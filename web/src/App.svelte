<!--
  App.svelte — root component; hash-based router.

  Routes:
    #/         → Entry (first visit) or Workshop (returning visitor / URL-seeded)
    #/workshop → Workshop
    #/about    → About

  Boot sequence (SPEC.md §4):
    1. Start loading botns.db in background (parallel to UI render).
    2. Check URL search params:
         ?q=…&pos=B2C5 → route to Workshop (populated from URL)
    3. Check localStorage:
         bb:v1:position present → route to Workshop (empty)
    4. Else → Entry.

  URL wins on initial load; Workshop writes it back to localStorage.
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import About from './lib/About.svelte';
  import Entry from './lib/Entry.svelte';
  import Workshop from './lib/Workshop.svelte';
  import FooterChrome from './lib/FooterChrome.svelte';
  import { loadReadingPosition } from './lib/storage';
  import { decodeWorkshopURL } from './lib/position';
  import { loadDatabase } from './lib/db';

  type Scene = 'entry' | 'workshop' | 'about';

  let scene: Scene = 'entry';

  function resolveScene(): Scene {
    const hash = window.location.hash;
    if (hash === '#/about') return 'about';
    if (hash === '#/workshop' || hash.startsWith('#/workshop?')) return 'workshop';
    return 'entry';
  }

  function onHashChange(): void {
    scene = resolveScene();
  }

  onMount(() => {
    // Step 1: kick off DB load immediately so it runs in parallel with UI.
    loadDatabase().catch(() => { /* error surfaced later via assertSchema */ });

    // Step 2: URL params win — ?q=…&pos=B2C5 → Workshop (populated).
    const urlDecoded = decodeWorkshopURL(window.location.search);
    if (urlDecoded) {
      if (!window.location.hash) {
        window.location.hash = '#/workshop';
      }
    } else {
      // Step 3: saved position → Workshop (empty).
      const saved = loadReadingPosition();
      if (saved && !window.location.hash) {
        window.location.hash = '#/workshop';
      }
    }

    // Step 4: resolve from whatever hash is now set (may have been set above).
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
  <Workshop />
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
