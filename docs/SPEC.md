# SPEC

## Purpose

Pet2text: Next.js client + FastAPI backend, with auth pluggable between
local JWT and AWS Cognito MFA (TOTP/SMS), and LangChain + OpenAI wiring
for LLM features.

## FastAPI (Python) focus

- `/api/v1`, camelCase JSON envelope (`isSuccess`/`data`/`errors`/`warning*`), JWT or Cognito-issued bearer tokens.
- Verify gate: `uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy --strict app scripts tests`, `uv run pytest`.
- Agent harness: `qagent` engine from `llm_workflows`; this repo holds `agent.config.json` + `.agent/`.

## Product

pet2text is a consumer chat app for pet owners: they describe what's going
on with their pet in their own words, an LLM assistant turns it into a
structured written record, and the owner brings that record to the next vet
visit. Beta, documentation-only — the product explicitly does not diagnose,
give medical advice, or judge cost/urgency.

Source of truth for UI/UX: Claude Design project
`https://claude.ai/design/p/8e047f59-f677-4394-8c32-9ce67d7d960b`
(`pet2text.dc.html` fully extracted; `pet2text screens.html` not yet
reviewed — pull before finalizing any screen this doc doesn't cover).

### Core entities

- **User / Owner** — email identity + full name (collected at signup, shown to admins reviewing pending accounts), `UserStatus` (numeric enum: `PENDING=0`, `ACTIVE=1`, `REJECTED=2` — replaces the starter's plain `is_active` boolean), `onboarding_completed_at` (null until the consent gate is passed), two consent preference flags (18+, beta/documentation-only) captured at onboarding.
- **Pet** — name, species (Dog/Cat/Other), age (free text), weight (optional), breed (optional), archived flag (soft-delete semantics — archiving hides the pet + chat, non-destructive, reversible).
- **Chat / Conversation** — one per pet, holds the message transcript and attachment count.
- **Message** — sender (assistant/owner), text, timestamp; may carry an attached file inline.
- **Attachment** — filename + source (camera/photo picker/file upload); stored but explicitly never parsed/read by the system.
- **Captured Summary** — the core generated artifact: categorized bullets (e.g. "Vet visit", "Your concern") with provenance (quote or filename + timestamp) and an owner signature. Starts unconfirmed; only persists to the pet's profile after explicit owner confirmation ("Yes, that's right"), with an Undo. This confirm step is the actual privacy mechanism — nothing is saved without sign-off.
- **Declined Question** — an out-of-scope question (medical judgment, pricing) the assistant declines to answer but can write down, reworded, into the chat for the owner to read at the clinic. Not rated or prioritized.

### Key flows

1. **Signup → admin approval → magic-link sign-in → onboarding → chat** (see "Auth & account lifecycle" below).
2. Chat: freeform owner input, assistant clarifying questions, attachments via a 3-way capture sheet (camera / photo / file), periodic "What I captured" card the owner must confirm/edit before it's saved.
3. Out-of-scope question → decline + offer to write a reworded version into the chat (not a rating/priority list).
4. Emergency-sounding input → composer disabled, stop-and-call-a-vet message, no severity rating.
5. Account: manage pets (add/archive/unarchive), read-only email, roadmap voting ("What's coming").

### Auth & account lifecycle (resolved — supersedes the starter's password/MFA flow for v1)

AWS Cognito is the only provider: a passwordless magic link over CUSTOM_AUTH. No password
and no MFA prompt anywhere in this flow, and no local-JWT fallback — the local password path
was removed.

1. **Signup** (public, unauthenticated) — email + full name only. Creates a `User` with
   `status=PENDING`. No session, no access yet.
2. **Admin approval** — extends the existing `users` admin module rather than a new screen:
   `UserStatus` replaces `is_active`, the list gets an Approve/Reject row action modeled on the
   existing `PATCH /users/bulk-status` pattern, gated by the existing `require_roles(*ADMINS)`.
   Approve → `status=ACTIVE` + "your account is ready, sign in" email. Reject → `status=REJECTED`
   (whether a rejection notice is emailed is an implementation-level call for that beat, not a
   blocking decision).
3. **Sign-in (every time, not just first login)** — email-only entry screen (design `2a`); backend
   issues a single-use, short-TTL magic-link token and emails it. The request/response shape must
   not leak whether an email exists or its status (standard anti-enumeration practice for
   passwordless flows) — only `ACTIVE` users can actually complete a link. Clicking the link
   verifies the token and issues the normal local-JWT session (httpOnly cookies, existing
   refresh-rotation machinery).
4. **First login → onboarding** — if `onboarding_completed_at` is null after a successful
   magic-link verification, redirect to the consent gate (design `2b`) before chat is reachable;
   submitting both checkboxes stamps `onboarding_completed_at` and saves the two flags as the
   user's preferences. Every later sign-in skips straight to chat.

### Open questions (implementation-level, resolve within the owning beat, not blocking)

- **LLM extraction contract** — exact category taxonomy, confidence/consolidation behavior across multiple confirmations, and how it composes with `app/core/llm.py`'s `ChatModelDep`.
- **Attachment retention** — storage location/lifecycle for camera/photo/file uploads that are stored but never parsed.
- **Roadmap voting persistence** — whether votes/comments need a backing table or are UI-only for now.
- **Rejection notice** — whether a REJECTED signup gets an email, or just silently stays inaccessible.
