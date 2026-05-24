# The Brown Book *(working name)*

_A spoiler-aware research dashboard for chewing on theories about Gene Wolfe's Book of the New Sun, without rereading 400,000 words._

## Problem

Deep readers of *Book of the New Sun* accumulate theories they want to test ("Is Dorcas really Severian's grandmother?"). Substantiating a shower thought today costs hours of re-reading dense prose. We've extracted a treasure trove of structured data from the tetralogy but present it as a dump — overloaded, not organized around questions, mostly text, unable to honor where in the book the reader currently is.

## Who It's For

**Primary:** Elliott — a deep BOTNS reader on his Nth pass, dogfooding.
**Secondary:** r/genewolfe regulars and other careful readers who want substantiated evidence for their own shower thoughts.

Not casual readers (they haven't read enough), not literary scholars (they're welcome but not optimized for).

## Core Features (priority order)

1. **Question + reading-position entry.** Free-text question, plus a book+chapter picker. Everything that follows respects the position.
2. **Evidence dashboard, 3–5 coordinated panels.** Question feeds them all; tweak it, all reflow. Includes at minimum: passages (FTS5-ranked), timeline, character network. Deterministic — no API call at query time.
3. **Progressive-disclosure timeline.** Flagship visual. Things past your reading position are fogged with a deliberate "reveal" affordance. Spoiler horizon stops being a setting and becomes a *felt* boundary. Zooms: books → chapters → scenes → passages.
4. **Corrections via PR.** Inline "this is wrong" flag → opens a pre-filled GitHub PR with a YAML correction. Merges trigger CI → fresh DB → redeploy. The tool improves through community contribution, no server.
5. **Static deployment, zero backend.** GitHub Pages or Cloudflare Pages. Browser-side SQLite (sql.js + FTS5). No login, no API costs at query time. Total page weight ≈ 5MB gzipped.

## Non-Goals

- **No AI synthesis at query time.** The tool surfaces evidence; the reader does the thinking. Wolfe wrote books that reward engagement — we're not going to subcontract that engagement to a model. Stated value.
- **No "verdict" on a theory.** Even soft language ("likely supported") is out.
- **No server, no auth, no accounts.** Trust without a backend.
- **No conversational layer in v1.** Seductive, easy to mis-design, would compromise the principle above. Hard no.
- **Not yet pluggable for other books.** ADR 5.0's seam (core/ vs studies/<book>/) stays clean, but a second book is a v3 concern.

## Technical Considerations

**Suggested stack:**
- **Build:** existing Python pipeline (uv) + a GitHub Action that runs `make all` and deploys.
- **Frontend:** sql.js (SQLite-in-WASM, FTS5 included) + small SPA. Framework choice deferred to architect — vanilla, Svelte, Solid all fit.
- **Distribution:** GitHub Pages or Cloudflare Pages. Static assets only.
- **Corrections:** YAML files in `corrections/`, one per fix. Read at build time by a new `apply_corrections.py` pass and the existing `normalize`/`canonicalize` scripts.

**Key technical decisions (with tradeoffs):**
- Ship the SQLite DB to the client rather than precomputed JSON: keeps deterministic FTS5 retrieval, enables new panels without changing the build, costs ~4MB on the wire.
- Spoiler horizon is a query parameter that filters every panel at query time, not a baked view: single source of truth, simpler data model.
- Corrections via PR (not server-side moderation): zero hosting, leverages GitHub permissions, deliberately slower than a wiki.
- Reading position is **book + chapter**, not a percentage slider — matches how readers track where they are.

**Known risks:**
- **First-load weight.** 8.5MB DB is fine on broadband, lousy on cell. Mitigations: aggressive caching, optional FTS-less "lite" DB.
- **Spoiler-horizon correctness is subtle.** First-appearance vs later-appearance metadata leaks easily. Every queryable entity needs a `revealed_at` field; anything past horizon must be structurally hidden, not just visually fogged.
- **Existing chapter summaries may contain forward-spoilers.** `summarize.py` wasn't given a "don't look ahead" constraint; a Book 1 Ch 5 summary may name a Book 4 revelation. May require re-running summarization with position-aware prompts.
- **Corrections schema design** — too rigid, no one contributes; too loose, the pipeline can't apply them. Needs early iteration with seed examples.

## Milestones — First Buildable Version

1. **Spoiler-horizon-aware retrieval.** Add `revealed_at` to core entities; add a `reveal_position` parameter (book + chapter) to FTS5 + entity queries. CLI verifies: Dorcas's identity hidden when position is mid-Book-1.
2. **Process *Urth of the New Sun* + corrections overlay.** Extend `extract.py` for Book 5. Build `apply_corrections.py` reading `corrections/*.yaml`. Seed with 3–5 real corrections to prove the loop.
3. **Browser-side SQLite.** Replace `build_browser.py` output with `index.html` + JS loading sql.js + `botns.db`. Initially renders the existing browser, but client-querying. Same data, no server.
4. **Dashboard v1.** Question input + book+chapter picker + 3 panels: passages, timeline (with fog), character network. Each panel a self-contained module so adding #4/#5 doesn't require a rewrite.
5. **Correction flow.** Per-item "flag" affordance → pre-filled GitHub issue. CONTRIBUTING.md. GitHub Action rebuilds and deploys on PR merge.

## Open Questions

- Project name — "The Brown Book" is a working title (in-universe reference to Severian's reference book). Lock or replace.
- Which 3–5 panels for v1, in what visual hierarchy?
- Frontend framework — defer to architect.
- Expose raw FTS5 query box for power users, or strictly behind the question UX?
- Re-run summarization with position-aware prompts, or carry forward-spoiler risk in v1?
