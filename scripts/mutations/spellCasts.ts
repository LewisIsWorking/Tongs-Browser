import type { RecordedMutation } from './shape.ts';

/**
 * Which cast a spell save answers. Added 2026-10-07 from C04, where one Daze rolled three Will saves
 * and the damage was applied by the wrong one. Each defect here still rolls a save and still applies
 * damage by a degree of success, so every count looks right.
 */
export const SPELL_CAST_MUTATIONS: readonly RecordedMutation[] = [
  {
    file: 'src/automation/validateSpellDamage.ts',
    find: '          : run.some((member) => member.id === each.castId))',
    replace: '          : true)',
    defect: "a save Tongs rolled for an earlier cast decides a later cast's damage",
    tests: ['tests/unit/spellSaveForCast.test.ts'],
  },
  {
    file: 'src/automation/SpellSaves.ts',
    find: '    return recastRun(self, [...casts, self], damages)[0] !== self;',
    replace: '    return false;',
    defect: 'a cast card posted again moments later rolls the same save a second time',
    tests: ['tests/unit/spellSaveForCast.test.ts'],
  },
];
