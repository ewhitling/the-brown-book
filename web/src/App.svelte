<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import About from './lib/About.svelte';
  import FooterChrome from './lib/FooterChrome.svelte';

  let scene: 'entry' | 'workshop' | 'about' = 'entry';

  function resolveScene(): typeof scene {
    const hash = window.location.hash;
    if (hash === '#/about') return 'about';
    return 'entry';
  }

  function onHashChange() {
    scene = resolveScene();
  }

  onMount(() => {
    scene = resolveScene();
    window.addEventListener('hashchange', onHashChange);
  });

  onDestroy(() => {
    window.removeEventListener('hashchange', onHashChange);
  });
</script>

{#if scene === 'about'}
  <About />
{:else}
  <!-- Entry / Workshop placeholder — filled by later tasks -->
  <main class="shell">
    <h1 style="font-family: var(--font-serif); padding-block: 2rem;">
      The Brown Book
    </h1>
  </main>
{/if}

<div class="shell">
  <FooterChrome />
</div>

<style>
  :global(body) {
    background: var(--paper);
  }
</style>
