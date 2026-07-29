from typing import Annotated, cast

from fastapi import APIRouter, Depends, status
from sqlmodel import Session, select

from app.db.models import ContentStatus, Recipe
from app.db.session import get_session
from app.modules.admin.content_service import (
    create_recipe,
    list_recipe_versions,
    patch_recipe,
    rollback_recipe,
    transition_recipe,
)
from app.modules.admin.dependencies import AdminAuth
from app.modules.admin.resource_service import (
    BANNER_CONFIG,
    BAR_CONFIG,
    INGREDIENT_CONFIG,
    KNOWLEDGE_CONFIG,
    SHORTCUT_CONFIG,
    ResourceConfig,
    create_resource,
    list_resource_versions,
    list_resources,
    patch_resource,
    rollback_resource,
    transition_resource,
)
from app.modules.admin.schemas import (
    AdminBannerListResponse,
    AdminBannerResponse,
    AdminBarListResponse,
    AdminBarResponse,
    AdminIngredientListResponse,
    AdminIngredientResponse,
    AdminKnowledgeListResponse,
    AdminKnowledgeResponse,
    AdminShortcutListResponse,
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
    AdminRecipeListResponse,
    AdminRecipeResponse,
    ContentVersionListResponse,
    RecipeCreate,
    RecipePatch,
    RevisionRequest,
    RollbackRequest,
)
from app.modules.content.service import recipe_response

router = APIRouter(prefix="/admin", tags=["admin-content"])
SessionDep = Annotated[Session, Depends(get_session)]


def _publish_resource(
    session: Session,
    *,
    config: ResourceConfig,
    public_id: str,
    payload: RevisionRequest,
    auth: AdminAuth,
) -> object:
    return transition_resource(
        session,
        config=config,
        public_id=public_id,
        expected_revision=payload.expected_revision,
        admin=auth.user,
        target_status=ContentStatus.PUBLISHED,
    )


def _archive_resource(
    session: Session,
    *,
    config: ResourceConfig,
    public_id: str,
    payload: RevisionRequest,
    auth: AdminAuth,
) -> object:
    return transition_resource(
        session,
        config=config,
        public_id=public_id,
        expected_revision=payload.expected_revision,
        admin=auth.user,
        target_status=ContentStatus.ARCHIVED,
    )


def _rollback_resource(
    session: Session,
    *,
    config: ResourceConfig,
    public_id: str,
    payload: RollbackRequest,
    auth: AdminAuth,
) -> object:
    return rollback_resource(
        session,
        config=config,
        public_id=public_id,
        expected_revision=payload.expected_revision,
        version_no=payload.version_no,
        admin=auth.user,
    )


@router.get("/recipes", response_model=AdminRecipeListResponse)
def admin_recipes(
    session: SessionDep,
    _auth: AdminAuth,
) -> AdminRecipeListResponse:
    recipes = session.exec(
        select(Recipe).order_by(column(Recipe.public_id).asc())
    ).all()
    return AdminRecipeListResponse(
        items=[
            AdminRecipeResponse(
                **recipe_response(session, recipe).model_dump(),
                status=recipe.status.value,
                revision=recipe.revision,
            )
            for recipe in recipes
        ]
    )


@router.post(
    "/recipes",
    response_model=AdminRecipeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_admin_recipe(
    payload: RecipeCreate,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminRecipeResponse:
    return create_recipe(session, payload=payload, admin=auth.user)


@router.patch("/recipes/{public_id}", response_model=AdminRecipeResponse)
def patch_admin_recipe(
    public_id: str,
    payload: RecipePatch,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminRecipeResponse:
    return patch_recipe(
        session,
        public_id=public_id,
        payload=payload,
        admin=auth.user,
    )


@router.post(
    "/recipes/{public_id}/publish",
    response_model=AdminRecipeResponse,
)
def publish_admin_recipe(
    public_id: str,
    payload: RevisionRequest,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminRecipeResponse:
    return transition_recipe(
        session,
        public_id=public_id,
        expected_revision=payload.expected_revision,
        admin=auth.user,
        target_status=ContentStatus.PUBLISHED,
    )


@router.post(
    "/recipes/{public_id}/archive",
    response_model=AdminRecipeResponse,
)
def archive_admin_recipe(
    public_id: str,
    payload: RevisionRequest,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminRecipeResponse:
    return transition_recipe(
        session,
        public_id=public_id,
        expected_revision=payload.expected_revision,
        admin=auth.user,
        target_status=ContentStatus.ARCHIVED,
    )


@router.get(
    "/recipes/{public_id}/versions",
    response_model=ContentVersionListResponse,
)
def admin_recipe_versions(
    public_id: str,
    session: SessionDep,
    _auth: AdminAuth,
) -> ContentVersionListResponse:
    return list_recipe_versions(session, public_id=public_id)


@router.post(
    "/recipes/{public_id}/rollback",
    response_model=AdminRecipeResponse,
)
def rollback_admin_recipe(
    public_id: str,
    payload: RollbackRequest,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminRecipeResponse:
    return rollback_recipe(
        session,
        public_id=public_id,
        expected_revision=payload.expected_revision,
        version_no=payload.version_no,
        admin=auth.user,
    )


@router.get("/ingredients", response_model=AdminIngredientListResponse)
def admin_ingredients(
    session: SessionDep,
    _auth: AdminAuth,
) -> AdminIngredientListResponse:
    return AdminIngredientListResponse(
        items=cast(
            "list[AdminIngredientResponse]",
            list_resources(session, config=INGREDIENT_CONFIG),
        )
    )


@router.post(
    "/ingredients",
    response_model=AdminIngredientResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_admin_ingredient(
    payload: IngredientCreate,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminIngredientResponse:
    return cast(
        "AdminIngredientResponse",
        create_resource(
            session,
            config=INGREDIENT_CONFIG,
            payload=payload,
            admin=auth.user,
        ),
    )


@router.patch(
    "/ingredients/{public_id}",
    response_model=AdminIngredientResponse,
)
def patch_admin_ingredient(
    public_id: str,
    payload: IngredientPatch,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminIngredientResponse:
    return cast(
        "AdminIngredientResponse",
        patch_resource(
            session,
            config=INGREDIENT_CONFIG,
            public_id=public_id,
            payload=payload,
            admin=auth.user,
        ),
    )


@router.post(
    "/ingredients/{public_id}/publish",
    response_model=AdminIngredientResponse,
)
def publish_admin_ingredient(
    public_id: str,
    payload: RevisionRequest,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminIngredientResponse:
    return cast(
        "AdminIngredientResponse",
        _publish_resource(
            session,
            config=INGREDIENT_CONFIG,
            public_id=public_id,
            payload=payload,
            auth=auth,
        ),
    )


@router.post(
    "/ingredients/{public_id}/archive",
    response_model=AdminIngredientResponse,
)
def archive_admin_ingredient(
    public_id: str,
    payload: RevisionRequest,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminIngredientResponse:
    return cast(
        "AdminIngredientResponse",
        _archive_resource(
            session,
            config=INGREDIENT_CONFIG,
            public_id=public_id,
            payload=payload,
            auth=auth,
        ),
    )


@router.get(
    "/ingredients/{public_id}/versions",
    response_model=ContentVersionListResponse,
)
def admin_ingredient_versions(
    public_id: str,
    session: SessionDep,
    _auth: AdminAuth,
) -> ContentVersionListResponse:
    return list_resource_versions(
        session,
        config=INGREDIENT_CONFIG,
        public_id=public_id,
    )


@router.post(
    "/ingredients/{public_id}/rollback",
    response_model=AdminIngredientResponse,
)
def rollback_admin_ingredient(
    public_id: str,
    payload: RollbackRequest,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminIngredientResponse:
    return cast(
        "AdminIngredientResponse",
        _rollback_resource(
            session,
            config=INGREDIENT_CONFIG,
            public_id=public_id,
            payload=payload,
            auth=auth,
        ),
    )


@router.get("/bars", response_model=AdminBarListResponse)
def admin_bars(
    session: SessionDep,
    _auth: AdminAuth,
) -> AdminBarListResponse:
    return AdminBarListResponse(
        items=cast(
            "list[AdminBarResponse]",
            list_resources(session, config=BAR_CONFIG),
        )
    )


@router.post(
    "/bars",
    response_model=AdminBarResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_admin_bar(
    payload: BarCreate,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminBarResponse:
    return cast(
        "AdminBarResponse",
        create_resource(
            session,
            config=BAR_CONFIG,
            payload=payload,
            admin=auth.user,
        ),
    )


@router.patch("/bars/{public_id}", response_model=AdminBarResponse)
def patch_admin_bar(
    public_id: str,
    payload: BarPatch,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminBarResponse:
    return cast(
        "AdminBarResponse",
        patch_resource(
            session,
            config=BAR_CONFIG,
            public_id=public_id,
            payload=payload,
            admin=auth.user,
        ),
    )


@router.post("/bars/{public_id}/publish", response_model=AdminBarResponse)
def publish_admin_bar(
    public_id: str,
    payload: RevisionRequest,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminBarResponse:
    return cast(
        "AdminBarResponse",
        _publish_resource(
            session,
            config=BAR_CONFIG,
            public_id=public_id,
            payload=payload,
            auth=auth,
        ),
    )


@router.post("/bars/{public_id}/archive", response_model=AdminBarResponse)
def archive_admin_bar(
    public_id: str,
    payload: RevisionRequest,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminBarResponse:
    return cast(
        "AdminBarResponse",
        _archive_resource(
            session,
            config=BAR_CONFIG,
            public_id=public_id,
            payload=payload,
            auth=auth,
        ),
    )


@router.get(
    "/bars/{public_id}/versions",
    response_model=ContentVersionListResponse,
)
def admin_bar_versions(
    public_id: str,
    session: SessionDep,
    _auth: AdminAuth,
) -> ContentVersionListResponse:
    return list_resource_versions(
        session,
        config=BAR_CONFIG,
        public_id=public_id,
    )


@router.post("/bars/{public_id}/rollback", response_model=AdminBarResponse)
def rollback_admin_bar(
    public_id: str,
    payload: RollbackRequest,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminBarResponse:
    return cast(
        "AdminBarResponse",
        _rollback_resource(
            session,
            config=BAR_CONFIG,
            public_id=public_id,
            payload=payload,
            auth=auth,
        ),
    )


@router.get("/knowledge", response_model=AdminKnowledgeListResponse)
def admin_knowledge(
    session: SessionDep,
    _auth: AdminAuth,
) -> AdminKnowledgeListResponse:
    return AdminKnowledgeListResponse(
        items=cast(
            "list[AdminKnowledgeResponse]",
            list_resources(session, config=KNOWLEDGE_CONFIG),
        )
    )


@router.post(
    "/knowledge",
    response_model=AdminKnowledgeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_admin_knowledge(
    payload: KnowledgeCreate,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminKnowledgeResponse:
    return cast(
        "AdminKnowledgeResponse",
        create_resource(
            session,
            config=KNOWLEDGE_CONFIG,
            payload=payload,
            admin=auth.user,
        ),
    )


@router.patch(
    "/knowledge/{public_id}",
    response_model=AdminKnowledgeResponse,
)
def patch_admin_knowledge(
    public_id: str,
    payload: KnowledgePatch,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminKnowledgeResponse:
    return cast(
        "AdminKnowledgeResponse",
        patch_resource(
            session,
            config=KNOWLEDGE_CONFIG,
            public_id=public_id,
            payload=payload,
            admin=auth.user,
        ),
    )


@router.post(
    "/knowledge/{public_id}/publish",
    response_model=AdminKnowledgeResponse,
)
def publish_admin_knowledge(
    public_id: str,
    payload: RevisionRequest,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminKnowledgeResponse:
    return cast(
        "AdminKnowledgeResponse",
        _publish_resource(
            session,
            config=KNOWLEDGE_CONFIG,
            public_id=public_id,
            payload=payload,
            auth=auth,
        ),
    )


@router.post(
    "/knowledge/{public_id}/archive",
    response_model=AdminKnowledgeResponse,
)
def archive_admin_knowledge(
    public_id: str,
    payload: RevisionRequest,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminKnowledgeResponse:
    return cast(
        "AdminKnowledgeResponse",
        _archive_resource(
            session,
            config=KNOWLEDGE_CONFIG,
            public_id=public_id,
            payload=payload,
            auth=auth,
        ),
    )


@router.get(
    "/knowledge/{public_id}/versions",
    response_model=ContentVersionListResponse,
)
def admin_knowledge_versions(
    public_id: str,
    session: SessionDep,
    _auth: AdminAuth,
) -> ContentVersionListResponse:
    return list_resource_versions(
        session,
        config=KNOWLEDGE_CONFIG,
        public_id=public_id,
    )


@router.post(
    "/knowledge/{public_id}/rollback",
    response_model=AdminKnowledgeResponse,
)
def rollback_admin_knowledge(
    public_id: str,
    payload: RollbackRequest,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminKnowledgeResponse:
    return cast(
        "AdminKnowledgeResponse",
        _rollback_resource(
            session,
            config=KNOWLEDGE_CONFIG,
            public_id=public_id,
            payload=payload,
            auth=auth,
        ),
    )


@router.get("/banners", response_model=AdminBannerListResponse)
def admin_banners(
    session: SessionDep,
    _auth: AdminAuth,
) -> AdminBannerListResponse:
    return AdminBannerListResponse(
        items=cast(
            "list[AdminBannerResponse]",
            list_resources(session, config=BANNER_CONFIG),
        )
    )


@router.post(
    "/banners",
    response_model=AdminBannerResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_admin_banner(
    payload: BannerCreate,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminBannerResponse:
    return cast(
        "AdminBannerResponse",
        create_resource(
            session,
            config=BANNER_CONFIG,
            payload=payload,
            admin=auth.user,
        ),
    )


@router.patch("/banners/{public_id}", response_model=AdminBannerResponse)
def patch_admin_banner(
    public_id: str,
    payload: BannerPatch,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminBannerResponse:
    return cast(
        "AdminBannerResponse",
        patch_resource(
            session,
            config=BANNER_CONFIG,
            public_id=public_id,
            payload=payload,
            admin=auth.user,
        ),
    )


@router.post(
    "/banners/{public_id}/publish",
    response_model=AdminBannerResponse,
)
def publish_admin_banner(
    public_id: str,
    payload: RevisionRequest,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminBannerResponse:
    return cast(
        "AdminBannerResponse",
        _publish_resource(
            session,
            config=BANNER_CONFIG,
            public_id=public_id,
            payload=payload,
            auth=auth,
        ),
    )


@router.post(
    "/banners/{public_id}/archive",
    response_model=AdminBannerResponse,
)
def archive_admin_banner(
    public_id: str,
    payload: RevisionRequest,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminBannerResponse:
    return cast(
        "AdminBannerResponse",
        _archive_resource(
            session,
            config=BANNER_CONFIG,
            public_id=public_id,
            payload=payload,
            auth=auth,
        ),
    )


@router.get(
    "/banners/{public_id}/versions",
    response_model=ContentVersionListResponse,
)
def admin_banner_versions(
    public_id: str,
    session: SessionDep,
    _auth: AdminAuth,
) -> ContentVersionListResponse:
    return list_resource_versions(
        session,
        config=BANNER_CONFIG,
        public_id=public_id,
    )


@router.post(
    "/banners/{public_id}/rollback",
    response_model=AdminBannerResponse,
)
def rollback_admin_banner(
    public_id: str,
    payload: RollbackRequest,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminBannerResponse:
    return cast(
        "AdminBannerResponse",
        _rollback_resource(
            session,
            config=BANNER_CONFIG,
            public_id=public_id,
            payload=payload,
            auth=auth,
        ),
    )


@router.get("/shortcuts", response_model=AdminShortcutListResponse)
def admin_shortcuts(
    session: SessionDep,
    _auth: AdminAuth,
) -> AdminShortcutListResponse:
    return AdminShortcutListResponse(
        items=cast(
            "list[AdminShortcutResponse]",
            list_resources(session, config=SHORTCUT_CONFIG),
        )
    )


@router.post(
    "/shortcuts",
    response_model=AdminShortcutResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_admin_shortcut(
    payload: ShortcutCreate,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminShortcutResponse:
    return cast(
        "AdminShortcutResponse",
        create_resource(
            session,
            config=SHORTCUT_CONFIG,
            payload=payload,
            admin=auth.user,
        ),
    )


@router.patch(
    "/shortcuts/{public_id}",
    response_model=AdminShortcutResponse,
)
def patch_admin_shortcut(
    public_id: str,
    payload: ShortcutPatch,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminShortcutResponse:
    return cast(
        "AdminShortcutResponse",
        patch_resource(
            session,
            config=SHORTCUT_CONFIG,
            public_id=public_id,
            payload=payload,
            admin=auth.user,
        ),
    )


@router.post(
    "/shortcuts/{public_id}/publish",
    response_model=AdminShortcutResponse,
)
def publish_admin_shortcut(
    public_id: str,
    payload: RevisionRequest,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminShortcutResponse:
    return cast(
        "AdminShortcutResponse",
        _publish_resource(
            session,
            config=SHORTCUT_CONFIG,
            public_id=public_id,
            payload=payload,
            auth=auth,
        ),
    )


@router.post(
    "/shortcuts/{public_id}/archive",
    response_model=AdminShortcutResponse,
)
def archive_admin_shortcut(
    public_id: str,
    payload: RevisionRequest,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminShortcutResponse:
    return cast(
        "AdminShortcutResponse",
        _archive_resource(
            session,
            config=SHORTCUT_CONFIG,
            public_id=public_id,
            payload=payload,
            auth=auth,
        ),
    )


@router.get(
    "/shortcuts/{public_id}/versions",
    response_model=ContentVersionListResponse,
)
def admin_shortcut_versions(
    public_id: str,
    session: SessionDep,
    _auth: AdminAuth,
) -> ContentVersionListResponse:
    return list_resource_versions(
        session,
        config=SHORTCUT_CONFIG,
        public_id=public_id,
    )


@router.post(
    "/shortcuts/{public_id}/rollback",
    response_model=AdminShortcutResponse,
)
def rollback_admin_shortcut(
    public_id: str,
    payload: RollbackRequest,
    session: SessionDep,
    auth: AdminAuth,
) -> AdminShortcutResponse:
    return cast(
        "AdminShortcutResponse",
        _rollback_resource(
            session,
            config=SHORTCUT_CONFIG,
            public_id=public_id,
            payload=payload,
            auth=auth,
        ),
    )
