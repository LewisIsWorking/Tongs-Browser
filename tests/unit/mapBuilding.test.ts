import { describe, expect, it } from 'vitest';

import { buildMapBuildingCommands } from '../../src/modifiers/MapBuilding.js';
import type { ChordPorts } from '../../src/modifiers/Chord.js';
import type { KeyDefinition } from '../../src/modifiers/keyDefinitions.js';

/**
 * The six GM map-building commands. Written 2026-09-09.
 *
 * ⚠️ ONE ORDERED LOG, matching `chord.test.ts`, because order is the contract: the modifier has to be
 * down BEFORE the key's keydown, since that keydown is what carries `ctrlKey`. Counting calls per
 * method passes whether Ctrl goes down first or last, and only first sends Ctrl+X.
 */
const recorder = (): { ports: ChordPorts; log: string[] } => {
  const log: string[] = [];
  return {
    log,
    ports: {
      press: (definition: KeyDefinition) => log.push(`press ${definition.code}`),
      release: (definition: KeyDefinition) => log.push(`release ${definition.code}`),
      tap: (definition: KeyDefinition) => log.push(`tap ${definition.code}`),
    },
  };
};

describe('the map-building chords', () => {
  /**
   * ⛔ THE ASSERTION WITH TEETH. A command that sends the wrong key compiles, renders a button, and
   * fails silently on a GM's phone: Foundry simply does not act, which is indistinguishable from the
   * synthesizer not working. The exact code is the only thing that decides whether it happens.
   *
   * ✅ The codes come from `scripts/keybindings/snapshot.ts`, read out of Foundry 14.366's own
   * registration file rather than from memory.
   */
  it.each([
    ['selectAll', 'KeyA'],
    ['cut', 'KeyX'],
    ['copy', 'KeyC'],
    ['paste', 'KeyV'],
  ] as const)('sends %s as Ctrl held across %s', (command, code) => {
    const { ports, log } = recorder();

    buildMapBuildingCommands(ports)[command]();

    expect(log).toEqual([`press ControlLeft`, `tap ${code}`, `release ControlLeft`]);
  });
});

describe('the map-building keys that are NOT chords', () => {
  /**
   * ⛔ THE BUG THIS FILE EXISTS FOR. Foundry binds sendToBack and bringToFront to the BARE bracket
   * keys, not to Ctrl+bracket. The six commands are alike in what they are for, so the natural
   * mistake is to assume they are alike in how they are sent. A Ctrl-wrapped bracket is a chord
   * Foundry does not bind, so the button would look exactly like the four beside it and do nothing.
   *
   * ⚠️ Asserting the FULL log, not just that a tap happened, is what makes this fail: a version that
   * wrapped these in Ctrl would still tap the bracket, and an assertion that only checked the tap
   * would pass while the command was dead.
   */
  it.each([
    ['sendToBack', 'BracketLeft'],
    ['bringToFront', 'BracketRight'],
  ] as const)('sends %s as a bare %s with no modifier at all', (command, code) => {
    const { ports, log } = recorder();

    buildMapBuildingCommands(ports)[command]();

    expect(log).toEqual([`tap ${code}`]);
  });

  /** ⚠️ Stated as its own claim, so "no Ctrl anywhere" survives a rewrite of the cases above. */
  it('never presses a modifier for the z-order pair', () => {
    const { ports, log } = recorder();
    const commands = buildMapBuildingCommands(ports);

    commands.sendToBack();
    commands.bringToFront();

    expect(log.some((entry) => entry.includes('Control'))).toBe(false);
  });
});

describe('the map-building command set', () => {
  /**
   * ⚠️ All six, checked as a set. `TrayActionHandlers` names each one, so a missing command is a type
   * error rather than a silent absence. But the set is what the tray spreads in, and a command that
   * exists under a different name would satisfy the type and route nowhere.
   */
  it('offers exactly the six commands the tray spreads in', () => {
    const { ports } = recorder();

    expect(Object.keys(buildMapBuildingCommands(ports)).sort()).toEqual([
      'bringToFront',
      'copy',
      'cut',
      'paste',
      'selectAll',
      'sendToBack',
    ]);
  });
});
