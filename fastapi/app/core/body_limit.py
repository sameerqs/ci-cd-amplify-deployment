from starlette.datastructures import Headers
from starlette.exceptions import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.errors import error_response


class BodyLimitMiddleware:
    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes
        self.message = f"Request body exceeds the {max_bytes // 1024} KB limit."

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        declared = Headers(scope=scope).get("content-length")
        if declared is not None and declared.isdigit() and int(declared) > self.max_bytes:
            response = error_response(
                status=413, message=self.message, path=str(scope.get("path", ""))
            )
            await response(scope, receive, send)
            return
        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    # why: FastAPI's body reader re-raises Starlette HTTPException but turns any
                    # other exception into 400, so AppError would lose the 413 status here.
                    raise HTTPException(status_code=413, detail=self.message)
            return message

        await self.app(scope, limited_receive, send)
