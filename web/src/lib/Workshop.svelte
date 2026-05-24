<!--
  Workshop.svelte — Scenes 2–4: the main evidence browser.

  Boot behaviour (SPEC.md §4):
    - Reads initial theory + position from URL (?q=…&pos=B2C5).
    - Falls back to localStorage position if no URL params.
    - Writes position to localStorage on every change.
    - URL is kept in sync after each successful query (shareability).

  Theory input is debounced at 150 ms. A monotonically-incrementing
  inflightToken discards stale responses when a newer request lands first.

  Three view states:
    empty      — no theory text (blank input or freshly mounted)
    loading    — theory set, query in progress
    populated  — result has at least one passage
    no-results — result has 0 passages
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fetchQueryResult } from './db';
  import { saveReadingPosition, loadReadingPosition } from './storage';
  import { compact, encodeWorkshopURL, decodeWorkshopURL } from './position';
  import type { ReadingPosition, QueryResult } from './types';
  import CharactersPanel from './CharactersPanel.svelte';
  import TimelinePanel from './TimelinePanel.svelte';

  // ─── Init from URL or localStorage ──────────────────────────────────────────

  /**
   * Reads the initial theory and position from URL search params, falling back
   * to localStorage for position. Runs synchronously during component init.
   */
  function readInitialState(): { theory: string; position: ReadingPosition } {
    const urlDecoded = decodeWorkshopURL(window.location.search);
    if (urlDecoded) {
      return { theory: urlDecoded.theory.text, position: urlDecoded.position };
    }
    const saved = loadReadingPosition();
    return { theory: '', position: saved ?? { book_id: 1, chapter_number: 1 } };
  }

  const initial = readInitialState();

  // ─── State ───────────────────────────────────────────────────────────────────

  let theory: string = initial.theory;
  let position: ReadingPosition = initial.position;

  let queryResult: QueryResult | null = null;
  let loading = false;
  let showPositionPicker = false;

  // Inline picker state (minimal — full PositionPicker in a later task)
  let pickerBookInput: string = String(position.book_id);
  let pickerChapterInput: string = String(position.chapter_number);

  // Monotonic token — responses from superseded requests are discarded.
  let inflightToken = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── Derived ─────────────────────────────────────────────────────────────────

  $: positionLabel = compact(position);

  $: viewState = ((): 'empty' | 'loading' | 'no-results' | 'populated' => {
    if (theory.trim() === '') return 'empty';
    if (loading) return 'loading';
    if (queryResult === null) return 'empty';
    if (queryResult.passages_panel.total_matching === 0) return 'no-results';
    return 'populated';
  })();

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  onMount(() => {
    // Persist position immediately (URL wins, then writes back to localStorage).
    saveReadingPosition(position);
    // Fire the initial query without additional debounce if URL seeded a theory.
    if (theory.trim()) {
      runQuery(0);
    }
  });

  onDestroy(() => {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
  });

  // ─── Query logic ─────────────────────────────────────────────────────────────

  /**
   * Schedules a debounced query. Cancels any pending timer.
   * Clears state immediately if theory is blank.
   */
  function scheduleQuery(): void {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    const trimmed = theory.trim();
    if (trimmed === '') {
      queryResult = null;
      loading = false;
      return;
    }
    loading = true;
    const token = ++inflightToken;
    debounceTimer = setTimeout(() => runQuery(token), 150);
  }

  /**
   * Executes a fetchQueryResult call for the current theory + position.
   * Discards the response if a newer token has been issued since this call
   * was scheduled (i.e. another keypress arrived during the async wait).
   */
  async function runQuery(token: number): Promise<void> {
    const trimmed = theory.trim();
    if (!trimmed) return;

    // If the caller passed token=0 (onMount path) we claim a new slot.
    const activeToken = token === 0 ? ++inflightToken : token;
    loading = true;

    try {
      const result = await fetchQueryResult(trimmed, position);
      if (activeToken !== inflightToken) return; // superseded
      queryResult = result;
      loading = false;
      syncURL(trimmed);
    } catch {
      if (activeToken === inflightToken) loading = false;
    }
  }

  /** Updates the browser URL with the current theory + position. */
  function syncURL(theoryText: string): void {
    const qs = encodeWorkshopURL({ text: theoryText }, position);
    const newUrl = qs + window.location.hash;
    window.history.replaceState(null, '', newUrl);
  }

  // ─── Event handlers ──────────────────────────────────────────────────────────

  function onTheoryInput(): void {
    scheduleQuery();
  }

  function onOpenPositionPicker(): void {
    pickerBookInput = String(position.book_id);
    pickerChapterInput = String(position.chapter_number);
    showPositionPicker = true;
  }

  function onApplyPosition(): void {
    const book = parseInt(pickerBookInput, 10);
    const chapter = parseInt(pickerChapterInput, 10);
    if (!book || !chapter || book < 1 || book > 5 || chapter < 1) return;
    position = { book_id: book, chapter_number: chapter };
    saveReadingPosition(position);
    showPositionPicker = false;
    if (theory.trim()) scheduleQuery();
  }

  function onRefineTheory(): void {
    theory = '';
    queryResult = null;
    loading = false;
    document.getElementById('theory-input')?.focus();
  }
</script>

<!-- ── Workshop shell ──────────────────────────────────────────────────── -->
<main class="workshop shell">

  <!-- ── Search bar ──────────────────────────────────────────────────── -->
  <div class="workshop-bar">
    <label for="theory-input" class="sr-only">Theory</label>
    <input
      id="theory-input"
      class="theory-input ui"
      type="search"
      placeholder="Type a theory, character name, or question…"
      bind:value={theory}
      on:input={onTheoryInput}
      autocomplete="off"
      spellcheck="false"
    />

    <button
      class="position-chip ui meta"
      type="button"
      aria-label="Reading position: {positionLabel}. Click to change."
      on:click={onOpenPositionPicker}
    >
      {positionLabel}
    </button>
  </div>

  <!-- ── Position picker overlay ─────────────────────────────────────── -->
  {#if showPositionPicker}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="picker-backdrop"
      on:click={() => { showPositionPicker = false; }}
    ></div>
    <div class="picker-overlay ui" role="dialog" aria-label="Update reading position" aria-modal="true">
      <h2 class="picker-heading">Reading position</h2>
      <p class="picker-hint meta">
        Everything past this point will be fogged.
      </p>
      <div class="picker-fields">
        <label class="picker-label" for="picker-book">Book (1–5)</label>
        <input
          id="picker-book"
          class="picker-input"
          type="number"
          min="1"
          max="5"
          bind:value={pickerBookInput}
        />
        <label class="picker-label" for="picker-chapter">Chapter</label>
        <input
          id="picker-chapter"
          class="picker-input"
          type="number"
          min="1"
          bind:value={pickerChapterInput}
        />
      </div>
      <div class="picker-actions">
        <button class="picker-apply ui" type="button" on:click={onApplyPosition}>
          Update
        </button>
        <button
          class="picker-cancel ui meta"
          type="button"
          on:click={() => { showPositionPicker = false; }}
        >
          Cancel
        </button>
      </div>
    </div>
  {/if}

  <!-- ── Panel area ──────────────────────────────────────────────────── -->

  {#if viewState === 'empty'}
    <div class="state-empty">
      <p class="ui meta empty-hint">
        Enter a theory above to search the evidence.
      </p>
    </div>

  {:else if viewState === 'loading'}
    <div class="panels state-loading" aria-live="polite" aria-busy="true">
      <section class="panel panel-passages" aria-label="Passages">
        <h2 class="panel-title">Passages</h2>
        <div class="panel-content loading"></div>
      </section>
      <section class="panel panel-timeline" aria-label="Timeline">
        <h2 class="panel-title">Timeline</h2>
        <div class="panel-content loading"></div>
      </section>
      <section class="panel panel-characters" aria-label="Characters">
        <h2 class="panel-title">Characters</h2>
        <div class="panel-content loading"></div>
      </section>
    </div>

  {:else if viewState === 'no-results'}
    <div class="state-no-results">
      <p class="no-results-msg ui">
        No evidence found within your reading position
        {#if queryResult?.had_matches_past_horizon}
          — but there are matches past your horizon.
        {:else}
          .
        {/if}
      </p>
      <ul class="no-results-actions ui meta">
        <li>
          <a
            href="#refine"
            on:click|preventDefault={onRefineTheory}
          >Refine your theory</a>
        </li>
        <li>
          <a
            href="#position"
            on:click|preventDefault={onOpenPositionPicker}
          >Update reading position</a>
        </li>
        <li>
          <a
            href="#horizon"
            on:click|preventDefault={() => { /* look-ahead modal — TASK-022 */ }}
          >Look past your reading position</a>
        </li>
      </ul>
    </div>

  {:else}
    <!-- populated state — three panel slots -->
    <div class="panels state-populated">

      <!-- Passages panel slot -->
      <section class="panel panel-passages" aria-label="Passages">
        <h2 class="panel-title">Passages</h2>
        <div class="panel-content">
          {#if queryResult}
            <p class="panel-meta meta">
              {queryResult.passages_panel.total_matching} match{queryResult.passages_panel.total_matching === 1 ? '' : 'es'}
              · showing {queryResult.passages_panel.showing}
            </p>
            <!-- PassagesPanel.svelte replaces this list in TASK-022 -->
            {#each queryResult.passages_panel.items as item (item.id)}
              <article class="passage-item {item.past_horizon ? 'fog' : ''}">
                <header class="passage-meta meta">
                  <span class="type-tag">{item.type}</span>
                  <span>
                    Book {item.chapter.book_id}, Ch. {item.chapter.number}
                    — {item.chapter.title}
                  </span>
                </header>
                <p class="passage-text">{item.text}</p>
              </article>
            {/each}
          {/if}
        </div>
      </section>

      <!-- Timeline panel slot -->
      <section class="panel panel-timeline" aria-label="Timeline">
        <h2 class="panel-title">Timeline</h2>
        <div class="panel-content">
          <TimelinePanel panel={queryResult?.timeline_panel ?? null} />
        </div>
      </section>

      <!-- Characters panel slot -->
      <section class="panel panel-characters" aria-label="Characters">
        <h2 class="panel-title">Characters</h2>
        <div class="panel-content">
          {#if queryResult}
            <CharactersPanel nodes={queryResult.characters_panel.nodes} />
          {/if}
        </div>
      </section>

    </div>
  {/if}

</main>

<style>
  /* ─── Screen-reader-only utility ───────────────────────────────────────── */

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  /* ─── Workshop shell ────────────────────────────────────────────────────── */

  .workshop {
    padding-block: var(--space-8);
  }

  /* ─── Search bar ────────────────────────────────────────────────────────── */

  .workshop-bar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-8);
  }

  .theory-input {
    flex: 1;
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--rule);
    border-radius: 4px;
    background: var(--paper);
    font-family: var(--font-serif);
    font-size: var(--text-lg);
    color: var(--ink);
    line-height: 1.4;
    outline: none;
    transition: border-color 80ms ease;
  }

  .theory-input:focus {
    border-color: var(--accent);
  }

  .theory-input::placeholder {
    color: var(--whisper);
    font-style: italic;
  }

  /* Remove browser's default search-field cancel button */
  .theory-input::-webkit-search-cancel-button {
    display: none;
  }

  .position-chip {
    flex-shrink: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rule);
    border-radius: 4px;
    background: var(--paper-deep);
    color: var(--muted);
    cursor: pointer;
    font-size: var(--text-sm);
    white-space: nowrap;
    transition: border-color 80ms ease, color 80ms ease;
  }

  .position-chip:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* ─── Position picker overlay ───────────────────────────────────────────── */

  .picker-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(26, 26, 26, 0.3);
    z-index: 40;
  }

  .picker-overlay {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 50;
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: 6px;
    padding: var(--space-8);
    width: min(24rem, 90vw);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  }

  .picker-heading {
    font-size: var(--text-xl);
    margin-bottom: var(--space-2);
  }

  .picker-hint {
    margin-bottom: var(--space-6);
  }

  .picker-fields {
    display: grid;
    grid-template-columns: 6rem 1fr;
    gap: var(--space-3);
    align-items: center;
    margin-bottom: var(--space-6);
  }

  .picker-label {
    font-size: var(--text-sm);
    color: var(--muted);
  }

  .picker-input {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rule);
    border-radius: 4px;
    background: var(--paper);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--ink);
    width: 100%;
  }

  .picker-input:focus {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .picker-actions {
    display: flex;
    gap: var(--space-3);
    align-items: center;
  }

  .picker-apply {
    padding: var(--space-2) var(--space-6);
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: background 80ms ease;
  }

  .picker-apply:hover {
    background: var(--accent-soft);
  }

  .picker-cancel {
    background: none;
    border: none;
    cursor: pointer;
    font-size: var(--text-sm);
    color: var(--muted);
    padding: 0;
  }

  .picker-cancel:hover {
    color: var(--ink);
  }

  /* ─── Empty state ───────────────────────────────────────────────────────── */

  .state-empty {
    padding-block: var(--space-16);
    text-align: center;
  }

  .empty-hint {
    color: var(--whisper);
  }

  /* ─── Loading state ─────────────────────────────────────────────────────── */

  .state-loading .panel-content.loading {
    min-height: 8rem;
    border-radius: 3px;
    background: linear-gradient(
      90deg,
      var(--paper-deep) 25%,
      var(--paper) 50%,
      var(--paper-deep) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.2s ease infinite;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* ─── No-results state ──────────────────────────────────────────────────── */

  .state-no-results {
    padding-block: var(--space-12);
  }

  .no-results-msg {
    font-size: var(--text-lg);
    color: var(--muted);
    margin-bottom: var(--space-6);
  }

  .no-results-actions {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .no-results-actions a {
    color: var(--accent);
    text-decoration: none;
    font-size: var(--text-base);
  }

  .no-results-actions a:hover {
    text-decoration: underline;
  }

  /* ─── Populated state ───────────────────────────────────────────────────── */

  /* panel-meta line */
  .panel-meta {
    margin-bottom: var(--space-4);
  }

  /* ─── Passage items ─────────────────────────────────────────────────────── */

  .passage-item {
    padding-block: var(--space-4);
    border-bottom: 1px solid var(--rule);
  }

  .passage-item:last-child {
    border-bottom: none;
  }

  .passage-meta {
    display: flex;
    gap: var(--space-3);
    align-items: baseline;
    margin-bottom: var(--space-2);
  }

  .passage-text {
    font-size: var(--text-base);
    line-height: 1.55;
  }

  /* ─── Timeline items ────────────────────────────────────────────────────── */

  .timeline-book {
    margin-bottom: var(--space-4);
  }

  .timeline-book-title {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: var(--space-2);
  }

  .timeline-chapter {
    display: flex;
    justify-content: space-between;
    padding-block: var(--space-1);
    font-size: var(--text-sm);
  }

  .timeline-matches {
    font-variant-numeric: tabular-nums;
  }

  /* ─── Character items ───────────────────────────────────────────────────── */

  .character-node {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding-block: var(--space-2);
    border-bottom: 1px solid var(--rule);
    font-size: var(--text-sm);
  }

  .character-node:last-child {
    border-bottom: none;
  }

  .character-count {
    font-variant-numeric: tabular-nums;
  }
</style>
