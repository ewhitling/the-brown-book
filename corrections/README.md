# corrections/

User-submitted and seed corrections to `botns.db`.

Applied by `apply_corrections` during `make build`. Safe to run multiple times
(idempotent). Files without a `.yaml` extension are ignored.

---

## File layout

```
corrections/
  *.yaml          user-submitted corrections (one per file, created via the SPA)
  seed/
    *.yaml        curated seed corrections (may contain a list of entries per file)
```

`apply_corrections` scans recursively, so `seed/*.yaml` files are picked up
automatically alongside top-level corrections.

---

## YAML schema

Each `.yaml` file may contain a **single correction mapping** or a **list of
correction mappings**. Seed files typically use the list form.

Three correction types exist in v1. Every type requires a `rationale` field.

---

### 1. `factual_fix`

Edit a specific field on a claim, detail, scene, embedded narrative, or death
event. The `old_value` field is a safety check: if the current DB value does
not match, the correction is rejected and `apply_corrections` exits non-zero.
Integer columns (e.g. `revealed_at_book`) are coerced automatically — write
the numeric value as a quoted string.

**Applies to:** `factual_claim`, `notable_detail`, `scene`,
`embedded_narrative`, `death_event`

```yaml
type: factual_fix
target_type: notable_detail
target_id: 228
field: revealed_at_book
old_value: "1"
new_value: "4"
rationale: >
  Hildegrin's coma/water observation (B1C23) foreshadows Dorcas having lain
  dead at the lake bottom for decades; the significance is not understood
  until the reanimation is confirmed in B4C34 and the Ouen locket in B4C37.
```

---

### 2. `merge`

Consolidate two or more duplicate entity rows into one. All foreign-key
references pointing to `source_ids` are rewritten to `into_id`; the source
rows are then deleted. The `into_id` row is preserved unchanged.

**Applies to:** `character`, `canonical_location`

```yaml
type: merge
target_type: character
source_ids: [1, 2]
into_id: 3
rationale: >
  "Severian (young)" (id=1) and "Severian (old)" (id=2) are the same person
  across narrative distance. Consolidate into the canonical row id=3.
```

---

### 3. `rename`

Update the canonical name of an entity. Pure metadata change; no FK cascade.

**Applies to:** `character` (updates `canonical_name`),
`canonical_location` (updates `name`)

```yaml
type: rename
target_type: character
target_id: 5
new_name: Severian of the Guild
rationale: >
  The full canonical form is preferred for disambiguation in the index.
```

---

## Seed corrections

`corrections/seed/` holds curated corrections authored in the private
`analysis-botns` repo and synced to the public `the-brown-book` repo via
`make publish`.

Current seed files:

| File | Contents |
|---|---|
| `seed/identity-reveals.yaml` | `revealed_at` overrides for Dorcas resurrection and Autarch composite-identity foreshadowing |

---

## Error handling

| Situation | Behaviour |
|---|---|
| `old_value` does not match the DB | Exit non-zero; filename and diff printed to stderr |
| YAML syntax error | Exception with filename |
| Unknown correction `type` | Pydantic `ValidationError` with filename |
| Missing required field | Pydantic `ValidationError` with filename |
| Correction already applied (`new_value` already in DB) | Silent skip (idempotent) |
