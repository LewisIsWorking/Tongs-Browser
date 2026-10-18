import type { RecordedMutation } from './shape.ts';

/**
 * Dual class's mutations. Added 2026-10-12 with `src/dualclass`.
 *
 * Each still builds a class and still answers the player: from every GM tab, or for somebody else's sheet,
 * or with the community macro's own three bugs back in it.
 */
export const DUAL_CLASS_MUTATIONS: readonly RecordedMutation[] = [
  {
    file: 'src/dualclass/DualClassRequests.ts',
    find: '    if (!this.ports.isDesignatedGm()) {',
    replace: '    if (false) {',
    defect: 'every GM tab answers the same request, and the GM is told twice',
    tests: ['tests/unit/dualClassRequests.test.ts'],
  },
  {
    file: 'src/dualclass/DualClassRequests.ts',
    find: '    if (this.running) {',
    replace: '    if (false) {',
    defect: 'the answer wakes the GM side mid-pass and the same request is answered twice',
    tests: ['tests/unit/dualClassRequests.test.ts'],
  },
  {
    file: 'src/dualclass/DualClassRequests.ts',
    find: '    if (!sheet.owned) {',
    replace: '    if (false) {',
    defect: "a player writes a request by hand and gives somebody else's character a dual class",
    tests: ['tests/unit/dualClassRequests.test.ts'],
  },
  {
    file: 'src/dualclass/dualClassDocuments.ts',
    find: 'owned: level >= OWNER_LEVEL',
    replace: 'owned: level >= 1',
    defect: 'a sheet the player can only see counts as theirs to dual class',
    tests: ['tests/unit/dualClassDocuments.test.ts'],
  },
  {
    file: 'src/dualclass/buildDualClass.ts',
    find: "['heavy', 'light', 'medium', 'unarmored']",
    replace: "['heavy', 'light', 'unarmored']",
    defect: "the macro's typo back: a Wizard - Ranger gets no medium armour",
    tests: ['tests/unit/buildDualClass.test.ts'],
  },
  {
    file: 'src/dualclass/buildDualClass.ts',
    find: "  mine['rules'] = rules.filter((rule) => !raisesMartial(rule, martial));",
    replace:
      '  rules.forEach((rule, i) => { if (raisesMartial(rule, martial)) rules.splice(i, 1); });',
    defect: "the macro's splice back: of two martial rules in a row, the second stays on the class",
    tests: ['tests/unit/buildDualClassRules.test.ts'],
  },
  {
    file: 'src/dualclass/landDualClass.ts',
    find: '.flatMap((item) => (item.id === null ? [] : [item.id]))',
    replace: ".map((item) => item.id ?? '')",
    defect: 'a class copy with no id is the one kept, and the real dual class is deleted',
    tests: ['tests/unit/landDualClass.test.ts'],
  },
];
