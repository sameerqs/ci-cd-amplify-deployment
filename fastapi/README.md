# Pet2text FastAPI starter

Backend built with idiomatic, strictly-typed Python: FastAPI 0.141, Pydantic 2,
SQLAlchemy 2 (async, asyncpg), Alembic, PostgreSQL 16+, `uv`, Ruff, mypy
`--strict`, pytest. Wire-compatible with the Next.js client in `../frontend`
(same `/api/v1` routes, response envelope, camelCase JSON, JWT claims —
local or AWS Cognito-issued, see the "Cognito MFA" section below).

## Quick start

```powershell
cd fastapi
pip install uv                      # once
uv sync                             # creates .venv from uv.lock
copy .env.example .env              # then fill DATABASE_URL, JWT_SECRET, PEPPER_SECRET (>= 32 chars)
uv run alembic upgrade head
uv run python -m scripts.seed       # optional: also seeds the "What's Coming" roadmap items
uv run fastapi dev app/main.py      # ensures the SEED_ADMIN_EMAIL Super Admin on boot; http://localhost:8000/docs
```

Docker (needs a `.env`; `POSTGRES_PASSWORD` is required):

```bash
docker compose up -d                # db -> migrate (one-shot) -> app on 127.0.0.1:8000
RUN_SEED=true docker compose up -d migrate
```

## Commands

| Task | Command |
| --- | --- |
| Install | `uv sync` |
| Dev server | `uv run fastapi dev app/main.py` |
| Format | `uv run ruff format .` |
| Lint | `uv run ruff check .` |
| Type check | `uv run mypy --strict app scripts tests` |
| Tests + coverage (>= 80% enforced) | `uv run pytest --cov` |
| New migration | `uv run alembic revision --autogenerate --rev-id 0002 -m add_widgets` |
| Apply / roll back | `uv run alembic upgrade head` / `uv run alembic downgrade base` |
| Seed | `uv run python -m scripts.seed` |
| Pre-commit hooks | `uv run pre-commit install` |

Verify locally before committing (`ruff check`, `ruff format --check`, `mypy --strict`,
`pytest`) — CI (`.github/workflows/verify.yml`) runs the identical commands on every push/PR.

Tests need a dedicated database: set `TEST_DATABASE_URL` in `.env`. The suite runs
`alembic downgrade base && alembic upgrade head` against it once, then wraps every test in
a transaction + SAVEPOINT that is rolled back, so the schema is exercised by the real
migrations and tests never see each other's rows. Without `TEST_DATABASE_URL` the API
tests fail loudly; they are never skipped.

## Layout

```
app/
  main.py            create_app(): lifespan (SELECT 1 fail-fast), middleware, handlers, routers
  api.py             THE SEAM: neutral /api router, v1 public router, v1 protected router
  core/              config · logging · errors · envelope · schemas · security · pagination
                     rate_limit · deps · mailer · enums · body_limit · catch_all · constants
  db/                Base + mixins (uuid pk, audit, soft delete), engine/session, models registry
  modules/<feature>/ router.py · service.py · schemas.py · models.py (+ constants.py)
  templates/email/   Jinja2 templates
alembic/             async env + versions/ (0001_init)
scripts/seed.py      single Super Admin seed (refuses without SEED_ADMIN_EMAIL)
tests/unit           no database; tests/api: real Postgres through httpx ASGITransport
```

Middleware order (outermost first): CORS -> CatchAll (500 envelope, logged once) ->
RequestContext (`X-Request-ID`, one access line) -> BodyLimit (1 MB).

## Conventions

- **Envelope.** Every handler returns `ok(data)` -> `ApiResponse[T]` with
  `{isSuccess, message, data, errors, warningHeading, warningMessage, warningType}`. `data`
  is always an object (`ok_items` wraps lists as `{items: [...]}`). Errors are raised as
  `AppError` subclasses (`NotFoundError`, `ConflictError`, ...) and rendered by the handlers
  in `core/errors.py`; validation errors are `422` with `errors[].field` paths; 5xx text is
  masked unless `ENV=development`.
- **Deny by default.** Routers included in `v1_protected_router` get
  `rate_limit_default`, `get_current_user` and `require_password_current`. Public routes
  live only on `v1_public_router` and are listed in `core/constants.py::PUBLIC_PATHS`; a
  test walks every route and fails if a protected route lacks the dependencies.
- **Authorization.** Users are customers by default. The database stores one
  `is_super_admin` flag with a partial unique index, and administrative routes
  use `Depends(require_super_admin)`.
- **Schemas.** Input models extend `InputSchema` (camelCase aliases, `extra="forbid"`,
  trimming); output models extend `OutputSchema` (`from_attributes`, camelCase output).
  `PasswordStr`, `EmailLower`, `PhoneStr`, `PostalStr` carry the shared validation rules.
- **Transactions.** `get_session` yields a session and rolls back on close; services call
  `await session.commit()` once at the end of a write. Never call `session.begin()` and
  never commit inside a dependency.
- **Lazy loading.** Async SQLAlchemy raises `MissingGreenlet` when serialization touches an
  unloaded attribute. Services return Pydantic schemas built while the session is live;
  output schemas expose scalar columns (plus plain `@property` values) of the queried
  entity only, and anything relational is loaded with `selectinload` in the service.
- **Pagination.** `?page&pageSize<=100&search<=200&sort=field:asc,other:desc`; each list
  declares a `SORTABLE` whitelist and returns `PaginatedData` (`items, page, pageSize,
  totalRecords, totalPages`). Unknown sort fields or directions are `400`.
- **Database.** Native `uuid` primary keys, snake_case columns, `timestamptz`, audit columns
  (`created_by_id`, `updated_by_id`, `utc_inserted_datetime`, `utc_modified_datetime`),
  `is_deleted` on every table, `is_active` only where activation is a domain concept.
  Filter `is_deleted.is_(False)` in every query. Partial unique index keeps one alive Super
  Admin. Migrations are `NNNN_snake_case` (`--rev-id 0002`).
- **Auth.** JWT HS256 (`iss`/`aud`, 15 min) + opaque refresh tokens (sha256 stored, 7 d,
  rotation with reuse detection and a 10 s grace window). `token_version` on the user is a
  synchronous kill switch. Passwords: `bcrypt(hmac_sha256(PEPPER_SECRET, password))`.
  Users with `must_change_password` receive `403 PASSWORD_CHANGE_REQUIRED` everywhere
  except change-password, force-change-password, logout and `GET /users/profile`.
- **Rate limiting.** In-memory fixed window keyed by JWT subject, else by client IP —
  combined with the body email on login and forgot-password so one client cannot lock
  another out of an account. Protected routes get the general limiter; login 15/15 min,
  forgot/reset 3/h, refresh 30/min. Per process: add Redis (`limits`) before running more
  than one worker.
- **Email.** `core/mailer.py` sends through stdlib `smtplib` when `SMTP_HOST` is set and
  logs a warning otherwise; invite responds with `warningType=SOFT` when the email was not
  sent.
- **Logging.** stdlib `logging`; JSON lines in `uat`/`production` (`LOG_JSON`), one access
  line per request with `request_id`; unhandled errors are logged once with the traceback.
  Never log emails, passwords or tokens.

## Adding a module

1. Create `app/modules/<name>/` with `models.py` (mixins from `app.db.base`), `schemas.py`,
   `service.py` (async functions taking `AsyncSession`; return schemas), `router.py`.
2. Import the models in `app/db/models.py`; run `uv run alembic revision --autogenerate
   --rev-id NNNN -m <name>` and review the file.
3. Include the router in `app/api.py` on `v1_protected_router` (or `v1_public_router` and
   add the path to `PUBLIC_PATHS`).
4. Write `tests/api/test_<name>.py` first; the `client`, `session` and header fixtures in
   `tests/api/conftest.py` cover auth and isolation.

## Intentionally not included

- PDF rendering: add `weasyprint` or `playwright` in a module when a project needs one.
- File storage: `frontend/app/download/[...key]/route.ts` already expects one at
  `/files` — add an `app/core/storage.py` adapter (local disk / S3) before shipping
  any upload feature; see `docs/optional-subsystems.md`.
- Email-change two-step flow, background jobs, caching, multi-tenancy, HTTP security
  headers (owned by whatever reverse proxy sits in front of this service in
  each environment — none is included in this repo).

See `deploy/README.md` for backend-specific operational notes, and
[`.github/workflows/backend-qa.yml`](../.github/workflows/backend-qa.yml) for
the actual deploy pipeline (lint/test → build → ECR → SSM → EC2).

## Auth

AWS Cognito, and nothing else. The pool runs a passwordless CUSTOM_AUTH
magic-link flow and issues the tokens; this service mints none of its own and
verifies pool JWTs against the JWKS. Boot in production requires `AWS_REGION`,
`COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID`; development and CI may run
without them and simply have no way to sign in.

The access token is the Bearer credential. Cognito's refresh token is
encrypted into `auth_sessions` and never leaves this process — the browser
holds an opaque session handle in an HttpOnly cookie, so renewal is something
only this service can do. `POST /auth/refresh` spends it, `POST /auth/logout`
revokes it here and at the pool.

One app client, created without a client secret. There is no second public
client: the browser never talks to Cognito directly, and nothing here
computes a `SECRET_HASH` — an app client with a secret would fail every call.

The pool needs the three custom-auth Lambda triggers before any of this works
— see [`lambdas/cognito_custom_auth/README.md`](lambdas/cognito_custom_auth/README.md)
for the contract and the required app-client settings.
