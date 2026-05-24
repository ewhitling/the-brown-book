<script lang="ts">
  const REPO_URL = 'https://github.com/ewhitling/the-brown-book';
  const CONTRIBUTING_URL =
    'https://github.com/ewhitling/the-brown-book/blob/main/CONTRIBUTING.md';
</script>

<article class="about shell">
  <header class="about-header">
    <h1 class="about-title">The Brown Book</h1>
    <p class="about-subtitle ui meta">About this tool</p>
  </header>

  <section class="about-section" id="what-this-is">
    <h2>What this is</h2>
    <p>
      An evidence browser for Gene Wolfe's <em>Book of the New Sun</em>, built
      so deep readers can substantiate theories without rereading 400,000 words.
      The database was built by running a language model over the text to extract
      scenes, characters, factual claims, and notable details. The tool lets you
      query that extraction against a reading position you provide.
    </p>
    <p>
      It is a fan project, not affiliated with the Wolfe estate or any publisher.
      The extracted data is derived from the novels; the novels themselves are not
      reproduced here.
    </p>
  </section>

  <hr />

  <section class="about-section" id="principles">
    <h2>Principles</h2>
    <p>
      The tool surfaces evidence and patterns; it never synthesizes at query
      time. The model's work happened upstream, during extraction. The thinking
      is yours.
    </p>
    <p>
      Every visible item is a piece of the original work or a deterministic
      build-time extraction — a passage, a claim, a scene summary. No verdicts.
      No AI summaries generated on demand. What you see is in the database;
      the database is in the repository.
    </p>
    <p>
      Copy is functional. No taglines. No exclamation marks. No selling.
    </p>
  </section>

  <hr />

  <section class="about-section" id="reading-position">
    <h2>Reading position and fog</h2>
    <p>
      When you set your reading position — book and chapter, inclusive — the
      tool hides everything past that point. Content from chapters you have not
      yet reached is fogged: still structurally present, but visually obscured
      with a hatched overlay and the label <em>"past your reading position."</em>
    </p>
    <p>
      You can peek past the fog deliberately. Clicking <em>Look ahead</em> on a
      fogged item shows it after a confirmation step. Once revealed, the item
      keeps a permanent tag — <em>↪ past your reading position</em> — so you
      remember you peeked. The tag persists for that browser session.
    </p>
    <p>
      The fog is a felt boundary, not a strict lock. The tool trusts you to use
      it honestly.
    </p>
  </section>

  <hr />

  <section class="about-section" id="corrections">
    <h2>Corrections</h2>
    <p>
      LLM extractions are imperfect. Every item in the tool has a
      <em>Flag</em> affordance. Clicking it opens a GitHub pull request
      pre-filled with a correction in YAML. A reviewer checks it against the
      book text; once merged, the next build picks it up and the tool reflects
      the fix.
    </p>
    <p>
      You can also file corrections by hand. The full schema and one example per
      correction type are documented in{' '}
      <a href={CONTRIBUTING_URL} target="_blank" rel="noopener noreferrer"
        >CONTRIBUTING.md</a
      >.
    </p>
    <p>
      Corrections are reviewed in the open on GitHub. Merged ones are picked up
      by the next build. Nothing is changed silently.
    </p>
  </section>

  <hr />

  <section class="about-section" id="source-contributors">
    <h2>Source and contributors</h2>
    <p>
      The source code and database are available at{' '}
      <a href={REPO_URL} target="_blank" rel="noopener noreferrer"
        >github.com/ewhitling/the-brown-book</a
      >.
    </p>
    <p>
      This project would not exist without Gene Wolfe, who wrote the books.
      The <em>Book of the New Sun</em> is his work.
    </p>
    <p>
      The r/genewolfe community has produced years of close reading, annotation,
      and debate that informed the extraction vocabulary and quality criteria
      used here.
    </p>
  </section>
</article>

<style>
  .about {
    padding-block: var(--space-16);
    max-width: 42rem;
  }

  .about-header {
    margin-bottom: var(--space-12);
  }

  .about-title {
    font-size: var(--text-3xl);
    font-weight: 500;
    margin-bottom: var(--space-2);
  }

  .about-subtitle {
    font-size: var(--text-sm);
    color: var(--muted);
  }

  .about-section {
    margin-block: var(--space-8);
  }

  .about-section h2 {
    font-size: var(--text-xl);
    font-weight: 500;
    margin-bottom: var(--space-4);
    color: var(--ink);
  }

  .about-section p {
    font-size: var(--text-lg);
    line-height: 1.6;
    color: var(--ink);
  }

  .about-section p + p {
    margin-top: var(--space-4);
  }

  .about-section em {
    font-style: italic;
  }

  hr {
    margin-block: var(--space-8);
  }
</style>
