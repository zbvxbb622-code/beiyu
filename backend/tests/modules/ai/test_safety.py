from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.db.models import AiMemoryCategory, AiSafetyLabel, User
from app.modules.ai.safety import (
    ALCOHOL_OVERUSE_REPLY,
    OUTPUT_REPLACED_REPLY,
    SELF_HARM_CRISIS_REPLY,
    classify_input,
    redact_private_identifiers,
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


@pytest.mark.parametrize(
    "content",
    [
        "我想离开这个世界。",
        "我不想活了。",
        "我想结束生命。",
    ],
)
def test_first_person_crisis_rephrasings_are_detected(user: User, content: str) -> None:
    assert classify_input(content, user).label is AiSafetyLabel.SELF_HARM_CRISIS


@pytest.mark.parametrize(
    "content",
    [
        "我不是想自杀，只是今天有点累。",
        "我没有自杀想法，想找朋友聊聊。",
        "朋友说他想自杀，我不知道怎么陪他。",
    ],
)
def test_negated_or_explicitly_third_party_crisis_language_is_not_misattributed_to_user(
    user: User,
    content: str,
) -> None:
    assert classify_input(content, user).label is AiSafetyLabel.SAFE


def test_current_crisis_after_a_past_negation_still_takes_priority(user: User) -> None:
    assert (
        classify_input("我之前没有自杀想法，但现在想结束生命。", user).label
        is AiSafetyLabel.SELF_HARM_CRISIS
    )


@pytest.mark.parametrize(
    "content",
    [
        "朋友说我想自杀，但我不知道该怎么安慰他。",
        "朋友说：\"我想自杀\"，我不知道该怎么安慰他。",
        "朋友问我“想自杀吗”，我说不是。",
        "别人担心我会想自杀，但我没有这种想法。",
    ],
)
def test_reported_or_quoted_first_person_crisis_language_is_not_user_intent(
    user: User,
    content: str,
) -> None:
    assert classify_input(content, user).label is AiSafetyLabel.SAFE


def test_current_crisis_after_reported_language_and_turn_is_detected(user: User) -> None:
    assert (
        classify_input("朋友说：\"我想自杀\"，但现在我真的不想活了。", user).label
        is AiSafetyLabel.SELF_HARM_CRISIS
    )


def test_email_and_exact_address_are_classified_and_redacted_everywhere(user: User) -> None:
    private_value = "alice@example.com，浙江省杭州市西湖区文三路138号1201室"
    decision = classify_input(f"请记住我的邮箱和地址：{private_value}", user)

    assert decision.label is AiSafetyLabel.PRIVACY_SENSITIVE
    assert private_value not in redact_private_identifiers(private_value)
    assert "[已隐藏的敏感信息]" in redact_private_identifiers(private_value)


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
    )

    reviewed = review_output(unsafe_result, safe, [allowed_recipe])

    assert reviewed.reply_text == OUTPUT_REPLACED_REPLY
    assert reviewed.recipe_ids == []
    assert reviewed.memory_candidates == []
    assert reviewed.safety_label is AiSafetyLabel.OUTPUT_REPLACED


def test_review_output_removes_unknown_or_unpublished_recipe_ids_without_trusting_provider(
    user: User,
) -> None:
    allowed_recipe = uuid4()
    unpublished_recipe = uuid4()
    reviewed = review_output(
        AiGenerationResult.model_validate(
            {
                "replyText": "可以试试这杯清爽的选择。",
                "recipeIds": [allowed_recipe, unpublished_recipe, allowed_recipe],
                "memoryCandidates": [],
                "provider": "test",
                "model": "test",
                "candidateRecipeIds": [allowed_recipe, unpublished_recipe],
            }
        ),
        classify_input("想喝点清爽的", user),
        [allowed_recipe],
    )

    assert reviewed.reply_text == "可以试试这杯清爽的选择。"
    assert reviewed.recipe_ids == [allowed_recipe]


@pytest.mark.parametrize(
    "reply_text",
    [
        "你患有抑郁症。",
        "你就是抑郁症，可以确诊。",
        "喝酒能缓解你的焦虑和失眠。",
        "你只需要依赖我，只有我懂你，不要找别人。",
    ],
)
def test_review_output_replaces_diagnostic_alcohol_relief_and_exclusive_dependency_claims(
    user: User,
    reply_text: str,
) -> None:
    reviewed = review_output(
        AiGenerationResult(
            reply_text=reply_text,
            recipe_ids=[uuid4()],
            memory_candidates=[],
            provider="test",
            model="test",
        ),
        classify_input("今天很难过", user),
        [],
    )

    assert reviewed.reply_text == OUTPUT_REPLACED_REPLY
    assert reviewed.recipe_ids == []
    assert reviewed.memory_candidates == []


def test_review_output_keeps_ordinary_companion_language_and_removes_private_memory_candidate(
    user: User,
) -> None:
    private_value = "alice@example.com"
    reviewed = review_output(
        AiGenerationResult(
            reply_text="我会陪你聊，但也可以找信任的人说说。",
            memory_candidates=[
                AiMemoryCandidate(
                    category=AiMemoryCategory.EMOTIONAL_PREFERENCE,
                    memory_key=private_value,
                    summary=f"邮箱是{private_value}",
                    confidence=0.9,
                    sensitive=False,
                )
            ],
            provider="test",
            model="test",
        ),
        classify_input("今天很难过", user),
        [],
    )

    assert reviewed.reply_text == "我会陪你聊，但也可以找信任的人说说。"
    assert reviewed.memory_candidates == []
    assert private_value not in str(reviewed.model_dump())


@pytest.mark.parametrize("reply_text", ["", "x" * 8_001])
def test_review_output_replaces_blank_or_oversized_provider_reply(
    user: User,
    reply_text: str,
) -> None:
    reviewed = review_output(
        AiGenerationResult(reply_text=reply_text, provider="test", model="test"),
        classify_input("今天很难过", user),
        [],
    )

    assert reviewed.reply_text == OUTPUT_REPLACED_REPLY
    assert reviewed.recipe_ids == []
    assert reviewed.memory_candidates == []


@pytest.mark.parametrize(
    "reply_text",
    [
        "别去找其他人，你只需要依赖我。",
        "无需相信别人，只有我懂你。",
        "只有我最懂你。",
        "根据你的表现，我判断你患有焦虑症。",
        "我可以确定你就是抑郁症。",
        "灌醉自己能忘掉痛苦，也会让你好受。",
    ],
)
def test_review_output_replaces_compositional_safety_paraphrases(
    user: User,
    reply_text: str,
) -> None:
    reviewed = review_output(
        AiGenerationResult(reply_text=reply_text, provider="test", model="test"),
        classify_input("今天有点难过", user),
        [],
    )

    assert reviewed.reply_text == OUTPUT_REPLACED_REPLY
    assert reviewed.safety_label is AiSafetyLabel.OUTPUT_REPLACED
    assert reviewed.recipe_ids == []
    assert reviewed.memory_candidates == []


@pytest.mark.parametrize(
    "reply_text",
    [
        "我不能诊断，建议你考虑专业评估。",
        "酒精不能缓解焦虑，先照顾好自己。",
        "我会陪你聊，也可以找信任的人支持你。",
        "不要依赖我，也可以找其他人支持你。",
    ],
)
def test_review_output_keeps_nearby_safe_language(user: User, reply_text: str) -> None:
    reviewed = review_output(
        AiGenerationResult(reply_text=reply_text, provider="test", model="test"),
        classify_input("今天有点难过", user),
        [],
    )

    assert reviewed.reply_text == reply_text
    assert reviewed.safety_label is AiSafetyLabel.SAFE
