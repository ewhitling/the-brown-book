<!--
  CorrectionPanel.svelte — Scene 6 flag overlay.
  Shows item context when the Flag affordance is clicked.
  Full correction form (type selector, GitHub PR URL builder) lands in TASK-027.
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PassageItem } from '../types';

  export let item: PassageItem;

  const dispatch = createEventDispatcher<{ close: void }>();

  function onClose(): void {
    dispatch('close');
  }

  function byline(i: PassageItem): string {
    return `${i.type} · Book ${i.chapter.book_id}, Ch ${i.chapter.number} · ‘${i.chapter.title}’`;
  }

  const EXCERPT_MAX = 280;
  $: excerpt =
    item.text.length > EXCERPT_MAX
      ? item.text.slice(0, EXCERPT_MAX).trimEnd() + '…'
      : item.text;
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="correction-backdrop" on:click={onClose}></div>

<aside
  class="correction-panel"
  role="dialog"
  aria-modal="true"
  aria-label="Suggest a correction"
>
  <header class="correction-header">
    <h2 class="correction-title ui">Suggest a correction</h2>
    <button
      class="correction-close ui"
      type="button"
      on:click={onClose}
      aria-label="Close"
    >
      &times;
    </button>
  </header>

  <div class="correction-context">
    <p class="correction-byline meta">{byline(item)}</p>
    <blockquote class="correction-excerpt">{excerpt}</blockquote>
  </div>

  <p class="correction-helper meta">
    Corrections are reviewed in the open on GitHub. Merged ones are picked up
    by the next build.
  </p>

  <!-- Placeholder — full form in TASK-027 -->
  <p class="correction-coming meta">Full correction form coming soon.</p>
</aside>

<style>
  .correction-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(26, 26, 26, 0.22);
    z-index: 40;
  }

  .correction-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 50;
    width: min(28rem, 92vw);
    background: var(--paper);
    border-left: 1px solid var(--rule);
    padding: var(--space-8);
    overflow-y: auto;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.10);
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  /* ─── Header ──────────────────────────────────────────────────────────────── */

  .correction-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .correction-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--ink);
  }

  .correction-close {
    background: none;
    border: none;
    font-size: var(--text-xl);
    line-height: 1;
    color: var(--muted);
    cursor: pointer;
    padding: 0;
  }

  .correction-close:hover {
    color: var(--ink);
  }

  /* ─── Item context block ──────────────────────────────────────────────────── */

  .correction-context {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--paper-deep);
    border-radius: 4px;
    border-left: 3px solid var(--rule);
  }

  .correction-byline {
    color: var(--muted);
  }

  .correction-excerpt {
    font-family: var(--font-serif);
    font-size: var(--text-base);
    line-height: 1.55;
    color: var(--ink);
    margin: 0;
    padding: 0;
    border: none;
  }

  /* ─── Helper text ─────────────────────────────────────────────────────────── */

  .correction-helper {
    color: var(--muted);
  }

  .correction-coming {
    color: var(--whisper);
    font-style: italic;
  }
</style>
