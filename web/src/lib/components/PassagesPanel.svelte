<!--
  PassagesPanel.svelte — TASK-022.

  Renders the passages panel from a PassagesPanel data object.

  Features:
  - Type-tagged byline per item: "scene · Book 1, Ch 21 · 'The Lake of Birds'"
  - Passage text in EB Garamond serif
  - Hover-revealed Flag affordance (⚑) that opens CorrectionPanel
  - Drop-cap on the first visible item (featured treatment)
  - Fog summary at bottom when past-horizon matches exist
  - Look-ahead: inline expansion of fogged items (see ADR 11.1)
  - Revealed items from localStorage persist with permanent ↪ tag

  Architectural note (ADR 11.1): look-ahead is inline expansion, not a
  per-item modal. All fogged items expand together on a single click and
  are recorded to localStorage immediately so the tag persists on reload.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { PassageItem, PassagesPanel } from '../types';
  import { isRevealed, recordReveal } from '../storage';
  import CorrectionPanel from './CorrectionPanel.svelte';

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
    revealedSet = new Set(
      panel.items
        .filter((item) => isRevealed(item.type, numericId(item.id)))
        .map((item) => item.id),
    );
  }

  // Seed on first mount.
  onMount(seedReveals);

  // Re-seed and reset session state whenever the panel data changes (new query).
  let prevPanel = panel;
  $: if (panel !== prevPanel) {
    prevPanel = panel;
    showFogged = false;
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

  /** Whether to show the fog footer (fogged items present, or flag from parent). */
  $: hasFog = foggedItems.length > 0 || hadMatchesPastHorizon;

  /** First visible item gets drop-cap featured treatment. */
  $: featuredId = visibleItems[0]?.id ?? null;

  // ─── Interaction state ────────────────────────────────────────────────────────

  /** Whether the user has clicked "Look ahead" in this session. */
  let showFogged = false;

  /** The item currently open in the correction panel, or null. */
  let correctionItem: PassageItem | null = null;

  // ─── Event handlers ───────────────────────────────────────────────────────────

  function onLookAhead(): void {
    // Record all currently-fogged items to localStorage before expanding.
    for (const item of foggedItems) {
      recordReveal(item.type, numericId(item.id));
    }
    // Merge into revealedSet so they render with ↪ tag immediately.
    revealedSet = new Set([...revealedSet, ...foggedItems.map((i) => i.id)]);
    showFogged = true;
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

  <!-- ── Session-expanded fogged items (after "Look ahead" click) ──────────── -->
  {#if showFogged}
    {#each foggedItems as item (item.id)}
      <article class="passage-item passage-item--revealed">
        <header class="passage-byline meta">
          <span class="revealed-tag">&#8618;</span>
          <span class="type-tag">{item.type}</span>
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
  {/if}

  <!-- ── Fog summary footer ─────────────────────────────────────────────────── -->
  {#if hasFog && !showFogged}
    <footer class="fog-footer meta">
      {foggedItems.length} more match{foggedItems.length === 1 ? '' : 'es'} past your reading position.
      <button class="look-ahead-btn ui" type="button" on:click={onLookAhead}>
        Look ahead &rarr;
      </button>
    </footer>
  {/if}

</div>

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

  /* ─── Fog summary footer ──────────────────────────────────────────────────── */

  .fog-footer {
    padding-block: var(--space-4);
    color: var(--muted);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    border-top: 1px dashed var(--rule);
    margin-top: var(--space-2);
  }

  .look-ahead-btn {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    font-size: var(--text-sm);
    font-family: var(--font-sans);
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .look-ahead-btn:hover {
    color: var(--accent-soft);
  }
</style>
