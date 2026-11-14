import { describe, expect, it } from 'vitest';

import { levelNotes, readPendingLevel, setsPendingLevel } from '../../src/levels/pendingLevel.js';

/**
 * A pending level's rules, 2026-11-14: what a script outside Foundry may write on an actor, and which
 * `updateActor` changes set it. The flag's shape is relied on by that script, so it is pinned here.
 */
const flagged = (value: unknown) => ({ flags: { 'tongs-browser': { pendingLevel: value } } });

describe('reading a pending level', () => {
  it('takes a whole number from 1 to 20, lowering included', () => {
    expect(readPendingLevel(flagged(7))).toEqual({ kind: 'level', level: 7 });
    expect(readPendingLevel(flagged(1))).toEqual({ kind: 'level', level: 1 });
    expect(readPendingLevel(flagged(20))).toEqual({ kind: 'level', level: 20 });
  });

  it('refuses anything else, without guessing what was meant', () => {
    for (const value of [0, 21, 99, -3, 7.5, '7', null, true, Number.NaN, { level: 7 }]) {
      expect(readPendingLevel(flagged(value))).toEqual({ kind: 'invalid', value });
    }
  });

  it('finds nothing on an actor with no flag, or only other flags', () => {
    expect(readPendingLevel({})).toEqual({ kind: 'none' });
    expect(readPendingLevel({ flags: null })).toEqual({ kind: 'none' });
    expect(readPendingLevel({ flags: { 'tongs-browser': 'odd' } })).toEqual({ kind: 'none' });
    expect(readPendingLevel({ flags: { 'tongs-browser': { other: 7 } } })).toEqual({
      kind: 'none',
    });
    expect(readPendingLevel({ flags: { pf2e: { pendingLevel: 7 } } })).toEqual({ kind: 'none' });
    expect(readPendingLevel(flagged(undefined))).toEqual({ kind: 'none' });
  });
});

describe('which changes set it', () => {
  it('is a change naming the flag, whatever its value', () => {
    expect(setsPendingLevel(flagged(7))).toBe(true);
    expect(setsPendingLevel(flagged('junk'))).toBe(true);
  });

  it('is never the level or HP write made while applying it, nor its own removal', () => {
    expect(setsPendingLevel({ system: { details: { level: { value: 7 } } } })).toBe(false);
    expect(setsPendingLevel({ flags: { 'tongs-browser': { '-=pendingLevel': null } } })).toBe(
      false
    );
    expect(setsPendingLevel({ flags: { pf2e: { pendingLevel: 7 } } })).toBe(false);
    expect(setsPendingLevel(null)).toBe(false);
    expect(setsPendingLevel('flags')).toBe(false);
  });
});

describe('what the GM is told', () => {
  it('names the actor and the level', () => {
    expect(levelNotes.levelled('Hero', 7)).toBe('Tongs levelled Hero to 7');
    expect(levelNotes.invalid('Hero', '7')).toBe(
      'Tongs ignored the pending level "7" on Hero: it must be a whole number from 1 to 20. The flag is cleared.'
    );
    expect(levelNotes.failed('Hero', 7, new Error('no class'))).toContain(
      'Tongs could not level Hero to 7: no class.'
    );
    expect(levelNotes.failed('Hero', 7, 'offline')).toContain('to 7: offline.');
    expect(levelNotes.unchanged('Hero', 7)).toContain('already at level 7');
  });
});
