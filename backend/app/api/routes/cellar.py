import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlmodel import Session

from app.core.errors import ErrorEnvelope
from app.db.session import get_session
from app.modules.auth.dependencies import CurrentAuth
from app.modules.cellar.schemas import (
    CellarBatchRequest,
    CellarItemCreate,
    CellarItemPatch,
    CellarItemResponse,
    CellarListResponse,
)
from app.modules.cellar.service import (
    add_cellar_item,
    cellar_item_response,
    cellar_list_response,
    delete_cellar_item,
    import_ingredients,
    list_cellar_items,
    update_cellar_item,
)

router = APIRouter(prefix="/cellar", tags=["cellar"])
SessionDep = Annotated[Session, Depends(get_session)]


@router.get("/items", response_model=CellarListResponse)
def items(session: SessionDep, auth: CurrentAuth) -> CellarListResponse:
    return cellar_list_response(list_cellar_items(session=session, user=auth.user))


@router.post(
    "/items",
    response_model=CellarItemResponse,
    status_code=status.HTTP_201_CREATED,
    responses={409: {"model": ErrorEnvelope}, 422: {"model": ErrorEnvelope}},
)
def create_item(
    payload: CellarItemCreate,
    session: SessionDep,
    auth: CurrentAuth,
) -> CellarItemResponse:
    return cellar_item_response(
        add_cellar_item(
            session=session,
            user=auth.user,
            payload=payload,
        )
    )


@router.patch(
    "/items/{item_id}",
    response_model=CellarItemResponse,
    responses={404: {"model": ErrorEnvelope}},
)
def patch_item(
    item_id: uuid.UUID,
    payload: CellarItemPatch,
    session: SessionDep,
    auth: CurrentAuth,
) -> CellarItemResponse:
    return cellar_item_response(
        update_cellar_item(
            session=session,
            user=auth.user,
            item_id=item_id,
            patch=payload,
        )
    )


@router.delete(
    "/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"model": ErrorEnvelope}},
)
def remove_item(
    item_id: uuid.UUID,
    session: SessionDep,
    auth: CurrentAuth,
) -> Response:
    delete_cellar_item(
        session=session,
        user=auth.user,
        item_id=item_id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/items/batch", response_model=CellarListResponse)
def batch_items(
    payload: CellarBatchRequest,
    session: SessionDep,
    auth: CurrentAuth,
) -> CellarListResponse:
    return cellar_list_response(
        import_ingredients(
            session=session,
            user=auth.user,
            ingredient_ids=payload.ingredient_ids,
        )
    )
