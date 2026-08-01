from sqlmodel import Session, select
from starlette.testclient import TestClient

from app.db.models import User, UserStatus
from tests.api.test_auth_sessions import bearer, create_login


def test_user_can_create_public_post_and_comment(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])

    created = database_client.post(
        "/api/v1/community/posts",
        headers=headers,
        json={
            "title": "今晚这杯金汤力",
            "body": "金酒和汤力水比例很稳，适合慢慢喝。",
            "category": "recommended",
            "imageKey": "ginTonic",
            "topics": ["金汤力", "居家调酒"],
            "visibility": "public",
            "allowComments": True,
        },
    )

    assert created.status_code == 201, created.text
    post = created.json()
    assert post["title"] == "今晚这杯金汤力"
    assert post["authorName"] == "游客调酒师"
    assert post["comments"] == []

    commented = database_client.post(
        f"/api/v1/community/posts/{post['id']}/comments",
        headers=headers,
        json={"text": "这个配方我也试试"},
    )

    assert commented.status_code == 201, commented.text
    assert commented.json()["text"] == "这个配方我也试试"

    listed = database_client.get("/api/v1/community/posts", headers=headers)
    assert listed.status_code == 200, listed.text
    assert listed.json()["items"][0]["id"] == post["id"]

    detail = database_client.get(
        f"/api/v1/community/posts/{post['id']}",
        headers=headers,
    )
    assert detail.status_code == 200, detail.text
    assert detail.json()["comments"][0]["text"] == "这个配方我也试试"


def test_private_post_is_visible_only_to_author(
    database_client: TestClient,
) -> None:
    first_login = create_login(database_client)
    first_headers = bearer(first_login["accessToken"])
    created = database_client.post(
        "/api/v1/community/posts",
        headers=first_headers,
        json={
            "title": "只给自己看的酒单",
            "body": "这条笔记不应该进入公共社区。",
            "visibility": "private",
        },
    )
    assert created.status_code == 201, created.text
    post_id = created.json()["id"]

    public_list = database_client.get("/api/v1/community/posts", headers=first_headers)
    assert public_list.status_code == 200
    assert all(item["id"] != post_id for item in public_list.json()["items"])

    own_detail = database_client.get(
        f"/api/v1/community/posts/{post_id}",
        headers=first_headers,
    )
    assert own_detail.status_code == 200


def test_commenting_closed_post_is_rejected(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])
    created = database_client.post(
        "/api/v1/community/posts",
        headers=headers,
        json={
            "title": "关闭评论的笔记",
            "body": "这条笔记不接受评论。",
            "allowComments": False,
        },
    )
    assert created.status_code == 201, created.text

    commented = database_client.post(
        f"/api/v1/community/posts/{created.json()['id']}/comments",
        headers=headers,
        json={"text": "应该失败"},
    )

    assert commented.status_code == 409
    assert commented.json()["error"]["code"] == "COMMUNITY_COMMENTS_CLOSED"


def test_deleted_user_posts_are_not_listed(
    database_client: TestClient,
    database_session: Session,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])
    created = database_client.post(
        "/api/v1/community/posts",
        headers=headers,
        json={"title": "作者删除后不可见", "body": "隐藏作者删除后的帖子。"},
    )
    assert created.status_code == 201, created.text

    user = database_session.exec(select(User)).one()
    user.status = UserStatus.DELETED
    user.deleted_at = user.created_at
    database_session.add(user)
    database_session.commit()

    listed = database_client.get("/api/v1/community/posts", headers=headers)

    assert listed.status_code == 401
