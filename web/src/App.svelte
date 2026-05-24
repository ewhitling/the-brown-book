<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import About from './lib/About.svelte';
  import Entry from './lib/Entry.svelte';
  import FooterChrome from './lib/FooterChrome.svelte';
  import { loadReadingPosition } from './lib/storage';

  let scene: 'entry' | 'workshop' | 'about' = 'entry';

  function resolveScene(): typeof scene {
    const hash = window.location.hash;
    if (hash === '#/about') return 'about';
    if (hash === '#/workshop') return 'workshop';
    return 'entry';
  }

  function onHashChange() {
    scene = resolveScene();
  }

  onMount(() => {
    // Returning visit: saved position skips Entry and lands at /workshop.
    const saved = loadReadingPosition();
    if (saved && !window.location.hash) {
      window.location.hash = '#/workshop';
    }

    scene = resolveScene();
    window.addEventListener('hashchange', onHashChange);
  });

  onDestroy(() => {
    window.removeEventListener('hashchange', onHashChange);
  });
</script>

{#if scene === 'about'}
  <About />
{:else if scene === 'workshop'}
  <!-- Workshop placeholder — filled by TASK-021 -->
  <main class="shell">
    <h1 style="font-family: var(--font-serif); padding-block: 2rem;">
      Workshop
    </h1>
  </main>
{:else}
  <Entry />
{/if}

<div class="shell">
  <FooterChrome />
</div>

<style>
  :global(body) {
    background: var(--paper);
  }
</style>
