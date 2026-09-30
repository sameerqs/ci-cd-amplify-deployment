from typing import Any

from fastapi import APIRouter, Depends

from app.core.constants import API_PREFIX, API_V1_PREFIX
from app.core.deps import get_current_user
from app.core.envelope import ApiResponse
from app.core.errors import ErrorData
from app.core.rate_limit import rate_limit_default
from app.modules.analytics.router import router as analytics_router
from app.modules.auth.router import public_router as auth_public_router
from app.modules.categories.router import router as categories_router
from app.modules.chat.router import attachments_router
from app.modules.chat.router import router as chat_router
from app.modules.files.router import router as files_router
from app.modules.health.router import router as health_router
from app.modules.pets.router import router as pets_router
from app.modules.roadmap.router import owner_router as whats_coming_router
from app.modules.roadmap.router import router as roadmap_router
from app.modules.users.router import router as users_router
from app.modules.version.router import router as version_router

ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    422: {"model": ApiResponse[ErrorData], "description": "Validation error"},
}

neutral_router = APIRouter(prefix=API_PREFIX)
neutral_router.include_router(health_router)
neutral_router.include_router(version_router)

v1_public_router = APIRouter(prefix=API_V1_PREFIX, responses=ERROR_RESPONSES)
v1_public_router.include_router(auth_public_router)

v1_protected_router = APIRouter(
    prefix=API_V1_PREFIX,
    dependencies=[
        Depends(rate_limit_default),
        Depends(get_current_user),
    ],
    responses=ERROR_RESPONSES,
)
v1_protected_router.include_router(analytics_router)
v1_protected_router.include_router(users_router)
v1_protected_router.include_router(categories_router)
v1_protected_router.include_router(roadmap_router)
v1_protected_router.include_router(pets_router)
v1_protected_router.include_router(whats_coming_router)
v1_protected_router.include_router(chat_router)
v1_protected_router.include_router(attachments_router)
v1_protected_router.include_router(files_router)
