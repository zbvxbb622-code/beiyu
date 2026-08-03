from datetime import timedelta
from uuid import UUID

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.core.errors import AppError
from app.db.models import (
    CommunityAuditAction,
    CommunityAuditLog,
    CommunityComment,
    CommunityCommentLike,
    CommunityFeedCategory,
    CommunityModerationStatus,
    CommunityPost,
    CommunityPostLike,
    CommunityPostVisibility,
    CommunityReport,
    CommunityReportStatus,
    CommunityReportTargetType,
    User,
    UserProfile,
)
from app.db.models.accounts import utc_now
from app.modules.community.schemas import (
    CommunityAuditLogListResponse,
    CommunityAuditLogResponse,
    CommunityCommentCreate,
    CommunityCommentResponse,
    CommunityModerationRequest,
    CommunityPostCreate,
    CommunityPostImage,
    CommunityPostListResponse,
    CommunityPostResponse,
    CommunityReportCreate,
    CommunityReportListResponse,
    CommunityReportResponse,
)

COMMUNITY_REPORTS_PER_USER_HOUR = 10


def _not_found() -> AppError:
    return AppError(
        code="COMMUNITY_POST_NOT_FOUND",
        message="社区笔记不存在或不可见",
        status_code=404,
    )


def _comments_closed() -> AppError:
    return AppError(
        code="COMMUNITY_COMMENTS_CLOSED",
        message="作者已关闭评论",
        status_code=409,
    )


def _comment_not_found() -> AppError:
    return AppError(
        code="COMMUNITY_COMMENT_NOT_FOUND",
        message="社区评论不存在或不可见",
        status_code=404,
    )


def _duplicate_report() -> AppError:
    return AppError(
        code="COMMUNITY_REPORT_ALREADY_OPEN",
        message="你已提交过举报，等待审核处理",
        status_code=409,
    )


def _report_rate_limited() -> AppError:
    return AppError(
        code="COMMUNITY_REPORT_RATE_LIMITED",
        message="举报提交过于频繁，请稍后再试",
        status_code=429,
    )


def _moderation_not_found() -> AppError:
    return AppError(
        code="COMMUNITY_MODERATION_TARGET_NOT_FOUND",
        message="审核对象不存在",
        status_code=404,
    )


def _profile_for(session: Session, user_id: UUID) -> UserProfile | None:
    return session.get(UserProfile, user_id)


def _author_snapshot(session: Session, user_id: UUID) -> tuple[str, str]:
    profile = _profile_for(session, user_id)
    if profile is None:
        return "杯语用户", "avatarOne"
    return profile.nickname, profile.avatar_key


def _date(value) -> str:
    return value.date().isoformat()


def _comment_response(session: Session, comment: CommunityComment, *, user: User) -> CommunityCommentResponse:
    author_name, avatar_key = _author_snapshot(session, comment.author_id)
    liked_by_me = session.exec(
        select(CommunityCommentLike)
        .where(CommunityCommentLike.comment_id == comment.id)
        .where(CommunityCommentLike.user_id == user.id)
    ).first() is not None
    return CommunityCommentResponse(
        id=str(comment.id),
        author_id=str(comment.author_id),
        author_name=author_name,
        author_avatar_key=avatar_key,
        parent_comment_id=str(comment.parent_comment_id) if comment.parent_comment_id else None,
        text=comment.text,
        date=_date(comment.created_at),
        likes=comment.like_count,
        liked_by_me=liked_by_me,
        moderation_status=comment.moderation_status.value,
        created_at=comment.created_at,
    )


def _post_response(
    session: Session,
    post: CommunityPost,
    *,
    user: User,
    include_comments: bool,
) -> CommunityPostResponse:
    author_name, avatar_key = _author_snapshot(session, post.author_id)
    liked_by_me = session.exec(
        select(CommunityPostLike)
        .where(CommunityPostLike.post_id == post.id)
        .where(CommunityPostLike.user_id == user.id)
    ).first() is not None
    comments = (
        session.exec(
            select(CommunityComment)
            .where(CommunityComment.post_id == post.id)
            .where(CommunityComment.moderation_status == CommunityModerationStatus.APPROVED)
            .order_by(col(CommunityComment.created_at), col(CommunityComment.id))
        ).all()
        if include_comments
        else []
    )
    return CommunityPostResponse(
        id=str(post.id),
        category=post.category.value,
        title=post.title,
        author_id=str(post.author_id),
        author_name=author_name,
        author_avatar_key=avatar_key,
        image_key=post.image_key,
        body=post.body,
        date=_date(post.created_at),
        likes=post.like_count,
        liked_by_me=liked_by_me,
        comments=[_comment_response(session, comment, user=user) for comment in comments],
        venue_id=post.venue_id,
        images=[CommunityPostImage.model_validate(image) for image in post.images],
        topics=post.topics,
        visibility=post.visibility.value,
        allow_comments=post.allow_comments,
        moderation_status=post.moderation_status.value,
        created_at=post.created_at,
    )


def _get_visible_post(session: Session, post_id: UUID, user: User) -> CommunityPost:
    post = session.get(CommunityPost, post_id)
    if post is None:
        raise _not_found()
    if post.moderation_status is not CommunityModerationStatus.APPROVED:
        raise _not_found()
    if post.visibility is CommunityPostVisibility.PRIVATE and post.author_id != user.id:
        raise _not_found()
    return post


def _get_visible_comment(session: Session, comment_id: UUID, user: User) -> CommunityComment:
    comment = session.get(CommunityComment, comment_id)
    if comment is None:
        raise _comment_not_found()
    if comment.moderation_status is not CommunityModerationStatus.APPROVED:
        raise _comment_not_found()
    _get_visible_post(session, comment.post_id, user)
    return comment


def list_posts(
    session: Session,
    *,
    user: User,
    category: CommunityFeedCategory | None = None,
    limit: int = 50,
) -> CommunityPostListResponse:
    _ = user.id
    statement = (
        select(CommunityPost)
        .where(CommunityPost.visibility == CommunityPostVisibility.PUBLIC)
        .where(CommunityPost.moderation_status == CommunityModerationStatus.APPROVED)
        .order_by(col(CommunityPost.created_at).desc(), col(CommunityPost.id).desc())
        .limit(limit)
    )
    if category is not None:
        if category is CommunityFeedCategory.FOLLOWING:
            statement = statement.where(
                col(CommunityPost.category).in_([
                    CommunityFeedCategory.FOLLOWING,
                    CommunityFeedCategory.RECOMMENDED,
                ])
            )
        else:
            statement = statement.where(CommunityPost.category == category)
    posts = session.exec(statement).all()
    return CommunityPostListResponse(
        items=[
            _post_response(session, post, user=user, include_comments=True)
            for post in posts
        ]
    )


def get_post(session: Session, *, user: User, post_id: UUID) -> CommunityPostResponse:
    post = _get_visible_post(session, post_id, user)
    return _post_response(session, post, user=user, include_comments=True)


def delete_post(session: Session, *, user: User, post_id: UUID) -> None:
    post = session.get(CommunityPost, post_id)
    if post is None or post.author_id != user.id:
        raise _not_found()
    session.delete(post)
    session.commit()


def create_post(
    session: Session,
    *,
    user: User,
    payload: CommunityPostCreate,
) -> CommunityPostResponse:
    images = [image.model_dump(mode="json", by_alias=True, exclude_none=True) for image in payload.images]
    first_asset = next((image.asset_key for image in payload.images if image.kind == "asset" and image.asset_key), None)
    image_key = payload.image_key or first_asset or "barInterior"
    now = utc_now()
    post = CommunityPost(
        author_id=user.id,
        category=CommunityFeedCategory(payload.category),
        title=payload.title.strip(),
        body=payload.body.strip(),
        image_key=image_key,
        images=images,
        topics=payload.topics,
        venue_id=payload.venue_id,
        visibility=CommunityPostVisibility(payload.visibility),
        allow_comments=payload.allow_comments,
        created_at=now,
        updated_at=now,
    )
    session.add(post)
    session.commit()
    session.refresh(post)
    return _post_response(session, post, user=user, include_comments=True)


def add_comment(
    session: Session,
    *,
    user: User,
    post_id: UUID,
    payload: CommunityCommentCreate,
) -> CommunityCommentResponse:
    post = _get_visible_post(session, post_id, user)
    if not post.allow_comments:
        raise _comments_closed()
    parent_comment_id = payload.parent_comment_id
    if parent_comment_id is not None:
        parent_comment = session.get(CommunityComment, parent_comment_id)
        if (
            parent_comment is None
            or parent_comment.post_id != post.id
            or parent_comment.moderation_status is not CommunityModerationStatus.APPROVED
        ):
            raise _comment_not_found()
    comment = CommunityComment(
        post_id=post.id,
        author_id=user.id,
        parent_comment_id=parent_comment_id,
        text=payload.text,
    )
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return _comment_response(session, comment, user=user)


def _report_response(report: CommunityReport) -> CommunityReportResponse:
    return CommunityReportResponse(
        id=str(report.id),
        reporter_id=str(report.reporter_id),
        target_type=report.target_type.value,
        post_id=str(report.post_id) if report.post_id else None,
        comment_id=str(report.comment_id) if report.comment_id else None,
        reason=report.reason,
        detail=report.detail,
        status=report.status.value,
        created_at=report.created_at,
    )


def _audit_response(audit: CommunityAuditLog) -> CommunityAuditLogResponse:
    return CommunityAuditLogResponse(
        id=str(audit.id),
        actor_id=str(audit.actor_id),
        target_type=audit.target_type.value,
        post_id=str(audit.post_id) if audit.post_id else None,
        comment_id=str(audit.comment_id) if audit.comment_id else None,
        action=audit.action.value,
        note=audit.note,
        created_at=audit.created_at,
    )


def _ensure_report_rate_limit(session: Session, *, user: User) -> None:
    cutoff = utc_now() - timedelta(hours=1)
    count = session.exec(
        select(func.count())
        .select_from(CommunityReport)
        .where(CommunityReport.reporter_id == user.id)
        .where(CommunityReport.created_at > cutoff)
    ).one()
    if count >= COMMUNITY_REPORTS_PER_USER_HOUR:
        raise _report_rate_limited()


def report_post(
    session: Session,
    *,
    user: User,
    post_id: UUID,
    payload: CommunityReportCreate,
) -> CommunityReportResponse:
    post = _get_visible_post(session, post_id, user)
    _ensure_report_rate_limit(session, user=user)
    existing = session.exec(
        select(CommunityReport)
        .where(CommunityReport.reporter_id == user.id)
        .where(CommunityReport.target_type == CommunityReportTargetType.POST)
        .where(CommunityReport.post_id == post.id)
        .where(CommunityReport.status == CommunityReportStatus.OPEN)
    ).first()
    if existing is not None:
        raise _duplicate_report()
    report = CommunityReport(
        reporter_id=user.id,
        target_type=CommunityReportTargetType.POST,
        post_id=post.id,
        reason=payload.reason,
        detail=payload.detail,
    )
    session.add(report)
    session.add(CommunityAuditLog(
        actor_id=user.id,
        target_type=CommunityReportTargetType.POST,
        post_id=post.id,
        action=CommunityAuditAction.REPORT_POST,
        note=payload.reason,
    ))
    session.commit()
    session.refresh(report)
    return _report_response(report)


def report_comment(
    session: Session,
    *,
    user: User,
    comment_id: UUID,
    payload: CommunityReportCreate,
) -> CommunityReportResponse:
    comment = _get_visible_comment(session, comment_id, user)
    if comment.moderation_status is not CommunityModerationStatus.APPROVED:
        raise _comment_not_found()
    _ensure_report_rate_limit(session, user=user)
    existing = session.exec(
        select(CommunityReport)
        .where(CommunityReport.reporter_id == user.id)
        .where(CommunityReport.target_type == CommunityReportTargetType.COMMENT)
        .where(CommunityReport.comment_id == comment.id)
        .where(CommunityReport.status == CommunityReportStatus.OPEN)
    ).first()
    if existing is not None:
        raise _duplicate_report()
    report = CommunityReport(
        reporter_id=user.id,
        target_type=CommunityReportTargetType.COMMENT,
        post_id=comment.post_id,
        comment_id=comment.id,
        reason=payload.reason,
        detail=payload.detail,
    )
    session.add(report)
    session.add(CommunityAuditLog(
        actor_id=user.id,
        target_type=CommunityReportTargetType.COMMENT,
        post_id=comment.post_id,
        comment_id=comment.id,
        action=CommunityAuditAction.REPORT_COMMENT,
        note=payload.reason,
    ))
    session.commit()
    session.refresh(report)
    return _report_response(report)


def list_reports(session: Session, *, limit: int = 100) -> CommunityReportListResponse:
    reports = session.exec(
        select(CommunityReport)
        .order_by(col(CommunityReport.created_at).desc(), col(CommunityReport.id).desc())
        .limit(limit)
    ).all()
    return CommunityReportListResponse(items=[_report_response(report) for report in reports])


def _moderation_action(
    *,
    target_type: CommunityReportTargetType,
    status: CommunityModerationStatus,
) -> CommunityAuditAction:
    if target_type is CommunityReportTargetType.POST:
        if status is CommunityModerationStatus.APPROVED:
            return CommunityAuditAction.APPROVE_POST
        if status is CommunityModerationStatus.HIDDEN:
            return CommunityAuditAction.HIDE_POST
        return CommunityAuditAction.REJECT_POST
    if status is CommunityModerationStatus.APPROVED:
        return CommunityAuditAction.APPROVE_COMMENT
    if status is CommunityModerationStatus.HIDDEN:
        return CommunityAuditAction.HIDE_COMMENT
    return CommunityAuditAction.REJECT_COMMENT


def moderate_post(
    session: Session,
    *,
    admin: User,
    post_id: UUID,
    payload: CommunityModerationRequest,
) -> CommunityPostResponse:
    post = session.get(CommunityPost, post_id)
    if post is None:
        raise _moderation_not_found()
    status = CommunityModerationStatus(payload.status)
    post.moderation_status = status
    post.moderation_note = payload.note
    post.updated_at = utc_now()
    session.add(post)
    now = utc_now()
    for report in session.exec(
        select(CommunityReport)
        .where(CommunityReport.target_type == CommunityReportTargetType.POST)
        .where(CommunityReport.post_id == post.id)
        .where(CommunityReport.status == CommunityReportStatus.OPEN)
    ).all():
        report.status = CommunityReportStatus.RESOLVED
        report.resolved_at = now
        report.resolved_by = admin.id
        session.add(report)
    session.add(CommunityAuditLog(
        actor_id=admin.id,
        target_type=CommunityReportTargetType.POST,
        post_id=post.id,
        action=_moderation_action(target_type=CommunityReportTargetType.POST, status=status),
        note=payload.note,
    ))
    session.commit()
    session.refresh(post)
    return _post_response(session, post, user=admin, include_comments=True)


def moderate_comment(
    session: Session,
    *,
    admin: User,
    comment_id: UUID,
    payload: CommunityModerationRequest,
) -> CommunityCommentResponse:
    comment = session.get(CommunityComment, comment_id)
    if comment is None:
        raise _moderation_not_found()
    status = CommunityModerationStatus(payload.status)
    comment.moderation_status = status
    comment.moderation_note = payload.note
    session.add(comment)
    now = utc_now()
    for report in session.exec(
        select(CommunityReport)
        .where(CommunityReport.target_type == CommunityReportTargetType.COMMENT)
        .where(CommunityReport.comment_id == comment.id)
        .where(CommunityReport.status == CommunityReportStatus.OPEN)
    ).all():
        report.status = CommunityReportStatus.RESOLVED
        report.resolved_at = now
        report.resolved_by = admin.id
        session.add(report)
    session.add(CommunityAuditLog(
        actor_id=admin.id,
        target_type=CommunityReportTargetType.COMMENT,
        post_id=comment.post_id,
        comment_id=comment.id,
        action=_moderation_action(target_type=CommunityReportTargetType.COMMENT, status=status),
        note=payload.note,
    ))
    session.commit()
    session.refresh(comment)
    return _comment_response(session, comment, user=admin)


def list_audit_logs(
    session: Session,
    *,
    post_id: UUID | None = None,
    comment_id: UUID | None = None,
    limit: int = 100,
) -> CommunityAuditLogListResponse:
    statement = select(CommunityAuditLog)
    if post_id is not None:
        statement = statement.where(CommunityAuditLog.post_id == post_id)
    if comment_id is not None:
        statement = statement.where(CommunityAuditLog.comment_id == comment_id)
    logs = session.exec(
        statement.order_by(col(CommunityAuditLog.created_at), col(CommunityAuditLog.id)).limit(limit)
    ).all()
    return CommunityAuditLogListResponse(items=[_audit_response(log) for log in logs])


def like_comment(session: Session, *, user: User, comment_id: UUID) -> CommunityCommentResponse:
    comment = _get_visible_comment(session, comment_id, user)
    existing = session.exec(
        select(CommunityCommentLike)
        .where(CommunityCommentLike.comment_id == comment.id)
        .where(CommunityCommentLike.user_id == user.id)
    ).first()
    if existing is None:
        session.add(CommunityCommentLike(comment_id=comment.id, user_id=user.id))
        comment.like_count += 1
        session.add(comment)
        session.commit()
        session.refresh(comment)
    return _comment_response(session, comment, user=user)


def unlike_comment(session: Session, *, user: User, comment_id: UUID) -> CommunityCommentResponse:
    comment = _get_visible_comment(session, comment_id, user)
    existing = session.exec(
        select(CommunityCommentLike)
        .where(CommunityCommentLike.comment_id == comment.id)
        .where(CommunityCommentLike.user_id == user.id)
    ).first()
    if existing is not None:
        session.delete(existing)
        comment.like_count = max(comment.like_count - 1, 0)
        session.add(comment)
        session.commit()
        session.refresh(comment)
    return _comment_response(session, comment, user=user)


def like_post(session: Session, *, user: User, post_id: UUID) -> CommunityPostResponse:
    post = _get_visible_post(session, post_id, user)
    existing = session.exec(
        select(CommunityPostLike)
        .where(CommunityPostLike.post_id == post.id)
        .where(CommunityPostLike.user_id == user.id)
    ).first()
    if existing is None:
        session.add(CommunityPostLike(post_id=post.id, user_id=user.id))
        post.like_count += 1
        post.updated_at = utc_now()
        session.add(post)
        session.commit()
        session.refresh(post)
    return _post_response(session, post, user=user, include_comments=True)


def unlike_post(session: Session, *, user: User, post_id: UUID) -> CommunityPostResponse:
    post = _get_visible_post(session, post_id, user)
    existing = session.exec(
        select(CommunityPostLike)
        .where(CommunityPostLike.post_id == post.id)
        .where(CommunityPostLike.user_id == user.id)
    ).first()
    if existing is not None:
        session.delete(existing)
        post.like_count = max(post.like_count - 1, 0)
        post.updated_at = utc_now()
        session.add(post)
        session.commit()
        session.refresh(post)
    return _post_response(session, post, user=user, include_comments=True)
