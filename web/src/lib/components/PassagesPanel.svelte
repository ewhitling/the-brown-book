<!--
  PassagesPanel.svelte — TASK-022.

  Renders the passages panel from a PassagesPanel data object.

  Features:
  - Type-tagged byline per item: "scene · Book 1, Ch 21 · 'The Lake of Birds'"
  - Passage text in EB Garamond serif
  - Hover-revealed Flag affordance (⚑) that opens CorrectionPanel
  - Drop-cap on the first visible item (featured treatment)
  - Fogged items shown individually with fog overlay + per-item Look ahead affordance
  - LookAheadModal (TASK-026) confirms per-item reveal before recording to localStorage
  - Revealed items from localStorage persist with permanent ↪ tag
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { PassageItem, PassagesPanel } from '../types';
  import { loadReveals, recordReveal } from '../storage';
  import CorrectionPanel from './CorrectionPanel.svelte';
  import LookAheadModal from './LookAheadModal.svelte';

  export let panel: PassagesPanel;
  export let hadMatchesPastHorizon: boolean = false;

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Extract the numeric portion from "type:123" item IDs.
   * e.g. "claim:412" → 412
   */
  function numericId(itemId: string): number {
    const colon = itemId.indexOf(':');
    return colon === -1 ? 0 : parseInt(itemId.slice(colon + 1), 10);
  }

  // ─── Reveal state ─────────────────────────────────────────────────────────────

  /** IDs of past-horizon items the user has deliberately revealed. */
  let revealedSet = new Set<string>();

  /** Re-seed revealedSet from localStorage for the current panel items. */
  function seedReveals(): void {
    const stored = loadReveals();
    revealedSet = new Set(
      panel.items
        .filter((item) =>
          stored.some((r) => r.type === item.type && r.id === numericId(item.id)),
        )
        .map((item) => item.id),
    );
  }

  // Seed on first mount.
  onMount(seedReveals);

  // Re-seed and reset session state whenever the panel data changes (new query).
  let prevPanel = panel;
  $: if (panel !== prevPanel) {
    prevPanel = panel;
    lookaheadItem = null;
    seedReveals();
  }

  // ─── Derived item groups ───────────────────────────────────────────────────────

  /** Items within the reading horizon — rendered normally. */
  $: visibleItems = panel.items.filter((item) => !item.past_horizon);

  /** Past-horizon items the user has already revealed — permanent ↪ tag. */
  $: revealedItems = panel.items.filter(
    (item) => item.past_horizon && revealedSet.has(item.id),
  );

  /** Past-horizon items not yet revealed — hidden until "Look ahead" is clicked. */
  $: foggedItems = panel.items.filter(
    (item) => item.past_horizon && !revealedSet.has(item.id),
  );

  /** First visible item gets drop-cap featured treatment. */
  $: featuredId = visibleItems[0]?.id ?? null;

  // ─── Interaction state ────────────────────────────────────────────────────────

  /** The fogged item pending reveal in the look-ahead modal, or null. */
  let lookaheadItem: PassageItem | null = null;

  /** The item currently open in the correction panel, or null. */
  let correctionItem: PassageItem | null = null;

  // ─── Event handlers ───────────────────────────────────────────────────────────

  function onLookAheadItem(item: PassageItem): void {
    lookaheadItem = item;
  }

  function onConfirmReveal(): void {
    if (!lookaheadItem) return;
    recordReveal(lookaheadItem.type, numericId(lookaheadItem.id));
    revealedSet = new Set([...revealedSet, lookaheadItem.id]);
    lookaheadItem = null;
  }

  function onCancelReveal(): void {
    lookaheadItem = null;
  }

  function onFlag(item: PassageItem): void {
    correctionItem = item;
  }

  function onCloseCorrection(): void {
    correctionItem = null;
  }
</script>

<div class="passages-list">

  <!-- ── Items within the reading horizon ──────────────────────────────────── -->
  {#each visibleItems as item (item.id)}
    <article
      class="passage-item"
      class:passage-item--featured={item.id === featuredId}
    >
      <header class="passage-byline meta">
        <span class="type-tag">{item.type}</span>
        <span class="byline-sep">&middot;</span>
        <span class="passage-location">
          Book {item.chapter.book_id}, Ch {item.chapter.number}
          &middot; &lsquo;{item.chapter.title}&rsquo;
        </span>
      </header>
      <p class="passage-text">{item.text}</p>
      <button
        class="flag-btn ui"
        type="button"
        title="Suggest a correction"
        aria-label="Flag this passage for correction"
        on:click={() => onFlag(item)}
      >
        &#9873;
      </button>
    </article>
  {/each}

  <!-- ── Past-horizon items permanently revealed via localStorage ───────────── -->
  {#each revealedItems as item (item.id)}
    <article class="passage-item passage-item--revealed">
      <header class="passage-byline meta">
        <span class="revealed-tag">&#8618;</span>
        <span class="type-tag">{item.type}</span>
        <span class="byline-sep">&middot;</span>
        <span class="passage-location">
          Book {item.chapter.book_id}, Ch {item.chapter.number}
          &middot; &lsquo;{item.chapter.title}&rsquo;
        </span>
      </header>
      <p class="passage-text">{item.text}</p>
      <button
        class="flag-btn ui"
        type="button"
        title="Suggest a correction"
        aria-label="Flag this passage for correction"
        on:click={() => onFlag(item)}
      >
        &#9873;
      </button>
    </article>
  {/each}

  <!-- ── Fogged items — visible with fog overlay, revealed per item via modal ── -->
  {#each foggedItems as item (item.id)}
    <article class="passage-item passage-item--fogged">
      <header class="passage-byline meta">
        <span class="type-tag">{item.type}</span>
        <span class="byline-sep">&middot;</span>
        <span class="passage-location">
          Book {item.chapter.book_id}, Ch {item.chapter.number}
          &middot; &lsquo;{item.chapter.title}&rsquo;
        </span>
      </header>
      <div class="fogged-text fog">
        <p class="passage-text">{item.text}</p>
      </div>
      <button
        class="look-ahead-item-btn ui"
        type="button"
        title="Look ahead"
        aria-label="Look ahead at this passage"
        on:click={() => onLookAheadItem(item)}
      >
        Look ahead &rarr;
      </button>
    </article>
  {/each}

</div>

<!-- ── LookAheadModal overlay ───────────────────────────────────────────────── -->
{#if lookaheadItem}
  <LookAheadModal
    item={lookaheadItem}
    on:confirm={onConfirmReveal}
    on:cancel={onCancelReveal}
  />
{/if}

<!-- ── CorrectionPanel overlay ──────────────────────────────────────────────── -->
{#if correctionItem}
  <CorrectionPanel item={correctionItem} on:close={onCloseCorrection} />
{/if}

<style>
  /* ─── List container ──────────────────────────────────────────────────────── */

  .passages-list {
    display: flex;
    flex-direction: column;
  }

  /* ─── Passage item ────────────────────────────────────────────────────────── */

  .passage-item {
    position: relative;
    padding-block: var(--space-4);
    border-bottom: 1px solid var(--rule);
  }

  .passage-item:last-child {
    border-bottom: none;
  }

  /* ─── Byline ──────────────────────────────────────────────────────────────── */

  .passage-byline {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: baseline;
    margin-bottom: var(--space-2);
  }

  .passage-location {
    color: var(--muted);
  }

  /* ─── Passage text ────────────────────────────────────────────────────────── */

  .passage-text {
    font-family: var(--font-serif);
    font-size: var(--text-base);
    line-height: 1.6;
    color: var(--ink);
    margin: 0;
  }

  /* ─── Drop-cap (first visible item only) ─────────────────────────────────── */

  .passage-item--featured .passage-text::first-letter {
    font-size: 3.25em;
    line-height: 0.82;
    float: left;
    margin-right: 0.05em;
    margin-top: 0.06em;
    font-weight: 500;
    color: var(--ink);
  }

  /* ─── Revealed item ───────────────────────────────────────────────────────── */

  /* No fog overlay — item is intentionally visible with the ↪ tag. */
  .passage-item--revealed {
    border-left: 2px solid var(--accent-bg);
    padding-left: var(--space-3);
  }

  /* ─── Flag button (hover-revealed) ───────────────────────────────────────── */

  .flag-btn {
    position: absolute;
    top: var(--space-4);
    right: 0;
    background: none;
    border: none;
    cursor: pointer;
    font-size: var(--text-sm);
    color: var(--accent);
    padding: var(--space-1) var(--space-2);
    opacity: 0;
    transition: opacity 100ms ease;
    line-height: 1;
  }

  .passage-item:hover .flag-btn {
    opacity: 1;
  }

  .flag-btn:focus-visible {
    opacity: 1;
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 2px;
  }

  /* ─── Fogged item ─────────────────────────────────────────────────────────── */

  .passage-item--fogged {
    border-left: 2px solid var(--rule);
    padding-left: var(--space-3);
  }

  /* Fog wrapper — needs position:relative for ::after pseudo-element. */
  .fogged-text {
    position: relative;
  }

  /* ─── Per-item look-ahead affordance (hover-revealed) ────────────────────── */

  .look-ahead-item-btn {
    display: block;
    margin-top: var(--space-2);
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    font-size: var(--text-sm);
    font-family: var(--font-sans);
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 2px;
    opacity: 0;
    transition: opacity 100ms ease;
  }

  .passage-item--fogged:hover .look-ahead-item-btn {
    opacity: 1;
  }

  .look-ahead-item-btn:focus-visible {
    opacity: 1;
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 2px;
  }
</style>
