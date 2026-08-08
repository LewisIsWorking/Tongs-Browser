import { defineConfig } from 'vite';

/**
 * Foundry loads the module as a single ES module plus a single stylesheet, and the filenames are
 * hardcoded in module.json. If these names drift, Foundry silently loads nothing, so the output
 * names are pinned explicitly rather than left to Vite's defaults.
 */
export default defineConfig({
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
