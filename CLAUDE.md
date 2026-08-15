# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`prelegal` is a platform that drafts common legal agreements. It has three parts:

- **`templates/`** (repo root) — a catalog of Common Paper-style legal document templates in Markdown, indexed by `catalog.json` (name, description, filename per entry). These are reference/source documents, not tied to any one app. Only `Mutual-NDA.md` uses simple `[Bracketed Placeholder]` tokens ready for direct fill-in; the other entries use Common Paper's Cover Page/Order Form "Variable" convention (`<span class="coverpage_link">Term</span>` etc.) and are not wired up to any generation flow.
- **`frontend/`** — a Next.js app implementing the first product surface on top of that catalog: the **Mutual NDA Creator**. Real auth (sign-in/sign-up, session cookies) gates the product; once signed in, a user drafts an NDA through a freeform AI chat (not a static form) that extracts structured fields turn by turn, then previews and downloads a PDF, with generated documents saved to their own document history. See [Frontend routing](#frontend-routing-sign-in--platform) below.
- **`backend/`** — a `uv`-managed FastAPI service (see [Backend](#backend)) providing auth, the chat's LLM field-extraction endpoint, per-user document history, and a health check.

## Technical design (target architecture)

The project ships as **Docker containers**, orchestrated by the root `docker-compose.yml`:

- **`/backend`** — a `uv` project using **FastAPI**. See [Backend](#backend).
- **`/frontend`** — the existing Next.js app (see above). Implemented: `frontend/Dockerfile`.
- **Database**: SQLite, **recreated from scratch on every startup** — no persistence across restarts, no migrations to preserve existing data. Implemented in `backend/app/db.py`'s `reset_db()`, called from the FastAPI `lifespan` hook. Schema: `users`, `sessions` (auth), `documents` (per-user saved NDAs).
- Frontend and backend run as **two separate containers/processes** (ports 3000 and 8000 respectively), not a single statically-served process — statically building the frontend and serving it from FastAPI is still just a future option to consider, not implemented. The frontend **does** call the backend now, over `fetch` with `credentials: "include"` (see `frontend/lib/api.ts`'s `API_URL`), for auth, the chat, and document history.
- **`scripts/`** holds the start/stop entry points, implemented as thin `docker compose` wrappers:
  - `scripts/start-mac.sh` / `scripts/stop-mac.sh` → `docker compose up -d --build` / `docker compose down`
  - `scripts/start-linux.sh` / `scripts/stop-linux.sh` → same, for Linux hosts

## Backend

`backend/` is a `uv` project (`pyproject.toml` + `uv.lock`), Python 3.13, deps `fastapi`, `uvicorn`, `litellm` (LLM calls for the chat), `bcrypt` (password hashing), `python-dotenv`, `email-validator` (dev: `pytest` + `httpx`).

- **`app/main.py`** — the FastAPI app. A `lifespan` hook calls `reset_db()` on every process startup (see below). CORS is open to `http://localhost:3000` only, with `allow_credentials=True` (required for the session cookie). Registers the `auth`, `chat`, and `documents` routers. `GET /api/health` runs `SELECT 1` against the SQLite connection and returns `{"status": "ok"}`.
- **`app/db.py`** — `reset_db()` deletes `backend/prelegal.db` if present (`missing_ok=True`) and recreates it empty from `SCHEMA` (`users`, `sessions`, `documents` tables); `get_connection()` opens a `sqlite3.Connection` to it, with `row_factory = sqlite3.Row`. No migrations exist — there's nothing to migrate because nothing persists across restarts.
- **`app/auth.py`** — `POST /api/auth/signup` / `/login` / `/logout`, `GET /api/auth/me`. Passwords hashed with `bcrypt`; a session token (`secrets.token_urlsafe(32)`) is stored in the `sessions` table and set as an `httponly`, `samesite=lax` cookie. `get_current_user` is the FastAPI dependency other routers use to require auth (raises `401` if the cookie is missing or the token isn't a live session).
- **`app/chat.py`** — `POST /api/chat`. Proxies the conversation plus fields captured so far to an LLM (`openrouter/openai/gpt-oss-120b` via LiteLLM, pinned to the Cerebras provider) using a system prompt built from `nda_fields.py`'s `NDA_FIELDS`; the model must return `{"reply": ..., "fields": {...}}` JSON, and the response fields are filtered to only the known `NDA_FIELDS` keys before returning. Requires `OPENROUTER_API_KEY`; returns `500` if it's unset and `502` if the LLM call itself fails.
- **`app/documents.py`** — authenticated (`get_current_user`) `POST /api/documents` (save), `GET /api/documents` (list, current user's only, newest first), `GET /api/documents/{id}` (detail, 404s if not owned by the caller). `party_a_name`/`party_b_name` are pulled out of the submitted fields blob into dedicated columns for the list view; the full field set is stored as `fields_json`.
- **`app/nda_fields.py`** — the canonical `NDA_FIELDS: dict[str, str]` (12 keys, with extraction-guidance descriptions for the LLM prompt). Mirrors `frontend/types/nda.ts`'s `NdaFormData` shape and `frontend/lib/ndaFields.ts`'s field labels/order — if one changes, update all three.

Commands (run from `backend/`):

```bash
uv run uvicorn app.main:app --reload --port 8000   # dev server
uv run pytest                                       # run tests (backend/tests/)
```

`backend/prelegal.db`, `.venv/`, `__pycache__/`, and `.pytest_cache/` are gitignored via the existing root `.gitignore` patterns (no backend-specific entries needed).

## Commands (run from `frontend/`)

```bash
npm run dev            # start dev server (Turbopack) on localhost:3000
npm run build           # production build
npm run lint             # eslint
npm test                 # vitest run (all tests, once)
npm run test:watch       # vitest watch mode
npm run test:coverage    # vitest with v8 coverage (lib/** and components/** only)
```

Run a single test file: `npx vitest run __tests__/fillTemplate.test.ts`
Run tests matching a name: `npx vitest run -t "cross-contamination"`

If `node_modules/.bin` is missing (fresh checkout), run `npm install` in `frontend/` first — `npm test` will otherwise fail with `vitest: command not found`.

## Environment

`OPENROUTER_API_KEY` is available in the environment via `.env` in the project root — used for LLM calls routed through OpenRouter (see the `cerebras` skill for calling Cerebras-backed models through LiteLLM + OpenRouter).

## Architecture

### Frontend routing: sign-in → platform

`app/page.tsx` (`/`) renders **`components/AuthScreen.tsx`** (client component) — a real sign-in/sign-up toggle that posts to `POST /api/auth/login` or `/signup`, which sets the session cookie; on success it calls `router.push("/platform")`.

The actual product — the Mutual NDA Creator — lives at **`app/platform/page.tsx`** (`/platform`), server-rendered but guarded client-side by **`components/PlatformShell.tsx`**: on mount it calls `GET /api/auth/me` and `router.replace("/")`s if that 401s, showing a brief "Loading…" state in between. Visiting `/platform` directly without a session redirects back to `/` rather than rendering the product.

### Two template directories that must stay in sync

The Mutual NDA template exists in **two places**:

- `templates/Mutual-NDA.md` — the canonical copy, part of the root-level template catalog (see `catalog.json`).
- `frontend/templates/Mutual-NDA.md` — a duplicate read by the Next.js app at build/boot time.

`frontend/app/platform/page.tsx` reads the template via `path.join(process.cwd(), "templates", "Mutual-NDA.md")` in a module-level IIFE (read once, not per-request — see the comment there), which resolves relative to `frontend/` when running `next dev`/`next build` from that directory — i.e. it reads the **frontend copy**, not the root catalog copy. If you edit the NDA template, edit both files (or the app will silently serve the stale one) **and restart the dev server** — the IIFE only runs once at process boot, so a template edit alone won't hot-reload into an already-running server. The template must keep Party-A/Party-B-**distinct** placeholders (`[Party A Street Address]`, `[Party B Email Address]`, etc., not generic `[Street Address]`/`[Email Address]`) — `fillTemplate.ts` depends on that distinction to fill both parties correctly.

**Known gap:** the template's intro clause reads `"...entered into as of the Effective Date by and between:"` with no placeholder anywhere to actually give "Effective Date" a value — `fillTemplate.ts`'s effective-date substitution is a no-op against the real template, so the date a user provides is captured but never appears anywhere in the generated document. Worth fixing before this ships.

### Request flow: chat → preview → PDF

`app/platform/page.tsx` (server component, reads the template) → `components/PlatformShell.tsx` (client, auth-gated, holds `"creator" | "history"` view state) → `components/NdaCreator.tsx` (client, holds `step: "form" | "preview"` and the collected `NdaFormData`) → `components/NdaChat.tsx` or `NdaPreview.tsx`.

- **`components/NdaChat.tsx`** collects fields through a freeform conversation instead of a static form: each user message POSTs to backend `POST /api/chat` along with the conversation history and fields captured so far, and the response's `fields` are merged into local state. `lib/ndaFields.ts`'s `NDA_FIELD_ORDER` drives the "Captured details" sidebar and gates the "Review & Generate" button (enabled once every field is non-empty); a user can also click any captured field to edit it inline, bypassing the chat.
- On submit, `NdaCreator.tsx` calls `onSubmit`, which (in `PlatformShell.tsx`) also `POST`s the fields to backend `/api/documents` to save them to the signed-in user's history, before moving to the preview step.
- **`lib/fillTemplate.ts`** does placeholder substitution against the raw template string using **anchored regex** for the numeric placeholders — `[3]` and `[30]` share a prefix, so unanchored/ordering-dependent replacement can corrupt one with the other (see the cross-contamination test in `__tests__/fillTemplate.test.ts`). Any new placeholder must use a regex that can't partially match a longer bracketed token.
- **`components/NdaPreview.tsx`** renders the filled markdown via `react-markdown`, and on "Download PDF" rasterizes the document `<div>` with `html2canvas-pro` and paginates it into a multi-page PDF via `jspdf`, slicing the canvas into `pxPerPage`-sized chunks. `html2canvas-pro` was swapped in for the unmaintained `html2canvas` because it supports modern CSS color functions (`oklch`, `lab`) that Tailwind v4 emits; `html2canvas` is still listed in `package.json` and mocked in `NdaCreator.test.tsx` but nothing imports it anymore — treat it as removable if you're cleaning up dependencies. The generated PDF filename is derived from both party names, sanitized with a Unicode-aware regex (`/[^\p{L}\p{N}-]/gu`) — don't reintroduce a plain ASCII-only or "match everything" pattern here, both have caused real bugs (see `frontend/CHANGES.md`).
- **`components/HistoryList.tsx`** lists the signed-in user's previously saved documents (`GET /api/documents`); selecting one fetches the full record (`GET /api/documents/{id}`) and reopens it in `NdaPreview.tsx`.

### Types

`types/nda.ts` defines `NdaFormData`, the single source of truth for the NDA's field shape — `NdaChat.tsx` (collection), `fillTemplate.ts` (substitution), and `lib/ndaFields.ts` (labels/order) all key off it. `types/document.ts` defines `DocumentSummary`/`DocumentDetail`, mirroring `backend/app/documents.py`'s response shapes.

## Debugging workflow

When the user pastes an error (stack trace, failing test output, console error, screenshot of a broken page), follow this loop rather than jumping straight to a fix:

1. **Hypothesize** — state a specific, falsifiable theory of the root cause before touching code.
2. **Investigate** — read the actual source at the point of failure to confirm or rule out the hypothesis (don't guess from the error message alone; e.g. the PDF-filename bug in `frontend/CHANGES.md` looked like a Unicode-stripping issue from the symptom, but the real cause was raw control bytes in the regex literal — only visible by reading the file's actual bytes, not its rendered text).
3. **Fix** — make the smallest change that addresses the confirmed root cause, not the symptom.
4. **Verify** — re-run whatever surfaced the error (test, dev server, browser) to confirm it's actually resolved.
5. If the hypothesis was wrong or the fix didn't fully resolve it, repeat from step 1 with what was just learned — don't keep patching around an unconfirmed theory.

## Testing notes

- Frontend tests live in `frontend/__tests__/`, using Vitest + Testing Library + jsdom (`vitest.setup.ts`, `vitest.config.ts`).
- Coverage is scoped to `lib/**` and `components/**` only (see `vitest.config.ts`).
- `NdaPreview.test.tsx` and `PlatformShell.test.tsx` mock `html2canvas-pro`, `jspdf`, and `react-markdown` — if you swap the PDF/canvas library again, update the mock target to match.
- `AuthScreen.test.tsx` and `PlatformShell.test.tsx` mock `next/navigation`'s `useRouter`; `PlatformShell.test.tsx` also stubs `fetch` for `/api/auth/me` to control the auth-gate redirect.
- `NdaChat.test.tsx` stubs `fetch` (via `vi.stubGlobal`) to control the `/api/chat` response shape rather than hitting the real LLM.
- Backend tests live in `backend/tests/` (`test_auth.py`, `test_chat.py`, `test_documents.py`, `test_health.py`), using `pytest` + FastAPI's `TestClient` (from `httpx`). `test_chat.py` monkeypatches `litellm.completion` via a `SimpleNamespace`-based fake rather than calling the real LLM. Run with `uv run pytest` from `backend/`.
