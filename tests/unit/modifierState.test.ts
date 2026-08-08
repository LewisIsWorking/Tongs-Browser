import { describe, expect, it } from 'vitest';

import {
  ALL_OFF,
  KeyLatch,
  MODIFIER_CODES,
  anyHeld,
  clearAll,
  consumeLatched,
  cycle,
  diff,
  isHeld,
  release,
  toModifierFlags,
  toggle,
} from '../../src/modifiers/ModifierState.js';

describe('modifier latch cycle', () => {
  /**
   * Three states rather than a boolean because the two useful behaviours conflict. Clearing after
   * one use is right for a single shift click; staying held is right for rotating a token through
   * several drags. A boolean would force a choice between them.
   */
  it('advances OFF to LATCHED to LOCKED and back to OFF', () => {
    expect(cycle(KeyLatch.OFF)).toBe(KeyLatch.LATCHED);
    expect(cycle(KeyLatch.LATCHED)).toBe(KeyLatch.LOCKED);
    expect(cycle(KeyLatch.LOCKED)).toBe(KeyLatch.OFF);
  });

  it('reaches LOCKED by tapping twice, which is what double tap to lock means', () => {
    let latches = ALL_OFF;
    latches = toggle(latches, 'ShiftLeft');
    latches = toggle(latches, 'ShiftLeft');

    expect(latches.ShiftLeft).toBe(KeyLatch.LOCKED);
  });

  it('treats both LATCHED and LOCKED as held', () => {
    expect(isHeld(KeyLatch.OFF)).toBe(false);
    expect(isHeld(KeyLatch.LATCHED)).toBe(true);
    expect(isHeld(KeyLatch.LOCKED)).toBe(true);
  });
});

describe('modifier map operations', () => {
  it('never mutates the map it is given', () => {
    const before = ALL_OFF;
    const after = toggle(before, 'ControlLeft');

    expect(before.ControlLeft).toBe(KeyLatch.OFF);
    expect(after.ControlLeft).toBe(KeyLatch.LATCHED);
    expect(after).not.toBe(before);
  });

  it('toggles one key without touching the others', () => {
    const latches = toggle(ALL_OFF, 'AltLeft');

    expect(latches.AltLeft).toBe(KeyLatch.LATCHED);
    expect(latches.ControlLeft).toBe(KeyLatch.OFF);
    expect(latches.ShiftLeft).toBe(KeyLatch.OFF);
  });

  it('releases a key from any state directly to OFF', () => {
    const locked = toggle(toggle(ALL_OFF, 'ShiftLeft'), 'ShiftLeft');
    expect(release(locked, 'ShiftLeft').ShiftLeft).toBe(KeyLatch.OFF);
  });

  it('reports whether anything is held', () => {
    expect(anyHeld(ALL_OFF)).toBe(false);
    expect(anyHeld(toggle(ALL_OFF, 'ShiftLeft'))).toBe(true);
  });

  it('clears everything', () => {
    const busy = toggle(toggle(ALL_OFF, 'ShiftLeft'), 'ControlLeft');
    expect(anyHeld(clearAll())).toBe(false);
    expect(anyHeld(busy)).toBe(true);
  });
});

describe('consumeLatched', () => {
  /**
   * The distinction that makes the tri-state worth having: an action clears the latched keys and
   * leaves the locked ones alone.
   */
  it('clears latched keys but leaves locked ones held', () => {
    let latches = toggle(ALL_OFF, 'ShiftLeft');
    latches = toggle(toggle(latches, 'ControlLeft'), 'ControlLeft');

    expect(latches.ShiftLeft).toBe(KeyLatch.LATCHED);
    expect(latches.ControlLeft).toBe(KeyLatch.LOCKED);

    const consumed = consumeLatched(latches);
    expect(consumed.ShiftLeft).toBe(KeyLatch.OFF);
    expect(consumed.ControlLeft).toBe(KeyLatch.LOCKED);
  });

  it('is a no op when nothing is latched', () => {
    const locked = toggle(toggle(ALL_OFF, 'AltLeft'), 'AltLeft');
    expect(consumeLatched(locked)).toEqual(locked);
  });
});

describe('diff', () => {
  /**
   * Only genuine held or released changes are reported, because re-pressing an already held key
   * would send a duplicate keydown, which Foundry reads as auto repeat.
   */
  it('reports a key becoming held', () => {
    expect(diff(ALL_OFF, toggle(ALL_OFF, 'ShiftLeft'))).toEqual([
      { code: 'ShiftLeft', held: true },
    ]);
  });

  it('reports a key being released', () => {
    const latched = toggle(ALL_OFF, 'ShiftLeft');
    expect(diff(latched, ALL_OFF)).toEqual([{ code: 'ShiftLeft', held: false }]);
  });

  it('reports nothing when moving between two held states', () => {
    const latched = toggle(ALL_OFF, 'ShiftLeft');
    const locked = toggle(latched, 'ShiftLeft');

    expect(locked.ShiftLeft).toBe(KeyLatch.LOCKED);
    expect(diff(latched, locked)).toEqual([]);
  });

  it('reports nothing when nothing changed', () => {
    expect(diff(ALL_OFF, ALL_OFF)).toEqual([]);
  });
});

describe('toModifierFlags', () => {
  it('projects held keys onto the flags carried by synthesised pointer events', () => {
    const latches = toggle(toggle(ALL_OFF, 'ShiftLeft'), 'AltLeft');

    expect(toModifierFlags(latches)).toEqual({
      ctrlKey: false,
      shiftKey: true,
      altKey: true,
      metaKey: false,
    });
  });

  it('treats locked the same as latched, since both mean held', () => {
    const locked = toggle(toggle(ALL_OFF, 'ControlLeft'), 'ControlLeft');
    expect(toModifierFlags(locked).ctrlKey).toBe(true);
  });

  it('never reports meta, which the bar does not offer', () => {
    expect(toModifierFlags(ALL_OFF).metaKey).toBe(false);
  });
});

describe('modifier codes', () => {
  /**
   * Foundry's keybinding system matches on KeyboardEvent.code throughout, so these must be the
   * physical key codes and not the logical key names. An event carrying only key is invisible to it.
   */
  it('uses physical key codes rather than logical key names', () => {
    expect(MODIFIER_CODES).toEqual(['ControlLeft', 'ShiftLeft', 'AltLeft']);
  });
});
