# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`prelegal` is a platform that drafts common legal agreements. It has three parts:

- **`templates/`** (repo root) — a catalog of Common Paper-style legal document templates in Markdown, indexed by `catalog.json` (name, description, filename per entry). These are reference/source documents, not tied to any one app.
- **`frontend/`** — a Next.js app implementing the first product surface on top of that catalog: the **Mutual NDA Creator**, a two-step form → preview → PDF-download flow for the Mutual NDA template specifically. It sits behind a fake login screen (no real auth yet) — see [Frontend routing](#frontend-routing-login--platform) below.
- **`backend/`** — a `uv`-managed FastAPI service (see [Backend](#backend)). Currently exposes only a health check; no business/domain endpoints yet.

## Technical design (target architecture)

The project ships as **Docker containers**, orchestrated by the root `docker-compose.yml`:

- **`/backend`** — a `uv` project using **FastAPI**. Implemented (KAN-4): `backend/app/main.py`, `backend/app/db.py`, `backend/Dockerfile`. See [Backend](#backend).
- **`/frontend`** — the existing Next.js app (see above). Implemented: `frontend/Dockerfile`.
- **Database**: SQLite, **recreated from scratch on every startup** — no persistence across restarts, no migrations to preserve existing data. Implemented in `backend/app/db.py`'s `reset_db()`, called from the FastAPI `lifespan` hook.
- Frontend and backend currently run as **two separate containers/processes** (ports 3000 and 8000 respectively), not a single statically-served process — statically building the frontend and serving it from FastAPI is still just a future option to consider, not implemented, and there is no wiring between the two yet (the frontend never calls the backend).
- **`scripts/`** holds the start/stop entry points, implemented as thin `docker compose` wrappers:
  - `scripts/start-mac.sh` / `scripts/stop-mac.sh` → `docker compose up -d --build` / `docker compose down`
  - `scripts/start-linux.sh` / `scripts/stop-linux.sh` → same, for Linux hosts

## Backend

`backend/` is a `uv` project (`pyproject.toml` + `uv.lock`), Python 3.13, deps `fastapi` + `uvicorn` (dev: `pytest` + `httpx`).

- **`app/main.py`** — the FastAPI app. A `lifespan` hook calls `reset_db()` on every process startup (see below). CORS is open to `http://localhost:3000` only. `GET /api/health` runs `SELECT 1` against the SQLite connection and returns `{"status": "ok"}` — this is the only endpoint; it exists to prove the DB is wired up, not as a real health-check contract for other services to depend on.
- **`app/db.py`** — `reset_db()` deletes `backend/prelegal.db` if present (`missing_ok=True`) and recreates it empty; `get_connection()` opens a `sqlite3.Connection` to it. No schema/migrations exist yet — there's nothing to migrate because nothing persists.

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

### Frontend routing: login → platform

`app/page.tsx` (`/`) is a **fake login screen** (`components/LoginScreen.tsx`, client component) — email/password fields with no validation and no real authentication; submitting just calls `router.push("/platform")`. This exists to satisfy KAN-4's "bring the user to the platform" requirement, not as real auth — there's no session, no backend call, and no way to fail the login.

The actual product — the Mutual NDA Creator — lives at **`app/platform/page.tsx`** (`/platform`), unguarded (visiting it directly, without going through `/`, works fine since there's no auth check to bypass).

### Two template directories that must stay in sync

The Mutual NDA template exists in **two places**:

- `templates/Mutual-NDA.md` — the canonical copy, part of the root-level template catalog (see `catalog.json`).
- `frontend/templates/Mutual-NDA.md` — a duplicate read by the Next.js app at build/boot time.

`frontend/app/platform/page.tsx` reads the template via `path.join(process.cwd(), "templates", "Mutual-NDA.md")` in a module-level IIFE (read once, not per-request — see the comment there), which resolves relative to `frontend/` when running `next dev`/`next build` from that directory — i.e. it reads the **frontend copy**, not the root catalog copy. If you edit the NDA template, edit both files (or the app will silently serve the stale one). The template must keep Party-A/Party-B-**distinct** placeholders (`[Party A Street Address]`, `[Party B Email Address]`, etc., not generic `[Street Address]`/`[Email Address]`) — `fillTemplate.ts` depends on that distinction to fill both parties correctly.

### Request flow: form → preview → PDF

`app/platform/page.tsx` (server component, reads the template) → `components/NdaCreator.tsx` (client, holds `step: "form" | "preview"` state and the collected `NdaFormData`) → either `NdaForm.tsx` or `NdaPreview.tsx`.

- **`lib/fillTemplate.ts`** does placeholder substitution against the raw template string using **anchored regex**, not plain string replace — placeholders like `[3]` and `[30]` share a prefix, so unanchored/ordering-dependent replacement can corrupt one with the other (see the cross-contamination test in `__tests__/fillTemplate.test.ts`). Any new placeholder must use a regex that can't partially match a longer bracketed token.
- **`components/NdaPreview.tsx`** renders the filled markdown via `react-markdown`, and on "Download PDF" rasterizes the document `<div>` with `html2canvas-pro` and paginates it into a multi-page PDF via `jspdf`, slicing the canvas into `pxPerPage`-sized chunks. `html2canvas-pro` was swapped in for the unmaintained `html2canvas` because it supports modern CSS color functions (`oklch`, `lab`) that Tailwind v4 emits; `html2canvas` is still listed in `package.json` and mocked in `NdaCreator.test.tsx` but nothing imports it anymore — treat it as removable if you're cleaning up dependencies. The generated PDF filename is derived from both party names, sanitized with a Unicode-aware regex (`/[^\p{L}\p{N}-]/gu`) — don't reintroduce a plain ASCII-only or "match everything" pattern here, both have caused real bugs (see `frontend/CHANGES.md`).
- **`components/NdaForm.tsx`**'s default `effectiveDate` must come from a `useState` lazy initializer (`() => new Date()...`), not a module-level constant — a module-level date is evaluated once at server boot and goes stale over the life of a long-running server process.

### Types

`types/nda.ts` defines `NdaFormData`, the single source of truth for form fields — both `NdaForm.tsx` (collection) and `fillTemplate.ts` (substitution) key off this shape.

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
- `NdaPreview.test.tsx` mocks `html2canvas-pro` and `jspdf` — if you swap the PDF/canvas library again, update the mock target to match.
- `LoginScreen.test.tsx` mocks `next/navigation`'s `useRouter` — the component only uses `push`, so that's the only method stubbed.
- Backend tests live in `backend/tests/`, using `pytest` + FastAPI's `TestClient` (from `httpx`). Run with `uv run pytest` from `backend/`.
