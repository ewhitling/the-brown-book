import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { copyFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import type { Plugin } from "vite";

/**
 * Copies data/botns.db → web/static/botns.db before the build starts.
 * The static/ directory is served verbatim by Vite and copied into dist/.
 */
function copyDbPlugin(): Plugin {
  return {
    name: "copy-botns-db",
    buildStart() {
      const src = resolve(__dirname, "../data/botns.db");
      const destDir = resolve(__dirname, "static");
      const dest = resolve(destDir, "botns.db");
      mkdirSync(destDir, { recursive: true });
      copyFileSync(src, dest);
      console.log("[copy-botns-db] copied data/botns.db → web/static/botns.db");
    },
  };
}

export default defineConfig({
  plugins: [svelte(), copyDbPlugin()],

  // Files in static/ are served as-is and copied verbatim into dist/ at build time.
  // This is where botns.db lands (copied by the plugin above) and where favicon.svg lives.
  publicDir: "static",

  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
