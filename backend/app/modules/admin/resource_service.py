from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.errors import AppError
from app.db.models import (
    Bar,
    ContentAction,
    ContentStatus,
    ContentType,
    ContentVersion,
    DrinkKnowledgeEntry,
    HomeBanner,
    HomeShortcut,
    Ingredient,
    Recipe,
    User,
)
from app.db.models.accounts import utc_now
from app.modules.admin.schemas import (
    AdminBannerResponse,
    AdminBarResponse,
    AdminIngredientResponse,
    AdminKnowledgeResponse,
    AdminShortcutResponse,
    BannerCreate,
    BannerPatch,
    BarCreate,
    BarPatch,
    IngredientCreate,
    IngredientPatch,
    KnowledgeCreate,
    KnowledgePatch,
    ShortcutCreate,
    ShortcutPatch,
)
from app.modules.content.repository import column
from app.modules.content.schemas import (
    ContentVersionListResponse,
    ContentVersionResponse,
)
from app.modules.content.service import bar_response, knowledge_response
from app.schemas.base import ApiModel

CreatePayload = (
    IngredientCreate
    | BarCreate
    | KnowledgeCreate
    | BannerCreate
    | ShortcutCreate
)
PatchPayload = (
    IngredientPatch
    | BarPatch
    | KnowledgePatch
    | BannerPatch
    | ShortcutPatch
)


@dataclass(frozen=True)
class ResourceConfig:
    model: type[Any]
    content_type: ContentType
    create_schema: type[ApiModel]
    response_builder: Callable[[Session, Any], ApiModel]
    nullable_fields: frozenset[str] = frozenset()
    image_required: bool = False


def _ingredient_response(_: Session, record: Ingredient) -> ApiModel:
    return AdminIngredientResponse(
        id=record.public_id,
        name=record.name,
        category=record.category,
        description=record.description,
        image_key=record.image_key,
        image_url=record.image_url,
        status=record.status.value,
        revision=record.revision,
    )


def _bar_response(_: Session, record: Bar) -> ApiModel:
    public = bar_response(record).model_dump(by_alias=False)
    return AdminBarResponse(
        **public,
        latitude=float(record.latitude) if record.latitude is not None else None,
        longitude=float(record.longitude) if record.longitude is not None else None,
        status=record.status.value,
        revision=record.revision,
    )


def _knowledge_response(
    session: Session,
    record: DrinkKnowledgeEntry,
) -> ApiModel:
    return AdminKnowledgeResponse(
        **knowledge_response(session, record).model_dump(by_alias=False),
        status=record.status.value,
        revision=record.revision,
    )


def _banner_response(_: Session, record: HomeBanner) -> ApiModel:
    return AdminBannerResponse.model_validate(
        {
            "public_id": record.public_id,
            "brand": record.brand,
            "title": record.title,
            "subtitle": record.subtitle,
            "script_label": record.script_label,
            "cta_label": record.cta_label,
            "target_route": record.target_route,
            "image_key": record.image_key,
            "image_url": record.image_url,
            "sort_order": record.sort_order,
            "starts_at": record.starts_at,
            "ends_at": record.ends_at,
            "status": record.status.value,
            "revision": record.revision,
        }
    )


def _shortcut_response(_: Session, record: HomeShortcut) -> ApiModel:
    return AdminShortcutResponse.model_validate(
        {
            "public_id": record.public_id,
            "title": record.title,
            "description": record.description,
            "icon": record.icon,
            "route": record.route,
            "sort_order": record.sort_order,
            "status": record.status.value,
            "revision": record.revision,
        }
    )


INGREDIENT_CONFIG = ResourceConfig(
    model=Ingredient,
    content_type=ContentType.INGREDIENT,
    create_schema=IngredientCreate,
    response_builder=_ingredient_response,
    nullable_fields=frozenset({"description", "image_key", "image_url"}),
)
BAR_CONFIG = ResourceConfig(
    model=Bar,
    content_type=ContentType.BAR,
    create_schema=BarCreate,
    response_builder=_bar_response,
    nullable_fields=frozenset(
        {"image_key", "image_url", "latitude", "longitude"}
    ),
    image_required=True,
)
KNOWLEDGE_CONFIG = ResourceConfig(
    model=DrinkKnowledgeEntry,
    content_type=ContentType.KNOWLEDGE,
    create_schema=KnowledgeCreate,
    response_builder=_knowledge_response,
    nullable_fields=frozenset({"recipe_id", "image_key", "image_url"}),
    image_required=True,
)
BANNER_CONFIG = ResourceConfig(
    model=HomeBanner,
    content_type=ContentType.BANNER,
    create_schema=BannerCreate,
    response_builder=_banner_response,
    nullable_fields=frozenset(
        {"image_key", "image_url", "starts_at", "ends_at"}
    ),
    image_required=True,
)
SHORTCUT_CONFIG = ResourceConfig(
    model=HomeShortcut,
    content_type=ContentType.SHORTCUT,
    create_schema=ShortcutCreate,
    response_builder=_shortcut_response,
)


def _not_found() -> AppError:
    return AppError(
        code="CONTENT_NOT_FOUND",
        message="内容不存在",
        status_code=404,
    )


def _revision_conflict(*, current_revision: int) -> AppError:
    return AppError(
        code="CONTENT_REVISION_CONFLICT",
        message="内容已更新，请刷新后重试",
        status_code=409,
        details={"currentRevision": current_revision},
    )


def _get_record(
    session: Session,
    *,
    config: ResourceConfig,
    public_id: str,
) -> Any:
    record = session.exec(
        select(config.model)
        .where(config.model.public_id == public_id)
        .with_for_update()
    ).first()
    if record is None:
        raise _not_found()
    return record


def _recipe_id(
    session: Session,
    *,
    public_id: str | None,
) -> Any:
    if public_id is None:
        return None
    recipe = session.exec(
        select(Recipe).where(Recipe.public_id == public_id)
    ).first()
    if recipe is None:
        raise AppError(
            code="UNKNOWN_RECIPE",
            message="关联酒谱不存在",
            status_code=422,
            details={"recipeId": public_id},
        )
    return recipe.id


def _payload_fields(
    session: Session,
    *,
    payload: BaseModel,
    exclude_unset: bool,
) -> dict[str, Any]:
    fields = payload.model_dump(
        mode="json",
        by_alias=False,
        exclude_unset=exclude_unset,
    )
    fields.pop("public_id", None)
    fields.pop("expected_revision", None)
    if "reviews" in fields:
        fields["featured_reviews"] = fields.pop("reviews")
    if "recipe_id" in fields:
        fields["recipe_id"] = _recipe_id(
            session,
            public_id=fields["recipe_id"],
        )
    for coordinate in ("latitude", "longitude"):
        value = fields.get(coordinate)
        if value is not None:
            fields[coordinate] = Decimal(str(value))
    return fields


def _response(
    session: Session,
    *,
    config: ResourceConfig,
    record: Any,
) -> ApiModel:
    return config.response_builder(session, record)


def _add_version(
    session: Session,
    *,
    config: ResourceConfig,
    record: Any,
    admin: User,
    action: ContentAction,
) -> None:
    session.flush()
    snapshot = _response(
        session,
        config=config,
        record=record,
    ).model_dump(mode="json", by_alias=True)
    session.add(
        ContentVersion(
            content_type=config.content_type,
            content_id=record.id,
            version_no=record.revision,
            snapshot=snapshot,
            action=action,
            created_by_admin_id=admin.id,
        )
    )


def list_resources(
    session: Session,
    *,
    config: ResourceConfig,
) -> list[ApiModel]:
    records = session.exec(
        select(config.model).order_by(column(config.model.public_id).asc())
    ).all()
    return [
        _response(session, config=config, record=record)
        for record in records
    ]


def create_resource(
    session: Session,
    *,
    config: ResourceConfig,
    payload: CreatePayload,
    admin: User,
) -> ApiModel:
    public_id = payload.public_id
    existing = session.exec(
        select(config.model).where(config.model.public_id == public_id)
    ).first()
    if existing is not None:
        raise AppError(
            code="CONTENT_ID_EXISTS",
            message="内容编号已存在",
            status_code=409,
        )
    now = utc_now()
    record = config.model(
        public_id=public_id,
        status=ContentStatus.DRAFT,
        revision=1,
        published_at=None,
        created_at=now,
        updated_at=now,
        **_payload_fields(
            session,
            payload=payload,
            exclude_unset=False,
        ),
    )
    session.add(record)
    _add_version(
        session,
        config=config,
        record=record,
        admin=admin,
        action=ContentAction.CREATE,
    )
    session.commit()
    session.refresh(record)
    return _response(session, config=config, record=record)


def patch_resource(
    session: Session,
    *,
    config: ResourceConfig,
    public_id: str,
    payload: PatchPayload,
    admin: User,
) -> ApiModel:
    record = _get_record(session, config=config, public_id=public_id)
    expected_revision = payload.expected_revision
    if record.revision != expected_revision:
        raise _revision_conflict(current_revision=record.revision)
    fields = _payload_fields(
        session,
        payload=payload,
        exclude_unset=True,
    )
    for field, value in fields.items():
        if value is None and field not in config.nullable_fields:
            raise AppError(
                code="INVALID_CONTENT_PATCH",
                message=f"{field} 不能为空",
                status_code=422,
            )
        setattr(record, field, value)
    record.status = ContentStatus.DRAFT
    record.published_at = None
    record.revision += 1
    record.updated_at = utc_now()
    session.add(record)
    _add_version(
        session,
        config=config,
        record=record,
        admin=admin,
        action=ContentAction.UPDATE,
    )
    session.commit()
    session.refresh(record)
    return _response(session, config=config, record=record)


def transition_resource(
    session: Session,
    *,
    config: ResourceConfig,
    public_id: str,
    expected_revision: int,
    admin: User,
    target_status: ContentStatus,
) -> ApiModel:
    record = _get_record(session, config=config, public_id=public_id)
    if record.revision != expected_revision:
        raise _revision_conflict(current_revision=record.revision)
    if (
        target_status is ContentStatus.PUBLISHED
        and config.image_required
        and not record.image_key
        and not record.image_url
    ):
        raise AppError(
            code="CONTENT_IMAGE_REQUIRED",
            message="发布前需要配置图片",
            status_code=422,
        )
    record.status = target_status
    record.revision += 1
    record.updated_at = utc_now()
    record.published_at = (
        record.updated_at if target_status is ContentStatus.PUBLISHED else None
    )
    session.add(record)
    _add_version(
        session,
        config=config,
        record=record,
        admin=admin,
        action=(
            ContentAction.PUBLISH
            if target_status is ContentStatus.PUBLISHED
            else ContentAction.ARCHIVE
        ),
    )
    session.commit()
    session.refresh(record)
    return _response(session, config=config, record=record)


def list_resource_versions(
    session: Session,
    *,
    config: ResourceConfig,
    public_id: str,
) -> ContentVersionListResponse:
    record = _get_record(session, config=config, public_id=public_id)
    versions = session.exec(
        select(ContentVersion)
        .where(
            ContentVersion.content_type == config.content_type,
            ContentVersion.content_id == record.id,
        )
        .order_by(column(ContentVersion.version_no).desc())
    ).all()
    return ContentVersionListResponse(
        items=[
            ContentVersionResponse(
                version_no=version.version_no,
                action=version.action.value,
                snapshot=version.snapshot,
                created_at=version.created_at,
            )
            for version in versions
        ]
    )


def rollback_resource(
    session: Session,
    *,
    config: ResourceConfig,
    public_id: str,
    expected_revision: int,
    version_no: int,
    admin: User,
) -> ApiModel:
    record = _get_record(session, config=config, public_id=public_id)
    if record.revision != expected_revision:
        raise _revision_conflict(current_revision=record.revision)
    version = session.exec(
        select(ContentVersion).where(
            ContentVersion.content_type == config.content_type,
            ContentVersion.content_id == record.id,
            ContentVersion.version_no == version_no,
        )
    ).first()
    if version is None:
        raise AppError(
            code="CONTENT_VERSION_NOT_FOUND",
            message="内容版本不存在",
            status_code=404,
        )
    restored = config.create_schema.model_validate(version.snapshot)
    fields = _payload_fields(
        session,
        payload=restored,
        exclude_unset=False,
    )
    for field, value in fields.items():
        setattr(record, field, value)
    record.status = ContentStatus.DRAFT
    record.published_at = None
    record.revision += 1
    record.updated_at = utc_now()
    session.add(record)
    _add_version(
        session,
        config=config,
        record=record,
        admin=admin,
        action=ContentAction.ROLLBACK,
    )
    session.commit()
    session.refresh(record)
    return _response(session, config=config, record=record)
