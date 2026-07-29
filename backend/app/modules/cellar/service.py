import uuid
from typing import Any, cast

from sqlalchemy.orm import InstrumentedAttribute
from sqlmodel import Session, select

from app.core.errors import AppError
from app.db.models import CellarItem, CellarItemSource, User
from app.db.models.accounts import utc_now
from app.modules.cellar.schemas import (
    CellarItemCreate,
    CellarItemPatch,
    CellarItemResponse,
    CellarListResponse,
)


def _column(value: Any) -> InstrumentedAttribute[Any]:
    return cast("InstrumentedAttribute[Any]", value)


def _clean_text(value: str) -> str:
    return " ".join(value.split())


def _normalize_custom_name(value: str) -> str:
    return _clean_text(value).casefold()


def cellar_item_response(item: CellarItem) -> CellarItemResponse:
    return CellarItemResponse(
        id=item.id,
        ingredient_id=item.ingredient_key,
        custom_name=item.custom_name,
        amount_label=item.amount_label,
        note=item.note,
        source=item.source,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def list_cellar_items(*, session: Session, user: User) -> list[CellarItem]:
    return list(
        session.exec(
            select(CellarItem)
            .where(
                CellarItem.user_id == user.id,
                _column(CellarItem.deleted_at).is_(None),
            )
            .order_by(_column(CellarItem.created_at).asc())
        ).all()
    )


def cellar_list_response(items: list[CellarItem]) -> CellarListResponse:
    return CellarListResponse(
        items=[cellar_item_response(item) for item in items],
    )


def _find_matching_item(
    *,
    session: Session,
    user: User,
    ingredient_id: str | None,
    normalized_custom_name: str | None,
) -> CellarItem | None:
    statement = select(CellarItem).where(CellarItem.user_id == user.id)
    if ingredient_id is not None:
        statement = statement.where(CellarItem.ingredient_key == ingredient_id)
    else:
        statement = statement.where(
            CellarItem.normalized_custom_name == normalized_custom_name
        )
    return session.exec(
        statement.order_by(_column(CellarItem.created_at).desc())
    ).first()


def add_cellar_item(
    *,
    session: Session,
    user: User,
    payload: CellarItemCreate,
    source: CellarItemSource = CellarItemSource.MANUAL,
    allow_existing: bool = False,
    commit: bool = True,
) -> CellarItem:
    ingredient_id = (
        _clean_text(payload.ingredient_id) if payload.ingredient_id else None
    )
    custom_name = _clean_text(payload.custom_name) if payload.custom_name else None
    normalized_custom_name = (
        _normalize_custom_name(custom_name) if custom_name else None
    )
    existing = _find_matching_item(
        session=session,
        user=user,
        ingredient_id=ingredient_id,
        normalized_custom_name=normalized_custom_name,
    )
    now = utc_now()
    if existing is not None and existing.deleted_at is None:
        if allow_existing:
            return existing
        raise AppError(
            code="CELLAR_ITEM_EXISTS",
            message="酒柜中已存在这项酒材",
            status_code=409,
        )

    if existing is None:
        item = CellarItem(
            user_id=user.id,
            ingredient_key=ingredient_id,
            custom_name=custom_name,
            normalized_custom_name=normalized_custom_name,
            amount_label=payload.amount_label,
            note=payload.note,
            source=source,
        )
    else:
        item = existing
        item.deleted_at = None
        item.custom_name = custom_name
        item.amount_label = payload.amount_label
        item.note = payload.note
        item.source = source
        item.updated_at = now
    session.add(item)
    if commit:
        session.commit()
        session.refresh(item)
    else:
        session.flush()
    return item


def get_owned_cellar_item(
    *,
    session: Session,
    user: User,
    item_id: uuid.UUID,
) -> CellarItem:
    item = session.exec(
        select(CellarItem).where(
            CellarItem.id == item_id,
            CellarItem.user_id == user.id,
            _column(CellarItem.deleted_at).is_(None),
        )
    ).first()
    if item is None:
        raise AppError(
            code="CELLAR_ITEM_NOT_FOUND",
            message="酒柜项目不存在",
            status_code=404,
        )
    return item


def update_cellar_item(
    *,
    session: Session,
    user: User,
    item_id: uuid.UUID,
    patch: CellarItemPatch,
) -> CellarItem:
    item = get_owned_cellar_item(session=session, user=user, item_id=item_id)
    for field_name, value in patch.model_dump(
        exclude_unset=True,
        by_alias=False,
    ).items():
        setattr(item, field_name, value)
    item.updated_at = utc_now()
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def delete_cellar_item(
    *,
    session: Session,
    user: User,
    item_id: uuid.UUID,
) -> None:
    item = get_owned_cellar_item(session=session, user=user, item_id=item_id)
    now = utc_now()
    item.deleted_at = now
    item.updated_at = now
    session.add(item)
    session.commit()


def import_ingredients(
    *,
    session: Session,
    user: User,
    ingredient_ids: list[str],
    commit: bool = True,
) -> list[CellarItem]:
    cleaned_ids = list(
        dict.fromkeys(
            cleaned for value in ingredient_ids if (cleaned := _clean_text(value))
        )
    )
    for ingredient_id in cleaned_ids:
        add_cellar_item(
            session=session,
            user=user,
            payload=CellarItemCreate(ingredient_id=ingredient_id),
            source=CellarItemSource.LOCAL_SYNC,
            allow_existing=True,
            commit=False,
        )
    if commit:
        session.commit()
    return list_cellar_items(session=session, user=user)
