import asyncio
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import ConflictError
from app.db.session import async_session_factory, engine
from app.modules.roadmap.models import RoadmapItem
from app.modules.users.service import ensure_super_admin

# Design 2j/2l "What's Coming" launch set. Supersedes the earlier Jira PET-11
# list (Summary & timeline / Secure share), which is stale and no longer seeded.
# The third value is what opens the comment box for that card specifically --
# distinct from the description above it, which sells the feature rather than
# asking the owner anything.
ROADMAP_ITEMS: tuple[tuple[str, str, str], ...] = (
    (
        "Pet Circle",
        "Let a partner or sitter add to the same pet's chat",
        "Who would you invite?",
    ),
    (
        "Local resources",
        "Clinics, low-cost options and payment plans near you",
        "What would be useful to find?",
    ),
    (
        "Longer voice notes",
        "Talk for a few minutes and have it written up for you",
        "What would you want to talk through?",
    ),
    (
        "Visit reminders",
        "A nudge before the appointment",
        "How far ahead would you want the nudge?",
    ),
)


async def ensure_roadmap_items(session: AsyncSession) -> None:
    existing = {
        item.title: item
        for item in (
            await session.execute(select(RoadmapItem).where(RoadmapItem.is_deleted.is_(False)))
        )
        .scalars()
        .all()
    }
    for title, description, comment_prompt in ROADMAP_ITEMS:
        item = existing.get(title)
        if item is None:
            session.add(
                RoadmapItem(title=title, description=description, comment_prompt=comment_prompt)
            )
        else:
            if item.description != description:
                item.description = description
            if item.comment_prompt != comment_prompt:
                item.comment_prompt = comment_prompt
    await session.flush()


async def seed(session: AsyncSession, email: str) -> str:
    await ensure_roadmap_items(session)
    return await ensure_super_admin(session, email)


async def main() -> int:
    if not settings.SEED_ADMIN_EMAIL:
        print("SEED_ADMIN_EMAIL is required", file=sys.stderr)
        return 1
    try:
        async with async_session_factory() as session:
            action = await seed(session, settings.SEED_ADMIN_EMAIL)
    except ConflictError as exc:
        print(f"Seed aborted: {exc.message}", file=sys.stderr)
        return 1
    finally:
        await engine.dispose()
    print(f"Super Admin {action}: {settings.SEED_ADMIN_EMAIL}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
