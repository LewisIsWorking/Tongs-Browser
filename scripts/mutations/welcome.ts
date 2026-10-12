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
  /* 2026-10-12: the sheet cap and companion sheets. */
  {
    file: 'src/welcome/SheetRequests.ts',
    find: '    if (count !== undefined && count.owned >= count.allowed) {',
    replace: '    if (false) {',
    defect: 'a player at the cap writes a request flag by hand and gets a third sheet anyway',
    tests: ['tests/unit/sheetCap.test.ts'],
  },
  {
    file: 'src/welcome/welcomeDocuments.ts',
    find: '      !isCompanionSheet(actor)\n',
    replace: '      true\n',
    defect: "a player's animal companion counts as their second sheet, so their grant is used up",
    tests: ['tests/unit/sheetCap.test.ts'],
  },
  {
    file: 'src/welcome/Companions.ts',
    find: '        if (made.includes(kind.kind) || this.failed.has(key)) {',
    replace: '        if (this.failed.has(key)) {',
    defect: 'a companion the GM deleted is made again on the next actor update',
    tests: ['tests/unit/companions.test.ts'],
  },
  {
    file: 'src/welcome/Companions.ts',
    find: '    if (!this.ports.isDesignatedGm()) {',
    replace: '    if (false) {',
    defect: 'every open GM tab makes its own familiar for the same character',
    tests: ['tests/unit/companions.test.ts'],
  },
];
