<!--
  CharactersPanel.svelte — sorted character list for v1.

  Props:
    nodes — CharacterNode[] pre-sorted by scene_count_matching DESC.

  Per entry:
    - canonical_name (✕ prefix for fogged)
    - first_appearance breadcrumb ("B1 C21" or "first in B3" for fogged)
    - scene_count_matching

  Fogged nodes (past_horizon) get dimmed treatment via .fog + ✕ prefix.
  Edges are ignored in v1 (reserved for v2 graph).
-->
<script lang="ts">
  import type { CharacterNode } from './types';

  export let nodes: CharacterNode[];

  /** Returns the first-appearance breadcrumb label for a node. */
  function breadcrumb(node: CharacterNode): string {
    if (node.past_horizon) {
      return `first in B${node.first_appearance.book_id}`;
    }
    return `B${node.first_appearance.book_id} C${node.first_appearance.chapter_number}`;
  }
</script>

{#if nodes.length === 0}
  <p class="empty-state meta">No characters matched.</p>
{:else}
  {#each nodes as node (node.character_id)}
    <div class="character-node {node.past_horizon ? 'fog' : ''}">
      <span class="character-name">
        {#if node.past_horizon}<span class="fog-glyph" aria-hidden="true">✕</span>{/if}{node.canonical_name}
      </span>
      <span class="character-right meta">
        <span class="character-breadcrumb">{breadcrumb(node)}</span>
        <span class="character-count">{node.scene_count_matching}</span>
      </span>
    </div>
  {/each}
{/if}

<style>
  .empty-state {
    padding-block: var(--space-4);
    color: var(--whisper);
  }

  .character-node {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-3);
    padding-block: var(--space-2);
    border-bottom: 1px solid var(--rule);
    font-size: var(--text-sm);
  }

  .character-node:last-child {
    border-bottom: none;
  }

  .character-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .fog-glyph {
    margin-right: var(--space-1);
    color: var(--whisper);
    font-size: var(--text-xs);
  }

  .character-right {
    display: flex;
    gap: var(--space-3);
    align-items: baseline;
    flex-shrink: 0;
  }

  .character-breadcrumb {
    color: var(--whisper);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
  }

  .character-count {
    font-variant-numeric: tabular-nums;
    min-width: 1.5ch;
    text-align: right;
  }
</style>
