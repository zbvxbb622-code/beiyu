from datetime import UTC
from typing import cast

from sqlalchemy import CheckConstraint, Table, UniqueConstraint

from app.db.models.accounts import (
    AuthSession,
    DevicePlatform,
    MembershipLevel,
    SmsCode,
    SmsScene,
    User,
    UserDevice,
    UserProfile,
    UserRole,
    UserStatus,
)
from app.db.models.cellar import CellarItem, CellarItemSource


def model_table(model: type[object]) -> Table:
    return cast(Table, vars(model)["__table__"])


def test_account_models_use_expected_tables_and_defaults() -> None:
    user = User(phone_hash="hash", phone_masked="+86138****0000")
    profile = UserProfile(user_id=user.id)
    device = UserDevice(
        user_id=user.id,
        installation_id_hash="device-hash",
        platform=DevicePlatform.IOS,
        device_name="iPhone",
        app_version="1.0.0",
    )

    assert User.__tablename__ == "users"
    assert UserProfile.__tablename__ == "user_profiles"
    assert UserDevice.__tablename__ == "user_devices"
    assert AuthSession.__tablename__ == "auth_sessions"
    assert SmsCode.__tablename__ == "sms_codes"
    assert user.status is UserStatus.ACTIVE
    assert user.role is UserRole.USER
    assert user.membership_level is MembershipLevel.FREE
    assert user.memory_enabled is True
    assert profile.nickname == "游客调酒师"
    assert profile.visibility == {
        "localOnlyMode": True,
        "analyticsOptIn": False,
        "syncWhenLoggedIn": False,
        "showBirthdayTag": True,
        "showAge": True,
        "showZodiac": False,
    }
    assert device.created_at.tzinfo is UTC


def test_account_tables_define_identity_and_session_uniqueness() -> None:
    user_constraints = set(model_table(User).constraints)
    device_constraints = set(model_table(UserDevice).constraints)
    session_constraints = set(model_table(AuthSession).constraints)

    assert any(
        isinstance(constraint, UniqueConstraint)
        and tuple(constraint.columns.keys()) == ("phone_hash",)
        for constraint in user_constraints
    )
    assert any(
        isinstance(constraint, UniqueConstraint)
        and tuple(constraint.columns.keys()) == ("user_id", "installation_id_hash")
        for constraint in device_constraints
    )
    assert any(
        isinstance(constraint, UniqueConstraint)
        and tuple(constraint.columns.keys()) == ("refresh_token_hash",)
        for constraint in session_constraints
    )


def test_sms_code_has_rate_limit_and_attempt_fields() -> None:
    sms = SmsCode(
        phone_hash="phone-hash",
        scene=SmsScene.LOGIN,
        code_hash="code-hash",
        device_hash="device-hash",
        ip_address="127.0.0.1",
    )

    assert sms.failed_attempts == 0
    assert {"phone_hash", "device_hash", "ip_address", "created_at"}.issubset(
        model_table(SmsCode).columns.keys()
    )


def test_cellar_model_enforces_one_item_identity_and_active_uniqueness() -> None:
    table = model_table(CellarItem)
    constraints = set(table.constraints)
    index_names = {index.name for index in table.indexes}

    assert CellarItem.__tablename__ == "cellar_items"
    assert any(isinstance(constraint, CheckConstraint) for constraint in constraints)
    assert "uq_cellar_items_active_ingredient" in index_names
    assert "uq_cellar_items_active_custom_name" in index_names

    item = CellarItem(
        user_id=User(phone_hash="hash-2", phone_masked="+86139****0000").id,
        ingredient_key="gin",
    )
    assert item.source is CellarItemSource.MANUAL
    assert item.created_at.tzinfo is UTC
