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
