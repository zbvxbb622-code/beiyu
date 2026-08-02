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
    assert post["authorName"] == "测试账号"
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


def test_user_can_create_post_with_local_photo_uri(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])

    created = database_client.post(
        "/api/v1/community/posts",
        headers=headers,
        json={
            "title": "相册图片笔记",
            "body": "这条笔记来自 iOS 相册选择。",
            "images": [
                {
                    "id": "local-photo-1",
                    "kind": "uri",
                    "uri": "file:///var/mobile/Containers/Data/photo.jpg",
                }
            ],
        },
    )

    assert created.status_code == 201, created.text
    post = created.json()
    assert post["imageKey"] == "barInterior"
    assert post["images"] == [
        {
            "id": "local-photo-1",
            "kind": "uri",
            "uri": "file:///var/mobile/Containers/Data/photo.jpg",
        }
    ]


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


def test_user_can_like_and_unlike_post_idempotently(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])
    created = database_client.post(
        "/api/v1/community/posts",
        headers=headers,
        json={"title": "可以点赞的笔记", "body": "点赞状态应该由后端保存。"},
    )
    assert created.status_code == 201, created.text
    post_id = created.json()["id"]
    assert created.json()["likes"] == 0
    assert created.json()["likedByMe"] is False

    liked = database_client.post(
        f"/api/v1/community/posts/{post_id}/like",
        headers=headers,
    )

    assert liked.status_code == 200, liked.text
    assert liked.json()["likes"] == 1
    assert liked.json()["likedByMe"] is True

    liked_again = database_client.post(
        f"/api/v1/community/posts/{post_id}/like",
        headers=headers,
    )
    assert liked_again.status_code == 200, liked_again.text
    assert liked_again.json()["likes"] == 1
    assert liked_again.json()["likedByMe"] is True

    listed = database_client.get("/api/v1/community/posts", headers=headers)
    assert listed.status_code == 200, listed.text
    listed_post = listed.json()["items"][0]
    assert listed_post["id"] == post_id
    assert listed_post["likes"] == 1
    assert listed_post["likedByMe"] is True

    unliked = database_client.delete(
        f"/api/v1/community/posts/{post_id}/like",
        headers=headers,
    )
    assert unliked.status_code == 200, unliked.text
    assert unliked.json()["likes"] == 0
    assert unliked.json()["likedByMe"] is False

    unliked_again = database_client.delete(
        f"/api/v1/community/posts/{post_id}/like",
        headers=headers,
    )
    assert unliked_again.status_code == 200, unliked_again.text
    assert unliked_again.json()["likes"] == 0
    assert unliked_again.json()["likedByMe"] is False


def test_user_can_reply_to_and_like_community_comment(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])
    created = database_client.post(
        "/api/v1/community/posts",
        headers=headers,
        json={"title": "评论可以互动", "body": "回复和点赞都应该由后端保存。"},
    )
    assert created.status_code == 201, created.text
    post_id = created.json()["id"]

    parent = database_client.post(
        f"/api/v1/community/posts/{post_id}/comments",
        headers=headers,
        json={"text": "第一条评论"},
    )
    assert parent.status_code == 201, parent.text
    parent_id = parent.json()["id"]

    reply = database_client.post(
        f"/api/v1/community/posts/{post_id}/comments",
        headers=headers,
        json={"text": "这是回复", "parentCommentId": parent_id},
    )
    assert reply.status_code == 201, reply.text
    reply_body = reply.json()
    assert reply_body["parentCommentId"] == parent_id
    assert reply_body["likes"] == 0
    assert reply_body["likedByMe"] is False

    liked = database_client.post(
        f"/api/v1/community/comments/{reply_body['id']}/like",
        headers=headers,
    )
    assert liked.status_code == 200, liked.text
    assert liked.json()["likes"] == 1
    assert liked.json()["likedByMe"] is True

    detail = database_client.get(
        f"/api/v1/community/posts/{post_id}",
        headers=headers,
    )
    assert detail.status_code == 200, detail.text
    comments = detail.json()["comments"]
    assert comments[0]["id"] == parent_id
    assert comments[0].get("parentCommentId") is None
    assert comments[1]["text"] == "这是回复"
    assert comments[1]["parentCommentId"] == parent_id
    assert comments[1]["likes"] == 1
    assert comments[1]["likedByMe"] is True

    unliked = database_client.delete(
        f"/api/v1/community/comments/{reply_body['id']}/like",
        headers=headers,
    )
    assert unliked.status_code == 200, unliked.text
    assert unliked.json()["likes"] == 0
    assert unliked.json()["likedByMe"] is False


def test_author_can_delete_own_community_post(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])
    created = database_client.post(
        "/api/v1/community/posts",
        headers=headers,
        json={"title": "准备删除的笔记", "body": "删除后不应继续出现在社区。"},
    )
    assert created.status_code == 201, created.text
    post_id = created.json()["id"]

    deleted = database_client.delete(
        f"/api/v1/community/posts/{post_id}",
        headers=headers,
    )
    assert deleted.status_code == 204, deleted.text

    detail = database_client.get(
        f"/api/v1/community/posts/{post_id}",
        headers=headers,
    )
    assert detail.status_code == 404


def test_user_cannot_delete_another_author_post(
    database_client: TestClient,
) -> None:
    first_login = create_login(database_client)
    first_headers = bearer(first_login["accessToken"])
    created = database_client.post(
        "/api/v1/community/posts",
        headers=first_headers,
        json={"title": "别人的笔记", "body": "不能被当前账号删除。"},
    )
    assert created.status_code == 201, created.text
    post_id = created.json()["id"]

    code_response = database_client.post(
        "/api/v1/auth/sms-codes",
        json={
            "phone": "13800000002",
            "scene": "LOGIN",
            "installationId": "community-delete-other-device",
        },
    )
    assert code_response.status_code == 202
    second_login_response = database_client.post(
        "/api/v1/auth/login",
        json={
            "phone": "13800000002",
            "code": "123456",
            "device": {
                "installationId": "community-delete-other-device",
                "platform": "IOS",
                "deviceName": "Other iPhone",
                "appVersion": "1.0.0",
            },
        },
    )
    assert second_login_response.status_code == 200, second_login_response.text
    second_login = second_login_response.json()
    second_headers = bearer(second_login["accessToken"])
    deleted = database_client.delete(
        f"/api/v1/community/posts/{post_id}",
        headers=second_headers,
    )

    assert deleted.status_code == 404
    assert database_client.get(
        f"/api/v1/community/posts/{post_id}",
        headers=first_headers,
    ).status_code == 200


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
