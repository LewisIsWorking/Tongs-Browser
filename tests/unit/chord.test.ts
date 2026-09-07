import { describe, expect, it } from 'vitest';

import { sendChord, type ChordPorts } from '../../src/modifiers/Chord.js';
import { CONTROL, UNDO_KEY, type KeyDefinition } from '../../src/modifiers/keyDefinitions.js';

/**
 * Sending a modifier plus a key as one action. Written 2026-09-07.
 *
 * ⚠️ ONE ORDERED LOG rather than a call count per method, for the reason the target key test records
 * in full: order IS the contract here, and three arrays by kind pass whether the modifier goes down
 * before the key or after it. Before is the only one that sends Ctrl+Z; after sends a bare Z.
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

describe('sendChord', () => {
  /** ⛔ The contract: modifier down, key tapped, modifier up, in that order and no other. */
  it('holds the modifier across the key and lets go after', () => {
    const { ports, log } = recorder();

    sendChord(ports, [CONTROL], UNDO_KEY);

    expect(log).toEqual(['press ControlLeft', 'tap KeyZ', 'release ControlLeft']);
  });

  /**
   * ⚠️ Released in REVERSE, so a two modifier chord unwinds the way a hand would. Nothing depends on
   * it with one modifier; asserting it now is what stops the second one being added wrongly.
   */
  it('releases several modifiers in the reverse of the order it pressed them', () => {
    const { ports, log } = recorder();
    const shift: KeyDefinition = {
      code: 'ShiftLeft',
      key: 'Shift',
      keyCode: 16,
      label: 'Shift',
      sticky: true,
    };

    sendChord(ports, [CONTROL, shift], UNDO_KEY);

    expect(log).toEqual([
      'press ControlLeft',
      'press ShiftLeft',
      'tap KeyZ',
      'release ShiftLeft',
      'release ControlLeft',
    ]);
  });

  /** ⚠️ No modifiers is a plain tap, not an error. It keeps the caller free of a special case. */
  it('sends a bare tap when there are no modifiers', () => {
    const { ports, log } = recorder();

    sendChord(ports, [], UNDO_KEY);

    expect(log).toEqual(['tap KeyZ']);
  });
});

describe('the undo definitions', () => {
  /** ⚠️ Foundry matches on `code`, so these are the fields that decide whether undo happens at all. */
  it('name the codes Foundry binds undo to', () => {
    expect(CONTROL.code).toBe('ControlLeft');
    expect(UNDO_KEY.code).toBe('KeyZ');
  });
});
