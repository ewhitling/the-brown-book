# Contributing to The Brown Book

Most contributions are *corrections* — fixes to imperfect LLM extractions that
improve the data set over time.

## How a correction becomes a PR

Every item in the tool has a **Flag** affordance. Clicking it opens a GitHub PR
pre-filled with correction YAML. Submit the PR, a reviewer checks it against the
source text, and once merged, the next build picks it up.

You can also file corrections by hand. Drop a `.yaml` file in `corrections/`
matching one of the three shapes below.

## Correction types

All three types require a `rationale` field. The rationale should cite the
relevant chapter and explain the issue in one sentence.

---

### 1. `factual_fix` — edit a specific field

Use this when a field on a claim, scene, detail, embedded narrative, or death
event is wrong. The `old_value` field is a safety check: if the current database
value does not match, the correction is rejected.

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
  Hildegrin's observation (B1C23) only becomes meaningful once Dorcas's
  resurrection is confirmed in B4C34. The significance is not felt until
  Book 4.
```

---

### 2. `merge` — consolidate duplicate entities

Use this when two or more rows in the database refer to the same character or
location. All foreign-key references to `source_ids` are rewritten to `into_id`;
the source rows are deleted. The `into_id` row is preserved unchanged.

**Applies to:** `character`, `canonical_location`

```yaml
type: merge
target_type: character
source_ids: [1, 2]
into_id: 3
rationale: >
  "Severian (young)" and "Severian (old)" are the same person across narrative
  distance. Consolidate into the canonical row (id=3).
```

---

### 3. `rename` — update a canonical name

Use this when the entity exists but its canonical name is wrong or inconsistent.
This is a pure metadata change — no foreign-key cascade.

**Applies to:** `character`, `canonical_location`

```yaml
type: rename
target_type: character
target_id: 5
new_name: Severian of the Guild
rationale: >
  The full canonical form is preferred for disambiguation in the index.
```

---

## Opening a PR by hand

1. Fork the repo and create a branch.
2. Add a file in `corrections/` with a descriptive name, for example
   `corrections/character-merge-severian.yaml`.
3. Paste your correction YAML.
4. Open a PR and complete the checklist below.

**PR checklist:**

- [ ] File is in `corrections/` with a `.yaml` extension.
- [ ] YAML matches one of the three shapes above — no missing required fields,
      no unrecognized keys.
- [ ] `rationale` cites the relevant chapter or passage.
- [ ] `old_value` is copied verbatim from the current database value (for
      `factual_fix` only).

## Reviewer guidelines

### When to merge

- The source-text citation checks out (look up the passage; don't rely on memory).
- The `old_value` matches the current database value.
- The rationale is clear and interpretively defensible.
- For `merge`: the two entities are demonstrably the same; no genuine ambiguity.
- For `rename`: the new name is the form Wolfe uses, not a fan interpretation or
  abbreviation.

### When to ask for changes

- The rationale is missing or vague ("this is wrong" is not a rationale).
- The `old_value` does not match the current database value.
- The correction touches a genuine interpretive dispute — flag it for discussion
  rather than declining silently.
- The YAML does not parse as a valid correction. To check locally:
  `uv run python -m core.apply_corrections`

### Other contributions

Tool bugs, documentation improvements, new panel ideas — open an issue to
discuss before opening a PR.
