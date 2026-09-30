import logging

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.errors import error_response

logger = logging.getLogger("app.errors")


class CatchAllMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        response_started = False

        async def tracking_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, receive, tracking_send)
        except Exception as exc:
            logger.exception("Unhandled error on %s %s", scope.get("method"), scope.get("path"))
            if response_started:
                raise
            response = error_response(
                status=500,
                message=f"{type(exc).__name__}: {exc}",
                path=str(scope.get("path", "")),
            )
            await response(scope, receive, send)
