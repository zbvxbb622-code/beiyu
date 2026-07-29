import hashlib
import hmac
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
import phonenumbers
from phonenumbers import PhoneNumberFormat, PhoneNumberType

ACCESS_TOKEN_AUDIENCE = "beiyu-mobile"
ACCESS_TOKEN_ISSUER = "beiyu-api"
ACCESS_TOKEN_ALGORITHM = "HS256"


@dataclass(frozen=True, slots=True)
class AccessTokenClaims:
    user_id: uuid.UUID
    session_id: uuid.UUID


def normalize_cn_phone(raw_phone: str) -> str:
    candidate = raw_phone.strip()
    if candidate.startswith("0086"):
        candidate = f"+86{candidate[4:]}"

    try:
        parsed = phonenumbers.parse(candidate, "CN")
    except phonenumbers.NumberParseException as exc:
        raise ValueError("请输入有效的中国大陆手机号") from exc

    if (
        parsed.country_code != 86
        or phonenumbers.region_code_for_number(parsed) != "CN"
        or not phonenumbers.is_valid_number(parsed)
        or phonenumbers.number_type(parsed) is not PhoneNumberType.MOBILE
    ):
        raise ValueError("请输入有效的中国大陆手机号")

    return phonenumbers.format_number(parsed, PhoneNumberFormat.E164)


def _keyed_hash(value: str, secret_key: str, namespace: str) -> str:
    message = f"beiyu:{namespace}:{value}".encode()
    return hmac.new(secret_key.encode(), message, hashlib.sha256).hexdigest()


def _jwt_key(secret_key: str) -> bytes:
    return hashlib.sha256(f"beiyu:jwt:{secret_key}".encode()).digest()


def phone_hash(normalized_phone: str, secret_key: str) -> str:
    return _keyed_hash(normalized_phone, secret_key, "phone")


def device_hash(installation_id: str, secret_key: str) -> str:
    return _keyed_hash(installation_id, secret_key, "device")


def otp_hash(
    stored_phone_hash: str,
    scene: str,
    code: str,
    secret_key: str,
) -> str:
    return _keyed_hash(
        f"{stored_phone_hash}:{scene}:{code}",
        secret_key,
        "otp",
    )


def mask_phone(normalized_phone: str) -> str:
    if not normalized_phone.startswith("+86") or len(normalized_phone) != 14:
        raise ValueError("请输入有效的中国大陆手机号")
    return f"{normalized_phone[:6]}****{normalized_phone[-4:]}"


def create_access_token(
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    secret_key: str,
    *,
    expires_minutes: int,
    now: datetime | None = None,
) -> str:
    issued_at = now or datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "sid": str(session_id),
        "type": "access",
        "aud": ACCESS_TOKEN_AUDIENCE,
        "iss": ACCESS_TOKEN_ISSUER,
        "iat": issued_at,
        "exp": issued_at + timedelta(minutes=expires_minutes),
    }
    return jwt.encode(payload, _jwt_key(secret_key), algorithm=ACCESS_TOKEN_ALGORITHM)


def decode_access_token(token: str, secret_key: str) -> AccessTokenClaims:
    try:
        payload = jwt.decode(
            token,
            _jwt_key(secret_key),
            algorithms=[ACCESS_TOKEN_ALGORITHM],
            audience=ACCESS_TOKEN_AUDIENCE,
            issuer=ACCESS_TOKEN_ISSUER,
        )
        if payload.get("type") != "access":
            raise jwt.InvalidTokenError("unexpected token type")
        return AccessTokenClaims(
            user_id=uuid.UUID(payload["sub"]),
            session_id=uuid.UUID(payload["sid"]),
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise jwt.InvalidTokenError("invalid access token claims") from exc


def refresh_token_hash(token: str, secret_key: str) -> str:
    return _keyed_hash(token, secret_key, "refresh-token")


def create_refresh_token(secret_key: str) -> tuple[str, str]:
    token = secrets.token_urlsafe(48)
    return token, refresh_token_hash(token, secret_key)
