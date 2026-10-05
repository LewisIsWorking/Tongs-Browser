import type { RecordedMutation } from './shape.ts';

/**
 * The ComeOnOverUno import's mutations. Added 2026-10-05.
 *
 * Each still imports a character: just onto a GM's screen, or twice, or with whatever the file says.
 */
export const WELCOME_IMPORT_MUTATIONS: readonly RecordedMutation[] = [
  {
    file: 'src/welcome/startImport.ts',
    find: '  if (globals.game?.user?.isGM === true) {',
    replace: '  if (false) {',
    defect:
      "a GM's browser, which owns every sheet, applies the player's import and PF2e's choices wait unseen on the GM's screen",
    tests: ['tests/unit/startImport.test.ts'],
  },
  {
    file: 'src/welcome/startImport.ts',
    find: '        sheet.getFlag?.(MODULE_ID, IMPORT_DONE_FLAG) === true ||',
    replace: '        false ||',
    defect:
      'the import runs again on every visit, asking the player the same PF2e choices each time',
    tests: ['tests/unit/startImport.test.ts'],
  },
  {
    file: 'src/welcome/applyImport.ts',
    find: '      if (ports.has(item.type, item.name)) {',
    replace: '      if (false) {',
    defect: 'a resumed import, or a feature the class already granted, is added a second time',
    tests: ['tests/unit/applyImport.test.ts'],
  },
  {
    file: 'src/welcome/importBuild.ts',
    find: "  if (!ITEM_TYPES.includes(type as ImportItemType) || name === '') {",
    replace: "  if (name === '') {",
    defect: 'any item type the file names is accepted, so an export can ask for weapons and loot',
    tests: ['tests/unit/importBuild.test.ts'],
  },
  {
    file: 'src/welcome/ImportPicker.ts',
    find: '    if (file.size > MAX_IMPORT_BYTES) {',
    replace: '    if (false) {',
    defect: 'any file, of any size, is read into the page and onto the request flag',
    tests: ['tests/dom/importPicker.test.ts'],
  },
];
