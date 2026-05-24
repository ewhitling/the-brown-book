# Contributing to The Brown Book

Most contributions are *corrections* — the LLM extractions are imperfect,
and reader-flagged fixes improve the data set over time.

## How a correction becomes a PR

The tool itself has a **Flag** affordance on every item. Clicking it
opens a GitHub PR pre-filled with the correction YAML. Submit the PR,
a reviewer eyeballs it against the book, and once merged, the next
build picks it up and the live tool reflects the fix.

You can also file corrections by hand. The full schema and one example
per type live in [`corrections/README.md`](corrections/README.md). The
short version: drop a YAML file in `corrections/` matching one of three
shapes — `merge`, `rename`, or `factual_fix`.

## What makes a good correction

- Cites the chapter (or scene) where you spotted the issue
- Quotes the relevant text when possible
- Explains *why* in a sentence — especially for `merge` and `factual_fix`,
  where the call is interpretive

## Reviewing a correction PR

*(Filled in by the v1 launch. For now: read the YAML, check the source
passage in the book, judge whether the fix is right.)*

## Other contributions

Tool bugs, documentation improvements, new panel ideas — open an issue
to discuss before opening a PR.
