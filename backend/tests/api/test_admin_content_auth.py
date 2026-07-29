import pytest
from sqlmodel import Session, select
from starlette.testclient import TestClient

from app.db.models import User, UserRole
from app.modules.content.seed import seed_content
from tests.api.test_auth_sessions import bearer, create_login


def set_current_user_role(session: Session, role: UserRole) -> None:
    user = session.exec(select(User)).one()
    user.role = role
    session.add(user)
    session.commit()


def test_admin_content_requires_authentication(
    database_client: TestClient,
    database_session: Session,
) -> None:
    seed_content(database_session)

    response = database_client.get("/api/v1/admin/recipes")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"


def test_regular_user_cannot_access_admin_content(
    database_client: TestClient,
    database_session: Session,
) -> None:
    seed_content(database_session)
    login = create_login(database_client)

    response = database_client.get(
        "/api/v1/admin/recipes",
        headers=bearer(login["accessToken"]),
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ADMIN_PERMISSION_REQUIRED"


@pytest.mark.parametrize("role", [UserRole.EDITOR, UserRole.SUPER_ADMIN])
def test_editor_roles_can_list_admin_content(
    database_client: TestClient,
    database_session: Session,
    role: UserRole,
) -> None:
    seed_content(database_session)
    login = create_login(database_client)
    set_current_user_role(database_session, role)

    response = database_client.get(
        "/api/v1/admin/recipes",
        headers=bearer(login["accessToken"]),
    )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 23
    assert {item["status"] for item in response.json()["items"]} == {"PUBLISHED"}
