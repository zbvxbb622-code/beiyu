import uuid
from datetime import UTC, datetime

import jwt
import pytest

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    device_hash,
    mask_phone,
    normalize_cn_phone,
    otp_hash,
    phone_hash,
    refresh_token_hash,
)

SECRET = "stage-one-test-secret"


@pytest.mark.parametrize(
    ("raw_phone", "expected"),
    [
        ("13800138000", "+8613800138000"),
        ("+86 138 0013 8000", "+8613800138000"),
        ("0086-13800138000", "+8613800138000"),
    ],
)
def test_normalize_cn_phone_accepts_mainland_mobile_numbers(
    raw_phone: str, expected: str
) -> None:
    assert normalize_cn_phone(raw_phone) == expected


@pytest.mark.parametrize("raw_phone", ["", "12345", "+14155552671", "01088888888"])
def test_normalize_cn_phone_rejects_invalid_or_non_mobile_numbers(
    raw_phone: str,
) -> None:
    with pytest.raises(ValueError, match="手机号"):
        normalize_cn_phone(raw_phone)


def test_sensitive_identifiers_use_stable_domain_separated_hashes() -> None:
    normalized_phone = normalize_cn_phone("13800138000")

    assert phone_hash(normalized_phone, SECRET) == phone_hash(normalized_phone, SECRET)
    assert phone_hash(normalized_phone, SECRET) != device_hash(normalized_phone, SECRET)
    assert otp_hash("phone-hash", "LOGIN", "123456", SECRET) != otp_hash(
        "phone-hash", "LOGIN", "654321", SECRET
    )
    assert mask_phone(normalized_phone) == "+86138****8000"


def test_access_token_round_trip_includes_user_and_session() -> None:
    user_id = uuid.uuid4()
    session_id = uuid.uuid4()

    token = create_access_token(user_id, session_id, SECRET, expires_minutes=15)
    claims = decode_access_token(token, SECRET)

    assert claims.user_id == user_id
    assert claims.session_id == session_id


def test_access_token_rejects_wrong_signature_and_expiry() -> None:
    token = create_access_token(
        uuid.uuid4(),
        uuid.uuid4(),
        SECRET,
        expires_minutes=-1,
        now=datetime.now(UTC),
    )

    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(token, SECRET)

    valid_token = create_access_token(
        uuid.uuid4(), uuid.uuid4(), SECRET, expires_minutes=15
    )
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(valid_token, "wrong-secret")


def test_refresh_tokens_are_opaque_unique_and_hashable() -> None:
    first_token, first_hash = create_refresh_token(SECRET)
    second_token, second_hash = create_refresh_token(SECRET)

    assert first_token != second_token
    assert first_hash != second_hash
    assert first_hash == refresh_token_hash(first_token, SECRET)
    assert len(first_hash) == 64
