import { defineConfig } from 'vitest/config';

/**
 * Two projects, deliberately separated.
 *
 * The pointer engine is built as pure functions that take a state object and return ordered event
 * descriptors, with a separate thin dispatcher performing the actual DOM work. The "unit" project
 * runs in plain node with no DOM at all, which enforces that split: if a sequence builder ever
 * reaches for document or window, its test fails immediately rather than quietly passing under
 * jsdom. The "dom" project covers dispatch ordering, hover transitions, and exclusion zones.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['tests/dom/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/types/**'],
      // Thresholds are switched on alongside the pointer core, once there is logic worth measuring.
    },
  },
});
