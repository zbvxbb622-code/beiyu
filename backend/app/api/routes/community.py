from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlmodel import Session

from app.db.models import CommunityFeedCategory
from app.db.session import get_session
from app.modules.auth.dependencies import CurrentAuth
from app.modules.community.schemas import (
    CommunityCommentCreate,
    CommunityCommentResponse,
    CommunityPostCreate,
    CommunityPostListResponse,
    CommunityPostResponse,
)
from app.modules.community.service import (
    add_comment,
    create_post,
    get_post,
    like_comment,
    like_post,
    list_posts,
    unlike_comment,
    unlike_post,
)

router = APIRouter(prefix="/community", tags=["community"])
SessionDep = Annotated[Session, Depends(get_session)]


@router.get(
    "/posts",
    response_model=CommunityPostListResponse,
    response_model_exclude_none=True,
)
def community_posts(
    auth: CurrentAuth,
    session: SessionDep,
    category: Annotated[CommunityFeedCategory | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> CommunityPostListResponse:
    return list_posts(session, user=auth.user, category=category, limit=limit)


@router.post(
    "/posts",
    response_model=CommunityPostResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_201_CREATED,
)
def create_community_post(
    payload: CommunityPostCreate,
    auth: CurrentAuth,
    session: SessionDep,
) -> CommunityPostResponse:
    return create_post(session, user=auth.user, payload=payload)


@router.get(
    "/posts/{post_id}",
    response_model=CommunityPostResponse,
    response_model_exclude_none=True,
)
def community_post_detail(
    post_id: UUID,
    auth: CurrentAuth,
    session: SessionDep,
) -> CommunityPostResponse:
    return get_post(session, user=auth.user, post_id=post_id)


@router.post(
    "/posts/{post_id}/like",
    response_model=CommunityPostResponse,
    response_model_exclude_none=True,
)
def like_community_post(
    post_id: UUID,
    auth: CurrentAuth,
    session: SessionDep,
) -> CommunityPostResponse:
    return like_post(session, user=auth.user, post_id=post_id)


@router.delete(
    "/posts/{post_id}/like",
    response_model=CommunityPostResponse,
    response_model_exclude_none=True,
)
def unlike_community_post(
    post_id: UUID,
    auth: CurrentAuth,
    session: SessionDep,
) -> CommunityPostResponse:
    return unlike_post(session, user=auth.user, post_id=post_id)


@router.post(
    "/posts/{post_id}/comments",
    response_model=CommunityCommentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_community_comment(
    post_id: UUID,
    payload: CommunityCommentCreate,
    auth: CurrentAuth,
    session: SessionDep,
) -> CommunityCommentResponse:
    return add_comment(session, user=auth.user, post_id=post_id, payload=payload)


@router.post(
    "/comments/{comment_id}/like",
    response_model=CommunityCommentResponse,
    response_model_exclude_none=True,
)
def like_community_comment(
    comment_id: UUID,
    auth: CurrentAuth,
    session: SessionDep,
) -> CommunityCommentResponse:
    return like_comment(session, user=auth.user, comment_id=comment_id)


@router.delete(
    "/comments/{comment_id}/like",
    response_model=CommunityCommentResponse,
    response_model_exclude_none=True,
)
def unlike_community_comment(
    comment_id: UUID,
    auth: CurrentAuth,
    session: SessionDep,
) -> CommunityCommentResponse:
    return unlike_comment(session, user=auth.user, comment_id=comment_id)
