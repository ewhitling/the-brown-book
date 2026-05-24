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
