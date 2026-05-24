<!--
  PositionPicker.svelte — Scene 7: compact overlay for changing reading position.

  Accepts:
    position  — current ReadingPosition (seeds the picker on open)
    show      — controls visibility (Workshop toggles this)

  Dispatches:
    apply  — { book_id, chapter_number } when Update is confirmed
    close  — when dismissed without saving (backdrop, Cancel, or ESC)

  Chapter dropdown is filtered by the selected book and resets when book changes.
  Books are loaded once from the DB and cached across opens.
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fetchAll } from './db';
  import type { ReadingPosition } from './types';

  export let position: ReadingPosition;
  export let show: boolean = false;

  const dispatch = createEventDispatcher<{
    apply: ReadingPosition;
    close: void;
  }>();

  interface BookOption {
    id: number;
    title: string;
  }

  interface ChapterOption {
    number: number;
    title: string;
  }

  let selectedBook: number = position.book_id;
  let selectedChapter: number = position.chapter_number;
  let books: BookOption[] = [];
  let chapters: ChapterOption[] = [];
  let booksLoaded = false;

  // Re-initialise picker state whenever the overlay opens.
  $: if (show) {
    void open();
  }

  async function open(): Promise<void> {
    selectedBook = position.book_id;
    selectedChapter = position.chapter_number;
    if (!booksLoaded) {
      const rows = await fetchAll('SELECT book_id, title FROM books ORDER BY book_id');
      books = rows.map((r) => ({
        id: r.book_id as number,
        title: r.title as string,
      }));
      booksLoaded = true;
    }
    await refreshChapters(selectedBook, false);
  }

  /**
   * Loads chapters for the given book from the DB.
   * @param bookId  Book to load chapters for.
   * @param reset   If true, always select the first chapter of the book.
   *                If false, keep selectedChapter when it exists in the new list.
   */
  async function refreshChapters(bookId: number, reset: boolean): Promise<void> {
    const rows = await fetchAll(
      'SELECT chapter_number, title FROM chapters WHERE book_id = :book_id ORDER BY chapter_number',
      { ':book_id': bookId },
    );
    chapters = rows.map((r) => ({
      number: r.chapter_number as number,
      title: r.title as string,
    }));
    if (reset || !chapters.some((c) => c.number === selectedChapter)) {
      selectedChapter = chapters[0]?.number ?? 1;
    }
  }

  /** Called by the book <select> on:change — reloads chapters and resets selection. */
  async function onBookChange(): Promise<void> {
    await refreshChapters(selectedBook, true);
  }

  function onApply(): void {
    dispatch('apply', { book_id: selectedBook, chapter_number: selectedChapter });
  }

  function onClose(): void {
    dispatch('close');
  }

  /** Global keydown handler — ESC closes without saving. */
  function handleKeydown(e: KeyboardEvent): void {
    if (!show) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="picker-backdrop" on:click={onClose}></div>

  <div
    class="picker-overlay ui"
    role="dialog"
    aria-label="Update reading position"
    aria-modal="true"
  >
    <h2 class="picker-heading">Reading position</h2>
    <p class="picker-hint meta">Everything past this point will be fogged.</p>

    <div class="picker-fields">
      <label class="picker-label" for="picker-book">Book</label>
      <select
        id="picker-book"
        class="picker-select"
        bind:value={selectedBook}
        on:change={onBookChange}
      >
        {#each books as book (book.id)}
          <option value={book.id}>{book.id}. {book.title}</option>
        {/each}
      </select>

      <label class="picker-label" for="picker-chapter">Chapter</label>
      <select
        id="picker-chapter"
        class="picker-select"
        bind:value={selectedChapter}
      >
        {#each chapters as ch (ch.number)}
          <option value={ch.number}>Ch. {ch.number} — {ch.title}</option>
        {/each}
      </select>
    </div>

    <div class="picker-actions">
      <button class="picker-apply ui" type="button" on:click={onApply}>
        Update
      </button>
      <button class="picker-cancel ui meta" type="button" on:click={onClose}>
        Cancel
      </button>
    </div>
  </div>
{/if}

<style>
  /* ─── Backdrop ───────────────────────────────────────────────────────────── */

  .picker-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(26, 26, 26, 0.3);
    z-index: 40;
  }

  /* ─── Overlay panel ──────────────────────────────────────────────────────── */

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

  /* ─── Fields grid ────────────────────────────────────────────────────────── */

  .picker-fields {
    display: grid;
    grid-template-columns: 5rem 1fr;
    gap: var(--space-3);
    align-items: center;
    margin-bottom: var(--space-6);
  }

  .picker-label {
    font-size: var(--text-sm);
    color: var(--muted);
  }

  .picker-select {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rule);
    border-radius: 4px;
    background: var(--paper);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--ink);
    width: 100%;
    cursor: pointer;
  }

  .picker-select:focus {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  /* ─── Actions ────────────────────────────────────────────────────────────── */

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
</style>
