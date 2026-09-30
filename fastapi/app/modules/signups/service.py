from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Query
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.enums import SIGNUP_STATUS_LABELS, SignupStatus, UserStatus
from app.core.envelope import total_pages
from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.core.mailer import send_email
from app.core.pagination import PageQuery, apply_page, apply_sort
from app.core.utils import utc_now
from app.modules.cognito.provisioning import provision_user
from app.modules.signups.constants import (
    SIGNUP_ALREADY_PENDING,
    SIGNUP_DEFAULT_ORDER,
    SIGNUP_EMAIL_TAKEN,
    SIGNUP_NOT_APPROVED,
    SIGNUP_NOT_FOUND,
    SIGNUP_SORTABLE,
)
from app.modules.signups.models import SignupRequest
from app.modules.signups.schemas import SignupRequestOut, SignupsPage, SignupStatusCount
from app.modules.users.models import User


@dataclass(frozen=True, slots=True)
class SignupFilters:
    status: SignupStatus | None = None


def get_signup_filters(
    status: Annotated[SignupStatus | None, Query()] = None,
) -> SignupFilters:
    return SignupFilters(status=status)


SignupFiltersDep = Annotated[SignupFilters, Depends(get_signup_filters)]

# why: a rejection can be reversed by approving later; an approval is final, since
# by then an account exists and taking access away is the Users screen's job.
APPROVABLE = frozenset({SignupStatus.PENDING, SignupStatus.REJECTED})
REJECTABLE = frozenset({SignupStatus.PENDING})


async def queue_signup(session: AsyncSession, email: str) -> None:
    """File a pending request for an address with no account.

    Raises when the address already has a pending or rejected request, so asking
    again can neither duplicate a request nor get past a rejection.
    """
    # why: ON CONFLICT on the unique email makes two simultaneous first requests
    # for one address resolve to one row, with no IntegrityError to unwind.
    inserted = await session.scalar(
        insert(SignupRequest)
        .values(email=email, status=SignupStatus.PENDING)
        .on_conflict_do_nothing(index_elements=[SignupRequest.email])
        .returning(SignupRequest.id)
    )
    if inserted is not None:
        await session.commit()
        return

    existing = await session.scalar(
        select(SignupRequest)
        .where(SignupRequest.email == email)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if existing is None or existing.status is SignupStatus.PENDING:
        raise ConflictError(SIGNUP_ALREADY_PENDING)
    if existing.status is SignupStatus.REJECTED:
        raise ForbiddenError(SIGNUP_NOT_APPROVED)
    # why: approved, yet no account holds this address -- deleting a user
    # anonymises its email. The owner may ask again, as before this table existed.
    existing.status = SignupStatus.PENDING
    existing.user_id = None
    existing.updated_by_id = None
    await session.commit()


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _signup_clauses(page: PageQuery, filters: SignupFilters) -> list[ColumnElement[bool]]:
    clauses: list[ColumnElement[bool]] = [SignupRequest.is_deleted.is_(False)]
    if page.search:
        pattern = f"%{_escape_like(page.search)}%"
        clauses.append(SignupRequest.email.ilike(pattern, escape="\\"))
    if filters.status is not None:
        clauses.append(SignupRequest.status == filters.status)
    return clauses


async def list_signups(
    session: AsyncSession, page: PageQuery, filters: SignupFilters
) -> SignupsPage:
    clauses = _signup_clauses(page, filters)
    stmt = apply_page(
        apply_sort(
            select(SignupRequest).where(*clauses),
            page.sort,
            SIGNUP_SORTABLE,
            SIGNUP_DEFAULT_ORDER,
        ),
        page,
    )
    items = (await session.execute(stmt)).scalars().all()
    total = (
        await session.scalar(select(func.count()).select_from(SignupRequest).where(*clauses)) or 0
    )
    # why: the status facet counts ignore the status filter itself, so switching tabs does not
    # zero out the other tabs' badges.
    count_clauses = _signup_clauses(page, SignupFilters())
    status_rows = (
        await session.execute(
            select(SignupRequest.status, func.count())
            .where(*count_clauses)
            .group_by(SignupRequest.status)
        )
    ).all()
    return SignupsPage(
        items=[SignupRequestOut.model_validate(signup) for signup in items],
        page=page.page,
        page_size=page.page_size,
        total_records=total,
        total_pages=total_pages(total, page.page_size),
        status_counts=[
            SignupStatusCount(status=status, count=count) for status, count in status_rows
        ],
    )


async def _lock_for_review(
    session: AsyncSession, signup_id: UUID, allowed_from: frozenset[SignupStatus]
) -> SignupRequest:
    # why: FOR UPDATE serialises reviews of one request. A second admin reviewing
    # at the same moment waits here, then sees the status the first one left.
    signup = await session.scalar(
        select(SignupRequest)
        .where(SignupRequest.id == signup_id, SignupRequest.is_deleted.is_(False))
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if signup is None:
        raise NotFoundError(SIGNUP_NOT_FOUND)
    if signup.status not in allowed_from:
        raise ConflictError(
            f"This signup request has already been reviewed (currently "
            f"{SIGNUP_STATUS_LABELS[signup.status].lower()})."
        )
    return signup


async def _commit(session: AsyncSession, signup: SignupRequest) -> SignupRequestOut:
    await session.flush()
    await session.refresh(signup)
    await session.commit()
    return SignupRequestOut.model_validate(signup)


async def approve_signup(
    session: AsyncSession, signup_id: UUID, current_user_id: UUID
) -> tuple[SignupRequestOut, bool]:
    signup = await _lock_for_review(session, signup_id, APPROVABLE)
    if await session.scalar(select(User.id).where(User.email == signup.email)) is not None:
        raise ConflictError(SIGNUP_EMAIL_TAKEN)

    # why: the pool user first. If it cannot be created nothing is written and
    # the request stays pending to retry; creating it again is a no-op.
    provision_user(signup.email)

    user = User(
        email=signup.email,
        status=UserStatus.ACTIVE,
        activated_at=utc_now(),
        is_super_admin=False,
        created_by_id=current_user_id,
        updated_by_id=current_user_id,
    )
    session.add(user)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError(SIGNUP_EMAIL_TAKEN) from exc

    signup.status = SignupStatus.APPROVED
    signup.user_id = user.id
    signup.updated_by_id = current_user_id
    approved = await _commit(session, signup)
    sent = await send_email(
        user.email,
        f"{settings.APP_NAME} account approved",
        "account-approved.html",
        display_name=user.display_name,
        login_url=f"{settings.FRONTEND_URL}/login",
    )
    return approved, sent


async def reject_signup(
    session: AsyncSession, signup_id: UUID, current_user_id: UUID
) -> tuple[SignupRequestOut, bool]:
    # A rejection creates nothing -- no account row and no pool user.
    signup = await _lock_for_review(session, signup_id, REJECTABLE)
    signup.status = SignupStatus.REJECTED
    signup.updated_by_id = current_user_id
    rejected = await _commit(session, signup)
    sent = await send_email(
        signup.email,
        f"{settings.APP_NAME} signup request update",
        "signup-rejected.html",
        display_name=signup.display_name,
    )
    return rejected, sent
