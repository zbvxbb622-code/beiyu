from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlmodel import Session

from app.db.models import CommunityFeedCategory
from app.db.session import get_session
from app.modules.admin.dependencies import AdminAuth
from app.modules.auth.dependencies import CurrentAuth
from app.modules.community.schemas import (
    CommunityAuditLogListResponse,
    CommunityCommentCreate,
    CommunityCommentResponse,
    CommunityModerationRequest,
    CommunityPostCreate,
    CommunityPostListResponse,
    CommunityPostResponse,
    CommunityReportCreate,
    CommunityReportListResponse,
    CommunityReportResponse,
)
from app.modules.community.service import (
    add_comment,
    create_post,
    delete_post,
    get_post,
    like_comment,
    like_post,
    list_audit_logs,
    list_posts,
    list_reports,
    moderate_comment,
    moderate_post,
    report_comment,
    report_post,
    unlike_comment,
    unlike_post,
)

router = APIRouter(prefix="/community", tags=["community"])
admin_router = APIRouter(prefix="/admin/community", tags=["admin-community"])
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


@router.delete(
    "/posts/{post_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_community_post(
    post_id: UUID,
    auth: CurrentAuth,
    session: SessionDep,
) -> None:
    delete_post(session, user=auth.user, post_id=post_id)


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
    "/posts/{post_id}/reports",
    response_model=CommunityReportResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_201_CREATED,
)
def report_community_post(
    post_id: UUID,
    payload: CommunityReportCreate,
    auth: CurrentAuth,
    session: SessionDep,
) -> CommunityReportResponse:
    return report_post(session, user=auth.user, post_id=post_id, payload=payload)


@router.post(
    "/comments/{comment_id}/reports",
    response_model=CommunityReportResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_201_CREATED,
)
def report_community_comment(
    comment_id: UUID,
    payload: CommunityReportCreate,
    auth: CurrentAuth,
    session: SessionDep,
) -> CommunityReportResponse:
    return report_comment(session, user=auth.user, comment_id=comment_id, payload=payload)


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


@admin_router.get(
    "/reports",
    response_model=CommunityReportListResponse,
    response_model_exclude_none=True,
)
def admin_community_reports(
    auth: AdminAuth,
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> CommunityReportListResponse:
    _ = auth.user.id
    return list_reports(session, limit=limit)


@admin_router.patch(
    "/posts/{post_id}/moderation",
    response_model=CommunityPostResponse,
    response_model_exclude_none=True,
)
def moderate_community_post(
    post_id: UUID,
    payload: CommunityModerationRequest,
    auth: AdminAuth,
    session: SessionDep,
) -> CommunityPostResponse:
    return moderate_post(session, admin=auth.user, post_id=post_id, payload=payload)


@admin_router.patch(
    "/comments/{comment_id}/moderation",
    response_model=CommunityCommentResponse,
    response_model_exclude_none=True,
)
def moderate_community_comment(
    comment_id: UUID,
    payload: CommunityModerationRequest,
    auth: AdminAuth,
    session: SessionDep,
) -> CommunityCommentResponse:
    return moderate_comment(session, admin=auth.user, comment_id=comment_id, payload=payload)


@admin_router.get(
    "/posts/{post_id}/audit-log",
    response_model=CommunityAuditLogListResponse,
    response_model_exclude_none=True,
)
def post_audit_log(
    post_id: UUID,
    auth: AdminAuth,
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> CommunityAuditLogListResponse:
    _ = auth.user.id
    return list_audit_logs(session, post_id=post_id, limit=limit)


@admin_router.get(
    "/comments/{comment_id}/audit-log",
    response_model=CommunityAuditLogListResponse,
    response_model_exclude_none=True,
)
def comment_audit_log(
    comment_id: UUID,
    auth: AdminAuth,
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> CommunityAuditLogListResponse:
    _ = auth.user.id
    return list_audit_logs(session, comment_id=comment_id, limit=limit)
