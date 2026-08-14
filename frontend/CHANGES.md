# Change Explanations

**Branch:** `kan-3-mutual-nda-creator`
**Date:** 2026-08-14
**Scope:** Five files changed across four separate fixes.

---

## PDF Download Failure — `lab()` color function unsupported

**Symptom:** Clicking "Download PDF" showed the error alert with no PDF generated. Console: `NdaPreview.tsx:87 PDF generation failed Error: Attempting to parse an unsupported color function "lab"`.

### Root cause trace

```
User clicks Download PDF
  → handleDownload() in NdaPreview.tsx
    → html2canvas(documentRef.current, { scale: 2, ... })
      → html2canvas walks every DOM node's computed styles
        → encounters a CSS custom property resolving to oklch(...)
          → html2canvas CSS parser hits the color() dispatch:

              var SUPPORTED_COLOR_FUNCTIONS = {
                hsl: hsl,
                hsla: hsl,
                rgb: rgb,
                rgba: rgb       ← only these four are handled
              };
              var colorFunction = SUPPORTED_COLOR_FUNCTIONS[value.name];
              if (typeof colorFunction === 'undefined') {
                throw new Error(
                  'Attempting to parse an unsupported color function "' + value.name + '"'
                );
              }

        → value.name === "lab" → not in the map → throws
    → catch(err) sets downloadError state
      → "Failed to generate PDF. Please try again." shown to user
```

### Why `lab()` appears in the page

Tailwind CSS v4 (installed as `"tailwindcss": "^4"`) generates its entire color palette using **CSS Color Level 4** functions. From `node_modules/tailwindcss/theme.css`:

```css
--color-red-50:  oklch(97.1% 0.013 17.38);
--color-red-100: oklch(93.6% 0.032 17.717);
/* ... every color token is oklch() ... */
```

The `@tailwindcss/typography` plugin also references these tokens. When the NDA document `<div>` is rendered with `prose` classes, the browser resolves those CSS variables to their `oklch()` / `lab()` values in computed style. `html2canvas` reads computed style — not the CSS source — so it sees the resolved modern color function strings, which its 2021-era parser does not recognise.

### Why `html2canvas` v1.4.1 doesn't handle this

`html2canvas` v1.4.1 was released in 2022, before CSS Color Level 4 (`oklch`, `lab`, `lch`, `display-p3`, `color-mix`) became standard browser output. Its color parser is a hand-rolled switch table frozen at `rgb`, `rgba`, `hsl`, `hsla`. There has been no upstream release since.

### Fix

Replace `html2canvas` with **`html2canvas-pro`** (v2.3.8), a maintained fork that extends the color parser to cover all CSS Color Level 4 functions including `oklch`, `lab`, `lch`, and `color-mix`.

**`components/NdaPreview.tsx`**
```diff
- const { default: html2canvas } = await import("html2canvas");
+ const { default: html2canvas } = await import("html2canvas-pro");
```

**`__tests__/NdaPreview.test.tsx`** — mock target updated to match:
```diff
- vi.mock("html2canvas", () => ({ ... }));
+ vi.mock("html2canvas-pro", () => ({ ... }));
```

The API is a drop-in replacement; no other call-site changes were needed. All 48 tests pass.

---

## `lib/fillTemplate.ts`

```diff
- .replace("[30]", data.disputeNoticeDays)
- // Confidentiality term appears twice in the template
- .replaceAll("[3]", data.confidentialityTerm);
+ // Regex anchors prevent [3] from matching inside [30] or other [3x] tokens
+ .replace(/\[30\]/g, data.disputeNoticeDays)
+ .replace(/\[3\]/g, data.confidentialityTerm);
```

**What changed:** String literals replaced with anchored global regex patterns.

**Why it matters:** `"[30]".includes("[3]")` is `true`, so `replaceAll("[3]", "5")` would silently turn `[30]` into `50` — corrupting the notice-period clause — if it ran before `[30]` was replaced, or if someone reordered the chain. The regex `/\[3\]/g` matches the complete bracket token and stops exactly at the `]`, so it cannot bleed into `[30]`. This is a silent-data-corruption bug fixed by making the match boundary-aware.

---

## `components/NdaForm.tsx`

### Remove stale module-level `today`

```diff
- const today = new Date().toISOString().split("T")[0];
-
- const INITIAL: NdaFormData = {
+ const INITIAL: Omit<NdaFormData, "effectiveDate"> = {
    ...
-   effectiveDate: today,
    ...
  };
```

**What changed:** The module-level `today` constant and `effectiveDate` field are deleted from `INITIAL`; the type narrows to `Omit<NdaFormData, "effectiveDate">`.

**Why it matters:** A Node.js module is evaluated once when the server process starts. On a server that runs for days, `today` becomes a stale date frozen at boot time — a user visiting the form after midnight would see yesterday pre-filled. Removing `effectiveDate` from `INITIAL` makes it impossible to accidentally restore the old behaviour by spreading `INITIAL` and forgetting to override `effectiveDate`. The `Omit` type enforces this at compile time.

---

### Lazy initializer for `effectiveDate`

```diff
- const [form, setForm] = useState<NdaFormData>(INITIAL);
+ const [form, setForm] = useState<NdaFormData>(() => ({
+   ...INITIAL,
+   effectiveDate: new Date().toISOString().split("T")[0],
+ }));
```

**What changed:** A lazy initializer (the `() =>` function form of `useState`) replaces the direct value.

**Why it matters:** React calls the lazy initializer exactly once — at the moment the component mounts in the browser. Since mounts happen client-side and on-demand, `new Date()` always returns the actual current date for that user, regardless of when the server started. Without the arrow function, React would evaluate the argument once at module load time, not at mount time, reproducing the same staleness bug.

---

### `required` prop on `TextAreaField`

```diff
  function TextAreaField({
    ...
+   required = true,
  }: {
    ...
+   required?: boolean;
  }) {
-   <span className="text-red-500 ml-1">*</span>
+   {required && <span className="text-red-500 ml-1">*</span>}
    ...
-   required
+   required={required}
```

**What changed:** `required` is added as an optional prop with a default of `true`, the asterisk label becomes conditional, and the `<textarea required>` attribute is now driven by the prop.

**Why it matters:** The old hardcoded `required` made it impossible to use `TextAreaField` for an optional field without editing the component itself. The default of `true` means all existing call sites keep their current behaviour without changes — it's purely additive. The asterisk was also hardcoded, so a visually optional field would still show the mandatory star even if `required={false}` was eventually passed.

---

## `components/NdaPreview.tsx`

### `downloadError` state + `catch` block

```diff
+ const [downloadError, setDownloadError] = useState<string | null>(null);
  ...
  setIsDownloading(true);
+ setDownloadError(null);
  ...
+ } catch (err) {
+   console.error("PDF generation failed", err);
+   setDownloadError("Failed to generate PDF. Please try again.");
  } finally {
```

**What changed:** A new nullable string state tracks a failure message; `catch` sets it; the start of each attempt clears it.

**Why it matters:** Without a `catch`, any rejection from `html2canvas` (e.g. a CORS failure on an embedded font) was silently swallowed — the button re-enabled, the PDF didn't appear, and the user had no indication why. Clearing the error at the top of each attempt (`setDownloadError(null)`) prevents a stale message from persisting across a successful retry.

---

### Error message in JSX

```diff
+ {downloadError && (
+   <p role="alert" className="text-sm text-red-600">
+     {downloadError}
+   </p>
+ )}
```

**What changed:** A conditionally rendered paragraph surfaces the error state to the user.

**Why it matters:** `role="alert"` is an ARIA live region — screen readers announce its content automatically when it appears, without requiring the user to navigate to it. Placing it above the toolbar means it appears near the button that triggered it, which is the expected spatial relationship.

---

## `__tests__/fillTemplate.test.ts` and `__tests__/NdaPreview.test.tsx`

Pure test additions — no production behaviour changed. The `fillTemplate` test verifies that `[3]` with `confidentialityTerm: "5"` does not corrupt a `[30]` placeholder in the same template. The two `NdaPreview` tests exercise the `catch` path: one checks the alert appears and the button re-enables after a failure; the other checks that a successful retry clears the alert.

---

## `CODE_REVIEW.md`

Mechanical audit-trail updates only — issue headings wrapped in strikethrough with ✅, `**Fix:**` blocks replaced by `**Resolution:**` summaries. No semantic content changed.

---

## `__tests__/fillTemplate.test.ts` — cross-contamination regression test

```diff
+ it("[3] placeholder does not corrupt [30] — cross-contamination guard", () => {
+   const data = { ...BASE_DATA, confidentialityTerm: "5", disputeNoticeDays: "30" };
+   const result = fillTemplate(MINIMAL_TEMPLATE, data);
+   expect(result).toContain("30");
+   expect(result).not.toContain("50");
+ });
```

**What changed:** Added a test that sets `confidentialityTerm` and `disputeNoticeDays` simultaneously to non-default values.

**Why it matters:** The earlier tests verified `[3]` and `[30]` substitution independently, so the `[30]`-fixed-before-`[3]` bug in `fillTemplate.ts` (see above) could regress without any test catching it — the template happens to place `[30]` before `[3]`, matching the current chain order. This test exercises both placeholders together and asserts the notice-period clause isn't corrupted into `"50 days"`. Verified live via Playwright e2e as well: filling the form with `confidentialityTerm: 5` and `disputeNoticeDays: 30` and generating the NDA correctly showed "5 years" and "30 days" in the preview.

---

## `components/NdaPreview.tsx` — PDF filename regex produced `-.pdf` for every document

**Symptom:** Found while running a Playwright e2e pass. Every downloaded PDF was named `-.pdf` regardless of the party names entered.

**Root cause:**

```
const filename = `Mutual-NDA-${data.partyAName}-${data.partyBName}`
  .replace(/[^\x7F]/gu, "_")      ← DEL byte (0x7F) inside [^...], matches almost every char
  .replace(/[^\x00-\x7F]/g, "_")  ← redundant, string is already all underscores
  .replace(/[^a-zA-Z0-9-]/g, "_") ← also redundant by this point
  .slice(0, 80);
```

The character classes contained raw control bytes (`DEL 0x7F`, `NUL 0x00`) rather than visible characters, so the first `.replace()` matched almost the entire string and stripped it to underscores before the later, correct-looking patterns ever ran.

**Fix:**

```diff
- .replace(/[^\x7F]/gu, "_")
- .replace(/[^\x00-\x7F]/g, "_")
- .replace(/[^a-zA-Z0-9-]/g, "_")
+ .replace(/[^\p{L}\p{N}-]/gu, "_")
```

A single Unicode-aware regex (matching the fix already proposed for `CODE_REVIEW.md` issue #7) replaces the three garbled lines. Verified via Playwright: a form filled with "Nimbus Analytics, Inc." / "Redwood Ventures LLC" now downloads as `Mutual-NDA-Nimbus_Analytics__Inc_-Redwood_Ventures_LLC.pdf` instead of `-.pdf`.

---

## Summary

These changes collectively fix four independent bugs — a silent data-corruption bug in placeholder substitution, a stale-closure bug in date initialisation, a swallowed-error bug in PDF generation, and a filename-mangling regex bug found via e2e testing — plus a missing-prop inconsistency between two sibling components and a regression test to lock in the placeholder fix. The production fixes are all backward-compatible: defaults preserve existing behaviour, and the `Omit` type on `INITIAL` adds a compile-time guard that would catch any future attempt to re-introduce a module-level date default.
