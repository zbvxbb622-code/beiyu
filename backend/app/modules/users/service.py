import uuid
from datetime import datetime
from typing import Any, cast

from sqlalchemy.orm import InstrumentedAttribute
from sqlmodel import Session, delete, select

from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import (
    AiConversation,
    AiDailyQuota,
    AiMemory,
    AiMemorySource,
    AiMemoryTombstone,
    AiMessage,
    AiRequest,
    AiUsageLog,
    AuthSession,
    CellarItem,
    CommunityAuditLog,
    CommunityComment,
    CommunityCommentLike,
    CommunityPost,
    CommunityPostLike,
    CommunityReport,
    User,
    UserDevice,
    UserProfile,
    UserStatus,
)
from app.db.models.accounts import default_visibility, utc_now
from app.modules.ai.access import require_ai_access
from app.modules.ai.quota import next_reset, quota_snapshot
from app.modules.auth.schemas import AuthenticatedUser
from app.modules.auth.service import list_user_devices
from app.modules.cellar.service import (
    cellar_list_response,
    import_ingredients,
    list_cellar_items,
)
from app.modules.users.schemas import (
    AccountDevice,
    AccountSecurityResponse,
    AiAllowance,
    BootstrapResponse,
    FeatureFlags,
    LocalSyncRequest,
    PrivacySettingsPatch,
    PrivacySettingsResponse,
    UserProfilePatch,
    UserProfileResponse,
)


def _column(value: Any) -> InstrumentedAttribute[Any]:
    return cast("InstrumentedAttribute[Any]", value)


def get_user_profile(session: Session, user: User) -> UserProfile:
    profile = session.get(UserProfile, user.id)
    if profile is None:
        raise AppError(
            code="PROFILE_NOT_FOUND",
            message="用户资料不存在",
            status_code=404,
        )
    return profile


def profile_response(profile: UserProfile) -> UserProfileResponse:
    visibility = default_visibility() | profile.visibility
    return UserProfileResponse(
        nickname=profile.nickname,
        avatar_key=profile.avatar_key,
        avatar_uri=None,
        signature=profile.signature,
        city=profile.city,
        gender=profile.gender,
        birthday=profile.birthday,
        show_birthday_tag=visibility["showBirthdayTag"],
        show_age=visibility["showAge"],
        show_zodiac=visibility["showZodiac"],
        occupation=profile.occupation,
        school=profile.school,
    )


def privacy_response(profile: UserProfile) -> PrivacySettingsResponse:
    visibility = default_visibility() | profile.visibility
    return PrivacySettingsResponse(
        local_only_mode=visibility["localOnlyMode"],
        analytics_opt_in=visibility["analyticsOptIn"],
        sync_when_logged_in=visibility["syncWhenLoggedIn"],
    )


def update_profile(
    *,
    session: Session,
    user: User,
    patch: UserProfilePatch,
) -> UserProfile:
    profile = get_user_profile(session, user)
    values = patch.model_dump(exclude_unset=True, by_alias=False)
    visibility = default_visibility() | profile.visibility
    visibility_fields = {
        "show_birthday_tag": "showBirthdayTag",
        "show_age": "showAge",
        "show_zodiac": "showZodiac",
    }
    for field_name, value in values.items():
        if field_name in visibility_fields:
            if value is not None:
                visibility[visibility_fields[field_name]] = value
        else:
            setattr(profile, field_name, value)
    profile.visibility = visibility
    profile.updated_at = utc_now()
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


def update_privacy(
    *,
    session: Session,
    user: User,
    patch: PrivacySettingsPatch,
) -> UserProfile:
    profile = get_user_profile(session, user)
    visibility = default_visibility() | profile.visibility
    field_names = {
        "local_only_mode": "localOnlyMode",
        "analytics_opt_in": "analyticsOptIn",
        "sync_when_logged_in": "syncWhenLoggedIn",
    }
    for field_name, value in patch.model_dump(
        exclude_unset=True,
        by_alias=False,
    ).items():
        if value is not None:
            visibility[field_names[field_name]] = value
    profile.visibility = visibility
    profile.updated_at = utc_now()
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


def confirm_age(*, session: Session, user: User) -> User:
    if user.age_confirmed_at is None:
        user.age_confirmed_at = utc_now()
        user.updated_at = user.age_confirmed_at
        session.add(user)
        session.commit()
        session.refresh(user)
    return user


def bootstrap_ai_state(
    *,
    session: Session,
    user: User,
    settings: Settings,
    now: datetime,
) -> tuple[AiAllowance, bool]:
    try:
        require_ai_access(user, settings)
    except AppError as exc:
        if exc.code not in {
            "AI_ACCESS_SUSPENDED",
            "AGE_CONFIRMATION_REQUIRED",
            "AI_FEATURE_DISABLED",
        }:
            raise
        return (
            AiAllowance(
                daily_message_limit=0,
                messages_used_today=0,
                remaining=0,
                resets_at=next_reset(now),
            ),
            False,
        )

    quota = quota_snapshot(session, user.id, settings, now)
    return (
        AiAllowance(
            daily_message_limit=quota.daily_message_limit,
            messages_used_today=quota.messages_used_today,
            remaining=quota.remaining,
            resets_at=quota.resets_at,
        ),
        True,
    )


def bootstrap_response(
    *,
    session: Session,
    user: User,
    current_device: UserDevice,
    settings: Settings,
    now: datetime,
) -> BootstrapResponse:
    profile = get_user_profile(session, user)
    devices = list_user_devices(session=session, user=user)
    ai_allowance, ai_chat_enabled = bootstrap_ai_state(
        session=session,
        user=user,
        settings=settings,
        now=now,
    )
    return BootstrapResponse(
        user=AuthenticatedUser(
            id=user.id,
            phone_masked=user.phone_masked,
            status=user.status,
            age_confirmed=user.age_confirmed_at is not None,
            memory_enabled=user.memory_enabled,
            membership_level=user.membership_level,
        ),
        profile=profile_response(profile),
        privacy=privacy_response(profile),
        account_security=AccountSecurityResponse(
            phone=user.phone_masked,
            phone_verified=True,
            devices=[
                AccountDevice(
                    id=device.id,
                    name=device.device_name,
                    platform=device.platform,
                    last_active_at=device.last_active_at,
                    is_current=device.id == current_device.id,
                )
                for device in devices
            ],
        ),
        cellar=cellar_list_response(list_cellar_items(session=session, user=user)),
        ai=ai_allowance,
        feature_flags=FeatureFlags(ai_chat=ai_chat_enabled),
    )


def sync_local_state(
    *,
    session: Session,
    user: User,
    current_device: UserDevice,
    payload: LocalSyncRequest,
    settings: Settings,
    now: datetime,
) -> BootstrapResponse:
    profile = get_user_profile(session, user)

    if payload.profile is not None:
        local_values = payload.profile.model_dump(
            exclude_unset=True,
            by_alias=False,
        )
        local_values.pop("show_birthday_tag", None)
        local_values.pop("show_age", None)
        local_values.pop("show_zodiac", None)
        for field_name, local_value in local_values.items():
            cloud_value = getattr(profile, field_name)
            cloud_is_empty = cloud_value in (None, "")
            if field_name == "nickname":
                cloud_is_empty = cloud_value in {"游客调酒师", "测试账号"}
            if cloud_is_empty and local_value not in (None, ""):
                setattr(profile, field_name, local_value)

    if (
        payload.privacy_settings is not None
        and payload.privacy_settings.sync_when_logged_in is True
    ):
        visibility = default_visibility() | profile.visibility
        privacy_values = payload.privacy_settings.model_dump(
            exclude_unset=True,
            by_alias=False,
        )
        privacy_fields = {
            "local_only_mode": "localOnlyMode",
            "analytics_opt_in": "analyticsOptIn",
            "sync_when_logged_in": "syncWhenLoggedIn",
        }
        for field_name, value in privacy_values.items():
            if value is not None:
                visibility[privacy_fields[field_name]] = value
        profile.visibility = visibility

    profile.updated_at = now
    session.add(profile)
    if payload.age_verified and user.age_confirmed_at is None:
        user.age_confirmed_at = now
        user.updated_at = now
        session.add(user)

    import_ingredients(
        session=session,
        user=user,
        ingredient_ids=payload.cellar_ingredient_ids,
        commit=False,
    )
    session.commit()
    session.refresh(user)
    session.refresh(profile)
    return bootstrap_response(
        session=session,
        user=user,
        current_device=current_device,
        settings=settings,
        now=now,
    )


def _delete_rows(session: Session, statement: Any) -> None:
    for row in session.exec(statement).all():
        session.delete(row)


def _clear_account_ai_content(*, session: Session, user: User) -> None:
    conversations = session.exec(
        select(AiConversation).where(AiConversation.user_id == user.id)
    ).all()
    messages = session.exec(select(AiMessage).where(AiMessage.user_id == user.id)).all()
    conversation_ids = {conversation.id for conversation in conversations}
    message_ids = {message.id for message in messages}

    for request in session.exec(select(AiRequest).where(AiRequest.user_id == user.id)).all():
        request.conversation_id = None
        request.response_message_id = None
        session.add(request)

    for usage_log in session.exec(
        select(AiUsageLog).where(AiUsageLog.user_id == user.id)
    ).all():
        usage_log.conversation_id = None
        session.add(usage_log)

    memory_ids = {
        memory.id
        for memory in session.exec(select(AiMemory).where(AiMemory.user_id == user.id)).all()
    }
    memory_sources = session.exec(select(AiMemorySource)).all()
    for source in memory_sources:
        if (
            source.memory_id in memory_ids
            or source.conversation_id in conversation_ids
            or source.source_message_id in message_ids
        ):
            session.delete(source)

    _delete_rows(session, select(AiMemory).where(AiMemory.user_id == user.id))
    _delete_rows(
        session,
        select(AiMemoryTombstone).where(AiMemoryTombstone.user_id == user.id),
    )
    _delete_rows(session, select(AiDailyQuota).where(AiDailyQuota.user_id == user.id))
    session.exec(delete(AiMessage).where(_column(AiMessage.user_id) == user.id))
    session.exec(delete(AiConversation).where(_column(AiConversation.user_id) == user.id))


def _clear_account_community_content(*, session: Session, user: User) -> None:
    posts = session.exec(select(CommunityPost).where(CommunityPost.author_id == user.id)).all()
    comments = session.exec(
        select(CommunityComment).where(CommunityComment.author_id == user.id)
    ).all()
    post_ids = {post.id for post in posts}
    comment_ids = {comment.id for comment in comments}

    if post_ids:
        for comment in session.exec(select(CommunityComment)).all():
            if comment.post_id in post_ids:
                comment_ids.add(comment.id)

    post_likes_by_user = session.exec(
        select(CommunityPostLike).where(CommunityPostLike.user_id == user.id)
    ).all()
    for like in post_likes_by_user:
        if like.post_id not in post_ids:
            post = session.get(CommunityPost, like.post_id)
            if post is not None:
                post.like_count = max(0, post.like_count - 1)
                session.add(post)

    comment_likes_by_user = session.exec(
        select(CommunityCommentLike).where(CommunityCommentLike.user_id == user.id)
    ).all()
    for like in comment_likes_by_user:
        if like.comment_id not in comment_ids:
            comment = session.get(CommunityComment, like.comment_id)
            if comment is not None:
                comment.like_count = max(0, comment.like_count - 1)
                session.add(comment)

    for like in session.exec(select(CommunityPostLike)).all():
        if like.user_id == user.id or like.post_id in post_ids:
            session.delete(like)
    for like in session.exec(select(CommunityCommentLike)).all():
        if like.user_id == user.id or like.comment_id in comment_ids:
            session.delete(like)
    for report in session.exec(select(CommunityReport)).all():
        if (
            report.reporter_id == user.id
            or report.post_id in post_ids
            or report.comment_id in comment_ids
        ):
            session.delete(report)
    for audit_log in session.exec(select(CommunityAuditLog)).all():
        if (
            audit_log.actor_id == user.id
            or audit_log.post_id in post_ids
            or audit_log.comment_id in comment_ids
        ):
            session.delete(audit_log)
    for comment in session.exec(select(CommunityComment)).all():
        if comment.author_id == user.id or comment.post_id in post_ids:
            session.delete(comment)
    for post in posts:
        session.delete(post)


def delete_account(*, session: Session, user: User) -> None:
    now = utc_now()
    profile = get_user_profile(session, user)
    _clear_account_ai_content(session=session, user=user)
    _clear_account_community_content(session=session, user=user)

    user.status = UserStatus.DELETED
    user.phone_hash = f"deleted:{uuid.uuid4().hex}"
    user.phone_masked = "已注销"
    user.memory_enabled = False
    user.deleted_at = now
    user.anonymized_at = now
    user.updated_at = now
    session.add(user)

    profile.nickname = "已注销用户"
    profile.avatar_media_id = None
    profile.avatar_key = "avatarOne"
    profile.signature = ""
    profile.city = ""
    profile.gender = None
    profile.birthday = None
    profile.occupation = None
    profile.school = None
    profile.visibility = default_visibility()
    profile.updated_at = now
    session.add(profile)

    devices = session.exec(
        select(UserDevice).where(UserDevice.user_id == user.id)
    ).all()
    for device in devices:
        device.revoked_at = device.revoked_at or now
        device.updated_at = now
        session.add(device)

    auth_sessions = session.exec(
        select(AuthSession).where(AuthSession.user_id == user.id)
    ).all()
    for auth_session in auth_sessions:
        auth_session.revoked_at = auth_session.revoked_at or now
        auth_session.updated_at = now
        session.add(auth_session)

    cellar_items = session.exec(
        select(CellarItem).where(
            CellarItem.user_id == user.id,
            _column(CellarItem.deleted_at).is_(None),
        )
    ).all()
    for item in cellar_items:
        item.deleted_at = now
        item.updated_at = now
        session.add(item)

    session.commit()
