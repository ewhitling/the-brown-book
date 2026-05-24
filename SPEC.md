# The Brown Book — Technical Spec

Technical source of truth for the v1 build. Companion to [PRD.md](PRD.md) (product), [DESIGN.md](DESIGN.md) (journey + IA), and [ADR.md](ADR.md) (decisions). Build plan is split across two files per ADR 9.0:

- [`tasks.yaml`](tasks.yaml) — analysis-botns tasks (data-layer foundation + `make publish`)
- [`tasks.brownbook.yaml`](tasks.brownbook.yaml) — the-brown-book tasks (SPA, corrections workflow, deploy). Ships to the public repo at TASK-011 as that repo's `tasks.yaml`.

The project spans two repos. See ADR 9.0:

- **`analysis-botns`** (private workshop) — full extraction pipeline, `data/botns.db` builds, source materials
- **`the-brown-book`** (public) — SPA, live `corrections/`, vendored apply-corrections layer + DB

Unless otherwise noted, all code paths below refer to `the-brown-book` after the initial publish.

---

## 1. Data models

Pydantic models in `core/models/`. Three roles: (1) validate `corrections/*.yaml`, (2) document SQLite row shapes, (3) source for the SPA's hand-mirrored TS types.

### `core/models/base.py`

```python
from __future__ import annotations
import re
from pydantic import BaseModel, Field


class BookChapter(BaseModel):
    """A position in the corpus — (book_id, chapter_number). Used for
    spoiler-horizon comparisons. Comparable, has compact URL form."""
    book_id: int = Field(..., ge=1, le=5)
    chapter_number: int = Field(..., ge=1)

    def __lt__(self, other: "BookChapter") -> bool:
        return (self.book_id, self.chapter_number) < (other.book_id, other.chapter_number)

    def __le__(self, other: "BookChapter") -> bool:
        return (self.book_id, self.chapter_number) <= (other.book_id, other.chapter_number)

    def compact(self) -> str:
        """e.g. 'B2C5'."""
        return f"B{self.book_id}C{self.chapter_number}"

    @classmethod
    def from_compact(cls, s: str) -> "BookChapter":
        m = re.match(r"^B(\d+)C(\d+)$", s)
        if not m:
            raise ValueError(f"invalid compact position: {s}")
        return cls(book_id=int(m.group(1)), chapter_number=int(m.group(2)))
```

### `core/models/entities.py`

```python
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Literal
from .base import BookChapter


SceneMode = Literal["action", "dialogue", "reflection", "embedded_story", "dream", "description"]
LocationType = Literal[
    "nation", "city", "building", "district",
    "body_of_water", "landscape", "world", "other",
]
DeathOutcome = Literal["final", "prevented", "reversed", "figurative", "ambiguous"]
EpistemicTier = Literal["observed", "reported", "hinted", "claimed"]
PassageType = Literal["prose", "summary", "claim", "scene", "detail", "embedded"]


class Book(BaseModel):
    id: int
    number: int = Field(..., ge=1, le=5)
    title: str
    chapter_count: int


class Chapter(BaseModel):
    id: int
    book_id: int                                  # FK -> Book.id
    number: int = Field(..., ge=1)
    title: str
    scene_count: int = 0


class Scene(BaseModel):
    id: int
    chapter_id: int                               # FK -> Chapter.id
    number: int = Field(..., ge=1)
    summary: str
    mode: SceneMode
    location_raw: str
    canonical_location_id: int | None = None      # FK -> CanonicalLocation.id
    time_context: str | None = None
    travel_direction: str | None = None
    character_ids: list[int] = Field(default_factory=list)
    revealed_at: BookChapter                      # default = source chapter


class CanonicalLocation(BaseModel):
    id: int
    name: str
    type: LocationType
    parent_id: int | None = None                  # self-FK for hierarchy
    temporal_note: str | None = None


class Character(BaseModel):
    id: int
    canonical_name: str
    aliases: list[str] = Field(default_factory=list)
    mentioned_at: BookChapter                     # auto: first-appearance chapter


class FactualClaim(BaseModel):
    id: int
    chapter_id: int
    scene_id: int | None = None
    text: str
    attribution: str | None = None
    revealed_at: BookChapter                      # default = source chapter


class NotableDetail(BaseModel):
    id: int
    chapter_id: int
    scene_id: int | None = None
    text: str
    revealed_at: BookChapter


class EmbeddedNarrative(BaseModel):
    id: int
    chapter_id: int
    summary: str
    narrator: str | None = None
    character_ids: list[int] = Field(default_factory=list)
    revealed_at: BookChapter


class DeathEvent(BaseModel):
    id: int
    chapter_id: int
    scene_id: int | None = None
    subject: str
    outcome: DeathOutcome
    mechanism: str
    epistemic_tier: EpistemicTier
    revealed_at: BookChapter
```

### `core/models/query.py`

```python
from __future__ import annotations
from pydantic import BaseModel, Field
from .base import BookChapter
from .entities import PassageType, SceneMode


class ReadingPosition(BaseModel):
    """User's reading position. Inclusive ('I have finished reading
    through this chapter')."""
    book_id: int = Field(..., ge=1, le=5)
    chapter_number: int = Field(..., ge=1)

    def as_bookchapter(self) -> BookChapter:
        return BookChapter(book_id=self.book_id, chapter_number=self.chapter_number)


class Theory(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)


# ── Passages panel ──────────────────────────────────────────────────────
class PassageChapter(BaseModel):
    book_id: int
    number: int
    title: str


class PassageItem(BaseModel):
    id: str                                       # e.g. "claim:412"
    type: PassageType
    text: str
    score: float                                  # FTS5 bm25
    chapter: PassageChapter
    scene_number: int | None = None
    past_horizon: bool
    revealed_at: BookChapter


class PassagesPanel(BaseModel):
    items: list[PassageItem]
    total_matching: int
    showing: int                                  # top-N (N=50 v1)


# ── Timeline panel ──────────────────────────────────────────────────────
class TimelineScene(BaseModel):
    scene_id: int
    number: int
    mode: SceneMode
    location_canonical: str | None = None
    location_raw: str
    summary: str
    past_horizon: bool
    matches_query: bool


class TimelineChapter(BaseModel):
    chapter_id: int
    number: int
    title: str
    past_horizon: bool
    matches: int                                  # count of matching items
    scenes: list[TimelineScene]                   # v1 deferred; populated lazily


class TimelineBook(BaseModel):
    book_id: int
    title: str
    chapters: list[TimelineChapter]


class TimelinePanel(BaseModel):
    books: list[TimelineBook]


# ── Characters panel ────────────────────────────────────────────────────
class CharacterNode(BaseModel):
    character_id: int
    canonical_name: str
    first_appearance: BookChapter
    past_horizon: bool
    scene_count_matching: int


class CharacterEdge(BaseModel):
    """Co-occurrence in matching scenes. Populated in v1 but unrendered
    (panel is list-only). Ready for v2 graph rendering."""
    source: int                                   # character_id
    target: int                                   # character_id
    weight: int
    past_horizon: bool


class CharactersPanel(BaseModel):
    nodes: list[CharacterNode]
    edges: list[CharacterEdge]


# ── Top-level query result ──────────────────────────────────────────────
class QueryResult(BaseModel):
    theory: Theory
    position: ReadingPosition
    passages_panel: PassagesPanel
    timeline_panel: TimelinePanel
    characters_panel: CharactersPanel
    had_matches_past_horizon: bool                # drives no-results CTA
```

### `core/models/corrections.py`

```python
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Literal


EntityTargetType = Literal["character", "canonical_location"]
ClaimTargetType = Literal[
    "factual_claim", "notable_detail", "scene", "embedded_narrative", "death_event",
]


class MergeCorrection(BaseModel):
    """Merge multiple entities into one. Applied during apply-corrections;
    rewrites all FK references."""
    type: Literal["merge"] = "merge"
    target_type: EntityTargetType
    source_ids: list[int] = Field(..., min_length=2)
    into_id: int
    rationale: str
    submitted_by: str | None = None


class RenameCorrection(BaseModel):
    """Rename an entity's canonical name. Pure metadata change."""
    type: Literal["rename"] = "rename"
    target_type: EntityTargetType
    target_id: int
    new_name: str
    rationale: str
    submitted_by: str | None = None


class FactualFixCorrection(BaseModel):
    """Edit a specific field on a claim/detail/scene/etc.
    Most valuable user-flagged correction."""
    type: Literal["factual_fix"] = "factual_fix"
    target_type: ClaimTargetType
    target_id: int
    field: str
    old_value: str                                # safety check; reject on mismatch
    new_value: str
    rationale: str
    submitted_by: str | None = None


# Discriminated union — one of these per YAML file
Correction = MergeCorrection | RenameCorrection | FactualFixCorrection
```

### `core/models/urls.py`

```python
from __future__ import annotations
from urllib.parse import urlencode, parse_qs
from pydantic import BaseModel
from .base import BookChapter
from .query import Theory, ReadingPosition


class WorkshopURL(BaseModel):
    theory: Theory
    position: ReadingPosition

    def encode(self) -> str:
        return "?" + urlencode({
            "q": self.theory.text,
            "pos": self.position.as_bookchapter().compact(),
        })

    @classmethod
    def decode(cls, qs: str) -> "WorkshopURL | None":
        params = parse_qs(qs.lstrip("?"))
        q = params.get("q", [None])[0]
        pos = params.get("pos", [None])[0]
        if not q or not pos:
            return None
        bc = BookChapter.from_compact(pos)
        return cls(
            theory=Theory(text=q),
            position=ReadingPosition(book_id=bc.book_id, chapter_number=bc.chapter_number),
        )
```

---

## 2. Data access surface (SPA, sql.js)

No REST API. All queries run client-side via sql.js against the loaded `botns.db`.

### Query functions (`web/src/lib/db.ts`)

| Function | Args | Returns | Triggered by |
|---|---|---|---|
| `loadDatabase()` | — | `Database` | App init |
| `assertSchema(db)` | `Database` | `boolean` | App init (after load) |
| `fetchPassages(theory, position, topN=50)` | str, ReadingPosition, int | `PassagesPanel` | Theory submit / position change |
| `fetchTimeline(theory, position)` | str, ReadingPosition | `TimelinePanel` | Theory submit / position change |
| `fetchCharacters(theory, position)` | str, ReadingPosition | `CharactersPanel` | Theory submit / position change |
| `fetchQueryResult(theory, position)` | str, ReadingPosition | `QueryResult` | Composes the three above |
| `countMatchesPastHorizon(theory, position)` | str, ReadingPosition | int | Drives no-results CTA |
| `lookupItem(itemType, itemId)` | str, int | full item record | Look-ahead reveal |

### SQL — load-bearing queries

`web/src/lib/sql/passages.sql`:
```sql
WITH ranked AS (
  SELECT rowid, type, text, bm25(evidence_fts) AS score,
         chapter_id, scene_id, revealed_at_book, revealed_at_chapter
  FROM evidence_fts
  WHERE evidence_fts MATCH :theory
  ORDER BY score
  LIMIT :top_n
)
SELECT r.*, c.number AS chapter_number, c.title AS chapter_title, c.book_id
FROM ranked r
JOIN chapters c ON c.id = r.chapter_id;
```

`web/src/lib/sql/timeline.sql`:
```sql
WITH matches AS (
  SELECT chapter_id, COUNT(*) AS m
  FROM evidence_fts
  WHERE evidence_fts MATCH :theory
  GROUP BY chapter_id
)
SELECT c.id, c.book_id, c.number, c.title,
       COALESCE(m.m, 0) AS matches, b.title AS book_title
FROM chapters c
JOIN books b ON b.id = c.book_id
LEFT JOIN matches m ON m.chapter_id = c.id
ORDER BY c.book_id, c.number;
```

`web/src/lib/sql/characters.sql`:
```sql
WITH matching_scenes AS (
  SELECT DISTINCT scene_id
  FROM evidence_fts
  WHERE evidence_fts MATCH :theory AND scene_id IS NOT NULL
)
SELECT ch.id, ch.canonical_name,
       ch.mentioned_at_book, ch.mentioned_at_chapter,
       COUNT(DISTINCT sc.scene_id) AS scene_count_matching
FROM characters ch
JOIN scene_characters sc ON sc.character_id = ch.id
WHERE sc.scene_id IN matching_scenes
GROUP BY ch.id
ORDER BY scene_count_matching DESC;
```

`web/src/lib/sql/character-edges.sql`:
```sql
WITH ms AS (SELECT DISTINCT scene_id FROM evidence_fts WHERE evidence_fts MATCH :theory)
SELECT a.character_id AS source, b.character_id AS target, COUNT(*) AS weight
FROM scene_characters a
JOIN scene_characters b
  ON a.scene_id = b.scene_id AND a.character_id < b.character_id
WHERE a.scene_id IN ms
GROUP BY a.character_id, b.character_id;
```

Post-pass in JS marks `past_horizon` per row by comparing `revealed_at_*` columns to the reading position.

### Client-state operations (`web/src/lib/storage.ts`)

| Operation | localStorage key | Shape | Triggered by |
|---|---|---|---|
| `saveReadingPosition` | `bb:v1:position` | `{book_id, chapter_number}` | Scene 1 continue / Scene 7 update |
| `loadReadingPosition` | `bb:v1:position` | same | App boot |
| `recordReveal` | `bb:v1:revealed` | `[{type, id}]` | Scene 5 confirm |
| `loadReveals` | `bb:v1:revealed` | same | App boot |

### External integration — GitHub PR URL (`web/src/lib/corrections.ts`)

```
https://github.com/<owner>/<repo>/new/main
  ?filename=corrections/<timestamp>-<type>-<slug>.yaml
  &value=<URL-encoded YAML body>
  &message=<commit subject>
```

Body matches `Correction` discriminated union from Phase 2. SPA constructs the URL; GitHub handles auth and PR creation.

---

## 3. File structure

```
the-brown-book/                            [public repo, new]
├── README.md                              public-facing intro
├── CONTRIBUTING.md                        how to submit corrections
├── PRD.md                                 copied from analysis-botns
├── DESIGN.md                              copied
├── SPEC.md                                copied
├── Makefile                               apply-corrections + web + build targets
├── pyproject.toml                         deps: pydantic, pyyaml
├── uv.lock
├── .gitignore                             includes web/dist, web/node_modules, web/static/botns.db
├── .env.example                           empty (no API key needed in public repo)
│
├── corrections/
│   ├── README.md                          schema explanation with examples
│   └── seed/
│       ├── identity-reveals.yaml          curated revealed_at overrides
│       └── character-merges.yaml          v1.1 — migrated from normalize_characters.py
│
├── core/                                  vendored from analysis-botns, refreshed by `make publish`
│   ├── __init__.py
│   ├── apply_corrections.py
│   ├── horizon.py
│   └── models/
│       ├── __init__.py
│       ├── base.py
│       ├── entities.py
│       ├── query.py
│       ├── corrections.py
│       └── urls.py
│
├── data/
│   └── botns.db                           vendored from analysis-botns; gitignored beneath
│                                           web/static/ during build
│
├── tests/                                 Python tests for vendored layer
│   ├── conftest.py
│   ├── test_models.py
│   ├── test_horizon.py
│   └── test_apply_corrections.py
│
├── web/                                   the SPA
│   ├── package.json
│   ├── svelte.config.js
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── src/
│   │   ├── main.ts                        Vite entry, mounts App
│   │   ├── App.svelte                     root + hash-based router
│   │   ├── app.css                        globals, CSS palette variables
│   │   ├── routes/
│   │   │   ├── Entry.svelte               Scene 1
│   │   │   ├── Workshop.svelte            Scenes 2-4 (hosts the three panels)
│   │   │   └── About.svelte               Scene 8
│   │   ├── lib/
│   │   │   ├── db.ts                      sql.js init + query functions
│   │   │   ├── types.ts                   hand-mirrored TS types from Pydantic
│   │   │   ├── position.ts                BookChapter helpers, URL encoding
│   │   │   ├── corrections.ts             form + GitHub PR URL builder
│   │   │   ├── storage.ts                 localStorage wrappers
│   │   │   └── sql/
│   │   │       ├── passages.sql
│   │   │       ├── timeline.sql
│   │   │       ├── characters.sql
│   │   │       └── character-edges.sql
│   │   └── components/
│   │       ├── PassagesPanel.svelte
│   │       ├── TimelinePanel.svelte
│   │       ├── CharactersPanel.svelte
│   │       ├── LookAheadModal.svelte
│   │       ├── CorrectionPanel.svelte
│   │       ├── PositionPicker.svelte
│   │       ├── PassageItem.svelte
│   │       └── TimelineStrip.svelte
│   ├── static/
│   │   ├── favicon.svg
│   │   └── botns.db                       gitignored — copied from data/ at build
│   └── dist/                              gitignored — Vite build output
│
└── .github/
    └── workflows/
        └── build-and-deploy.yml           CI: make build + sanity checks
                                            (CF Pages handles actual deploy)


analysis-botns/                            [existing private repo]
├── (existing files — see ADR 5.0)
├── core/
│   ├── apply_corrections.py               [NEW] sync target for the-brown-book
│   ├── horizon.py                         [NEW] sync target
│   └── models/                            [NEW] sync target
├── corrections/
│   └── seed/                              authored here, synced out
└── Makefile                               [updated] adds apply-corrections, publish targets
```

---

## 4. State and flow

No backend. All state buckets are client-side, plus a static CDN-cached DB.

### State buckets

| Bucket | What | Lifetime |
|---|---|---|
| Svelte stores (in-memory) | `theory`, `queryResult`, `loading` | Tab session |
| localStorage | `bb:v1:position`, `bb:v1:revealed` | Browser-permanent |
| URL params | `q`, `pos` | Per link (shareability) |
| Static asset (cached) | `botns.db`, sql.js WASM, SPA bundle | Until redeploy |
| In-memory query cache | `Map<(theoryText, position), QueryResult>` | Tab session, LRU 50 entries |

### Boot sequence

```
1. Mount App.svelte
2. Begin loading sql.js + botns.db in background (parallel to UI)
3. Resolve initial route:
   ├─ URL has q + pos? → Workshop (populated), prefill from URL
   ├─ localStorage has position? → Workshop (empty)
   └─ else → Entry
4. When DB ready, run assertSchema; dispatch any pending query
```

**Loading UX:** first-visit Entry takes long enough (book + chapter picker) that the DB loads in the background and the user never sees a spinner. Returning visitors / deep-link visitors see a quiet shimmer on the panels until DB is ready.

### Scene transitions

| From | Trigger | To | State carried |
|---|---|---|---|
| Entry | Continue | Workshop empty | position → localStorage |
| Workshop empty | Theory typed (debounce 150ms) | Workshop populated / no-results | theory → store + URL |
| Workshop populated | Flag clicked | Correction panel (overlay) | item context → modal |
| Workshop populated | Look-ahead clicked | LookAhead modal (overlay) | item ref → modal |
| Workshop populated | Position chip clicked | PositionPicker (overlay) | current position |
| LookAhead | Show it anyway | Workshop populated | revealed item id → localStorage |
| Correction panel | Open PR | New tab (external GitHub) | YAML → URL-encoded |
| PositionPicker | Update | Workshop populated, panels reflow | new position → localStorage + URL |
| Workshop ↔ About | Footer link | About | — |

### Conflict resolution: URL vs localStorage

URL wins on initial load, then writes back to localStorage. Matches how shared links should behave.

### No auth, no notifications, no optimistic updates

- No accounts. localStorage is the user's only identity.
- GitHub handles correction-PR auth in its own flow.
- All state is local; nothing to be optimistic about.

---

## 5. Infrastructure

### Database

**SQLite, static asset, loaded via sql.js (WASM, FTS5).** No live migrations. Schema is rebuilt from scratch every `make all` run. `assertSchema()` at SPA boot catches drift between deployed DB and SPA TS types.

### Build / CI

Two CI loops:

| Trigger | Repo | Runs | Frequency |
|---|---|---|---|
| Manual `make publish` | analysis-botns | Rebuild + sync to public repo | Rare (new extraction work) |
| Push to `main` | the-brown-book | `make build` (apply-corrections + web), CF Pages deploys | Per PR merge |

**`make build`** in the-brown-book:
```makefile
build:
    uv run python -m core.apply_corrections
    cp data/botns.db web/static/botns.db
    cd web && npm ci && npm run build
    @scripts/check-size-budgets.sh
```

Size budgets (CI fails if exceeded):
- `data/botns.db` ≤ 25 MB (currently ~9 MB)
- `web/dist/` total transferred ≤ 6 MB

### Deployment

**Cloudflare Pages** via GitHub integration. Project connected to `the-brown-book`. Build command `make build`. Output `web/dist/`. Initial domain `<project>.pages.dev`; custom domain v1.1.

Env vars (CF Pages settings):
- `VITE_REPO_OWNER=ewhitling`
- `VITE_REPO_NAME=the-brown-book`
- `VITE_DEPLOY_ENV=prod` (overridden to `preview` for PR builds)
- `ANTHROPIC_API_KEY` — defensive only; apply-corrections never hits the API

PR preview deploys are first-class — reviewers see correction PRs applied at a live URL before merging.

### No backend, no email, no file storage, no background queue

Stated explicitly: none of these exist in v1.

### Monitoring

- **CI build status:** Cloudflare Pages dashboard + GitHub PR checks
- **DB size budget:** enforced in `make build`
- **Bundle size budget:** enforced in `make build`
- **Schema drift:** `assertSchema()` at SPA boot logs to console
- **No user telemetry in v1.** GoatCounter or similar privacy-respecting pageview counts may land in v1.1.

Likely failure modes, in order:

| Failure | Detection | Mitigation |
|---|---|---|
| Malformed corrections YAML | CI fails at `apply-corrections` | Per-file Pydantic validation surfaces filename + error |
| DB schema drift between Python + TS | Console error at SPA boot | `assertSchema()` graceful fallback |
| sql.js fails (old browser) | Init throws | Catch + show fallback message |
| FTS5 parse error on user theory | Query throws | Catch in `fetchPassages`; render no-results |
| First-load too slow on cellular | User reports | Lazy-load WASM after first paint, show panel shimmer |
