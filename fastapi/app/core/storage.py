"""Attachment storage.

This layer puts bytes somewhere durable and hands them back. S3 is used when a bucket is configured;
otherwise files land in a local directory, which keeps dev and CI running with
no cloud account and no credentials in the repo.
"""

import logging
import shutil
from collections.abc import AsyncIterator
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import BinaryIO
from uuid import uuid4

import anyio
import boto3

from app.core.config import settings
from app.core.errors import NotFoundError

logger = logging.getLogger("app.storage")


@dataclass(frozen=True, slots=True)
class StoredFile:
    key: str
    size_bytes: int


def _local_root() -> Path:
    root = Path(settings.LOCAL_STORAGE_DIR)
    root.mkdir(parents=True, exist_ok=True)
    return root


def build_key(pet_id: str, filename: str) -> str:
    # why: the stored name is never the uploaded one - two owners uploading
    # "bill.pdf" must not collide, and a crafted name must not escape the root.
    suffix = Path(filename).suffix[:16]
    return f"pets/{pet_id}/{uuid4().hex}{suffix}"


@lru_cache(maxsize=1)
def _s3_client() -> object:
    # why: boto3 clients are expensive to build and safe to reuse; a fresh one
    # per call also got discarded while its StreamingBody was still being read.
    return boto3.client(
        "s3",
        region_name=settings.s3_region,
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
    )


def _put_sync(key: str, data: bytes, content_type: str) -> None:
    if settings.S3_BUCKET:
        _s3_client().put_object(  # type: ignore[attr-defined]
            Bucket=settings.S3_BUCKET, Key=key, Body=data, ContentType=content_type
        )
        return
    target = _local_root() / key
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)


async def put(key: str, data: bytes, content_type: str) -> StoredFile:
    await anyio.to_thread.run_sync(_put_sync, key, data, content_type)
    return StoredFile(key=key, size_bytes=len(data))


CHUNK_BYTES = 64 * 1024


def _stat_sync(key: str) -> int:
    if settings.S3_BUCKET:
        head = _s3_client().head_object(Bucket=settings.S3_BUCKET, Key=key)  # type: ignore[attr-defined]
        return int(head["ContentLength"])
    target = _local_root() / key
    if not target.is_file():
        raise NotFoundError("File not found")
    return target.stat().st_size


async def stat(key: str) -> int:
    return await anyio.to_thread.run_sync(_stat_sync, key)


def _open_sync(key: str) -> BinaryIO:
    if settings.S3_BUCKET:
        obj = _s3_client().get_object(Bucket=settings.S3_BUCKET, Key=key)  # type: ignore[attr-defined]
        body: BinaryIO = obj["Body"]
        return body
    target = _local_root() / key
    if not target.is_file():
        raise NotFoundError("File not found")
    return target.open("rb")


async def stream(key: str) -> AsyncIterator[bytes]:
    """Yield fixed-size chunks and always close the handle.

    why: handing a raw file object to StreamingResponse makes Starlette iterate
    it *by line* - one threadpool hop per newline byte for a PDF, or the whole
    file buffered when there are none - and nothing ever closes it.
    """
    handle = await anyio.to_thread.run_sync(_open_sync, key)
    try:
        while True:
            chunk = await anyio.to_thread.run_sync(handle.read, CHUNK_BYTES)
            if not chunk:
                return
            yield chunk
    finally:
        await anyio.to_thread.run_sync(handle.close)


def _read_sync(key: str) -> bytes:
    handle = _open_sync(key)
    try:
        return handle.read()
    finally:
        handle.close()


async def read(key: str) -> bytes:
    """The whole object in memory.

    Only for the multimodal path, where the bytes have to be base64'd into a
    prompt anyway. Downloads still go through stream() -- reading a 25MB file
    into memory per request is the thing that layer exists to avoid.
    """
    return await anyio.to_thread.run_sync(_read_sync, key)


def _delete_sync(key: str) -> None:
    if settings.S3_BUCKET:
        _s3_client().delete_object(Bucket=settings.S3_BUCKET, Key=key)  # type: ignore[attr-defined]
        return
    target = _local_root() / key
    target.unlink(missing_ok=True)


async def delete(key: str) -> None:
    await anyio.to_thread.run_sync(_delete_sync, key)


def reset_local_storage() -> None:
    """Test helper: drop everything the local backend wrote."""
    root = Path(settings.LOCAL_STORAGE_DIR)
    if root.exists():
        shutil.rmtree(root)
