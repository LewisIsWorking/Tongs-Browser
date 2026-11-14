import type { RecordedMutation } from './shape.ts';

/**
 * Pending levels' mutations. Added 2026-11-14.
 *
 * Each is a rule whose loss still levels the actor, just wrongly: past PF2e's highest level, twice, with
 * prompts piled on top of each other, or again at every launch.
 */
export const LEVEL_MUTATIONS: readonly RecordedMutation[] = [
  {
    file: 'src/levels/pendingLevel.ts',
    find: '&& value >= LOWEST && value <= HIGHEST',
    replace: '&& value >= LOWEST',
    defect: 'a pending level of 21 or 99 is applied, past the highest level PF2e has',
    tests: ['tests/unit/pendingLevel.test.ts'],
  },
  {
    file: 'src/levels/startPendingLevels.ts',
    find: '    failure = { error };',
    replace: '    throw error;',
    defect:
      'a level change that fails leaves the flag behind, so it is tried again at every launch and stops the rest',
    tests: ['tests/unit/applyPendingLevels.test.ts'],
  },
  {
    file: 'src/levels/startPendingLevels.ts',
    find: '  const next = queue.then(job);',
    replace: '  const next = job();',
    defect:
      'a flag set while the launch sweep waits on a ChoiceSet prompt is applied at once, piling prompts up',
    tests: ['tests/unit/startPendingLevels.test.ts'],
  },
  {
    file: 'src/levels/startPendingLevels.ts',
    find: '    if (setsPendingLevel(changes) && isDesignatedGm()) {',
    replace: '    if (setsPendingLevel(changes)) {',
    defect: 'with two GMs online, both level the actor and every ChoiceSet prompt is asked twice',
    tests: ['tests/unit/startPendingLevels.test.ts'],
  },
  {
    file: 'src/levels/startPendingLevels.ts',
    find: '  if (isDesignatedGm()) {',
    replace: '  if (true) {',
    defect: 'with two GMs online, both launch sweeps level every flagged actor',
    tests: ['tests/unit/startPendingLevels.test.ts'],
  },
];
