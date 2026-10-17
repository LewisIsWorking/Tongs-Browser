import { describe, expect, it, vi } from 'vitest';

import {
  answerDualClass,
  dualClassSheet,
  pendingDualClasses,
} from '../../src/dualclass/dualClassDocuments.js';
import type { DualClassGame } from '../../src/dualclass/dualClassDocuments.js';

/** The GM's user and actor reads for dual class, and that a player gets none of them. 2026-10-12. */
const REQUEST = {
  id: 'r1',
  actorId: 'A1',
  first: 'Compendium.pf2e.classes.Item.F',
  second: 'Compendium.pf2e.classes.Item.W',
  at: 1,
};
const flagged =
  (value: unknown) =>
  (scope: string, key: string): unknown =>
    scope === 'tongs-browser' && key === 'dualClassRequest' ? value : undefined;

function game(isGM = true, ownership: Record<string, number> = { u1: 3 }) {
  const update = vi.fn(async () => Promise.resolve());
  const actors: Record<
    string,
    { name: string | null; type: string; ownership: Record<string, number> }
  > = {
    A1: { name: 'Kibwe', type: 'character', ownership },
    N1: { name: 'Goblin', type: 'npc', ownership: { u1: 3 } },
    U1: { name: null, type: 'character', ownership: { u1: 3 } },
  };
  const world: DualClassGame = {
    user: { isGM },
    users: {
      contents: [
        { id: 'gm', name: 'GM', isGM: true, getFlag: flagged(REQUEST) },
        { id: 'u1', name: 'Lai', getFlag: flagged(REQUEST), update },
        { id: 'u2', name: null, getFlag: flagged(REQUEST) },
        { id: null, name: 'Ghost', getFlag: flagged(REQUEST) },
        { id: 'u3', name: 'Ryo', getFlag: flagged({ id: 'broken' }) },
        { id: 'u4', name: 'Ana' },
      ],
    },
    actors: { get: (id) => actors[id] },
  };
  return { world, update };
}

describe('pending requests', () => {
  it('lists each player with a well formed request, never a GM or a nameless id', () => {
    expect(pendingDualClasses(game().world)).toEqual([
      { userId: 'u1', userName: 'Lai', request: REQUEST },
      { userId: 'u2', userName: 'A player', request: REQUEST },
    ]);
  });

  it('lists nothing to a player', () => {
    expect(pendingDualClasses(game(false).world)).toEqual([]);
    expect(pendingDualClasses(undefined)).toEqual([]);
    expect(pendingDualClasses({ user: { isGM: true } })).toEqual([]);
  });
});

describe('the sheet a request names', () => {
  it('is the asker’s when they have Foundry’s OWNER level on it', () => {
    expect(dualClassSheet(game().world, 'A1', 'u1')).toEqual({ name: 'Kibwe', owned: true });
  });

  it('is not theirs when they can only observe it', () => {
    expect(dualClassSheet(game(true, { u1: 2 }).world, 'A1', 'u1')?.owned).toBe(false);
    expect(dualClassSheet(game().world, 'A1', 'u9')?.owned).toBe(false);
  });

  it('is theirs when everyone owns it by default, unless they are given less', () => {
    expect(dualClassSheet(game(true, { default: 3 }).world, 'A1', 'u1')?.owned).toBe(true);
    expect(dualClassSheet(game(true, { default: 3, u1: 1 }).world, 'A1', 'u1')?.owned).toBe(false);
  });

  it('is no sheet when it is missing, not a character, or asked for by a player', () => {
    expect(dualClassSheet(game().world, 'GONE', 'u1')).toBeNull();
    expect(dualClassSheet(game().world, 'N1', 'u1')).toBeNull();
    expect(dualClassSheet(game(false).world, 'A1', 'u1')).toBeNull();
    expect(dualClassSheet({ user: { isGM: true } }, 'A1', 'u1')).toBeNull();
  });

  it('names an unnamed sheet', () => {
    expect(dualClassSheet(game().world, 'U1', 'u1')?.name).toBe('their character');
  });

  it('reads a sheet with no ownership as nobody’s', () => {
    const world: DualClassGame = {
      user: { isGM: true },
      actors: { get: () => ({ name: 'Kibwe', type: 'character' }) },
    };
    expect(dualClassSheet(world, 'A1', 'u1')?.owned).toBe(false);
  });
});

describe('the answer', () => {
  it('clears the request and writes the answer in ONE update on the asker', async () => {
    const { world, update } = game();
    const result = { kind: 'refused', requestId: 'r1', reason: 'No.' } as const;
    await answerDualClass(world, 'u1', result);
    expect(update).toHaveBeenCalledExactlyOnceWith({
      'flags.tongs-browser.-=dualClassRequest': null,
      'flags.tongs-browser.dualClassResult': result,
    });
  });

  it('writes nothing from a player’s browser, or to a user who is not there', async () => {
    const { world, update } = game(false);
    await answerDualClass(world, 'u1', { kind: 'refused', requestId: 'r1', reason: 'No.' });
    await answerDualClass(game().world, 'u9', { kind: 'refused', requestId: 'r1', reason: 'No.' });
    await answerDualClass({ user: { isGM: true } }, 'u1', {
      kind: 'refused',
      requestId: 'r1',
      reason: 'No.',
    });
    expect(update).not.toHaveBeenCalled();
  });
});
