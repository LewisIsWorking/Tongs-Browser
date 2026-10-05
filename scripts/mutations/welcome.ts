import type { RecordedMutation } from './shape.ts';

/**
 * The new-player welcome's mutations. Added 2026-10-05.
 *
 * Each still makes a sheet and still answers the player: just twice, or from every GM tab at once, or
 * with somebody else's sheet counted as theirs, so the welcome never shows.
 */
export const WELCOME_MUTATIONS: readonly RecordedMutation[] = [
  {
    file: 'src/welcome/SheetRequests.ts',
    find: '    if (!this.ports.isDesignatedGm()) {',
    replace: '    if (false) {',
    defect:
      'every GM and Assistant browser serves the same request, so the player gets one sheet per open tab',
    tests: ['tests/unit/sheetRequests.test.ts'],
  },
  {
    file: 'src/welcome/SheetRequests.ts',
    find: '    if (made !== null) {',
    replace: '    if (false) {',
    defect: 'a pass that made the sheet but failed to answer makes a second sheet on the next pass',
    tests: ['tests/unit/sheetRequests.test.ts'],
  },
  {
    file: 'src/welcome/SheetRequests.ts',
    find: '    if (this.running) {',
    replace: '    if (false) {',
    defect:
      'the answer fires updateUser, which starts a second pass alongside the first and makes the sheet twice',
    tests: ['tests/unit/sheetRequests.test.ts'],
  },
  {
    file: 'src/welcome/welcomeDocuments.ts',
    find: "    (actor) => actor.type === 'character' && actor.isOwner === true",
    replace: "    (actor) => actor.type === 'character' && actor.isOwner !== false",
    defect: 'a sheet the player can only see counts as theirs, so a new player is never welcomed',
    tests: ['tests/unit/welcomeDocuments.test.ts'],
  },
  {
    file: 'src/welcome/welcomeDocuments.ts',
    find: '    return user.isGM === true || user.id === null || request === null',
    replace: '    return user.id === null || request === null',
    defect: 'a stale request on a GM account makes a sheet for the GM, who already sees everything',
    tests: ['tests/unit/welcomeDocuments.test.ts'],
  },
];
