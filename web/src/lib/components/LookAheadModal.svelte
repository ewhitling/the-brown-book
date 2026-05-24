<!--
  LookAheadModal.svelte — Scene 5 reveal overlay.
  Confirmation modal when reader clicks Look ahead on a fogged passage.

  Props:
    item — the fogged PassageItem the reader wants to peek at

  Events:
    confirm — user chose "Show it anyway"; caller records reveal + updates state
    cancel  — user cancelled; no state change

  Visual treatment: centred paper card, soft shadow, accent border on preview.
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PassageItem } from '../types';

  export let item: PassageItem;

  const dispatch = createEventDispatcher<{ confirm: void; cancel: void }>();

  function onConfirm(): void {
    dispatch('confirm');
  }

  function onCancel(): void {
    dispatch('cancel');
  }

  function byline(i: PassageItem): string {
    return `${i.type} · Book ${i.chapter.book_id}, Ch ${i.chapter.number} · ‘${i.chapter.title}’`;
  }

  const PREVIEW_MAX = 200;
  $: preview =
    item.text.length > PREVIEW_MAX
      ? item.text.slice(0, PREVIEW_MAX).trimEnd() + '…'
      : item.text;
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="lookahead-backdrop" on:click={onCancel}></div>

<div
  class="lookahead-modal"
  role="dialog"
  aria-modal="true"
  aria-label="Look ahead confirmation"
>
  <p class="lookahead-warning ui">
    This is past your reading position. Show it anyway?
  </p>

  <div class="lookahead-preview">
    <p class="lookahead-byline meta">{byline(item)}</p>
    <p class="lookahead-text">{preview}</p>
  </div>

  <div class="lookahead-actions">
    <button
      class="lookahead-cancel ui"
      type="button"
      on:click={onCancel}
    >
      Cancel
    </button>
    <button
      class="lookahead-confirm ui"
      type="button"
      on:click={onConfirm}
    >
      Show it anyway
    </button>
  </div>
</div>

<style>
  /* ─── Backdrop ──────────────────────────────────────────────────────────── */

  .lookahead-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(26, 26, 26, 0.35);
    z-index: 40;
  }

  /* ─── Modal card ────────────────────────────────────────────────────────── */

  .lookahead-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 50;
    width: min(32rem, 92vw);
    background: var(--paper);
    border-radius: 6px;
    padding: var(--space-8);
    box-shadow: 0 4px 32px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  /* ─── Warning line ──────────────────────────────────────────────────────── */

  .lookahead-warning {
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--ink);
  }

  /* ─── Item preview card ─────────────────────────────────────────────────── */

  .lookahead-preview {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--paper-deep);
    border-radius: 4px;
    border-left: 3px solid var(--accent);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  }

  .lookahead-byline {
    color: var(--muted);
  }

  .lookahead-text {
    font-family: var(--font-serif);
    font-size: var(--text-base);
    line-height: 1.55;
    color: var(--ink);
    margin: 0;
  }

  /* ─── Actions row ───────────────────────────────────────────────────────── */

  .lookahead-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
  }

  .lookahead-cancel {
    background: none;
    border: 1px solid var(--rule);
    border-radius: 4px;
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-sm);
    color: var(--muted);
    cursor: pointer;
    transition: border-color 80ms ease, color 80ms ease;
  }

  .lookahead-cancel:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .lookahead-confirm {
    background: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 4px;
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-sm);
    color: var(--paper);
    cursor: pointer;
    transition: background 80ms ease, border-color 80ms ease;
  }

  .lookahead-confirm:hover {
    background: var(--accent-soft);
    border-color: var(--accent-soft);
  }
</style>
