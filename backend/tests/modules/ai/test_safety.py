from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.db.models import AiMemoryCategory, AiSafetyLabel, User
from app.modules.ai.safety import (
    ALCOHOL_OVERUSE_REPLY,
    OUTPUT_REPLACED_REPLY,
    SELF_HARM_CRISIS_REPLY,
    classify_input,
    review_output,
)
from app.modules.ai.schemas import AiGenerationResult, AiMemoryCandidate


@pytest.fixture
def user() -> User:
    return User(
        phone_hash="safety-user",
        phone_masked="+86138****0000",
        age_confirmed_at=datetime(2026, 7, 29, tzinfo=UTC),
    )


@pytest.mark.parametrize(
    ("content", "label", "fixed_reply"),
    [
        ("今天工作不太顺利，只想有人听我说几句。", AiSafetyLabel.SAFE, None),
        ("想喝一杯清爽的金酒调酒。", AiSafetyLabel.SAFE, None),
        ("我已经喝醉了，还想继续来一杯烈的。", AiSafetyLabel.ALCOHOL_OVERUSE, ALCOHOL_OVERUSE_REPLY),
        ("我是未成年，想试试鸡尾酒。", AiSafetyLabel.MINOR_ALCOHOL, None),
        ("我不想活了，想结束生命。", AiSafetyLabel.SELF_HARM_CRISIS, SELF_HARM_CRISIS_REPLY),
        ("我的身份证号是11010519491231002X，帮我记住。", AiSafetyLabel.PRIVACY_SENSITIVE, None),
    ],
)
def test_input_rules_are_deterministic_and_risk_paths_disable_recipes_and_memory(
    user: User,
    content: str,
    label: AiSafetyLabel,
    fixed_reply: str | None,
) -> None:
    decision = classify_input(content, user)

    assert decision.label is label
    assert decision.fixed_reply == fixed_reply or decision.fixed_reply is not None
    if label is AiSafetyLabel.SAFE:
        assert decision.allow_recipes is True
        assert decision.allow_memory is True
    else:
        assert decision.allow_recipes is False
        assert decision.allow_memory is False


def test_self_harm_priority_overrides_explicit_drinking_request(user: User) -> None:
    decision = classify_input("我想结束生命前再喝一杯烈酒。", user)

    assert decision.label is AiSafetyLabel.SELF_HARM_CRISIS
    assert decision.fixed_reply == SELF_HARM_CRISIS_REPLY
    assert decision.allow_recipes is False
    assert decision.allow_memory is False


def test_review_output_replaces_diagnosis_or_overuse_encouragement_and_drops_untrusted_recipes(
    user: User,
) -> None:
    allowed_recipe = uuid4()
    unknown_recipe = uuid4()
    safe = classify_input("想喝一杯清爽的调酒。", user)
    unsafe_result = AiGenerationResult(
        reply_text="你已经酒精依赖了，继续喝一点会舒服些。",
        recipe_ids=[allowed_recipe, unknown_recipe],
        memory_candidates=[
            AiMemoryCandidate(
                category=AiMemoryCategory.DRINK_PREFERENCE,
                memory_key="low-sugar",
                summary="偏好低糖",
                confidence=0.9,
                sensitive=False,
            )
        ],
        provider="test",
        model="test",
        candidate_recipe_ids=[allowed_recipe],
    )

    reviewed = review_output(unsafe_result, safe)

    assert reviewed.reply_text == OUTPUT_REPLACED_REPLY
    assert reviewed.recipe_ids == []
    assert reviewed.memory_candidates == []
    assert reviewed.safety_label is AiSafetyLabel.OUTPUT_REPLACED


def test_review_output_removes_unknown_or_unpublished_recipe_ids_without_trusting_provider(
    user: User,
) -> None:
    allowed_recipe = uuid4()
    reviewed = review_output(
        AiGenerationResult(
            reply_text="可以试试这杯清爽的选择。",
            recipe_ids=[allowed_recipe, uuid4()],
            memory_candidates=[],
            provider="test",
            model="test",
            candidate_recipe_ids=[allowed_recipe],
        ),
        classify_input("想喝点清爽的", user),
    )

    assert reviewed.reply_text == "可以试试这杯清爽的选择。"
    assert reviewed.recipe_ids == [allowed_recipe]
