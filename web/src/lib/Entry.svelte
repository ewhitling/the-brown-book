<!--
  Entry.svelte — Scene 1: First visit.
  TASK-020: Book + chapter picker. Saves position to localStorage, routes to #/workshop.
  DB loads in background; Continue button shows a loading state until ready.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { loadDatabase, fetchAll } from './db';
  import { saveReadingPosition } from './storage';
  import type { ReadingPosition } from './types';

  // ─── Row shapes ──────────────────────────────────────────────────────────────

  interface BookRow {
    id: number;
    title: string;
  }

  interface ChapterRow {
    book_id: number;
    chapter_number: number;
    title: string;
  }

  // ─── State ───────────────────────────────────────────────────────────────────

  let dbReady = false;
  let books: BookRow[] = [];
  let allChapters: ChapterRow[] = [];

  /** String bindings for <select> elements. */
  let selectedBookId = '';
  let selectedChapterNumber = '';

  // ─── Derived ─────────────────────────────────────────────────────────────────

  $: bookIdNum = selectedBookId ? Number(selectedBookId) : null;

  $: filteredChapters = bookIdNum !== null
    ? allChapters.filter((c) => c.book_id === bookIdNum)
    : [];

  $: canContinue = dbReady && bookIdNum !== null && selectedChapterNumber !== '';

  // ─── Init ────────────────────────────────────────────────────────────────────

  onMount(async () => {
    // Start DB load in background; populate pickers once ready.
    await loadDatabase();

    const [bookRows, chapterRows] = await Promise.all([
      fetchAll('SELECT book_id AS id, title FROM books ORDER BY book_id'),
      fetchAll(
        'SELECT book_id, chapter_number, title FROM chapters ORDER BY book_id, chapter_number',
      ),
    ]);

    books = bookRows as BookRow[];
    allChapters = chapterRows as ChapterRow[];
    dbReady = true;
  });

  // ─── Handlers ────────────────────────────────────────────────────────────────

  function onBookChange() {
    // Reset chapter selection when book changes.
    selectedChapterNumber = '';
  }

  function handleContinue() {
    if (!canContinue) return;

    const position: ReadingPosition = {
      book_id: Number(bookIdNum),
      chapter_number: Number(selectedChapterNumber),
    };

    saveReadingPosition(position);
    window.location.hash = '#/workshop';
  }
</script>

<main class="entry shell">
  <header class="entry-header">
    <h1 class="entry-title">The Brown Book</h1>
    <p class="entry-desc ui meta">
      An evidence browser for Gene Wolfe's <em>Book of the New Sun</em>.
    </p>
  </header>

  <form class="entry-form" on:submit|preventDefault={handleContinue}>
    <fieldset class="picker-group ui" disabled={!dbReady}>
      <legend class="picker-legend">Where are you in the books?</legend>

      <div class="picker-row">
        <label class="picker-label" for="book-select">Book</label>
        <select
          id="book-select"
          class="picker-select"
          bind:value={selectedBookId}
          on:change={onBookChange}
        >
          <option value="" disabled>Select a book</option>
          {#each books as book (book.id)}
            <option value={String(book.id)}>{book.title}</option>
          {/each}
        </select>
      </div>

      <div class="picker-row">
        <label class="picker-label" for="chapter-select">Chapter</label>
        <select
          id="chapter-select"
          class="picker-select"
          bind:value={selectedChapterNumber}
          disabled={!dbReady || bookIdNum === null}
        >
          <option value="" disabled>Select a chapter</option>
          {#each filteredChapters as ch (ch.chapter_number)}
            <option value={String(ch.chapter_number)}>
              {ch.chapter_number}. {ch.title}
            </option>
          {/each}
        </select>
      </div>
    </fieldset>

    <button
      type="submit"
      class="continue-btn ui"
      disabled={!canContinue}
      aria-busy={!dbReady}
    >
      {#if !dbReady}
        <span class="spinner" aria-hidden="true"></span>
        Loading
      {:else}
        Continue →
      {/if}
    </button>
  </form>
</main>

<style>
  .entry {
    padding-block: var(--space-16);
  }

  /* ─── Header ─────────────────────────────────────────────────────────────── */

  .entry-header {
    margin-bottom: var(--space-12);
  }

  .entry-title {
    font-size: var(--text-3xl);
    margin-bottom: var(--space-3);
  }

  .entry-desc {
    font-size: var(--text-base);
  }

  /* ─── Form ───────────────────────────────────────────────────────────────── */

  .entry-form {
    max-width: 28rem;
  }

  /* ─── Picker fieldset ────────────────────────────────────────────────────── */

  .picker-group {
    border: none;
    padding: 0;
    margin: 0 0 var(--space-8) 0;
  }

  .picker-legend {
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: var(--space-6);
    display: block;
  }

  .picker-row {
    display: grid;
    grid-template-columns: 5rem 1fr;
    align-items: center;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }

  .picker-label {
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--muted);
  }

  .picker-select {
    width: 100%;
    padding: var(--space-2) var(--space-8) var(--space-2) var(--space-3);
    border: 1px solid var(--rule);
    border-radius: 4px;
    background-color: var(--paper);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236b665e' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right var(--space-3) center;
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--ink);
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
  }

  .picker-select:disabled {
    color: var(--whisper);
    cursor: default;
  }

  .picker-select:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  /* ─── Continue button ────────────────────────────────────────────────────── */

  .continue-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-6);
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 4px;
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: background 80ms ease;
  }

  .continue-btn:hover:not(:disabled) {
    background: var(--accent-soft);
  }

  .continue-btn:disabled {
    background: var(--rule);
    color: var(--muted);
    cursor: default;
  }

  /* ─── Loading spinner ────────────────────────────────────────────────────── */

  .spinner {
    display: inline-block;
    width: 10px;
    height: 10px;
    border: 1.5px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 600ms linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
