<!--
  TimelinePanel.svelte — TASK-023
  Flagship chapter timeline: one row per book, one cell per chapter.
  Cell fill height encodes match density across four distinguishable levels.
  Chapters past the reading position receive a diagonal-hatch fog overlay.
  Hover shows a tooltip with chapter title and match count.
-->
<script lang="ts">
  import type { TimelinePanel, TimelineChapter } from './types';
  import { densityLevel, fillPercent, maxMatchCount } from './timeline';

  /** The timeline panel from a QueryResult, or null when no query is active. */
  export let panel: TimelinePanel | null = null;

  $: maxMatches = maxMatchCount(panel);

  // ─── Tooltip state ────────────────────────────────────────────────────────

  let hoveredChapter: TimelineChapter | null = null;
  let tooltipX = 0;
  let tooltipY = 0;

  function onCellEnter(e: MouseEvent, ch: TimelineChapter): void {
    hoveredChapter = ch;
    updateTooltip(e);
  }

  function onCellMove(e: MouseEvent): void {
    updateTooltip(e);
  }

  function onCellLeave(): void {
    hoveredChapter = null;
  }

  function updateTooltip(e: MouseEvent): void {
    tooltipX = e.clientX + 12;
    tooltipY = e.clientY - 48;
  }
</script>

{#if panel}
  <div class="tl-panel" aria-label="Chapter timeline">

    <!-- ── Book rows ─────────────────────────────────────────────────── -->
    {#each panel.books as book (book.book_id)}
      <div class="tl-book">

        <div class="tl-book-label meta" title={book.title} aria-hidden="true">
          B{book.book_id}
        </div>

        <div
          class="tl-cells"
          role="list"
          aria-label="{book.title} chapters"
        >
          {#each book.chapters as ch (ch.chapter_id)}
            <!-- svelte-ignore a11y-interactive-supports-focus -->
            <div
              class="tl-cell density-{densityLevel(ch.matches, maxMatches)}"
              role="listitem"
              aria-label="Chapter {ch.number}: {ch.title}, {ch.matches} match{ch.matches === 1 ? '' : 'es'}{ch.past_horizon ? ', past reading position' : ''}"
              on:mouseenter={(e) => onCellEnter(e, ch)}
              on:mousemove={onCellMove}
              on:mouseleave={onCellLeave}
            >
              <div
                class="tl-fill"
                style="height: {fillPercent(ch.matches, maxMatches)}"
                aria-hidden="true"
              ></div>
              {#if ch.past_horizon}
                <div class="tl-fog" aria-hidden="true"></div>
              {/if}
            </div>
          {/each}
        </div>

      </div>
    {/each}

    <!-- ── Legend ────────────────────────────────────────────────────── -->
    <div class="tl-legend" aria-label="Legend">
      <div class="tl-legend-item">
        <div class="tl-legend-swatch swatch-match" aria-hidden="true"></div>
        <span class="meta">Evidence</span>
      </div>
      <div class="tl-legend-item">
        <div class="tl-legend-swatch swatch-fog" aria-hidden="true"></div>
        <span class="meta">Past position</span>
      </div>
    </div>

  </div>
{/if}

<!-- Floating tooltip — position: fixed keeps it above the panel grid -->
{#if hoveredChapter !== null}
  <div
    class="tl-tooltip"
    style="left: {tooltipX}px; top: {tooltipY}px;"
    role="tooltip"
    aria-hidden="true"
  >
    <div class="tl-tooltip-title">
      Ch.&nbsp;{hoveredChapter.number} — {hoveredChapter.title}
    </div>
    <div class="tl-tooltip-meta meta">
      {hoveredChapter.matches} match{hoveredChapter.matches === 1 ? '' : 'es'}{hoveredChapter.past_horizon ? ' · fogged' : ''}
    </div>
  </div>
{/if}

<style>
  /* ─── Panel wrapper ─────────────────────────────────────────────────────── */

  .tl-panel {
    width: 100%;
  }

  /* ─── Book row ──────────────────────────────────────────────────────────── */

  .tl-book {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .tl-book-label {
    flex-shrink: 0;
    width: 1.5rem;
    text-align: right;
    font-size: var(--text-xs);
    color: var(--whisper);
    /* vertically centres the label against the 40 px cell strip */
    line-height: 40px;
    user-select: none;
  }

  /* ─── Chapter cell strip ────────────────────────────────────────────────── */

  .tl-cells {
    flex: 1;
    display: flex;
    align-items: flex-end;
    gap: 1px;
    height: 40px;
  }

  .tl-cell {
    flex: 1;
    min-width: 2px;
    height: 40px;
    position: relative;
    background: var(--paper-deep);
    border-radius: 1px;
    overflow: hidden;
    cursor: default;
  }

  /* ─── Match-density fill bar ────────────────────────────────────────────── */

  .tl-fill {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    border-radius: 1px 1px 0 0;
    transition: height 120ms ease;
  }

  /* Four distinguishable density levels */
  .tl-cell.density-0 .tl-fill { background: transparent; }
  .tl-cell.density-1 .tl-fill { background: var(--accent-bg); }
  .tl-cell.density-2 .tl-fill { background: var(--accent-soft); }
  .tl-cell.density-3 .tl-fill { background: var(--accent); }

  /* ─── Fog overlay — mirrors .fog::after from app.css ───────────────────── */

  .tl-fog {
    position: absolute;
    inset: 0;
    background-color: rgba(250, 247, 240, 0.72);  /* --paper at 72 % */
    background-image: var(--fog-hatch);
    pointer-events: none;
    border-radius: inherit;
  }

  /* ─── Legend ────────────────────────────────────────────────────────────── */

  .tl-legend {
    display: flex;
    gap: var(--space-4);
    padding-top: var(--space-3);
    border-top: 1px solid var(--rule);
    margin-top: var(--space-2);
  }

  .tl-legend-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .tl-legend-swatch {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .swatch-match {
    background: var(--accent);
  }

  .swatch-fog {
    background-color: rgba(250, 247, 240, 0.72);
    background-image: var(--fog-hatch);
    border: 1px solid var(--rule);
  }

  /* ─── Tooltip ───────────────────────────────────────────────────────────── */

  .tl-tooltip {
    position: fixed;
    z-index: 100;
    pointer-events: none;
    background: var(--ink);
    color: var(--paper);
    border-radius: 4px;
    padding: var(--space-2) var(--space-3);
    max-width: 14rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .tl-tooltip-title {
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 500;
    line-height: 1.4;
    color: var(--paper);
    margin-bottom: 2px;
  }

  .tl-tooltip-meta {
    font-size: var(--text-xs);
    color: var(--whisper);
  }
</style>
