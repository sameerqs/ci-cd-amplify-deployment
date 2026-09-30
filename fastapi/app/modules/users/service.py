import secrets
import time
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Query
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.enums import UserStatus
from app.core.envelope import total_pages
from app.core.errors import BadRequestError, ConflictError, NotFoundError
from app.core.mailer import send_email
from app.core.pagination import PageQuery, apply_page, apply_sort
from app.core.utils import utc_now
from app.modules.auth.sessions import revoke_all_for_users
from app.modules.roadmap.service import scrub_notes_for_user
from app.modules.users.constants import (
    DEFAULT_ORDER,
    MAX_EMAIL_LENGTH,
    SEARCH_STATUS_WORDS,
    SORTABLE,
)
from app.modules.users.models import User
from app.modules.users.schemas import (
    CompleteOnboardingIn,
    InviteUserIn,
    OnboardingStateOut,
    PickerOption,
    ProfileOut,
    StatusCount,
    UpdateUserIn,
    UserOut,
    UsersPage,
)

DAY_MS = 86_400_000
USER_EXISTS = (
    "User already exists with this email. If a previous invite timed out, the account may "
    "already have been created - check the users list."
)


USER_NOT_ACTIVE = "Only an active account can be suspended."
USER_NOT_SUSPENDED = "Only a suspended account can be restored."
SUPER_ADMIN_NOT_SUSPENDABLE = "The Super Admin account cannot be suspended."
# An account row is only ever one of these; the others are legacy review states.
LISTED_STATUSES = (UserStatus.ACTIVE, UserStatus.SUSPENDED)


@dataclass(frozen=True, slots=True)
class UserFilters:
    status: UserStatus | None = None
    created_between: tuple[datetime, datetime] | None = None
    email: str | None = None


def parse_created_range(raw: str | None) -> tuple[datetime, datetime] | None:
    if not raw:
        return None
    start_raw, sep, end_raw = raw.partition(",")
    if not sep or not start_raw.strip().isdigit() or not end_raw.strip().isdigit():
        raise BadRequestError("createdAt must be '<startMs>,<endMs>'")
    start_ms, end_ms = int(start_raw), int(end_raw)
    end_ms += DAY_MS - (end_ms % DAY_MS) - 1
    if end_ms < start_ms:
        raise BadRequestError("createdAt range end precedes start")
    return (
        datetime.fromtimestamp(start_ms / 1000, UTC),
        datetime.fromtimestamp(end_ms / 1000, UTC),
    )


def get_user_filters(
    status: Annotated[UserStatus | None, Query()] = None,
    created_at: Annotated[str | None, Query(alias="createdAt", max_length=40)] = None,
    email: Annotated[str | None, Query(max_length=MAX_EMAIL_LENGTH)] = None,
) -> UserFilters:
    if status is not None and status not in LISTED_STATUSES:
        raise BadRequestError("status must be Active (1) or Suspended (3)")
    cleaned_email = email.strip() if email else None
    return UserFilters(
        status=status,
        created_between=parse_created_range(created_at),
        email=cleaned_email or None,
    )


UserFiltersDep = Annotated[UserFilters, Depends(get_user_filters)]


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _list_clauses(
    page: PageQuery, filters: UserFilters, current_user_id: UUID
) -> list[ColumnElement[bool]]:
    clauses: list[ColumnElement[bool]] = [
        User.is_deleted.is_(False),
        User.id != current_user_id,
        User.status.in_(LISTED_STATUSES),
    ]
    if page.search:
        pattern = f"%{_escape_like(page.search)}%"
        search_clauses: list[ColumnElement[bool]] = [
            User.email.ilike(pattern, escape="\\"),
        ]
        status_word = SEARCH_STATUS_WORDS.get(page.search.lower())
        if status_word is not None:
            search_clauses.append(User.status == status_word)
        clauses.append(or_(*search_clauses))
    if filters.email:
        clauses.append(User.email.ilike(f"%{_escape_like(filters.email)}%", escape="\\"))
    if filters.status is not None:
        clauses.append(User.status == filters.status)
    if filters.created_between is not None:
        start, end = filters.created_between
        clauses.append(User.created_at.between(start, end))
    return clauses


async def list_users(
    session: AsyncSession, page: PageQuery, filters: UserFilters, current_user_id: UUID
) -> UsersPage:
    clauses = _list_clauses(page, filters, current_user_id)
    stmt = apply_page(
        apply_sort(select(User).where(*clauses), page.sort, SORTABLE, DEFAULT_ORDER), page
    )
    items = (await session.execute(stmt)).scalars().all()
    total = await session.scalar(select(func.count()).select_from(User).where(*clauses)) or 0
    # why: the facet counts ignore the status filter itself, so switching tabs does not
    # zero out the other tab's badge.
    count_clauses = _list_clauses(page, replace(filters, status=None), current_user_id)
    counts = dict(
        (
            await session.execute(
                select(User.status, func.count()).where(*count_clauses).group_by(User.status)
            )
        )
        .tuples()
        .all()
    )
    return UsersPage(
        items=[UserOut.model_validate(user) for user in items],
        page=page.page,
        page_size=page.page_size,
        total_records=total,
        total_pages=total_pages(total, page.page_size),
        status_counts=[
            StatusCount(status=status, count=counts.get(status, 0)) for status in LISTED_STATUSES
        ],
    )


async def _load_user(session: AsyncSession, user_id: UUID) -> User:
    user = await session.scalar(select(User).where(User.id == user_id, User.is_deleted.is_(False)))
    if user is None:
        raise NotFoundError("User not found")
    return user


async def _lock_user(session: AsyncSession, user_id: UUID) -> User:
    # why: FOR UPDATE serialises status changes on one account, so two admins
    # suspending at once cannot both pass the status check and both send mail.
    user = await session.scalar(
        select(User)
        .where(User.id == user_id, User.is_deleted.is_(False))
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if user is None:
        raise NotFoundError("User not found")
    return user


async def read_user(session: AsyncSession, user_id: UUID) -> UserOut:
    return UserOut.model_validate(await _load_user(session, user_id))


async def read_profile(session: AsyncSession, user_id: UUID) -> ProfileOut:
    return ProfileOut.model_validate(await _load_user(session, user_id))


async def _persist(session: AsyncSession, user: User) -> None:
    await session.flush()
    await session.refresh(user)
    await session.commit()


async def invite_user(
    session: AsyncSession, payload: InviteUserIn, current_user_id: UUID
) -> tuple[UserOut, bool]:
    existing = await session.scalar(select(User.id).where(User.email == payload.email))
    if existing is not None:
        raise ConflictError(USER_EXISTS)
    # why: no temporary password to send. Cognito owns credentials, so an invite
    # is an approved row plus a nudge to the same one-screen sign-in everyone
    # else uses -- there is nothing here for an intercepted email to leak.
    user = User(
        email=payload.email,
        status=UserStatus.ACTIVE,
        activated_at=utc_now(),
        is_super_admin=False,
        created_by_id=current_user_id,
        updated_by_id=current_user_id,
    )
    session.add(user)
    await _persist(session, user)
    sent = await send_email(
        user.email,
        f"Welcome to {settings.APP_NAME}",
        "welcome.html",
        display_name=user.display_name,
        email=user.email,
        login_url=f"{settings.FRONTEND_URL}/login",
    )
    return UserOut.model_validate(user), sent


async def update_user(
    session: AsyncSession, user_id: UUID, payload: UpdateUserIn, current_user_id: UUID
) -> tuple[UserOut, bool | None]:
    """Apply the edit form. `isActive` is the same suspend/restore as the row actions.

    Returns the user and whether a notification email went out -- None when the
    status did not change, so nothing was sent.
    """
    user = await _load_user(session, user_id)
    if payload.is_active is None or payload.is_active == (user.status is UserStatus.ACTIVE):
        return UserOut.model_validate(user), None
    if payload.is_active:
        return await restore_user(session, user_id, current_user_id)
    return await suspend_user(session, user_id, current_user_id)


async def suspend_user(
    session: AsyncSession, user_id: UUID, current_user_id: UUID
) -> tuple[UserOut, bool]:
    """Block the account. The pool user is left as it is -- the status alone keeps
    them out -- so restoring needs nothing re-created."""
    user = await _lock_user(session, user_id)
    if user.is_super_admin:
        raise ConflictError(SUPER_ADMIN_NOT_SUSPENDABLE)
    if user.status is not UserStatus.ACTIVE:
        raise ConflictError(USER_NOT_ACTIVE)
    user.status = UserStatus.SUSPENDED
    user.suspended_at = utc_now()
    user.suspended_by_id = current_user_id
    user.updated_by_id = current_user_id
    # why: suspension has to reach the person now, not whenever their session
    # happens to lapse. Ending every session forces the next request through
    # get_current_user, which refuses a suspended account with its reason.
    await revoke_all_for_users(session, [user.id])
    await _persist(session, user)
    sent = await send_email(
        user.email,
        f"{settings.APP_NAME} account suspended",
        "account-suspended.html",
        display_name=user.display_name,
    )
    return UserOut.model_validate(user), sent


async def restore_user(
    session: AsyncSession, user_id: UUID, current_user_id: UUID
) -> tuple[UserOut, bool]:
    user = await _lock_user(session, user_id)
    if user.status is not UserStatus.SUSPENDED:
        raise ConflictError(USER_NOT_SUSPENDED)
    user.status = UserStatus.ACTIVE
    user.activated_at = utc_now()
    user.suspended_at = None
    user.suspended_by_id = None
    user.updated_by_id = current_user_id
    await _persist(session, user)
    sent = await send_email(
        user.email,
        f"{settings.APP_NAME} account restored",
        "account-restored.html",
        display_name=user.display_name,
        login_url=f"{settings.FRONTEND_URL}/login",
    )
    return UserOut.model_validate(user), sent


def anonymise_email(email: str) -> str:
    suffix = f"-{secrets.token_hex(4)}{int(time.time() * 1000)}"
    return email[: MAX_EMAIL_LENGTH - len(suffix)] + suffix


async def soft_delete_user(session: AsyncSession, user_id: UUID, current_user_id: UUID) -> UserOut:
    user = await _load_user(session, user_id)
    user.email = anonymise_email(user.email)
    user.is_deleted = True
    user.updated_by_id = current_user_id
    await revoke_all_for_users(session, [user.id])
    # why: is_deleted is soft -- the row and its child rows outlive the
    # account -- so anything that promised to go away on deletion has to be
    # scrubbed explicitly, here, in the same transaction as the rest of it.
    await scrub_notes_for_user(session, user.id)
    await _persist(session, user)
    return UserOut.model_validate(user)


async def list_admin_picker(session: AsyncSession) -> list[PickerOption]:
    rows = (
        await session.execute(
            select(User)
            .where(
                User.is_deleted.is_(False),
                User.status == UserStatus.ACTIVE,
                User.is_super_admin.is_(False),
            )
            .order_by(User.email)
        )
    ).scalars()
    return [PickerOption(id=user.id, label=user.display_name) for user in rows]


async def super_admin_exists(session: AsyncSession) -> bool:
    row = await session.scalar(
        select(User.id).where(User.is_super_admin.is_(True), User.is_deleted.is_(False))
    )
    return row is not None


async def ensure_super_admin(session: AsyncSession, email: str) -> str:
    """Idempotently promote/create the Super Admin for `email`.

    Used by both `scripts/seed.py` (operator-invoked) and the app's own
    startup (`app/main.py`), so a fresh environment always has exactly one
    live Super Admin without a separate manual step.
    """
    alive_super_admin = await session.scalar(
        select(User).where(User.is_super_admin.is_(True), User.is_deleted.is_(False))
    )
    if alive_super_admin is not None:
        if alive_super_admin.email != email:
            taken = await session.scalar(
                select(User.id).where(User.email == email, User.id != alive_super_admin.id)
            )
            if taken is not None:
                raise ConflictError(
                    f"{email} belongs to another user; cannot re-point the Super Admin"
                )
            alive_super_admin.email = email
        alive_super_admin.status = UserStatus.ACTIVE
        action = "updated"
    else:
        existing = await session.scalar(
            select(User).where(User.email == email, User.is_deleted.is_(False))
        )
        if existing is not None:
            existing.is_super_admin = True
            existing.status = UserStatus.ACTIVE
            action = "promoted"
        else:
            session.add(User(email=email, is_super_admin=True, status=UserStatus.ACTIVE))
            action = "created"
    await session.commit()
    return action


ONBOARDING_CONSENT_REQUIRED = (
    "Both the age and beta-documentation confirmations are required to continue."
)


async def complete_onboarding(
    session: AsyncSession, user_id: UUID, payload: CompleteOnboardingIn
) -> OnboardingStateOut:
    if not (payload.age_confirmed and payload.beta_disclaimer_accepted):
        raise BadRequestError(ONBOARDING_CONSENT_REQUIRED)
    user = await _load_user(session, user_id)
    user.age_confirmed = True
    user.beta_disclaimer_accepted = True
    # why: re-submitting keeps the original stamp - this is the moment consent was
    # first given, and overwriting it would lose that record.
    if user.onboarding_completed_at is None:
        user.onboarding_completed_at = utc_now()
    user.updated_by_id = user.id
    await _persist(session, user)
    return OnboardingStateOut.model_validate(user)
