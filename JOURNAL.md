# Journal

<!-- Chronological log of development sessions for this public repo.
Sister repo's pipeline history lives at github.com/ewhitling/analysis-botns/JOURNAL.md. -->

## 2026-05-23: Repo bootstrapped (TASK-011)

- Created from the analysis-botns architect's plan (PRD/DESIGN/SPEC/ADR copied in)
- Skeleton: pyproject.toml (pydantic + pyyaml), Makefile (apply-corrections / web / build / test), CONTRIBUTING.md, .env.example, .gitignore (web build artifacts + SQLite WAL + .ao bookkeeping)
- ao wrapper + ao.yaml present; `feature: brown-book-v1`
- tasks.yaml = the shipped subset from analysis-botns/tasks.brownbook.yaml (TASK-011 through TASK-030)
- Empty dirs (data/, core/, web/, corrections/seed/, tests/) — populated by TASK-012 onwards
- Next: TASK-012 = `make publish` from analysis-botns to seed the vendored apply-corrections layer + the canonical botns.db

## 2026-05-23: First publish synced + verified (TASK-012)

- Ran `make publish` from analysis-botns@014c8c4
- Synced: data/botns.db, core/{apply_corrections,horizon}.py, core/models/, corrections/seed/identity-reveals.yaml
- Verified: `uv run python -m core.apply_corrections` runs cleanly against the vendored DB
- Landed in commit `6c21faf`
- TASK-011 + TASK-012 pruned from `tasks.yaml` so ao starts at TASK-013

## 2026-05-23: Handed off to ao starting at TASK-013

- 18 tasks remaining (TASK-013 → TASK-030)
- Two are manual prerequisites for ao to surface as user-action-required: TASK-014 (Cloudflare Pages project setup)

## 2026-05-23: TASK-029 assessment — blocker on TASK-014

Attempted TASK-029 (end-to-end smoke test). Status:
- Build pipeline verified: `make build` succeeds end-to-end
  - apply-corrections runs cleanly
  - web/ builds with no errors
  - Size budgets pass: DB 11.9MB (budget 25MB), bundle 147KB gzip (budget 6MB)
- All UI components from TASK-022-028 are in place (Timeline, LookAheadModal, PositionPicker, Corrections form, etc.)
- Correction submission form tested locally

**Blocker:** TASK-029 requires a deployed Brown Book to test against (need a live URL to open, flag corrections, test previews/merges). TASK-014 (manual CF Pages project creation) hasn't been completed — the project doesn't exist in Cloudflare's dashboard yet.

**Action required:** Set up Cloudflare Pages project per TASK-014 spec:
  - Create "the-brown-book" project in CF Pages, connect to ewhitling/the-brown-book GitHub repo
  - Configure build: command `make build`, output `web/dist/`
  - Add env vars: VITE_REPO_OWNER=ewhitling, VITE_REPO_NAME=the-brown-book, VITE_DEPLOY_ENV=prod
  - Once live, TASK-029 can proceed with real end-to-end test

This is a one-time setup blocker for both TASK-029 and TASK-030 (final polish).
