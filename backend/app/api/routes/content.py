from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.db.session import get_session
from app.modules.content.schemas import (
    BarListResponse,
    BarResponse,
    HomeResponse,
    IngredientListResponse,
    KnowledgeListResponse,
    KnowledgeResponse,
    RecipeListResponse,
    RecipeResponse,
    SearchListResponse,
)
from app.modules.content.service import (
    get_bar,
    get_home,
    get_knowledge,
    get_recipe,
    list_bars,
    list_ingredients,
    list_knowledge,
    list_recipes,
    search_content,
)

router = APIRouter(tags=["content"])
SessionDep = Annotated[Session, Depends(get_session)]
Page = Annotated[int, Query(ge=1)]
PageSize = Annotated[int, Query(alias="pageSize", ge=1, le=100)]


@router.get("/home", response_model=HomeResponse)
def home(session: SessionDep) -> HomeResponse:
    return get_home(session)


@router.get("/ingredients", response_model=IngredientListResponse)
def ingredients(
    session: SessionDep,
    page: Page = 1,
    page_size: PageSize = 100,
) -> IngredientListResponse:
    return list_ingredients(session, page=page, page_size=page_size)


@router.get("/recipes", response_model=RecipeListResponse)
def recipes(
    session: SessionDep,
    page: Page = 1,
    page_size: PageSize = 20,
) -> RecipeListResponse:
    return list_recipes(session, page=page, page_size=page_size)


@router.get("/recipes/{public_id}", response_model=RecipeResponse)
def recipe_detail(public_id: str, session: SessionDep) -> RecipeResponse:
    return get_recipe(session, public_id)


@router.get("/bars", response_model=BarListResponse)
def bars(
    session: SessionDep,
    page: Page = 1,
    page_size: PageSize = 20,
) -> BarListResponse:
    return list_bars(session, page=page, page_size=page_size)


@router.get("/bars/{public_id}", response_model=BarResponse)
def bar_detail(public_id: str, session: SessionDep) -> BarResponse:
    return get_bar(session, public_id)


@router.get("/knowledge", response_model=KnowledgeListResponse)
def knowledge(
    session: SessionDep,
    page: Page = 1,
    page_size: PageSize = 20,
) -> KnowledgeListResponse:
    return list_knowledge(session, page=page, page_size=page_size)


@router.get("/knowledge/{public_id}", response_model=KnowledgeResponse)
def knowledge_detail(public_id: str, session: SessionDep) -> KnowledgeResponse:
    return get_knowledge(session, public_id)


@router.get("/search", response_model=SearchListResponse)
def search(
    session: SessionDep,
    q: Annotated[str, Query(min_length=1, max_length=100)],
    page: Page = 1,
    page_size: PageSize = 20,
) -> SearchListResponse:
    return search_content(
        session,
        query=q.strip(),
        page=page,
        page_size=page_size,
    )
