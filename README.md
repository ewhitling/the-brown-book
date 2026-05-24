# The Brown Book

An evidence browser for Gene Wolfe's *Book of the New Sun*.

The tool surfaces evidence and patterns from the tetralogy and *The Urth of the
New Sun*. It does not synthesize at query time or return a verdict on a theory.
The thinking is yours.

**Live tool:** [the-brown-book.pages.dev](https://the-brown-book.pages.dev)  
**Repository:** [github.com/ewhitling/the-brown-book](https://github.com/ewhitling/the-brown-book)

## How this tool works

Bring a theory and your current reading position. Three coordinated panels
— Passages, Timeline, Characters — surface what is relevant in the text,
filtered so that content past your reading position stays fogged by default.
Peeking past the horizon is deliberate and recorded per item.

For a full walkthrough of the scenes and the design decisions behind them,
see the in-tool About page.

## Where the data comes from

The SQLite database is produced by the extraction pipeline in
[`ewhitling/analysis-botns`](https://github.com/ewhitling/analysis-botns),
a private workshop repo. New data lands here via `make publish` runs from
that repo.

This public repo owns:

- The SPA (`web/`)
- Live community corrections (`corrections/`)
- A vendored copy of the apply-corrections layer (`core/`)
- The vendored database (`data/botns.db`)

## Contributing

Spotted something wrong? See [CONTRIBUTING.md](CONTRIBUTING.md). Corrections
land as YAML files in `corrections/`, get reviewed as open PRs, and are picked
up by the next build.

## Acknowledgments

Gene Wolfe. The r/genewolfe community. Named contributors will be listed here
as their first correction merges.
