from collections.abc import Generator
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from sqlalchemy import Engine, bindparam
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, create_engine, select

from app.core.config import get_settings


@lru_cache
def get_engine() -> Engine:
    settings = get_settings()
    return create_engine(str(settings.database_url), pool_pre_ping=True)


def get_session() -> Generator[Session, None, None]:
    with Session(get_engine()) as session:
        yield session


def check_database(
    session: Annotated[Session, Depends(get_session)],
) -> bool:
    try:
        result = session.exec(
            select(bindparam("probe")),
            params={"probe": 1},
        )
        return result.one() == 1
    except SQLAlchemyError:
        return False
