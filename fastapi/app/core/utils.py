from datetime import UTC, datetime


def utc_now() -> datetime:
    return datetime.now(UTC)


def format_person_name(
    first_name: str | None, last_name: str | None, fallback: str, *, max_length: int | None = None
) -> str:
    parts = [part.strip() for part in (first_name, last_name) if part and part.strip()]
    name = " ".join(parts) if parts else fallback
    # why: callers persisting the result must cap it — joined first+last can exceed the column
    # width even when each part is individually valid.
    return name if max_length is None else name[:max_length]
