import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from sqlalchemy import text

from app import __version__
from app.api import neutral_router, v1_protected_router, v1_public_router
from app.core.body_limit import BodyLimitMiddleware
from app.core.catch_all import CatchAllMiddleware
from app.core.config import settings
from app.core.errors import ConflictError, install_exception_handlers
from app.core.logging import RequestContextMiddleware, configure_logging

# why: registers every mapped model with Base.metadata before the app ever
# touches the database. Mirrors alembic/env.py, which needs the same thing
# for migrations and already does this. The name is thrown away rather than
# `import app.db.models`, which would silently stop doing anything the moment
# `app` below is no longer the last name bound in this module.
from app.db import models as _register_every_model  # noqa: F401
from app.db.session import async_session_factory, engine
from app.modules.users.service import ensure_super_admin

logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))
    logger.info(
        "Database connection verified (TZ=UTC); %s v%s ready", settings.APP_NAME, __version__
    )
    # why: guarantees a live Super Admin on every boot (fresh env, restored
    # backup, ...) without a separate manual step. Idempotent and non-fatal:
    # a bad SEED_ADMIN_EMAIL should not block the app from serving traffic.
    if settings.SEED_ADMIN_EMAIL:
        async with async_session_factory() as session:
            try:
                action = await ensure_super_admin(session, settings.SEED_ADMIN_EMAIL)
                logger.info("Super Admin %s: %s", action, settings.SEED_ADMIN_EMAIL)
            except ConflictError as exc:
                logger.warning("Super Admin bootstrap skipped: %s", exc.message)
    yield
    await engine.dispose()
    logger.info("Database engine disposed")


def generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}" if route.tags else route.name


def create_app() -> FastAPI:
    configure_logging(settings.LOG_LEVEL, settings.log_json)
    app = FastAPI(
        title=f"{settings.APP_NAME} API",
        description=f"{settings.APP_NAME} API",
        version=__version__,
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url="/redoc" if settings.docs_enabled else None,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
        lifespan=lifespan,
        generate_unique_id_function=generate_unique_id,
    )
    install_exception_handlers(app)
    app.include_router(neutral_router)
    app.include_router(v1_public_router)
    app.include_router(v1_protected_router)
    app.add_middleware(BodyLimitMiddleware, max_bytes=settings.BODY_LIMIT_BYTES)
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(CatchAllMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "Cache-Control", "Pragma", "X-Request-ID"],
        expose_headers=["X-Request-ID", "Retry-After"],
        max_age=3600,
    )
    return app


app = create_app()
