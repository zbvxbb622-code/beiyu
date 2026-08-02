from uuid import UUID

from sqlmodel import Session, col, select

from app.core.errors import AppError
from app.db.models import (
    CommunityComment,
    CommunityCommentLike,
    CommunityFeedCategory,
    CommunityPost,
    CommunityPostLike,
    CommunityPostVisibility,
    User,
    UserProfile,
)
from app.db.models.accounts import utc_now
from app.modules.community.schemas import (
    CommunityCommentCreate,
    CommunityCommentResponse,
    CommunityPostCreate,
    CommunityPostImage,
    CommunityPostListResponse,
    CommunityPostResponse,
)


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
        created_at=post.created_at,
    )


def _get_visible_post(session: Session, post_id: UUID, user: User) -> CommunityPost:
    post = session.get(CommunityPost, post_id)
    if post is None:
        raise _not_found()
    if post.visibility is CommunityPostVisibility.PRIVATE and post.author_id != user.id:
        raise _not_found()
    return post


def _get_visible_comment(session: Session, comment_id: UUID, user: User) -> CommunityComment:
    comment = session.get(CommunityComment, comment_id)
    if comment is None:
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
        if parent_comment is None or parent_comment.post_id != post.id:
            raise _comment_not_found()
    comment = CommunityComment(
        post_id=post.id,
        author_id=user.id,
        parent_comment_id=parent_comment_id,
        text=payload.text.strip(),
    )
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return _comment_response(session, comment, user=user)


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
