import logging
from typing import Literal

from fastapi import APIRouter
from sqlalchemy import text

from app.core.deps import SessionDep
from app.core.envelope import ApiResponse, ok
from app.core.errors import ServiceUnavailableError
from app.core.schemas import OutputSchema

logger = logging.getLogger("app.health")
router = APIRouter(tags=["Health"])


class HealthOut(OutputSchema):
    status: Literal["ok"]
    database: Literal["up"]


@router.get("/health", summary="Liveness check including database connectivity")
async def get_health(session: SessionDep) -> ApiResponse[HealthOut]:
    try:
        await session.execute(text("SELECT 1"))
    except Exception as exc:
        logger.error("Health check failed: %s", type(exc).__name__)
        raise ServiceUnavailableError("Database unavailable") from exc
    return ok(HealthOut(status="ok", database="up"))
