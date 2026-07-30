from collections.abc import Callable
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, cast
from uuid import UUID, uuid4

import pytest
from sqlalchemy import ColumnElement
from sqlmodel import Session, select

from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import (
    AiChatMode,
    AiConversation,
    AiDailyQuota,
    AiMemory,
    AiMemoryCategory,
    AiMessage,
    AiRequest,
    AiRequestStatus,
    AiSafetyLabel,
    AiUsageLog,
    ContentStatus,
    Recipe,
    User,
    UserStatus,
)
from app.integrations.ai.base import (
    AiProviderInvalidResponse,
    AiProviderTimeout,
    AiProviderUnavailable,
)
from app.modules.ai import orchestrator
from app.modules.ai.safety import OUTPUT_REPLACED_REPLY, SELF_HARM_CRISIS_REPLY
from app.modules.ai.schemas import (
    AiGenerationRequest,
    AiGenerationResult,
    AiMemoryCandidate,
    SendMessageRequest,
    TemporaryContextMessage,
    TemporaryMessageRequest,
)

NOW = datetime(2026, 7, 29, 12, tzinfo=UTC)


def ai_settings() -> Settings:
    return Settings(
        database_url="postgresql+psycopg://user:pass@db/beiyu",
        ai_memory_hmac_key="orchestrator-memory-secret-value",
    )


def persist_owner_and_conversation(
    session: Session,
    *,
    suffix: str = "owner",
) -> tuple[User, UUID]:
    user = User(
        phone_hash=f"orchestrator-{suffix}-{uuid4().hex}",
        phone_masked="+86138****0000",
        age_confirmed_at=NOW,
    )
    session.add(user)
    session.flush()
    conversation = AiConversation(user_id=user.id, created_at=NOW, updated_at=NOW)
    session.add(conversation)
    conversation_id = conversation.id
    session.commit()
    return user, conversation_id


def normal_payload(
    content: str = "我喜欢清爽、低甜的饮品。",
    *,
    client_message_id: UUID | None = None,
) -> SendMessageRequest:
    return SendMessageRequest(
        content=content,
        client_message_id=client_message_id or uuid4(),
    )


def temporary_payload(
    content: str = "继续刚才的话题。",
    *,
    client_message_id: UUID | None = None,
) -> TemporaryMessageRequest:
    return TemporaryMessageRequest(
        content=content,
        client_message_id=client_message_id or uuid4(),
        context=[
            TemporaryContextMessage(role="USER", content="今天不太顺利。"),
            TemporaryContextMessage(
                role="ASSISTANT",
                content="我在。你可以慢慢说。",
            ),
        ],
    )


def generation_result(
    *,
    reply_text: str = "记下了。我会优先考虑清爽、低甜的方向。",
    recipe_ids: list[UUID] | None = None,
    memory_candidates: list[AiMemoryCandidate] | None = None,
) -> AiGenerationResult:
    return AiGenerationResult(
        reply_text=reply_text,
        recipe_ids=recipe_ids or [],
        memory_candidates=memory_candidates or [],
        provider="mock-provider",
        model="mock-model-v1",
        input_tokens=12,
        output_tokens=8,
        cost_estimate=0.0125,
    )


class MockProvider:
    def __init__(
        self,
        session: Session,
        result: AiGenerationResult | Exception,
        *,
        events: list[str] | None = None,
    ) -> None:
        self.session = session
        self.result = result
        self.events = events
        self.calls: list[AiGenerationRequest] = []

    def generate(self, request: AiGenerationRequest) -> AiGenerationResult:
        assert self.session.in_transaction() is False
        if self.events is not None:
            self.events.append("provider")
        self.calls.append(request)
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def record_call(
    monkeypatch: pytest.MonkeyPatch,
    events: list[str],
    name: str,
) -> None:
    original = getattr(orchestrator, name)

    def wrapped(*args: Any, **kwargs: Any) -> Any:
        events.append(name)
        return original(*args, **kwargs)

    monkeypatch.setattr(orchestrator, name, wrapped)


def assert_app_error(
    code: str,
    status_code: int,
    action: Callable[[], object],
) -> None:
    with pytest.raises(AppError) as raised:
        action()
    assert raised.value.code == code
    assert raised.value.status_code == status_code


def test_normal_success_orders_services_calls_provider_outside_transaction_and_commits_atomically(
    database_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user, conversation_id = persist_owner_and_conversation(database_session)
    recipe = Recipe(
        public_id=f"recipe-{uuid4().hex}",
        status=ContentStatus.PUBLISHED,
        published_at=NOW,
        name="清爽酒谱",
        english_name="Crisp",
        description="清爽低甜",
        tags=["清爽"],
    )
    database_session.add(recipe)
    recipe_id = recipe.id
    database_session.commit()
    candidate = AiMemoryCandidate(
        category=AiMemoryCategory.DRINK_PREFERENCE,
        memory_key="taste:crisp-low-sugar",
        summary="偏好清爽、低甜的饮品",
        confidence=0.9,
        sensitive=False,
    )
    events: list[str] = []
    for name in (
        "require_ai_access",
        "reserve_request",
        "classify_input",
        "build_normal_generation_request",
        "review_output",
        "save_exchange",
        "apply_memory_candidates",
        "complete_reservation",
    ):
        record_call(monkeypatch, events, name)
    provider = MockProvider(
        database_session,
        generation_result(
            recipe_ids=[recipe_id, uuid4()],
            memory_candidates=[candidate],
        ),
        events=events,
    )

    response = orchestrator.send_normal_message(
        database_session,
        user,
        conversation_id,
        normal_payload(),
        provider,
        ai_settings(),
        NOW,
        monotonic=lambda: 10.25,
    )

    assert events == [
        "require_ai_access",
        "reserve_request",
        "classify_input",
        "build_normal_generation_request",
        "provider",
        "review_output",
        "save_exchange",
        "apply_memory_candidates",
        "complete_reservation",
    ]
    assert response.assistant_message.recipe_ids == [recipe_id]
    assert [change.summary for change in response.memory_changes] == [
        "偏好清爽、低甜的饮品"
    ]
    assert response.usage.model_dump() == {
        "limit": 50,
        "used": 1,
        "remaining": 49,
        "resetsAt": datetime(2026, 7, 29, 16, tzinfo=UTC),
    }
    assert database_session.in_transaction() is False
    assert len(database_session.exec(select(AiMessage)).all()) == 2
    assert len(database_session.exec(select(AiMemory)).all()) == 1
    usage = database_session.exec(select(AiUsageLog)).one()
    assert (
        usage.provider,
        usage.model,
        usage.input_tokens,
        usage.output_tokens,
        usage.cost_estimate,
        usage.safety_label,
    ) == (
        "mock-provider",
        "mock-model-v1",
        12,
        8,
        Decimal("0.012500"),
        AiSafetyLabel.SAFE,
    )


def test_foreign_conversation_is_rejected_before_reservation(
    database_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user, _ = persist_owner_and_conversation(database_session)
    _, foreign_conversation_id = persist_owner_and_conversation(
        database_session,
        suffix="foreign",
    )
    reserve_called = False
    original = orchestrator.reserve_request

    def tracked_reserve(*args: Any, **kwargs: Any) -> Any:
        nonlocal reserve_called
        reserve_called = True
        return original(*args, **kwargs)

    monkeypatch.setattr(orchestrator, "reserve_request", tracked_reserve)

    assert_app_error(
        "AI_CONVERSATION_NOT_FOUND",
        404,
        lambda: orchestrator.send_normal_message(
            database_session,
            user,
            foreign_conversation_id,
            normal_payload(),
            MockProvider(database_session, generation_result()),
            ai_settings(),
            NOW,
        ),
    )

    assert reserve_called is False
    assert database_session.exec(select(AiRequest)).all() == []
    assert database_session.exec(select(AiDailyQuota)).all() == []


def test_fixed_safety_reply_skips_provider_and_is_a_successful_normal_exchange(
    database_session: Session,
) -> None:
    user, conversation_id = persist_owner_and_conversation(database_session)
    provider = MockProvider(database_session, generation_result())

    response = orchestrator.send_normal_message(
        database_session,
        user,
        conversation_id,
        normal_payload("我不想活了"),
        provider,
        ai_settings(),
        NOW,
    )

    assert provider.calls == []
    assert response.assistant_message.content == SELF_HARM_CRISIS_REPLY
    assert response.assistant_message.safety_label is AiSafetyLabel.SELF_HARM_CRISIS
    assert response.assistant_message.recipe_ids == []
    assert response.memory_changes == []
    usage = database_session.exec(select(AiUsageLog)).one()
    assert (
        usage.outcome,
        usage.provider,
        usage.model,
        usage.input_tokens,
        usage.output_tokens,
        usage.latency_ms,
        usage.safety_label,
    ) == (
        "SUCCEEDED",
        "server",
        "safety-rules",
        None,
        None,
        0,
        AiSafetyLabel.SELF_HARM_CRISIS,
    )


@pytest.mark.parametrize(
    ("provider_error", "code", "status_code"),
    [
        (AiProviderTimeout("secret timeout detail"), "AI_PROVIDER_TIMEOUT", 504),
        (AiProviderUnavailable("secret unavailable detail"), "AI_PROVIDER_UNAVAILABLE", 503),
        (
            AiProviderInvalidResponse("secret invalid body"),
            "AI_PROVIDER_UNAVAILABLE",
            503,
        ),
    ],
)
def test_provider_failures_release_reservation_and_record_one_failed_attempt(
    database_session: Session,
    provider_error: Exception,
    code: str,
    status_code: int,
) -> None:
    user, conversation_id = persist_owner_and_conversation(database_session)
    payload = normal_payload()
    provider = MockProvider(database_session, provider_error)
    ticks = iter([10.0, 10.125])

    assert_app_error(
        code,
        status_code,
        lambda: orchestrator.send_normal_message(
            database_session,
            user,
            conversation_id,
            payload,
            provider,
            ai_settings(),
            NOW,
            monotonic=lambda: next(ticks),
        ),
    )

    request = database_session.exec(select(AiRequest)).one()
    quota = database_session.exec(select(AiDailyQuota)).one()
    logs = database_session.exec(select(AiUsageLog)).all()
    assert request.status is AiRequestStatus.FAILED
    assert request.failure_code == code
    assert (quota.used_count, quota.reserved_count) == (0, 0)
    assert [(log.outcome, log.latency_ms) for log in logs] == [("FAILED", 125)]
    assert database_session.exec(select(AiMessage)).all() == []


def test_reviewed_unsafe_output_replaces_content_and_drops_recipes_and_memory(
    database_session: Session,
) -> None:
    user, conversation_id = persist_owner_and_conversation(database_session)
    recipe = Recipe(
        public_id=f"recipe-{uuid4().hex}",
        status=ContentStatus.PUBLISHED,
        published_at=NOW,
        name="酒谱",
        english_name="Drink",
        description="description",
    )
    database_session.add(recipe)
    recipe_id = recipe.id
    database_session.commit()
    provider = MockProvider(
        database_session,
        generation_result(
            reply_text="喝酒能麻痹痛苦。",
            recipe_ids=[recipe_id],
            memory_candidates=[
                AiMemoryCandidate(
                    category=AiMemoryCategory.DRINK_PREFERENCE,
                    memory_key="unsafe",
                    summary="偏好清爽、低甜的饮品",
                    confidence=0.9,
                    sensitive=False,
                )
            ],
        ),
    )

    response = orchestrator.send_normal_message(
        database_session,
        user,
        conversation_id,
        normal_payload(),
        provider,
        ai_settings(),
        NOW,
    )

    assert response.assistant_message.content == OUTPUT_REPLACED_REPLY
    assert response.assistant_message.safety_label is AiSafetyLabel.OUTPUT_REPLACED
    assert response.assistant_message.recipe_ids == []
    assert response.memory_changes == []
    assert database_session.exec(select(AiMemory)).all() == []


def test_temporary_success_uses_request_context_without_retaining_text_or_response_id(
    database_session: Session,
    caplog: pytest.LogCaptureFixture,
) -> None:
    user, _ = persist_owner_and_conversation(database_session)
    payload = temporary_payload(content="临时秘密正文 7fbd7bd1")
    provider = MockProvider(
        database_session,
        generation_result(reply_text="临时回复正文 7fbd7bd1"),
    )

    response = orchestrator.send_temporary_message(
        database_session,
        user,
        payload,
        provider,
        ai_settings(),
        NOW,
        monotonic=lambda: 4.0,
    )

    assert [message.content for message in provider.calls[0].messages] == [
        "今天不太顺利。",
        "我在。你可以慢慢说。",
        "临时秘密正文 7fbd7bd1",
    ]
    assert response.assistant_message.content == "临时回复正文 7fbd7bd1"
    assert response.memory_changes == []
    assert database_session.exec(select(AiMessage)).all() == []
    assert database_session.exec(select(AiMemory)).all() == []
    request = database_session.exec(select(AiRequest)).one()
    assert request.mode is AiChatMode.TEMPORARY
    assert request.response_message_id is None
    assert request.conversation_id is None
    assert database_session.exec(select(AiUsageLog)).one().conversation_id is None
    assert "临时秘密正文 7fbd7bd1" not in caplog.text
    assert "临时回复正文 7fbd7bd1" not in caplog.text


def test_temporary_success_retry_is_not_retained_and_does_not_call_provider_again(
    database_session: Session,
) -> None:
    user, _ = persist_owner_and_conversation(database_session)
    payload = temporary_payload()
    first_provider = MockProvider(database_session, generation_result())
    orchestrator.send_temporary_message(
        database_session,
        user,
        payload,
        first_provider,
        ai_settings(),
        NOW,
    )
    retry_provider = MockProvider(database_session, generation_result())

    assert_app_error(
        "TEMPORARY_RESPONSE_NOT_RETAINED",
        409,
        lambda: orchestrator.send_temporary_message(
            database_session,
            user,
            payload,
            retry_provider,
            ai_settings(),
            NOW,
        ),
    )

    assert retry_provider.calls == []
    assert len(database_session.exec(select(AiUsageLog)).all()) == 1
    assert database_session.exec(select(AiDailyQuota)).one().used_count == 1


def test_normal_success_replays_server_owned_exchange_without_provider_or_duplicate_writes(
    database_session: Session,
) -> None:
    user, conversation_id = persist_owner_and_conversation(database_session)
    payload = normal_payload()
    first_provider = MockProvider(database_session, generation_result())
    first = orchestrator.send_normal_message(
        database_session,
        user,
        conversation_id,
        payload,
        first_provider,
        ai_settings(),
        NOW,
    )
    replay_provider = MockProvider(
        database_session,
        generation_result(reply_text="must not be returned"),
    )

    replay = orchestrator.send_normal_message(
        database_session,
        user,
        conversation_id,
        payload,
        replay_provider,
        ai_settings(),
        NOW,
    )

    assert replay_provider.calls == []
    assert replay.conversation == first.conversation
    assert replay.user_message == first.user_message
    assert replay.assistant_message == first.assistant_message
    assert replay.usage == first.usage
    assert replay.memory_changes == []
    assert len(database_session.exec(select(AiMessage)).all()) == 2
    assert len(database_session.exec(select(AiUsageLog)).all()) == 1


def test_in_progress_normal_request_returns_stable_conflict_without_provider(
    database_session: Session,
) -> None:
    user, conversation_id = persist_owner_and_conversation(database_session)
    payload = normal_payload()
    trusted_user = database_session.get(User, _identity(user))
    assert trusted_user is not None
    orchestrator.reserve_request(
        database_session,
        trusted_user,
        payload.client_message_id,
        AiChatMode.NORMAL,
        conversation_id,
        ai_settings(),
        NOW,
    )
    database_session.commit()
    provider = MockProvider(database_session, generation_result())

    assert_app_error(
        "AI_REQUEST_IN_PROGRESS",
        409,
        lambda: orchestrator.send_normal_message(
            database_session,
            user,
            conversation_id,
            payload,
            provider,
            ai_settings(),
            NOW,
        ),
    )

    assert provider.calls == []
    request = database_session.exec(select(AiRequest)).one()
    assert request.status is AiRequestStatus.RESERVED
    assert request.attempt_count == 1


def _identity(instance: User) -> UUID:
    value = instance.id
    assert isinstance(value, UUID)
    return value


def test_failed_normal_retry_uses_provider_again_and_records_each_attempt_once(
    database_session: Session,
) -> None:
    user, conversation_id = persist_owner_and_conversation(database_session)
    payload = normal_payload()
    ticks = iter([1.0, 1.01])
    assert_app_error(
        "AI_PROVIDER_TIMEOUT",
        504,
        lambda: orchestrator.send_normal_message(
            database_session,
            user,
            conversation_id,
            payload,
            MockProvider(database_session, AiProviderTimeout("timeout")),
            ai_settings(),
            NOW,
            monotonic=lambda: next(ticks),
        ),
    )

    provider = MockProvider(database_session, generation_result())
    response = orchestrator.send_normal_message(
        database_session,
        user,
        conversation_id,
        payload,
        provider,
        ai_settings(),
        NOW,
        monotonic=lambda: 2.0,
    )

    request = database_session.exec(select(AiRequest)).one()
    logs = database_session.exec(
        select(AiUsageLog).order_by(
            cast(ColumnElement[Any], AiUsageLog.attempt_no)
        )
    ).all()
    assert request.status is AiRequestStatus.SUCCEEDED
    assert request.attempt_count == 2
    assert [log.outcome for log in logs] == ["FAILED", "SUCCEEDED"]
    assert response.usage.used == 1
    assert len(provider.calls) == 1


def test_unknown_provider_error_releases_reservation_and_preserves_original_exception(
    database_session: Session,
) -> None:
    class ProviderBug(RuntimeError):
        pass

    user, conversation_id = persist_owner_and_conversation(database_session)
    error = ProviderBug("opaque provider bug")
    with pytest.raises(ProviderBug) as raised:
        orchestrator.send_normal_message(
            database_session,
            user,
            conversation_id,
            normal_payload(),
            MockProvider(database_session, error),
            ai_settings(),
            NOW,
            monotonic=lambda: 3.0,
        )

    assert raised.value is error
    request = database_session.exec(select(AiRequest)).one()
    assert (request.status, request.failure_code) == (
        AiRequestStatus.FAILED,
        "AI_INTERNAL_ERROR",
    )
    assert database_session.exec(select(AiDailyQuota)).one().reserved_count == 0
    assert len(database_session.exec(select(AiUsageLog)).all()) == 1


@pytest.mark.parametrize(
    "failure_point",
    ["classify_input", "build_normal_generation_request"],
)
def test_safety_or_context_failure_commits_failed_reservation_without_provider(
    database_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    failure_point: str,
) -> None:
    class InternalFailure(RuntimeError):
        pass

    user, conversation_id = persist_owner_and_conversation(database_session)
    error = InternalFailure(failure_point)

    def fail(*_: Any, **__: Any) -> Any:
        raise error

    monkeypatch.setattr(orchestrator, failure_point, fail)
    provider = MockProvider(database_session, generation_result())
    with pytest.raises(InternalFailure) as raised:
        orchestrator.send_normal_message(
            database_session,
            user,
            conversation_id,
            normal_payload(),
            provider,
            ai_settings(),
            NOW,
        )

    assert raised.value is error
    assert provider.calls == []
    request = database_session.exec(select(AiRequest)).one()
    assert (request.status, request.failure_code) == (
        AiRequestStatus.FAILED,
        "AI_INTERNAL_ERROR",
    )
    assert len(database_session.exec(select(AiUsageLog)).all()) == 1


@pytest.mark.parametrize(
    "failure_point",
    ["apply_memory_candidates", "complete_reservation"],
)
def test_normal_final_domain_failure_rolls_back_messages_memory_and_completion(
    database_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    failure_point: str,
) -> None:
    class FinalizationFailure(RuntimeError):
        pass

    user, conversation_id = persist_owner_and_conversation(database_session)
    candidate = AiMemoryCandidate(
        category=AiMemoryCategory.DRINK_PREFERENCE,
        memory_key="taste:crisp-low-sugar",
        summary="偏好清爽、低甜的饮品",
        confidence=0.9,
        sensitive=False,
    )
    error = FinalizationFailure(failure_point)

    def fail(*_: Any, **__: Any) -> Any:
        raise error

    monkeypatch.setattr(orchestrator, failure_point, fail)
    with pytest.raises(FinalizationFailure) as raised:
        orchestrator.send_normal_message(
            database_session,
            user,
            conversation_id,
            normal_payload(),
            MockProvider(
                database_session,
                generation_result(memory_candidates=[candidate]),
            ),
            ai_settings(),
            NOW,
            monotonic=lambda: 5.0,
        )

    assert raised.value is error
    assert database_session.exec(select(AiMessage)).all() == []
    assert database_session.exec(select(AiMemory)).all() == []
    request = database_session.exec(select(AiRequest)).one()
    quota = database_session.exec(select(AiDailyQuota)).one()
    assert (request.status, request.response_message_id) == (
        AiRequestStatus.FAILED,
        None,
    )
    assert (quota.used_count, quota.reserved_count) == (0, 0)
    assert [(log.outcome, log.attempt_no) for log in database_session.exec(select(AiUsageLog))] == [
        ("FAILED", 1)
    ]


def test_normal_final_commit_failure_rolls_back_everything_then_fails_reservation(
    database_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class CommitFailure(RuntimeError):
        pass

    user, conversation_id = persist_owner_and_conversation(database_session)
    original_commit = database_session.commit
    commit_count = 0
    error = CommitFailure("final commit")

    def commit_with_final_failure() -> None:
        nonlocal commit_count
        commit_count += 1
        if commit_count == 3:
            raise error
        original_commit()

    monkeypatch.setattr(database_session, "commit", commit_with_final_failure)
    with pytest.raises(CommitFailure) as raised:
        orchestrator.send_normal_message(
            database_session,
            user,
            conversation_id,
            normal_payload(),
            MockProvider(database_session, generation_result()),
            ai_settings(),
            NOW,
        )

    assert raised.value is error
    assert commit_count == 4
    assert database_session.exec(select(AiMessage)).all() == []
    request = database_session.exec(select(AiRequest)).one()
    quota = database_session.exec(select(AiDailyQuota)).one()
    assert (request.status, request.response_message_id) == (
        AiRequestStatus.FAILED,
        None,
    )
    assert (quota.used_count, quota.reserved_count) == (0, 0)
    assert [log.outcome for log in database_session.exec(select(AiUsageLog))] == [
        "FAILED"
    ]


def test_temporary_fixed_safety_reply_uses_no_provider_and_retains_no_messages(
    database_session: Session,
) -> None:
    user, _ = persist_owner_and_conversation(database_session)
    provider = MockProvider(database_session, generation_result())

    response = orchestrator.send_temporary_message(
        database_session,
        user,
        temporary_payload("我不想活了"),
        provider,
        ai_settings(),
        NOW,
    )

    assert provider.calls == []
    assert response.assistant_message.content == SELF_HARM_CRISIS_REPLY
    assert response.assistant_message.safety_label is AiSafetyLabel.SELF_HARM_CRISIS
    assert database_session.exec(select(AiMessage)).all() == []
    usage = database_session.exec(select(AiUsageLog)).one()
    assert (usage.provider, usage.model, usage.safety_label) == (
        "server",
        "safety-rules",
        AiSafetyLabel.SELF_HARM_CRISIS,
    )


def test_orchestrator_rejects_caller_transaction_state_without_committing_it(
    database_session: Session,
) -> None:
    user, conversation_id = persist_owner_and_conversation(database_session)
    unrelated = User(
        phone_hash=f"unrelated-{uuid4().hex}",
        phone_masked="+86138****9999",
    )
    database_session.add(unrelated)

    with pytest.raises(RuntimeError, match="clean caller session"):
        orchestrator.send_normal_message(
            database_session,
            user,
            conversation_id,
            normal_payload(),
            MockProvider(database_session, generation_result()),
            ai_settings(),
            NOW,
        )

    assert unrelated in database_session.new
    assert database_session.exec(select(AiRequest)).all() == []


@pytest.mark.parametrize("mode", [AiChatMode.NORMAL, AiChatMode.TEMPORARY])
def test_output_safety_failure_releases_reservation_and_preserves_original_error(
    database_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    mode: AiChatMode,
) -> None:
    class ReviewFailure(RuntimeError):
        pass

    user, conversation_id = persist_owner_and_conversation(database_session)
    error = ReviewFailure("output review")

    def fail_review(*_: Any, **__: Any) -> Any:
        raise error

    monkeypatch.setattr(orchestrator, "review_output", fail_review)
    with pytest.raises(ReviewFailure) as raised:
        if mode is AiChatMode.NORMAL:
            orchestrator.send_normal_message(
                database_session,
                user,
                conversation_id,
                normal_payload(),
                MockProvider(database_session, generation_result()),
                ai_settings(),
                NOW,
            )
        else:
            orchestrator.send_temporary_message(
                database_session,
                user,
                temporary_payload(),
                MockProvider(database_session, generation_result()),
                ai_settings(),
                NOW,
            )

    assert raised.value is error
    request = database_session.exec(select(AiRequest)).one()
    assert (request.status, request.failure_code) == (
        AiRequestStatus.FAILED,
        "AI_INTERNAL_ERROR",
    )
    assert database_session.exec(select(AiDailyQuota)).one().reserved_count == 0
    assert [log.outcome for log in database_session.exec(select(AiUsageLog))] == [
        "FAILED"
    ]


def test_access_requeries_stored_user_instead_of_trusting_caller_fields(
    database_session: Session,
) -> None:
    user, conversation_id = persist_owner_and_conversation(database_session)
    user_id = _identity(user)
    stored_user = database_session.get(User, user_id)
    assert stored_user is not None
    stored_user.status = UserStatus.BANNED
    database_session.add(stored_user)
    database_session.commit()
    forged_active_user = User(
        id=user_id,
        phone_hash="forged",
        phone_masked="+86138****9999",
        age_confirmed_at=NOW,
    )

    assert_app_error(
        "AI_ACCESS_SUSPENDED",
        403,
        lambda: orchestrator.send_normal_message(
            database_session,
            forged_active_user,
            conversation_id,
            normal_payload(),
            MockProvider(database_session, generation_result()),
            ai_settings(),
            NOW,
        ),
    )

    assert database_session.exec(select(AiRequest)).all() == []


def test_read_only_auth_transaction_is_closed_before_orchestration(
    database_session: Session,
) -> None:
    user, conversation_id = persist_owner_and_conversation(database_session)
    user_id = _identity(user)
    assert database_session.exec(select(User).where(User.id == user_id)).one().id == user_id
    assert database_session.in_transaction() is True
    assert not database_session.new
    assert not database_session.dirty
    assert not database_session.deleted

    response = orchestrator.send_normal_message(
        database_session,
        user,
        conversation_id,
        normal_payload(),
        MockProvider(database_session, generation_result()),
        ai_settings(),
        NOW,
    )

    assert response.usage.used == 1
    assert database_session.in_transaction() is False


def test_cross_mode_client_message_id_returns_stable_conflict_without_second_attempt(
    database_session: Session,
) -> None:
    user, conversation_id = persist_owner_and_conversation(database_session)
    client_message_id = uuid4()
    orchestrator.send_normal_message(
        database_session,
        user,
        conversation_id,
        normal_payload(client_message_id=client_message_id),
        MockProvider(database_session, generation_result()),
        ai_settings(),
        NOW,
    )
    provider = MockProvider(database_session, generation_result())

    assert_app_error(
        "AI_REQUEST_CONFLICT",
        409,
        lambda: orchestrator.send_temporary_message(
            database_session,
            user,
            temporary_payload(client_message_id=client_message_id),
            provider,
            ai_settings(),
            NOW,
        ),
    )

    assert provider.calls == []
    request = database_session.exec(select(AiRequest)).one()
    assert (request.mode, request.status, request.attempt_count) == (
        AiChatMode.NORMAL,
        AiRequestStatus.SUCCEEDED,
        1,
    )
    assert len(database_session.exec(select(AiUsageLog)).all()) == 1
    quota = database_session.exec(select(AiDailyQuota)).one()
    assert (quota.used_count, quota.reserved_count) == (1, 0)


def test_failed_cross_mode_retry_rolls_back_attempt_and_quota_mutations(
    database_session: Session,
) -> None:
    user, conversation_id = persist_owner_and_conversation(database_session)
    client_message_id = uuid4()
    ticks = iter([1.0, 1.01])
    assert_app_error(
        "AI_PROVIDER_TIMEOUT",
        504,
        lambda: orchestrator.send_normal_message(
            database_session,
            user,
            conversation_id,
            normal_payload(client_message_id=client_message_id),
            MockProvider(database_session, AiProviderTimeout("timeout")),
            ai_settings(),
            NOW,
            monotonic=lambda: next(ticks),
        ),
    )
    provider = MockProvider(database_session, generation_result())

    assert_app_error(
        "AI_REQUEST_CONFLICT",
        409,
        lambda: orchestrator.send_temporary_message(
            database_session,
            user,
            temporary_payload(client_message_id=client_message_id),
            provider,
            ai_settings(),
            NOW,
        ),
    )

    assert provider.calls == []
    request = database_session.exec(select(AiRequest)).one()
    assert (
        request.mode,
        request.status,
        request.attempt_count,
        request.failure_code,
    ) == (
        AiChatMode.NORMAL,
        AiRequestStatus.FAILED,
        1,
        "AI_PROVIDER_TIMEOUT",
    )
    quota = database_session.exec(select(AiDailyQuota)).one()
    assert (quota.used_count, quota.reserved_count) == (0, 0)
    assert [log.outcome for log in database_session.exec(select(AiUsageLog))] == [
        "FAILED"
    ]


def test_cross_conversation_client_message_id_does_not_replay_old_exchange(
    database_session: Session,
) -> None:
    user, first_conversation_id = persist_owner_and_conversation(database_session)
    user_id = _identity(user)
    second_conversation = AiConversation(
        user_id=user_id,
        created_at=NOW,
        updated_at=NOW,
    )
    database_session.add(second_conversation)
    second_conversation_id = second_conversation.id
    database_session.commit()
    client_message_id = uuid4()
    first = orchestrator.send_normal_message(
        database_session,
        user,
        first_conversation_id,
        normal_payload(client_message_id=client_message_id),
        MockProvider(database_session, generation_result()),
        ai_settings(),
        NOW,
    )
    provider = MockProvider(database_session, generation_result())

    assert_app_error(
        "AI_REQUEST_CONFLICT",
        409,
        lambda: orchestrator.send_normal_message(
            database_session,
            user,
            second_conversation_id,
            normal_payload(client_message_id=client_message_id),
            provider,
            ai_settings(),
            NOW,
        ),
    )

    assert provider.calls == []
    assert database_session.exec(select(AiRequest)).one().conversation_id == (
        first.conversation.id
    )
    assert len(database_session.exec(select(AiMessage)).all()) == 2
    assert len(database_session.exec(select(AiUsageLog)).all()) == 1
