import type { RecordedMutation } from './shape.ts';

/**
 * World swaps' mutations. Added 2026-09-20.
 *
 * Each is a rule whose loss still beats, still prompts and still answers: the GM sees a dialog every
 * thirty seconds, or answers for a world that is not theirs, or gives an answer COO never hears.
 */
export const SWAP_MUTATIONS: readonly RecordedMutation[] = [
  {
    file: 'src/swaps/WorldSwapGm.ts',
    find: '    if (request.state !== AWAITING || this.seen.has(request.id)) {',
    replace: '    if (request.state !== AWAITING) {',
    defect:
      'the same request opens a fresh dialog on every heartbeat, stacking windows over the table',
    tests: ['tests/unit/worldSwapGm.test.ts'],
  },
  {
    file: 'src/swaps/WorldSwapGm.ts',
    find: '      this.seen.delete(request.id);',
    replace: '      void request;',
    defect:
      'an answer that never reached ComeOnOverUno is never asked again, so the request quietly expires',
    tests: ['tests/unit/worldSwapGm.test.ts'],
  },
  {
    file: 'src/swaps/startWorldSwaps.ts',
    find: "      settings.get(MODULE_ID, APPROVE_SETTING) !== false && automationRole(globals) === 'act',",
    replace: '      true,',
    defect:
      'every GM browser beats and prompts, including an Assistant and a second tab, and the setting cannot switch it off',
    tests: ['tests/unit/startWorldSwaps.test.ts'],
  },
  {
    file: 'src/swaps/startWorldSwaps.ts',
    find: '      return answer === true;',
    replace: '      return true;',
    defect:
      "a dialog the GM closed, or that failed to open, reads as 'yes' and closes the world they are playing in",
    tests: ['tests/unit/startWorldSwaps.test.ts'],
  },
];
