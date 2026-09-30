from fastapi import APIRouter

from app.core.analytics import track
from app.core.deps import CurrentUser
from app.core.envelope import ApiResponse, Empty, ok_empty
from app.modules.analytics.schemas import TrackEventIn

router = APIRouter(prefix="/events", tags=["Analytics"])


@router.post("", summary="Log a client-side product event")
async def track_event(payload: TrackEventIn, user: CurrentUser) -> ApiResponse[Empty]:
    # why: auth is the only thing standing between this endpoint and an open
    # log-injection sink -- it stays behind v1_protected_router for that reason,
    # even though the event body carries no identity of its own.
    del user
    track(payload.event, **payload.properties)
    return ok_empty()
