# The Brown Book

An evidence browser for Gene Wolfe's *Book of the New Sun*.

## What this is

A community-made research dashboard for chewing on theories about the
tetralogy plus *The Urth of the New Sun*, built so deep readers can
substantiate ideas without rereading 400,000 words.

Live tool: *(deploy URL will land here once Cloudflare Pages is set up)*

## How it works

You bring a theory and your current reading position. Three coordinated
evidence panels — passages, timeline, characters — surface what's relevant
in the text, structurally filtered to honor your spoiler horizon. The
tool surfaces evidence and patterns. **It never synthesizes at query
time or returns a verdict.** The thinking is yours.

See [DESIGN.md](DESIGN.md) for the full scene map and visual direction,
[PRD.md](PRD.md) for the product principles, and [SPEC.md](SPEC.md) for
the technical contract.

## Where the data comes from

The underlying SQLite database is produced by the extraction pipeline in
[`ewhitling/analysis-botns`](https://github.com/ewhitling/analysis-botns),
a separate private workshop repo. New data lands here via `make publish`
runs from there.

This public repo owns:

- The SPA (`web/`)
- Live community corrections (`corrections/`)
- A vendored copy of the apply-corrections layer (`core/`)
- The vendored database (`data/botns.db`)

## Contributing

Spotted something wrong? See [CONTRIBUTING.md](CONTRIBUTING.md).
Corrections land as YAML files in `corrections/`, get reviewed in the
open as PRs, and are picked up by the next build.

## Acknowledgments

Gene Wolfe. The r/genewolfe community. Named contributors land here as
their first correction merges.
