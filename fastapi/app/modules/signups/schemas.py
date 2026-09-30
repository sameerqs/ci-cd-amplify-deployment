from datetime import datetime
from uuid import UUID

from app.core.enums import SignupStatus
from app.core.envelope import PaginatedData
from app.core.schemas import OutputSchema


class SignupRequestOut(OutputSchema):
    id: UUID
    email: str
    display_name: str
    status: SignupStatus
    user_id: UUID | None
    created_by_id: UUID | None
    updated_by_id: UUID | None
    created_at: datetime
    updated_at: datetime | None


class SignupStatusCount(OutputSchema):
    status: SignupStatus
    count: int


class SignupsPage(PaginatedData[SignupRequestOut]):
    status_counts: list[SignupStatusCount]
