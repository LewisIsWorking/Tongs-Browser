import { readFileSync } from 'node:fs';

import { defineConfig } from 'vite';

/**
 * The version baked into the bundle at build time.
 *
 * ⚠️ Not the same thing as `game.modules.get(id).version`, which is what a diagnostic naturally
 * reaches for and which lied for eight releases. Foundry reads module.json ONCE at server start and
 * caches it, so overwriting module files under a running server leaves the reported version frozen
 * at whatever was installed when the server booted. A build stamp cannot drift from the code it was
 * built with, which is the only property that matters when someone is telling you what they are
 * running.
 */
const packageVersion = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

/**
 * Foundry loads the module as a single ES module plus a single stylesheet, and the filenames are
 * hardcoded in module.json. If these names drift, Foundry silently loads nothing, so the output
 * names are pinned explicitly rather than left to Vite's defaults.
 */
export default defineConfig({
  define: {
    __TB_BUILD_VERSION__: JSON.stringify(packageVersion),
  },
  build: {
    lib: {
      entry: 'src/main.ts',
      formats: ['es'],
      fileName: () => 'tongs-browser.js',
    },
    // A single stylesheet, never split, so assetFileNames below can name it deterministically.
    cssCodeSplit: false,
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    // Left unminified on purpose. The bundle is small, and readable stack traces in Chrome devtools
    // on a physical Android device are worth far more here than a few saved kilobytes.
    minify: false,
    target: 'es2022',
    rollupOptions: {
      output: {
        assetFileNames: 'tongs-browser.[ext]',
      },
    },
  },
});
