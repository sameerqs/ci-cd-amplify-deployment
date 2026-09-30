# Optional subsystems — removal recipes

The backend ships every subsystem enabled so it runs complete out of the
box. Each recipe below is a **pure deletion** — no feature flags, no runtime
branches. Delete what your project doesn't need; everything else keeps
working.

| Subsystem | Weight | Depends on it |
| --- | --- | --- |
| Email (SMTP) | small | invite / forgot-password / email-change flows |
| Version endpoint | tiny | client footer version display |
| Throttling | tiny | recommended keep |
| LLM (LangChain + OpenAI) | small (adds `langchain`/`langchain-openai` to the image) | nothing in core — opt-in via `OPENAI_API_KEY` |
| AWS Cognito | small (adds `boto3`/`cryptography`) | **required** — it is the only way to sign in |

There is no PDF-generation subsystem here — the FastAPI backend was never
given one (the Puppeteer/Handlebars renderer some earlier sibling starters
ship is NestJS-specific). Add `weasyprint` or `playwright` in a new module
if a project needs one.

## File storage — not implemented, flagged not removed

`frontend/app/download/[...key]/route.ts` is a streaming download proxy that
expects a backend endpoint at `${API_BASE}/files/<key>` — but this FastAPI
backend has no `files`/storage module to serve it, and nothing fronting it
in this repo proxies a `/files` location yet either. Either:

- add `app/modules/files/` (a local-disk or S3 adapter behind
  `app/core/storage.py`, per `fastapi/README.md`'s "Intentionally not
  included" section) before shipping anything that uploads files, or
- delete the client proxy (`app/download/[...key]/route.ts`,
  `lib/utils/file-download.ts`, `lib/utils/file-upload.ts`,
  `components/custom/FileDropZone.tsx`) if the project has no file-upload
  feature.

## Email (SMTP)

Retry-wrapped mailer (`app/core/mailer.py`) + Jinja2 templates
(`app/templates/email/`).

**Caveat:** user invite (welcome credentials) and forgot-password flows
send mail. If you delete email entirely, stub the mailer's send function
(log + return) or remove those flows too.

Delete:
- `app/core/mailer.py`, calls to it in `app/modules/users/service.py` +
  `app/modules/auth/service.py`
- `app/templates/email/` (whole dir)
- Env: `SMTP_*`, `EMAIL_FROM` from `fastapi/.env.example`
- Dep: none extra — `mailer.py` uses the stdlib `smtplib` + `jinja2`
  (already required elsewhere)

## Version endpoint

`GET /api/version` (`app/modules/version/router.py`) reads the package
version, displayed in the client footer.

Delete:
- `app/modules/version/` + its registration on `neutral_router` in `app/api.py`
- Client: `app/context/version-context.tsx`, `lib/utils/version-service.ts`,
  `components/version-display.tsx`, and their usages in `app/layout.tsx` +
  the dashboard shell

## Throttling (recommended keep)

Per-user/IP sliding-window limiter (`app/core/rate_limit.py`) applied as a
`v1_protected_router` dependency plus per-route overrides on auth endpoints.

Delete:
- `app/core/rate_limit.py`, the `rate_limit_default` dependency in
  `app/api.py`'s `v1_protected_router`, and any per-route
  `Depends(rate_limit_*)` on auth endpoints
- `THROTTLE_*` env lines from `fastapi/.env.example`

## LLM (LangChain + OpenAI)

`app/core/llm.py` provides a cached `ChatOpenAI` client behind
`ChatModelDep`; nothing in core depends on it while no route uses that
dependency.

Delete:
- `app/core/llm.py`, `tests/unit/test_llm.py`
- Deps: `langchain`, `langchain-openai` (`fastapi/pyproject.toml`,
  then `uv sync`)
- Env: `OPENAI_*` from `fastapi/.env.example`

## AWS Cognito

Not optional. `app/modules/cognito/` + `app/core/cognito_jwt.py` are the only
authentication this application has: the pool runs the passwordless
CUSTOM_AUTH flow, issues the tokens, and the backend verifies them via JWKS.
Removing them removes sign-in.

What *is* optional around it:
- **The pool itself, in development.** Without `AWS_REGION` /
  `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` the app still boots and the
  whole test suite still runs; there is simply no way to sign in. Production
  refuses to start without them.
- **`infra/cognito/`** — the CloudFormation stack is one way to provision the
  pool, not the only one. Delete it if you provision by hand or with Terraform.
- **Explicit AWS keys.** `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` are
  passed to boto3 only when set; leave them blank in AWS and the instance role
  supplies them.
