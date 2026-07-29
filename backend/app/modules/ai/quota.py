from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlmodel import Session, select

from app.core.config import Settings
from app.db.models import AiDailyQuota

BEIJING_TIME_ZONE = ZoneInfo("Asia/Shanghai")


@dataclass(frozen=True)
class QuotaSnapshot:
    daily_message_limit: int
    messages_used_today: int
    remaining: int
    resets_at: datetime


def _utc_now(now: datetime) -> datetime:
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    return now.astimezone(UTC)


def quota_date(now: datetime) -> date:
    return _utc_now(now).astimezone(BEIJING_TIME_ZONE).date()


def next_reset(now: datetime) -> datetime:
    local_now = _utc_now(now).astimezone(BEIJING_TIME_ZONE)
    next_day = local_now.date() + timedelta(days=1)
    return datetime.combine(next_day, time.min, BEIJING_TIME_ZONE).astimezone(UTC)


def quota_snapshot(
    session: Session,
    user_id: UUID,
    settings: Settings,
    now: datetime,
) -> QuotaSnapshot:
    today = quota_date(now)
    with session.no_autoflush:
        quota = session.exec(
            select(AiDailyQuota).where(
                AiDailyQuota.user_id == user_id,
                AiDailyQuota.quota_date == today,
            )
        ).first()
    used_count = max(0, quota.used_count) if quota is not None else 0
    reserved_count = max(0, quota.reserved_count) if quota is not None else 0
    occupied_count = min(settings.ai_daily_limit, used_count + reserved_count)
    remaining = settings.ai_daily_limit - occupied_count
    return QuotaSnapshot(
        daily_message_limit=settings.ai_daily_limit,
        messages_used_today=occupied_count,
        remaining=remaining,
        resets_at=next_reset(now),
    )
