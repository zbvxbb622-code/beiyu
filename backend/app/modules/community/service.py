from uuid import UUID

from sqlmodel import Session, col, select

from app.core.errors import AppError
from app.db.models import (
    CommunityComment,
    CommunityFeedCategory,
    CommunityPost,
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


def _profile_for(session: Session, user_id: UUID) -> UserProfile | None:
    return session.get(UserProfile, user_id)


def _author_snapshot(session: Session, user_id: UUID) -> tuple[str, str]:
    profile = _profile_for(session, user_id)
    if profile is None:
        return "杯语用户", "avatarOne"
    return profile.nickname, profile.avatar_key


def _date(value) -> str:
    return value.date().isoformat()


def _comment_response(session: Session, comment: CommunityComment) -> CommunityCommentResponse:
    author_name, avatar_key = _author_snapshot(session, comment.author_id)
    return CommunityCommentResponse(
        id=str(comment.id),
        author_id=str(comment.author_id),
        author_name=author_name,
        author_avatar_key=avatar_key,
        text=comment.text,
        date=_date(comment.created_at),
        created_at=comment.created_at,
    )


def _post_response(
    session: Session,
    post: CommunityPost,
    *,
    include_comments: bool,
) -> CommunityPostResponse:
    author_name, avatar_key = _author_snapshot(session, post.author_id)
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
        comments=[_comment_response(session, comment) for comment in comments],
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
            _post_response(session, post, include_comments=True)
            for post in posts
        ]
    )


def get_post(session: Session, *, user: User, post_id: UUID) -> CommunityPostResponse:
    post = _get_visible_post(session, post_id, user)
    return _post_response(session, post, include_comments=True)


def create_post(
    session: Session,
    *,
    user: User,
    payload: CommunityPostCreate,
) -> CommunityPostResponse:
    images = [image.model_dump(mode="json", by_alias=True) for image in payload.images]
    image_key = payload.image_key or (payload.images[0].asset_key if payload.images else "barInterior")
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
    return _post_response(session, post, include_comments=True)


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
    comment = CommunityComment(
        post_id=post.id,
        author_id=user.id,
        text=payload.text.strip(),
    )
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return _comment_response(session, comment)
