import re
from collections.abc import Collection
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

CRISIS_TERMS = ("想自杀", "不想活了", "结束生命", "伤害自己", "割腕", "去死", "想离开这个世界")
SELF_HARM_PATTERNS = tuple(re.compile(pattern, re.IGNORECASE) for pattern in CRISIS_TERMS)
NEGATED_CRISIS_PATTERN = re.compile(
    r"(?:我|自己)?(?:不是|没有)(?:想)?(?:自杀|自杀想法|自杀念头)",
    re.IGNORECASE,
)
REPORTING_CRISIS_PATTERN = re.compile(
    r"(?:朋友|同学|家人|别人|他|她)(?:说|问|提到|表示|觉得|担心)",
    re.IGNORECASE,
)
CLAUSE_SPLIT_PATTERN = re.compile(r"([，,；;。！？!?])")
CURRENT_INTENT_BOUNDARY_PATTERN = re.compile(
    r"(?:但|而|不过|可是|然而|(?=我现在|我真的|其实我))"
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
EMAIL_PATTERN = re.compile(
    r"(?<![\w.+-])[A-Za-z0-9][A-Za-z0-9._%+-]{0,63}"
    r"@[A-Za-z0-9][A-Za-z0-9.-]{0,251}\.[A-Za-z]{2,63}(?![\w.-])"
)
EXACT_CHINESE_ADDRESS_PATTERN = re.compile(
    r"(?:(?:[\u4e00-\u9fff]{2,9}省)?(?:[\u4e00-\u9fff]{2,9}市)?)"
    r"[\u4e00-\u9fff]{2,9}(?:区|县)"
    r"[\u4e00-\u9fff0-9]{1,24}(?:路|街|巷|道)\d{1,5}号"
    r"(?:[\u4e00-\u9fff0-9-]{0,12}(?:室|单元|栋|楼))?"
)
MEDICAL_INPUT_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in ("帮我诊断", "诊断我", "我是不是.*(?:抑郁|焦虑|酒精依赖)")
)
EXCLUDES_OTHER_SUPPORT_PATTERN = re.compile(
    r"(?:"
    r"(?:别|不要|无需).{0,6}(?:找|相信).{0,6}(?:其他人|别人)"
    r"|(?:别|不要|无需).{0,6}依赖(?:其他人|别人)"
    r")",
    re.IGNORECASE,
)
EXCLUSIVE_SELF_SUPPORT_PATTERN = re.compile(
    r"(?:只|只有).{0,6}(?:依赖我|需要我|我.{0,3}懂你)", re.IGNORECASE
)
EXCLUSIVE_PRESENCE_PATTERN = re.compile(
    r"(?:只要|只有)(?:有我|我(?:一个)?).{0,6}(?:就)?(?:够了|足够)",
    re.IGNORECASE,
)
DIAGNOSIS_ASSERTION_TOKENS = (
    "根据你的表现",
    "我判断",
    "你患有",
    "你就是",
    "你已经",
    "你得了",
    "你这是",
    "确诊",
    "可以确定",
    "可以确诊",
)
DIAGNOSIS_TOKENS = ("抑郁", "焦虑", "精神疾病", "酒精依赖")
DIAGNOSIS_NEGATION_PATTERN = re.compile(
    r"(?:不能|无法|不应|不该).{0,8}(?:诊断|判断|确定).{0,16}"
    r"(?:抑郁|焦虑|精神疾病|酒精依赖)",
    re.IGNORECASE,
)
ALCOHOL_TOKENS = ("酒精", "喝酒", "喝一杯", "来一杯", "灌一杯", "灌醉", "麻痹")
ALCOHOL_RELIEF_TOKENS = ("缓解", "忘掉", "忘记", "好受", "解决", "麻痹")
EMOTIONAL_DISTRESS_TOKENS = ("难过", "痛苦", "焦虑", "失眠")
ALCOHOL_NEGATION_PATTERN = re.compile(
    r"(?:酒精|喝酒|喝一杯|来一杯|灌一杯|灌醉|麻痹).{0,8}"
    r"(?:不能|无法|不会|不该).{0,8}(?:缓解|忘掉|忘记|好受|解决|麻痹)",
    re.IGNORECASE,
)
CONTINUED_DRINKING_ENCOURAGEMENT_PATTERN = re.compile(
    r"(?:继续喝|再喝|多喝).{0,12}(?:舒服|没事|可以)",
    re.IGNORECASE,
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


def redact_private_identifiers(content: str) -> str:
    redacted = content
    for pattern in (
        PHONE_PATTERN,
        ID_CARD_PATTERN,
        BANK_CARD_PATTERN,
        ADDRESS_PATTERN,
        EMAIL_PATTERN,
        EXACT_CHINESE_ADDRESS_PATTERN,
    ):
        redacted = pattern.sub("[已隐藏的敏感信息]", redacted)
    return redacted


def contains_private_identifiers(content: str) -> bool:
    return redact_private_identifiers(content) != content


def _risk_decision(label: AiSafetyLabel, reply: str) -> SafetyDecision:
    return SafetyDecision(label=label, fixed_reply=reply, allow_recipes=False, allow_memory=False)


def _without_crisis_terms(content: str) -> str:
    for pattern in SELF_HARM_PATTERNS:
        content = pattern.sub("", content)
    return content


def _without_reported_crisis_terms(clause: str) -> str:
    reporting = REPORTING_CRISIS_PATTERN.search(clause)
    if reporting is None:
        return clause

    direct_quote = re.match(r"[：:\s]*[\"“]", clause[reporting.end() :])
    if direct_quote is not None:
        quote_start = reporting.end() + direct_quote.end()
        quote_end = re.search(r"[\"”]", clause[quote_start:])
        if quote_end is not None:
            reported_end = quote_start + quote_end.end()
            reported = clause[quote_start:reported_end]
            if _matches(reported, SELF_HARM_PATTERNS):
                return (
                    clause[:quote_start]
                    + _without_crisis_terms(reported)
                    + clause[reported_end:]
                )

    current_boundary = CURRENT_INTENT_BOUNDARY_PATTERN.search(clause, reporting.end())
    reported_end = current_boundary.start() if current_boundary is not None else len(clause)
    reported = clause[reporting.start() : reported_end]
    if not _matches(reported, SELF_HARM_PATTERNS):
        return clause
    return clause[: reporting.start()] + _without_crisis_terms(reported) + clause[reported_end:]


def _without_reported_crisis_content(content: str) -> str:
    parts = CLAUSE_SPLIT_PATTERN.split(content)
    return "".join(
        part if CLAUSE_SPLIT_PATTERN.fullmatch(part) else _without_reported_crisis_terms(part)
        for part in parts
    )


def _is_current_user_crisis(content: str) -> bool:
    current_content = _without_reported_crisis_content(content)
    if not _matches(current_content, SELF_HARM_PATTERNS):
        return False
    negated = NEGATED_CRISIS_PATTERN.search(current_content)
    if negated is None:
        return True
    return _matches(current_content[negated.end() :], SELF_HARM_PATTERNS)


def _contains_any(content: str, tokens: tuple[str, ...]) -> bool:
    return any(token in content for token in tokens)


def _is_unsafe_dependency(reply: str) -> bool:
    return bool(
        EXCLUDES_OTHER_SUPPORT_PATTERN.search(reply)
        or EXCLUSIVE_SELF_SUPPORT_PATTERN.search(reply)
        or EXCLUSIVE_PRESENCE_PATTERN.search(reply)
    )


def _is_unsafe_diagnosis(reply: str) -> bool:
    for clause in CLAUSE_SPLIT_PATTERN.split(reply):
        if CLAUSE_SPLIT_PATTERN.fullmatch(clause) or DIAGNOSIS_NEGATION_PATTERN.search(clause):
            continue
        if _contains_any(clause, DIAGNOSIS_ASSERTION_TOKENS) and _contains_any(
            clause,
            DIAGNOSIS_TOKENS,
        ):
            return True
    return False


def _is_unsafe_alcohol_relief(reply: str) -> bool:
    for clause in CLAUSE_SPLIT_PATTERN.split(reply):
        if CLAUSE_SPLIT_PATTERN.fullmatch(clause):
            continue
        if CONTINUED_DRINKING_ENCOURAGEMENT_PATTERN.search(clause):
            return True
        if ALCOHOL_NEGATION_PATTERN.search(clause):
            continue
        if (
            _contains_any(clause, ALCOHOL_TOKENS)
            and _contains_any(clause, ALCOHOL_RELIEF_TOKENS)
            and _contains_any(clause, EMOTIONAL_DISTRESS_TOKENS)
        ):
            return True
    return False


def classify_input(content: str, user: User) -> SafetyDecision:
    del user
    normalized = content.strip()
    if _is_current_user_crisis(normalized):
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
        and not contains_private_identifiers(candidate.memory_key)
        and not contains_private_identifiers(candidate.summary)
    ]


def review_output(
    result: AiGenerationResult,
    decision: SafetyDecision,
    server_allowed_recipe_ids: Collection[UUID],
) -> AiGenerationResult:
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
        or _is_unsafe_diagnosis(reply)
        or _is_unsafe_alcohol_relief(reply)
        or _is_unsafe_dependency(reply)
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

    allowed_recipe_ids = set(server_allowed_recipe_ids)
    recipe_ids: list[UUID] = []
    for recipe_id in result.recipe_ids:
        if decision.allow_recipes and recipe_id in allowed_recipe_ids and recipe_id not in recipe_ids:
            recipe_ids.append(recipe_id)
    return result.model_copy(
        update={
            "reply_text": redact_private_identifiers(reply),
            "recipe_ids": recipe_ids,
            "memory_candidates": (
                _safe_memory_candidates(result.memory_candidates)
                if decision.allow_memory
                else []
            ),
            "safety_label": AiSafetyLabel.SAFE,
        }
    )
