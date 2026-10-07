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
  {
    file: 'src/automation/SaveSummary.ts',
    find: '    this.queue = turn.catch(() => undefined);',
    replace: '    this.queue = Promise.resolve();',
    defect: 'a spell at two targets whose saves land together posts two saves cards',
    tests: ['tests/unit/saveSummary.test.ts'],
  },
  {
    file: 'src/automation/startSpellSaves.ts',
    find: "    message.applyMode?.('blind');",
    replace: '',
    defect: 'the players see the save Tongs rolled, number and all, beside the card that hides it',
    tests: ['tests/unit/spellSaveForCast.test.ts'],
  },
];
