from app.modules.community.schemas import CommunityPostCreate


def test_community_post_create_accepts_remote_media_image() -> None:
    payload = CommunityPostCreate(
        title="OSS 图片笔记",
        body="这条笔记引用对象存储图片。",
        images=[
            {
                "id": "media-1",
                "kind": "remote",
                "mediaId": "upload-1",
                "url": "https://cdn.example.test/community/upload-1.jpg",
            }
        ],
    )

    assert payload.images[0].kind == "remote"
