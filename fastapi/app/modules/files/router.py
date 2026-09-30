from urllib.parse import quote

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.core import storage
from app.core.deps import CurrentUser, SessionDep
from app.modules.chat import service

router = APIRouter(prefix="/files", tags=["Files"])


def content_disposition(filename: str, *, inline: bool = False) -> str:
    """RFC 5987 encoding.

    why: Starlette encodes headers as latin-1, so interpolating a filename with
    any non-latin-1 character (CJK, Cyrillic, an emoji) raises
    UnicodeEncodeError and that file 500s on every download, permanently. The
    ascii fallback keeps old clients working; filename* carries the real name.
    """
    ascii_name = filename.encode("ascii", "replace").decode("ascii").replace('"', "'")
    disposition = "inline" if inline else "attachment"
    return f"{disposition}; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename)}"


@router.get("/{storage_key:path}", summary="Download an attachment")
async def download(
    storage_key: str,
    session: SessionDep,
    user: CurrentUser,
    inline: bool = Query(default=False),
) -> StreamingResponse:
    # why: ownership is resolved from the database, never from the key itself -
    # a guessed or crafted key must not reach another owner's file.
    attachment = await service.resolve_attachment(session, user.id, storage_key)
    size = await storage.stat(attachment.storage_key)
    return StreamingResponse(
        storage.stream(attachment.storage_key),
        media_type=attachment.content_type,
        headers={
            "Content-Length": str(size),
            "Content-Disposition": content_disposition(attachment.filename, inline=inline),
            "Cache-Control": "no-store",
        },
    )
