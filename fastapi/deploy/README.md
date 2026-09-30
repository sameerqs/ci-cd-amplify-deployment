# Deploying the FastAPI backend

Production deploy is CI-driven, not host-driven: pushing to `qa` with backend
changes runs [`.github/workflows/backend-qa.yml`](../../.github/workflows/backend-qa.yml),
which lints/tests, builds this service's `Dockerfile`, pushes it to ECR tagged
with the commit SHA, and deploys that exact image to EC2 over AWS SSM Run
Command (no SSH, no image build on the host). Application config/secrets are
never on the host at rest: the deploy script running on EC2 fetches them from
AWS Systems Manager Parameter Store (path `/pet2text/qa/*`, SecureString
values encrypted with the account's KMS key) at deploy time, using the
instance's own IAM role, and writes them to a `chmod 600` temp file that's
deleted again immediately after `docker run` reads it. GitHub Actions never
requests or sees these values. See that workflow for the full mechanics and
its own comments for the one-time EC2 setup it expects (Docker installed, an
instance role with ECR pull + `ssm:GetParametersByPath` on that path +
`kms:Decrypt` on the key that encrypts it + SSM Run Command permissions).

This file is just the backend-specific operational notes that workflow
doesn't repeat.

## Operational notes

- One uvicorn worker per container (see `Dockerfile`'s `CMD`); the
  in-memory rate limiter (`app/core/rate_limit.py`) is per-process, so
  scale by adding containers and move to a shared store (e.g. Redis) once
  more than one replica needs to share limiter state.
- Pool sizing: `DATABASE_POOL_SIZE` + `DATABASE_POOL_MAX_OVERFLOW` per
  container (`fastapi/.env`). If you ever run more than one `api` replica,
  keep `replicas × (pool_size + max_overflow)` below Postgres
  `max_connections` (default 100).
- Graceful stop: uvicorn drains for 30s (`--timeout-graceful-shutdown 30` in
  the `Dockerfile`'s `CMD`); give whatever stops the container at least that
  long before a SIGKILL.
- `FORWARDED_ALLOW_IPS` must match whatever actually proxies to the
  container. The deploy workflow binds the container to `127.0.0.1:8000` on
  the host (port 8000 is never exposed publicly), so this only matters once
  something — an ALB, nginx, Caddy — is added in front of it: a wrong value
  means `X-Forwarded-For` is trusted from the wrong hop, and every IP-keyed
  rate limit collapses into one bucket.
- Health check: `/api/health` returns `200` only when `SELECT 1` against
  Postgres succeeds — the deploy workflow polls this via the image's own
  `HEALTHCHECK` and fails the deploy if it never reports healthy.
