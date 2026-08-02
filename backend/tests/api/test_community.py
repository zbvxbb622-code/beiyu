from sqlmodel import Session, select
from starlette.testclient import TestClient

from app.db.models import User, UserRole, UserStatus
from tests.api.test_auth_sessions import bearer, create_login


def create_login_for(
    client: TestClient,
    *,
    phone: str,
    installation_id: str,
) -> dict:
    code_response = client.post(
        "/api/v1/auth/sms-codes",
        json={
            "phone": phone,
            "scene": "LOGIN",
            "installationId": installation_id,
        },
    )
    assert code_response.status_code == 202
    response = client.post(
        "/api/v1/auth/login",
        json={
            "phone": phone,
            "code": "123456",
            "device": {
                "installationId": installation_id,
                "platform": "IOS",
                "deviceName": "Admin iPhone",
                "appVersion": "1.0.0",
            },
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


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


def test_blank_post_title_body_and_comment_are_rejected(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])

    blank_title = database_client.post(
        "/api/v1/community/posts",
        headers=headers,
        json={"title": "   ", "body": "正文"},
    )
    blank_body = database_client.post(
        "/api/v1/community/posts",
        headers=headers,
        json={"title": "标题", "body": "   "},
    )
    created = database_client.post(
        "/api/v1/community/posts",
        headers=headers,
        json={"title": "正常标题", "body": "正常正文"},
    )
    assert created.status_code == 201, created.text

    blank_comment = database_client.post(
        f"/api/v1/community/posts/{created.json()['id']}/comments",
        headers=headers,
        json={"text": "   "},
    )

    assert blank_title.status_code == 422
    assert blank_body.status_code == 422
    assert blank_comment.status_code == 422


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


def test_user_cannot_reply_to_hidden_parent_comment(
    database_client: TestClient,
    database_session: Session,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])
    created = database_client.post(
        "/api/v1/community/posts",
        headers=headers,
        json={"title": "父评论被隐藏", "body": "回复隐藏评论应该失败。"},
    )
    assert created.status_code == 201, created.text
    post_id = created.json()["id"]
    parent = database_client.post(
        f"/api/v1/community/posts/{post_id}/comments",
        headers=headers,
        json={"text": "待隐藏父评论"},
    )
    assert parent.status_code == 201, parent.text
    parent_id = parent.json()["id"]

    admin_login = create_login_for(database_client, phone="13800000904", installation_id="admin-hide-parent-comment")
    admin_user = database_session.exec(select(User).where(User.id == admin_login["user"]["id"])).one()
    admin_user.role = UserRole.MODERATOR
    database_session.add(admin_user)
    database_session.commit()
    hidden = database_client.patch(
        f"/api/v1/admin/community/comments/{parent_id}/moderation",
        headers=bearer(admin_login["accessToken"]),
        json={"status": "hidden", "note": "隐藏父评论"},
    )
    assert hidden.status_code == 200, hidden.text

    reply = database_client.post(
        f"/api/v1/community/posts/{post_id}/comments",
        headers=headers,
        json={"text": "不应成功", "parentCommentId": parent_id},
    )

    assert reply.status_code == 404
    assert reply.json()["error"]["code"] == "COMMUNITY_COMMENT_NOT_FOUND"


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


def test_user_can_report_post_and_comment_for_admin_review(
    database_client: TestClient,
    database_session: Session,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])
    created = database_client.post(
        "/api/v1/community/posts",
        headers=headers,
        json={"title": "需要举报的笔记", "body": "这条内容用于验证举报链路。"},
    )
    assert created.status_code == 201, created.text
    post_id = created.json()["id"]
    comment = database_client.post(
        f"/api/v1/community/posts/{post_id}/comments",
        headers=headers,
        json={"text": "需要举报的评论"},
    )
    assert comment.status_code == 201, comment.text
    comment_id = comment.json()["id"]

    reported_post = database_client.post(
        f"/api/v1/community/posts/{post_id}/reports",
        headers=headers,
        json={"reason": "spam", "detail": "重复刷屏"},
    )
    reported_comment = database_client.post(
        f"/api/v1/community/comments/{comment_id}/reports",
        headers=headers,
        json={"reason": "harassment"},
    )

    assert reported_post.status_code == 201, reported_post.text
    assert reported_post.json()["targetType"] == "post"
    assert reported_post.json()["status"] == "open"
    assert reported_comment.status_code == 201, reported_comment.text
    assert reported_comment.json()["targetType"] == "comment"
    admin_login = create_login_for(database_client, phone="13800000902", installation_id="admin-reports-device")
    admin_user = database_session.exec(select(User).where(User.id == admin_login["user"]["id"])).one()
    admin_user.role = UserRole.MODERATOR
    database_session.add(admin_user)
    database_session.commit()
    reports = database_client.get(
        "/api/v1/admin/community/reports",
        headers=bearer(admin_login["accessToken"]),
    )
    assert reports.status_code == 200, reports.text
    assert [item["targetType"] for item in reports.json()["items"]] == ["comment", "post"]


def test_report_reason_cannot_be_blank(database_client: TestClient) -> None:
    login = create_login_for(database_client, phone="13800000903", installation_id="community-report-blank-device")
    headers = bearer(login["accessToken"])
    created = database_client.post(
        "/api/v1/community/posts",
        headers=headers,
        json={"title": "空举报原因笔记", "body": "这条内容用于验证举报原因校验。"},
    )
    assert created.status_code == 201, created.text
    post_id = created.json()["id"]

    response = database_client.post(
        f"/api/v1/community/posts/{post_id}/reports",
        headers=headers,
        json={"reason": "   "},
    )

    assert response.status_code == 422


def test_duplicate_open_report_is_rejected_until_moderated(
    database_client: TestClient,
    database_session: Session,
) -> None:
    login = create_login_for(database_client, phone="13800000905", installation_id="community-report-duplicate-device")
    headers = bearer(login["accessToken"])
    created = database_client.post(
        "/api/v1/community/posts",
        headers=headers,
        json={"title": "重复举报笔记", "body": "同一用户不能刷未处理举报。"},
    )
    assert created.status_code == 201, created.text
    post_id = created.json()["id"]

    first = database_client.post(
        f"/api/v1/community/posts/{post_id}/reports",
        headers=headers,
        json={"reason": "spam"},
    )
    duplicate = database_client.post(
        f"/api/v1/community/posts/{post_id}/reports",
        headers=headers,
        json={"reason": "spam"},
    )

    assert first.status_code == 201, first.text
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "COMMUNITY_REPORT_ALREADY_OPEN"

    admin_login = create_login_for(database_client, phone="13800000906", installation_id="admin-resolve-duplicate-report")
    admin_user = database_session.exec(select(User).where(User.id == admin_login["user"]["id"])).one()
    admin_user.role = UserRole.MODERATOR
    database_session.add(admin_user)
    database_session.commit()
    moderated = database_client.patch(
        f"/api/v1/admin/community/posts/{post_id}/moderation",
        headers=bearer(admin_login["accessToken"]),
        json={"status": "approved", "note": "已处理"},
    )
    assert moderated.status_code == 200, moderated.text

    second_after_resolution = database_client.post(
        f"/api/v1/community/posts/{post_id}/reports",
        headers=headers,
        json={"reason": "spam"},
    )
    assert second_after_resolution.status_code == 201, second_after_resolution.text


def test_report_creation_is_rate_limited_per_user(
    database_client: TestClient,
) -> None:
    login = create_login_for(
        database_client,
        phone="13800000907",
        installation_id="community-report-rate-limit-device",
    )
    headers = bearer(login["accessToken"])
    post_ids: list[str] = []
    for index in range(11):
        created = database_client.post(
            "/api/v1/community/posts",
            headers=headers,
            json={
                "title": f"举报频率限制笔记 {index}",
                "body": "每个目标不同，用于验证总频率限制。",
            },
        )
        assert created.status_code == 201, created.text
        post_ids.append(created.json()["id"])

    for post_id in post_ids[:10]:
        reported = database_client.post(
            f"/api/v1/community/posts/{post_id}/reports",
            headers=headers,
            json={"reason": "spam"},
        )
        assert reported.status_code == 201, reported.text

    blocked = database_client.post(
        f"/api/v1/community/posts/{post_ids[10]}/reports",
        headers=headers,
        json={"reason": "spam"},
    )

    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "COMMUNITY_REPORT_RATE_LIMITED"


def test_editor_cannot_access_community_moderation_routes(
    database_client: TestClient,
    database_session: Session,
) -> None:
    author_login = create_login_for(
        database_client,
        phone="13800000908",
        installation_id="community-editor-forbidden-author",
    )
    author_headers = bearer(author_login["accessToken"])
    created = database_client.post(
        "/api/v1/community/posts",
        headers=author_headers,
        json={"title": "编辑不能审核", "body": "社区审核权限需要拆分。"},
    )
    assert created.status_code == 201, created.text
    post_id = created.json()["id"]

    editor_login = create_login_for(
        database_client,
        phone="13800000909",
        installation_id="community-editor-forbidden-device",
    )
    editor_user = database_session.exec(select(User).where(User.id == editor_login["user"]["id"])).one()
    editor_user.role = UserRole.EDITOR
    database_session.add(editor_user)
    database_session.commit()
    editor_headers = bearer(editor_login["accessToken"])

    reports = database_client.get(
        "/api/v1/admin/community/reports",
        headers=editor_headers,
    )
    moderation = database_client.patch(
        f"/api/v1/admin/community/posts/{post_id}/moderation",
        headers=editor_headers,
        json={"status": "hidden", "note": "不应允许"},
    )

    assert reports.status_code == 403
    assert moderation.status_code == 403


def test_admin_can_hide_and_restore_reported_post_with_audit_log(
    database_client: TestClient,
    database_session: Session,
) -> None:
    author_login = create_login(database_client)
    author_headers = bearer(author_login["accessToken"])
    created = database_client.post(
        "/api/v1/community/posts",
        headers=author_headers,
        json={"title": "待审核笔记", "body": "管理员可以隐藏和恢复。"},
    )
    assert created.status_code == 201, created.text
    post_id = created.json()["id"]

    admin_login = create_login_for(database_client, phone="13800000901", installation_id="admin-review-device")
    admin_user = database_session.exec(select(User).where(User.id == admin_login["user"]["id"])).one()
    admin_user.role = UserRole.MODERATOR
    database_session.add(admin_user)
    database_session.commit()
    admin_headers = bearer(admin_login["accessToken"])

    forbidden = database_client.patch(
        f"/api/v1/admin/community/posts/{post_id}/moderation",
        headers=author_headers,
        json={"status": "hidden", "note": "普通用户不应能审核"},
    )
    assert forbidden.status_code == 403

    hidden = database_client.patch(
        f"/api/v1/admin/community/posts/{post_id}/moderation",
        headers=admin_headers,
        json={"status": "hidden", "note": "违规内容下架"},
    )
    assert hidden.status_code == 200, hidden.text
    assert hidden.json()["moderationStatus"] == "hidden"

    listed = database_client.get("/api/v1/community/posts", headers=author_headers)
    assert listed.status_code == 200
    assert all(item["id"] != post_id for item in listed.json()["items"])
    detail = database_client.get(f"/api/v1/community/posts/{post_id}", headers=author_headers)
    assert detail.status_code == 404

    restored = database_client.patch(
        f"/api/v1/admin/community/posts/{post_id}/moderation",
        headers=admin_headers,
        json={"status": "approved", "note": "复核恢复"},
    )
    assert restored.status_code == 200, restored.text
    assert restored.json()["moderationStatus"] == "approved"
    assert database_client.get(f"/api/v1/community/posts/{post_id}", headers=author_headers).status_code == 200

    audit = database_client.get(
        f"/api/v1/admin/community/posts/{post_id}/audit-log",
        headers=admin_headers,
    )
    assert audit.status_code == 200, audit.text
    assert [item["action"] for item in audit.json()["items"]] == ["hide_post", "approve_post"]
