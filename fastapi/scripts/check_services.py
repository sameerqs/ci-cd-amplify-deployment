"""Connectivity check for every external dependency this API talks to.

Run inside the running api container so it sees the real env, e.g.
`docker exec pet2text-backend-qa python -m scripts.check_services` on the
deployed host, or `docker compose exec api python -m scripts.check_services`
locally. Read-only except for S3, where it writes/reads/deletes one small
probe object to prove the credentials actually have write access, not just
that the bucket exists.
"""

import asyncio
import sys
import uuid
from dataclasses import dataclass

from sqlalchemy import text

from app.core.config import settings
from app.db.session import async_session_factory, engine


@dataclass(frozen=True, slots=True)
class Result:
    name: str
    ok: bool
    detail: str
    skipped: bool = False


def _print(result: Result) -> None:
    label = "SKIP" if result.skipped else ("OK" if result.ok else "FAIL")
    print(f"[{label:>4}] {result.name:<20} {result.detail}")


async def check_database() -> Result:
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        url = str(engine.url).replace(engine.url.password or "", "***")
        return Result("database", True, url)
    except Exception as exc:
        return Result("database", False, f"{type(exc).__name__}: {exc}")


async def check_cognito_jwks() -> Result:
    if not settings.cognito_configured:
        detail = "AWS_REGION/COGNITO_USER_POOL_ID/COGNITO_CLIENT_ID unset"
        return Result("cognito.jwks", False, detail, skipped=True)
    import httpx

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(settings.cognito_jwks_url)
            resp.raise_for_status()
            keys = resp.json().get("keys", [])
        detail = f"{len(keys)} signing key(s) from {settings.cognito_jwks_url}"
        return Result("cognito.jwks", bool(keys), detail)
    except Exception as exc:
        return Result("cognito.jwks", False, f"{type(exc).__name__}: {exc}")


def _check_cognito_pool_sync() -> Result:
    if not settings.cognito_configured:
        detail = "AWS_REGION/COGNITO_USER_POOL_ID/COGNITO_CLIENT_ID unset"
        return Result("cognito.pool", False, detail, skipped=True)
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError

    client = boto3.client(
        "cognito-idp",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.aws_secret_access_key,
    )
    try:
        resp = client.describe_user_pool(UserPoolId=settings.COGNITO_USER_POOL_ID)
        pool = resp["UserPool"]
        return Result("cognito.pool", True, f"{pool['Name']!r} status={pool.get('Status', 'n/a')}")
    except NoCredentialsError as exc:
        return Result("cognito.pool", False, f"no AWS credentials resolved: {exc}")
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "?")
        return Result("cognito.pool", False, f"{code}: {exc}")
    except Exception as exc:
        return Result("cognito.pool", False, f"{type(exc).__name__}: {exc}")


def _check_s3_sync() -> Result:
    if not settings.S3_BUCKET:
        detail = "S3_BUCKET/AWS_S3_BUCKET_NAME unset -- falling back to local disk storage"
        return Result("s3", False, detail, skipped=True)
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError

    client = boto3.client(
        "s3",
        region_name=settings.s3_region,
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
    )
    key = f"_health-check/{uuid.uuid4().hex}.txt"
    try:
        client.head_bucket(Bucket=settings.S3_BUCKET)
        client.put_object(Bucket=settings.S3_BUCKET, Key=key, Body=b"ok", ContentType="text/plain")
        client.get_object(Bucket=settings.S3_BUCKET, Key=key)
        client.delete_object(Bucket=settings.S3_BUCKET, Key=key)
        detail = f"bucket={settings.S3_BUCKET!r} region={settings.s3_region} put/get/delete ok"
        return Result("s3", True, detail)
    except NoCredentialsError as exc:
        return Result("s3", False, f"no AWS credentials resolved: {exc}")
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "?")
        return Result("s3", False, f"{code} on bucket={settings.S3_BUCKET!r}: {exc}")
    except Exception as exc:
        return Result("s3", False, f"{type(exc).__name__}: {exc}")


async def check_openai() -> Result:
    if settings.OPENAI_API_KEY is None:
        return Result("openai", False, "OPENAI_API_KEY unset", skipped=True)
    from app.core.llm import get_chat_model

    try:
        model = get_chat_model()
        await model.ainvoke("Reply with exactly: ok")
        return Result("openai", True, f"model={settings.OPENAI_MODEL} responded")
    except Exception as exc:
        return Result("openai", False, f"{type(exc).__name__}: {exc}")


async def main() -> int:
    print(f"ENV={settings.ENV}\n")

    results = [
        await check_database(),
        await check_cognito_jwks(),
        await asyncio.to_thread(_check_cognito_pool_sync),
        await asyncio.to_thread(_check_s3_sync),
        await check_openai(),
    ]
    for result in results:
        _print(result)

    failed = [r for r in results if not r.ok and not r.skipped]
    skipped = [r for r in results if r.skipped]
    passed = len(results) - len(failed) - len(skipped)
    print(f"\n{len(failed)} failed, {len(skipped)} skipped, {passed} ok")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
