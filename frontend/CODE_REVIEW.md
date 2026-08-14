# Code Review — Mutual NDA Creator

**Branch:** `kan-3-mutual-nda-creator`
**Date:** 2026-08-14
**Scope:** `lib/fillTemplate.ts`, `components/`, `app/page.tsx`, `types/nda.ts`, `__tests__/`

---

## High

### 1. Latent placeholder-ordering bug in `fillTemplate.ts`

**File:** `lib/fillTemplate.ts` · lines 34–58

`replaceAll("[3]", data.confidentialityTerm)` will corrupt any occurrence of `[3]` that is part of `[30]`, because `"[30]".includes("[3]")` is true and `replaceAll` is not regex-anchored. The production case is currently safe only because `.replace("[30]", ...)` runs before `.replaceAll("[3]", ...)` in the chain — but if anyone reorders those two lines or adds another `[3x]`-style placeholder, it will silently produce wrong output.

**Fix:** Use anchored regex replacements:
```ts
.replace(/\[30\]/g, data.disputeNoticeDays)
.replace(/\[3\]/g, data.confidentialityTerm)
```

---

### ~~2. `app/page.tsx` filesystem read is uncached and path breaks on some deploy runtimes~~ ✅ Fixed

Template moved to `frontend/templates/Mutual-NDA.md` (no `..` path) and read in a module-level IIFE so the disk read happens once at server startup. Next.js now prebuilds the page as static content at build time.

---

## Medium

### ~~3. `handleDownload` swallows errors silently — no user feedback on failure~~ ✅ Fixed

**File:** `components/NdaPreview.tsx` · lines 19–86

The `try/finally` block re-enables the button but has no `catch`. Any failure from `html2canvas` (CORS error, DOM exception) or the dynamic `import()` calls is swallowed, leaving the user no indication that PDF generation failed.

**Resolution:** Added `downloadError` state, a `catch` block that sets it with a user-facing message (and logs to console), and a `role="alert"` paragraph in the toolbar that renders when the error is set. Error clears on the next download attempt. Two new tests cover the failure and recovery paths.1
---

### ~~4. `today` is computed at module load time, not render time~~ ✅ Fixed

**File:** `components/NdaForm.tsx` · line 10

`const today = new Date().toISOString().split("T")[0]` is declared at module scope. On a long-running server, this value becomes stale; a server that starts before midnight UTC and serves a client after midnight will pre-fill yesterday's date.

**Resolution:** Removed the module-level `today` constant and `effectiveDate` from `INITIAL` (typed as `Omit<NdaFormData, "effectiveDate">`). `useState` now uses a lazy initializer that computes the date fresh on every component mount.

---

### ~~5. `TextAreaField` always renders as `required` — no way to make it optional~~ ✅ Fixed

**File:** `components/NdaForm.tsx` · lines 62–91

`TextAreaField` hardcodes `required` on the `<textarea>` with no prop to override it, unlike `Field` which accepts `required?: boolean`. The two components could be unified into a single `Field` that conditionally renders `<input>` or `<textarea>` based on a `multiline` prop.

**Resolution:** Added `required?: boolean` (default `true`) to `TextAreaField`'s props and type definition. The asterisk label indicator and the `required` attribute on `<textarea>` are now both conditional on the prop value, matching `Field`'s existing behaviour.

---

### ~~6. Placeholder-ordering test gives false confidence — cross-contamination case not exercised~~ ✅ Fixed

**File:** `__tests__/fillTemplate.test.ts` · line 110

The tests verify `[3]` and `[30]` separately but never together with a non-default `disputeNoticeDays`. The `MINIMAL_TEMPLATE` places `[30]` before `[3]`, matching the current chain order, so the latent bug (issue #1) is not caught.

**Resolution:** Added "`[3]` placeholder does not corrupt `[30]` — cross-contamination guard" test (line 129) setting `confidentialityTerm: "5"` and `disputeNoticeDays: "30"` simultaneously and asserting the output does not contain `"50"`.

---

## Low

### 7. PDF filename becomes meaningless for non-ASCII party names

**File:** `components/NdaPreview.tsx` · lines 80–82

`.replace(/[^a-zA-Z0-9-]/g, "_")` strips all non-ASCII characters. A party name like `Müller GmbH & Co. KG` produces `Mutual-NDA-______-_____` — not useful.

**Fix:** Use a Unicode-aware pattern: `.replace(/[^\p{L}\p{N}-]/gu, "_")`.

---

### 8. `fillTemplate` runs on every render in `NdaPreview` — should be memoized

**File:** `components/NdaPreview.tsx` · line 17

`fillTemplate(template, data)` is called unconditionally on every render. When `isDownloading` toggles it triggers a re-render and redundant string processing over the full NDA template.

**Fix:**
```ts
const filled = useMemo(() => fillTemplate(template, data), [template, data]);
```

---

### 9. Multi-page PDF loop emits a near-empty trailing page for certain document lengths

**File:** `components/NdaPreview.tsx` · lines 41–78

With a canvas height of 1200px and `pxPerPage ≈ 1166`, the loop runs twice — the second iteration produces a slice of only 34px, effectively a blank page at the end of every PDF for documents of this length. The test suite does not assert `pdf.addPage` call count, so this is not caught.

**Fix (production):** Skip the final slice if its height is below a minimum threshold (e.g., `< 0.01 * pxPerPage`).
**Fix (test):** Assert `expect(pdfMock.addPage).toHaveBeenCalledTimes(n)` explicitly.
