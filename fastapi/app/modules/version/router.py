from datetime import datetime

from fastapi import APIRouter

from app import __version__
from app.core.config import settings
from app.core.envelope import ApiResponse, ok
from app.core.schemas import OutputSchema
from app.core.utils import utc_now

router = APIRouter(tags=["Version"])


class VersionOut(OutputSchema):
    api_version: str
    api_major: str
    environment: str
    timestamp: datetime


@router.get("/version", summary="API version and environment")
async def get_version() -> ApiResponse[VersionOut]:
    return ok(
        VersionOut(
            api_version=__version__,
            api_major=__version__.split(".")[0],
            environment=settings.ENV,
            timestamp=utc_now(),
        )
    )
