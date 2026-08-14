# Known Issues

## AI Chat (KAN-5)

Both items below were flagged by code review as low-confidence, non-blocking
edge cases and deliberately shipped as-is — revisit if observed in practice.

### JSON-parse fallback can discard a valid `reply`

**Where:** `backend/app/chat.py`, the `try`/`except` block around `json.loads(content)`.

If the model returns syntactically valid JSON but with a malformed `fields`
shape (e.g. a list instead of an object, or a non-dict top-level value), the
`.get("fields", {}).items()` call raises `AttributeError`. This is caught by
the same `except` as JSON parse failures, so the *entire* response —
including a perfectly good `reply` — is discarded, and the raw JSON text is
shown to the user as the reply instead.

**Likelihood:** low — requires the model to ignore the system prompt's
explicit instruction that `fields` must be an object of string values.

**If this needs hardening:** parse `reply` and `fields` independently so a
valid `reply` survives even when `fields` is malformed.

### A manual field correction can be silently overwritten on a later turn

**Where:** `frontend/components/NdaChat.tsx`, the `fields` merge in `sendMessage`
(`setFields((prev) => ({ ...prev, ...data.fields }))`) combined with the
backend always sending the full known-`fields` state back to the model each
turn as context.

If a user manually edits a field via the sidebar's inline-edit control, that
correction is included in the "fields captured so far" context sent to the
model on the next turn. The system prompt instructs the model to echo back
already-known fields rather than re-derive them, so in the common case the
correction survives — but nothing *enforces* this. If the model re-derives a
field from earlier conversation text instead of trusting the "known fields"
hint, a manual correction could be silently reverted by the next turn's
response.

**Likelihood:** moderate, non-deterministic — depends on model behavior, not
a coding bug.

**If this needs hardening:** tag manually-edited fields (e.g. a `Set` of
edited keys) and skip merging the model's value for those keys on subsequent
turns, or exclude edited fields from what gets sent back to the model as
still-open questions.
