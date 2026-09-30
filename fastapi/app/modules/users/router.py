from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.constants import Messages
from app.core.deps import AuthUser, CurrentUser, SessionDep, require_super_admin
from app.core.enums import UserStatus
from app.core.envelope import ApiResponse, Items, WarningInfo, ok, ok_items
from app.core.errors import NotFoundError
from app.core.pagination import PageQueryDep
from app.modules.signups import service as signups_service
from app.modules.signups.schemas import SignupRequestOut, SignupsPage
from app.modules.signups.service import SignupFiltersDep
from app.modules.users import service
from app.modules.users.schemas import (
    CompleteOnboardingIn,
    InviteUserIn,
    OnboardingStateOut,
    PickerOption,
    ProfileOut,
    SuperAdminExistsOut,
    UpdateUserIn,
    UserOut,
    UsersPage,
)
from app.modules.users.service import UserFiltersDep

router = APIRouter(prefix="/users", tags=["Users"])
super_admin_only = Depends(require_super_admin)
admins_only = super_admin_only


def _assert_not_self(target_id: UUID, user: AuthUser) -> None:
    if target_id == user.id:
        raise NotFoundError("User not found")


@router.get("/profile", summary="Current user's profile")
async def get_profile(session: SessionDep, user: CurrentUser) -> ApiResponse[ProfileOut]:
    return ok(await service.read_profile(session, user.id))


@router.post("/onboarding", summary="Complete the consent gate")
async def complete_onboarding(
    payload: CompleteOnboardingIn, session: SessionDep, user: CurrentUser
) -> ApiResponse[OnboardingStateOut]:
    return ok(await service.complete_onboarding(session, user.id, payload))


@router.post("/invite", dependencies=[super_admin_only], summary="Invite a customer")
async def invite(
    payload: InviteUserIn, session: SessionDep, user: CurrentUser
) -> ApiResponse[UserOut]:
    created, email_sent = await service.invite_user(session, payload, user.id)
    warning = None
    if not email_sent:
        warning = WarningInfo(
            heading="Invitation email not sent",
            message=(
                f"The user was created, but the invitation email to {created.email} could not "
                "be sent. Share the temporary password another way or trigger a password reset."
            ),
            type="SOFT",
        )
    return ok(created, message=Messages.USER_INVITED, warning=warning)


@router.get(
    "/super-admin-exists", dependencies=[super_admin_only], summary="Whether a Super Admin exists"
)
async def super_admin_exists(session: SessionDep) -> ApiResponse[SuperAdminExistsOut]:
    return ok(SuperAdminExistsOut(exists=await service.super_admin_exists(session)))


@router.get("", dependencies=[super_admin_only], summary="List users")
async def list_users(
    page: PageQueryDep, filters: UserFiltersDep, session: SessionDep, user: CurrentUser
) -> ApiResponse[UsersPage]:
    return ok(await service.list_users(session, page, filters, user.id))


@router.get("/picker", dependencies=[super_admin_only], summary="Active users for pickers")
async def admin_picker(session: SessionDep) -> ApiResponse[Items[PickerOption]]:
    return ok_items(await service.list_admin_picker(session))


@router.get("/signups", dependencies=[admins_only], summary="Review pet-owner signups")
async def list_signups(
    page: PageQueryDep, filters: SignupFiltersDep, session: SessionDep
) -> ApiResponse[SignupsPage]:
    return ok(await signups_service.list_signups(session, page, filters))


@router.patch(
    "/signups/{signup_id}/approve", dependencies=[admins_only], summary="Approve a signup"
)
async def approve_signup(
    signup_id: UUID, session: SessionDep, user: CurrentUser
) -> ApiResponse[SignupRequestOut]:
    approved, email_sent = await signups_service.approve_signup(session, signup_id, user.id)
    warning = None
    if not email_sent:
        warning = WarningInfo(
            heading="Approval email not sent",
            message=(
                f"The account is active, but {approved.email} could not be emailed. "
                "Provide notice another way that sign-in is now available."
            ),
            type="SOFT",
        )
    return ok(approved, message=Messages.SIGNUP_APPROVED, warning=warning)


@router.patch("/signups/{signup_id}/reject", dependencies=[admins_only], summary="Reject a signup")
async def reject_signup(
    signup_id: UUID, session: SessionDep, user: CurrentUser
) -> ApiResponse[SignupRequestOut]:
    rejected, email_sent = await signups_service.reject_signup(session, signup_id, user.id)
    warning = None
    if not email_sent:
        warning = WarningInfo(
            heading="Rejection email not sent",
            message=(
                f"The request was rejected, but {rejected.email} could not be emailed. "
                "Provide notice another way if a response is expected."
            ),
            type="SOFT",
        )
    return ok(rejected, message=Messages.SIGNUP_REJECTED, warning=warning)


@router.get("/{user_id}", dependencies=[super_admin_only], summary="Get a user")
async def get_user(user_id: UUID, session: SessionDep, user: CurrentUser) -> ApiResponse[UserOut]:
    _assert_not_self(user_id, user)
    return ok(await service.read_user(session, user_id))


def _status_email_warning(target: UserOut, email_sent: bool | None) -> WarningInfo | None:
    if email_sent is not False:
        return None
    state = "suspended" if target.status is UserStatus.SUSPENDED else "restored"
    return WarningInfo(
        heading="Notification email not sent",
        message=(
            f"The account was {state}, but {target.email} could not be emailed. "
            "Provide notice another way."
        ),
        type="SOFT",
    )


@router.patch("/{user_id}", dependencies=[super_admin_only], summary="Update a user")
async def update_user(
    user_id: UUID, payload: UpdateUserIn, session: SessionDep, user: CurrentUser
) -> ApiResponse[UserOut]:
    _assert_not_self(user_id, user)
    updated, email_sent = await service.update_user(session, user_id, payload, user.id)
    return ok(
        updated,
        message=Messages.USER_UPDATED,
        warning=_status_email_warning(updated, email_sent),
    )


@router.patch("/{user_id}/suspend", dependencies=[super_admin_only], summary="Suspend a user")
async def suspend_user(
    user_id: UUID, session: SessionDep, user: CurrentUser
) -> ApiResponse[UserOut]:
    _assert_not_self(user_id, user)
    suspended, email_sent = await service.suspend_user(session, user_id, user.id)
    return ok(
        suspended,
        message=Messages.USER_SUSPENDED,
        warning=_status_email_warning(suspended, email_sent),
    )


@router.patch("/{user_id}/restore", dependencies=[super_admin_only], summary="Restore a user")
async def restore_user(
    user_id: UUID, session: SessionDep, user: CurrentUser
) -> ApiResponse[UserOut]:
    _assert_not_self(user_id, user)
    restored, email_sent = await service.restore_user(session, user_id, user.id)
    return ok(
        restored,
        message=Messages.USER_RESTORED,
        warning=_status_email_warning(restored, email_sent),
    )


@router.delete("/{user_id}", dependencies=[super_admin_only], summary="Soft delete a user")
async def delete_user(
    user_id: UUID, session: SessionDep, user: CurrentUser
) -> ApiResponse[UserOut]:
    _assert_not_self(user_id, user)
    deleted = await service.soft_delete_user(session, user_id, user.id)
    return ok(deleted, message=Messages.USER_DELETED)
