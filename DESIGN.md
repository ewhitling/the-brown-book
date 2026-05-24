# The Brown Book — Design

Design artifacts for the v1 build. See [PRD.md](PRD.md) for product context.

Companion files:
- [`wireframes.html`](wireframes.html) — structural layouts for all 8 scenes
- [`mockup.html`](mockup.html) — high-fidelity aspirational mockup for 3 flagship scenes (entry, workshop populated, look-ahead)

---

## Scene Map

The user journey, in order.

### Scene 1 — First visit (entry, not a landing page)

- **Sees:** Page title (*The Brown Book*). One neutral descriptor: *"An evidence browser for Gene Wolfe's* Book of the New Sun*."* A "where are you in the books?" picker (Book + Chapter). A *Continue* link. Footer chrome: GitHub link + *About* link.
- **Does:** Picks book + chapter. Continues.
- **Next:** → Workshop, empty. Position saved to localStorage; subsequent visits skip this scene.
- **Critical copy:** Title only. No tagline. No principle line. No CTA copy.

### Scene 2 — Workshop, empty

- **Sees:** Theory input bar (prominent). Reading-position chip in corner. Empty panel scaffolding labeled *Passages*, *Timeline*, *Characters*. Footer chrome: GitHub + About.
- **Does:** Types a theory.
- **Next:** → Workshop, populated.
- **Critical copy:** Input placeholder *"What are you exploring?"*. Position chip *"Reading: Book 2, Ch 5"*.

### Scene 3 — Workshop, populated *(the workhorse)*

- **Sees:** Theory bar (editable) + position chip at top. Three panels filtered to theory + position:
  - **Passages** — FTS5-ranked excerpts (chapter prose, summaries, factual claims, scenes, embedded narratives, notable details — type-tagged)
  - **Timeline** — books → chapters → scenes. Region past reading position is visibly fogged.
  - **Characters** — character co-occurrence list (edges from same-scene presence).
  - Hover-revealed **Flag** affordance per item.
  - Fogged regions have a *Look ahead* affordance.
- **Does:** Reads. Tweaks theory (panels refresh). Adjusts position (panels refresh, fog redraws). Hovers a fogged region or item.
- **Next:** Stays here. Branches to → Look-ahead (Scene 5), → Suggest correction (Scene 6), → Change position (Scene 7) as overlays.
- **Critical copy:** Panel titles *Passages*, *Timeline*, *Characters*. Fog overlay *"Past your reading position"* + *"Look ahead →"*. Flag tooltip *"Suggest a correction"*. Passage type tags: *prose · summary · claim · scene · detail · embedded*.

### Scene 4 — Workshop, no results

- **Sees:** Theory bar + position chip preserved. Quiet message and three actions.
- **Next:** → Workshop populated, or stays empty.
- **Critical copy:** *"Nothing for this theory before Book 2, Ch 5."* Three actions: *"Refine theory"* / *"Update position"* / *"Look past your position →"* (third only shown when matches exist past horizon).

### Scene 5 — Look ahead (reveal overlay)

- **Sees:** Confirmation modal: *"This is past Book 2, Ch 5. Show it anyway?"* Once revealed, the item appears with a permanent tag *↪ past your reading position* so the reader remembers they peeked.
- **Does:** Show or Cancel.
- **Next:** → Workshop populated (item visible + tagged).

### Scene 6 — Suggest a Correction (flag overlay)

- **Sees:** Slide-in panel with the item locked for context, correction-type selector, two free-text fields, submit.
- **Does:** Fills the form, submits. Browser opens GitHub's PR-creation page with pre-filled YAML.
- **Next:** User is now on GitHub. Outside the app.
- **Critical copy:** Header *"Suggest a correction"*. Helper *"Corrections are reviewed in the open on GitHub. Merged ones are picked up by the next build."* Submit *"Open PR on GitHub"*.

### Scene 7 — Change Reading Position

- **Sees:** Compact picker (Book ▾ + Chapter ▾) anchored to the position chip.
- **Does:** Selects new book/chapter, confirms.
- **Next:** → Workshop populated (panels refresh, fog redraws).

### Scene 8 — About / how this works

A real page reachable from footer chrome. A colophon, not a marketing page.

Sections:
- **What this is** — *"An evidence browser for Gene Wolfe's Book of the New Sun, built so deep readers can substantiate theories without rereading 400,000 words."*
- **Principles** — *"The tool surfaces evidence and patterns; it never synthesizes at query time. The model's work happened upstream, during extraction. The thinking is yours."*
- **Reading position & fog** — what the fog means and how peeking works.
- **Corrections** — how the PR loop works. Link to CONTRIBUTING.md.
- **Source & contributors** — link to repo. Credit to BOTNS community + named contributors.

Reads like a wiki page or CONTRIBUTING.md. Quiet, factual.

---

## Data Contract

### Entities (used across scenes)

```
Book
  id, number, title, chapter_count
  Note: number 1-4 = tetralogy, 5 = Urth of the New Sun

Chapter
  id, book_id (FK), number, title, scene_count

Scene
  id, chapter_id (FK), number, summary, mode, location_raw,
  canonical_location_id (FK?), time_context, travel_direction,
  characters: [character_id]
  mode enum: action | dialogue | reflection | embedded_story | dream | description

CanonicalLocation
  id, name, type, parent_id (FK?), temporal_note
  type enum: nation | city | building | district | body_of_water | landscape | world | …

Character
  id, canonical_name, aliases: [string]
  mentioned_at: { book_id, chapter_number }       # first appearance
  identity_revealed_at: { book_id, chapter_number } | null
    [TBD — schema decision for /architect: do we add a second revelation axis for
     characters with hidden truths (Dorcas, the Autarch), or fold into mentioned_at
     and accept spoiler leakage on identity-level facts?]

FactualClaim
  id, chapter_id, scene_id?, text, attribution?

NotableDetail
  id, chapter_id, scene_id?, text

EmbeddedNarrative
  id, chapter_id, summary, narrator?, characters: [character_id]

DeathEvent
  id, chapter_id, scene_id?, subject, outcome, mechanism, epistemic_tier
  outcome enum: final | prevented | reversed | figurative | ambiguous
  epistemic_tier enum: observed | reported | hinted | claimed
```

Not consumed by v1 panels but already in DB: `ChapterMetrics`, `BookMetrics`, `Motif`. /architect decides whether to ship them.

### Query-time types

```
ReadingPosition
  book_id (1-5), chapter_number
  Semantics: inclusive — "I have finished reading through this chapter."

Theory
  text: string                       # free-form

Correction
  target_type: string                # entity type
  target_id: int
  correction_type: enum
    merge | rename | factual_fix | wrong_attribution | other
  whats_wrong: string
  what_it_should_be: string

URL params (shareability)
  q: theory text (URL-encoded)
  pos: compact position string e.g. "B2C5"
```

### Per-scene data

**Scene 1 (First visit)**
- inputs: `position_picker_selection: ReadingPosition`
- reads: `Book[]` (for dropdown)

**Scene 2 (Workshop empty)**
- reads: stored `ReadingPosition` (from localStorage or URL)
- inputs: `Theory.text`

**Scene 3 (Workshop populated)** — the big one

```
QueryResult {
  theory: Theory
  position: ReadingPosition

  passages_panel: {
    items: [
      {
        id: string,
        type: enum { prose | summary | claim | scene | detail | embedded },
        text: string,                          # the excerpt
        score: float,                          # FTS5 bm25
        chapter: { book_id, number, title },
        scene_number: int?,
        past_horizon: bool,
        revealed_at: { book_id, chapter_number }
      }
    ],
    total_matching: int,
    showing: int                               # top N, no pagination control in v1
  }

  timeline_panel: {
    books: [
      {
        book_id, title,
        chapters: [
          {
            chapter_id, number, title,
            past_horizon: bool,
            matches: int,                      # count of matching items in this chapter
            scenes: [
              {
                scene_id, number,
                mode, location_canonical?, location_raw,
                summary,
                past_horizon: bool,
                matches_query: bool
              }
            ]
          }
        ]
      }
    ]
  }

  characters_panel: {
    nodes: [
      {
        character_id, canonical_name,
        first_appearance: { book_id, chapter_number },
        past_horizon: bool,
        scene_count_matching: int
      }
    ],
    edges: [
      {
        source: character_id, target: character_id,
        weight: int,                           # co-occurrence count in matching scenes
        past_horizon: bool
      }
    ]
  }
}
```

**Scene 4 (No results)**
- Same `QueryResult` shape, panel arrays empty.
- Additional flag: `had_matches_past_horizon: bool` — show "Look past your position" CTA only when it would help.

**Scene 5 (Look ahead)**
- inputs: `{ item_type, item_id }`
- client state: `revealed_items: [{ type, id }]` persisted in localStorage.

**Scene 6 (Correction)**
- inputs: `Correction`
- output: GitHub PR-creation URL with pre-filled YAML in `?value=<encoded>`

**Scene 7 (Position change)**
- inputs: `ReadingPosition`

**Scene 8 (About)** — no data.

### Open TBDs flagged for /architect

1. **`identity_revealed_at` schema** — single field on Character or two? Affects spoiler-horizon correctness on identity-level facts.
2. **Passage type taxonomy** — must align with what's in `evidence_fts` today; confirm at build time.
3. **Timeline data shape** — assumed query-time via sql.js; /architect may choose precomputed JSON sidecar for performance.
4. **Pagination on passages** — recommend "top N, no controls" for v1.
5. **URL position format** — recommend compact `B2C5`.

---

## Design Principles

1. **Surface evidence, never synthesize.** No verdicts, no AI summaries at read time. Every visible item is a piece of the original work or a deterministic build-time extraction.
2. **Spoiler horizon is a felt boundary, not a setting.** Fog is visible chrome. Peeking is deliberate and recorded.
3. **No selling.** Community tool, fan-coded. Copy is functional and neutral. No taglines, no CTAs, no exclamation marks.
4. **Density without overload.** Lots of evidence, but every panel respects ink-to-information. No decorative gridlines, no unnecessary chrome.
5. **The tool is the artifact.** Single static page, no backend, no accounts. What you see is in the DB; the DB is in the repo.

---

## Visual Direction

Direction: **Light + journalistic** *(deliberate departure from the global dark-mode default — the literary content reads better in editorial-magazine treatment).*

### Palette
- Background: warm off-white `#f7f5ef` (paper, not clinical white)
- Body text: near-black `#1d1d1f`
- Muted: `#6b665e`
- Whisper: `#a8a399`
- Rule: `#d8d4cb`
- Accent: deep indigo `#3b1d6e` — used sparingly for links, active states, fog border, flag icon

### Typography
- **Body / passages:** EB Garamond (refined serif, literary). Lets BOTNS prose breathe.
- **UI chrome:** Inter (sans, small weight, tight tracking).
- This overrides the user's global Avenir Next default — deliberate, because the content is literary, not analytical.

### Spacing
- Generous margins, comfortable line height (~1.55 for body).
- No edge-to-edge density.

### Iconography
- Minimal. Flag icon, GitHub mark, dropdown chevron. That's it.

### Fog treatment
- Translucent overlay with faint diagonal hatching at ~6% opacity.
- Hover reveals an inline `Look ahead →` link inside the fogged region.
- Revealed items retain a permanent `↪ past your reading position` tag (small, accent color).

### Interaction patterns
- **Snappy:** Theory edits debounce at ~150ms; panels reflow. Position changes apply instantly.
- **Deliberate:** Peeking past the fog requires a confirm. Correction submission is a deliberate slide-in panel.
- **Minimal animation:** Panel updates can use a brief opacity transition (~120ms) to avoid jarring shifts. Otherwise stillness.

### Tone of voice
- Factual, not promotional.
- Second person used sparingly ("Your reading position"), never warmly.
- Empty states quiet: *"Nothing for this theory before Book 2, Ch 5."*
- No exclamation marks, no emoji, no "Oops!"
- Helper text reads like a CONTRIBUTING.md.

---

## Naming Glossary

| Term | Definition |
|---|---|
| **The Brown Book** | The tool. *(working name; may be locked or replaced in v1.)* |
| **Workshop** | The dashboard scene — theory + position + panels. |
| **Theory** | A free-text query the reader brings. Not "hypothesis," not "question." |
| **Reading position** | Where the reader currently is. Pair: book + chapter, inclusive. |
| **Spoiler horizon** | Architectural concept: everything past `reading position` is hidden or fogged. Not surfaced in UI copy. |
| **Fog** | The visual manifestation of the spoiler horizon. Used in UI ("past your reading position", "look ahead", "still fogged"). |
| **Look ahead** | The affordance to peek past the horizon. Permanently tags the revealed item. |
| **Suggest a correction** | The action of filing a correction PR. |
| **Correction** | A YAML file in `corrections/` that the next build picks up. |
| **Panel** | One of the named information surfaces (Passages, Timeline, Characters). |
| **Item** | An individual piece of evidence in a panel. Type-tagged. |
