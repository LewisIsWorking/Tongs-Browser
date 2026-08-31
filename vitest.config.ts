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

      /**
       * ⚠️ THE TARGET IS 100%, and these numbers are the ratchet that gets there. Added 2026-08-30.
       *
       * Until now this block read "thresholds are switched on alongside the pointer core, once there
       * is logic worth measuring". That day passed a long time ago: 95.66% of statements across 30-odd
       * files. Coverage was PRINTED and never GATED. `test:coverage` existed and neither `verify` nor
       * CI ran it, so the figure only appeared when somebody typed the command, and nothing anywhere
       * would have gone red if it fell.
       *
       * `autoUpdate` is what makes this a ratchet rather than a floor: when coverage rises, Vitest
       * rewrites these numbers, so the gain is locked in and cannot be given back. When it falls, the
       * run fails. The numbers below are therefore a HIGH WATER MARK, not a target, and the only
       * direction they move is up. They are seeded at the measured values on the day the gate was
       * switched on rather than at 100, because a threshold nothing can currently satisfy gets turned
       * off within the week.
       *
       * ⚠️ Coverage is a floor on what is EXECUTED, never evidence that anything was ASSERTED. A test
       * written to move these numbers, with no expected value in it, raises the percentage and proves
       * nothing. Mutation testing is the check that separates the two; see docs/MANUAL-TESTING.md.
       */
      thresholds: {
        autoUpdate: true,
        statements: 98.19,
        branches: 96.51,
        functions: 98.52,
        lines: 98.17,
      },
    },
  },
});
