from datetime import datetime, timezone
from typing import Optional, Tuple
import zoneinfo


def normalize_date_range(
    start_date: Optional[datetime],
    end_date: Optional[datetime],
    tz_str: str = "UTC",
    default_to_today: bool = False,
) -> Tuple[Optional[datetime], Optional[datetime]]:
    """
    Normalizes start_date and end_date based on the business timezone:
    - If both are None and default_to_today is True (e.g., Dashboard metrics):
      Computes [today 00:00:00.000000, today 23:59:59.999999] in business timezone,
      and converts the range to UTC.
    - If both are None and default_to_today is False:
      Returns (None, None) (unfiltered).
    - If start_date is provided:
      Localizes to business timezone (if naive) and converts to UTC.
    - If end_date is provided:
      If time is midnight 00:00:00 (i.e. date-only parameter like '2026-09-20'),
      expands to 23:59:59.999999 in business timezone so the entire end date is inclusive,
      then converts to UTC.
    """
    try:
        tz = zoneinfo.ZoneInfo(tz_str)
    except Exception:
        tz = timezone.utc

    now_tz = datetime.now(tz)

    if start_date is None and end_date is None:
        if default_to_today:
            start_tz = datetime(now_tz.year, now_tz.month, now_tz.day, 0, 0, 0, 0, tzinfo=tz)
            end_tz = datetime(now_tz.year, now_tz.month, now_tz.day, 23, 59, 59, 999999, tzinfo=tz)
            return start_tz.astimezone(timezone.utc), end_tz.astimezone(timezone.utc)
        return None, None

    start_utc = None
    if start_date is not None:
        if start_date.tzinfo is None:
            start_tz = start_date.replace(tzinfo=tz)
        else:
            start_tz = start_date.astimezone(tz)
        start_utc = start_tz.astimezone(timezone.utc)

    end_utc = None
    if end_date is not None:
        if end_date.tzinfo is None:
            if end_date.hour == 0 and end_date.minute == 0 and end_date.second == 0 and end_date.microsecond == 0:
                end_tz = end_date.replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=tz)
            else:
                end_tz = end_date.replace(tzinfo=tz)
        else:
            end_tz = end_date.astimezone(tz)
            if end_tz.hour == 0 and end_tz.minute == 0 and end_tz.second == 0 and end_tz.microsecond == 0:
                end_tz = end_tz.replace(hour=23, minute=59, second=59, microsecond=999999)
        end_utc = end_tz.astimezone(timezone.utc)

    return start_utc, end_utc
