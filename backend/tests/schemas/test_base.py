from app.schemas.base import ApiModel


def test_api_model_accepts_python_names_and_serializes_camel_case() -> None:
    class Example(ApiModel):
        refresh_token: str

    model = Example(refresh_token="token")

    assert model.model_dump() == {"refreshToken": "token"}
    assert Example.model_validate({"refreshToken": "other"}).refresh_token == "other"
