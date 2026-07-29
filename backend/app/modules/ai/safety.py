import re
from dataclasses import dataclass
from uuid import UUID

from app.db.models import AiMemoryCategory, AiSafetyLabel, User
from app.modules.ai.schemas import AiGenerationResult, AiMemoryCandidate

ALCOHOL_OVERUSE_REPLY = (
    "听起来你现在已经喝得不少了。先别继续喝，喝点水、找个安全的地方休息，"
    "也可以联系身边信任的人陪你一会儿。"
)
MINOR_ALCOHOL_REPLY = "我不能提供含酒精饮品建议。不过可以一起想想清爽的无酒精饮品。"
SELF_HARM_CRISIS_REPLY = (
    "听到你这么说，我很在意你此刻的安全。请先联系身边信任的人陪着你，"
    "如果你可能马上伤害自己，请立即联系当地紧急服务或危机支持热线。"
)
PRIVACY_REPLY = "这类身份信息不适合发在聊天里，也不会被我记住。请不要继续发送证件、银行卡或详细住址。"
OUTPUT_REPLACED_REPLY = "我先不沿着这个方向回答。我们可以聊聊让你现在更安全、更舒服的下一步。"

SELF_HARM_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in ("想自杀", "不想活了", "结束生命", "伤害自己", "割腕", "去死")
)
MINOR_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in ("未成年", "未满18", "未满十八", "我是1[0-7]岁", "我才1[0-7]岁", "初中生")
)
OVERUSE_STATE_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in ("喝醉", "醉了", "喝多了", "断片", "喝吐", "酒精中毒")
)
OVERUSE_CONTINUE_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in ("继续喝", "继续来", "再来一杯", "再喝", "加一杯", "来杯烈")
)
DIRECT_OVERUSE_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in ("喝到吐", "喝到断片", "灌醉", "拼酒")
)
PHONE_PATTERN = re.compile(r"(?<!\d)1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}(?!\d)")
ID_CARD_PATTERN = re.compile(r"(?<![\dXx])\d{17}[\dXx](?![\dXx])")
BANK_CARD_PATTERN = re.compile(r"(?<!\d)(?:\d[ -]?){15,18}\d(?!\d)")
ADDRESS_PATTERN = re.compile(r"(?:住址|详细地址|家庭地址|地址是|住在).{4,80}")
MEDICAL_INPUT_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in ("帮我诊断", "诊断我", "我是不是.*(?:抑郁|焦虑|酒精依赖)")
)
OUTPUT_DIAGNOSIS_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        "你(?:就是|已经|肯定).{0,12}(?:抑郁症|焦虑症|酒精依赖|精神疾病)",
        "诊断(?:为|是).{0,12}(?:抑郁症|焦虑症|酒精依赖|精神疾病)",
    )
)
OUTPUT_OVERUSE_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in ("继续喝.*(?:舒服|没事|可以)", "再喝.*(?:舒服|没事|可以)", "多喝一点")
)
INTERNAL_PROMPT_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in ("system prompt", "系统提示词", "内部字段", "candidate_recipe_ids")
)
ALLOWED_MEMORY_CATEGORIES = frozenset(AiMemoryCategory)


@dataclass(frozen=True)
class SafetyDecision:
    label: AiSafetyLabel
    fixed_reply: str | None
    allow_recipes: bool
    allow_memory: bool


SAFE_DECISION = SafetyDecision(AiSafetyLabel.SAFE, None, True, True)


def _matches(content: str, patterns: tuple[re.Pattern[str], ...]) -> bool:
    return any(pattern.search(content) is not None for pattern in patterns)


def contains_private_identifiers(content: str) -> bool:
    return any(
        pattern.search(content) is not None
        for pattern in (PHONE_PATTERN, ID_CARD_PATTERN, BANK_CARD_PATTERN, ADDRESS_PATTERN)
    )


def redact_private_identifiers(content: str) -> str:
    redacted = content
    for pattern in (PHONE_PATTERN, ID_CARD_PATTERN, BANK_CARD_PATTERN, ADDRESS_PATTERN):
        redacted = pattern.sub("[已隐藏的敏感信息]", redacted)
    return redacted


def _risk_decision(label: AiSafetyLabel, reply: str) -> SafetyDecision:
    return SafetyDecision(label=label, fixed_reply=reply, allow_recipes=False, allow_memory=False)


def classify_input(content: str, user: User) -> SafetyDecision:
    del user
    normalized = content.strip()
    if _matches(normalized, SELF_HARM_PATTERNS):
        return _risk_decision(AiSafetyLabel.SELF_HARM_CRISIS, SELF_HARM_CRISIS_REPLY)
    if _matches(normalized, MINOR_PATTERNS):
        return _risk_decision(AiSafetyLabel.MINOR_ALCOHOL, MINOR_ALCOHOL_REPLY)
    if _matches(normalized, DIRECT_OVERUSE_PATTERNS) or (
        _matches(normalized, OVERUSE_STATE_PATTERNS)
        and _matches(normalized, OVERUSE_CONTINUE_PATTERNS)
    ):
        return _risk_decision(AiSafetyLabel.ALCOHOL_OVERUSE, ALCOHOL_OVERUSE_REPLY)
    if contains_private_identifiers(normalized) or _matches(normalized, MEDICAL_INPUT_PATTERNS):
        return _risk_decision(AiSafetyLabel.PRIVACY_SENSITIVE, PRIVACY_REPLY)
    return SAFE_DECISION


def _safe_memory_candidates(candidates: list[AiMemoryCandidate]) -> list[AiMemoryCandidate]:
    return [
        candidate
        for candidate in candidates
        if not candidate.sensitive
        and candidate.category in ALLOWED_MEMORY_CATEGORIES
        and candidate.summary == candidate.summary.strip()
    ]


def review_output(result: AiGenerationResult, decision: SafetyDecision) -> AiGenerationResult:
    if decision.fixed_reply is not None:
        return result.model_copy(
            update={
                "reply_text": decision.fixed_reply,
                "recipe_ids": [],
                "memory_candidates": [],
                "safety_label": decision.label,
            }
        )

    reply = result.reply_text.strip()
    unsafe_reply = (
        not reply
        or len(reply) > 8_000
        or _matches(reply, OUTPUT_DIAGNOSIS_PATTERNS)
        or _matches(reply, OUTPUT_OVERUSE_PATTERNS)
        or _matches(reply, INTERNAL_PROMPT_PATTERNS)
    )
    if unsafe_reply:
        return result.model_copy(
            update={
                "reply_text": OUTPUT_REPLACED_REPLY,
                "recipe_ids": [],
                "memory_candidates": [],
                "safety_label": AiSafetyLabel.OUTPUT_REPLACED,
            }
        )

    allowed_recipe_ids = set(result.candidate_recipe_ids)
    recipe_ids: list[UUID] = []
    for recipe_id in result.recipe_ids:
        if decision.allow_recipes and recipe_id in allowed_recipe_ids and recipe_id not in recipe_ids:
            recipe_ids.append(recipe_id)
    return result.model_copy(
        update={
            "reply_text": reply,
            "recipe_ids": recipe_ids,
            "memory_candidates": (
                _safe_memory_candidates(result.memory_candidates)
                if decision.allow_memory
                else []
            ),
            "safety_label": AiSafetyLabel.SAFE,
        }
    )
