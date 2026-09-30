from datetime import datetime
from uuid import UUID

from pydantic import computed_field

from app.core.enums import UserStatus
from app.core.envelope import PaginatedData
from app.core.schemas import EmailLower, InputSchema, OutputSchema


class UserOut(OutputSchema):
    id: UUID
    email: str
    display_name: str
    is_super_admin: bool
    status: UserStatus
    activated_at: datetime | None
    suspended_at: datetime | None
    suspended_by_id: UUID | None
    onboarding_completed_at: datetime | None
    age_confirmed: bool
    beta_disclaimer_accepted: bool
    created_by_id: UUID | None
    updated_by_id: UUID | None
    created_at: datetime
    updated_at: datetime | None

    # why: isActive stays on the wire for existing clients; it is now derived from status and
    # mypy has no support for a decorator stacked on @property, hence the narrow ignore.
    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_active(self) -> bool:
        return self.status == UserStatus.ACTIVE


class ProfileOut(UserOut):
    """The signed-in user's own record. Identical to UserOut: this product keeps
    nothing about a person that an admin cannot already see."""


class InviteUserIn(InputSchema):
    email: EmailLower


class UpdateUserIn(InputSchema):
    is_active: bool | None = None


class PickerOption(OutputSchema):
    id: UUID
    label: str


class SuperAdminExistsOut(OutputSchema):
    exists: bool


class StatusCount(OutputSchema):
    status: UserStatus
    count: int


class UsersPage(PaginatedData[UserOut]):
    status_counts: list[StatusCount]


class CompleteOnboardingIn(InputSchema):
    age_confirmed: bool
    beta_disclaimer_accepted: bool


class OnboardingStateOut(OutputSchema):
    onboarding_completed_at: datetime | None
    age_confirmed: bool
    beta_disclaimer_accepted: bool
