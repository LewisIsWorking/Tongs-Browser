import { describe, expect, it } from 'vitest';

import { world } from './support/buildAutoApplyWorld.js';

describe('who is asking', () => {
  it('reads the role, the user and the system from the world', () => {
    const { ports } = world();

    expect(ports.role()).toBe('act');
    expect(ports.myUserId()).toBe('gm');
    expect(ports.systemId()).toBe('pf2e');
  });

  it("tells a player's message and a player's creature from the GM's", () => {
    const { ports } = world();
    const card = { id: 'd1', timestamp: 1 };

    expect(ports.authorIsPlayer({ ...card, author: { isGM: false } } as never)).toBe(true);
    expect(ports.authorIsPlayer({ ...card, author: { isGM: true } } as never)).toBe(false);
    expect(ports.authorIsPlayer(card)).toBe(false);
    expect(ports.attackerIsPlayers('A')).toBe(true);
    expect(ports.attackerIsPlayers('missing')).toBe(false);
  });
});

describe("the card's flags, and applying", () => {
  it('are set, read and removed through the message itself', async () => {
    const { ports } = world();
    const card = { id: 'd1', timestamp: 1 };

    await ports.setFlag('d1', 'handled', true);
    expect(ports.isHandled(card)).toBe(true);
    expect(ports.flag(card, 'handled')).toBe(true);
    await ports.unsetFlag('d1', 'handled');
    expect(ports.isHandled(card)).toBe(false);
  });

  it("applies through the roll deck's own apply, at full", async () => {
    const { ports, deck } = world();

    await ports.apply('d1', 'Scene.S.Token.X');

    expect(deck.apply).toHaveBeenCalledWith('d1', 'full', 'Scene.S.Token.X');
  });
});

describe('the target as it is now', () => {
  /* ⛔ Found live: the tracker showed encounter 1 while the enemy fought in encounter 4. */
  it('reads an enemy standing in any encounter, not only the one the tracker shows', () => {
    expect(world().ports.targetState('Scene.S.Token.X')).toEqual({
      exists: true,
      hp: 30,
      inCombat: true,
      playerOwned: false,
    });
  });

  /* ⛔ A limit found on Forge: a hit on a creature on a map the GM was not viewing waited until they opened it. */
  it('reads a token on a scene nobody is viewing as it is, and a missing token as gone', () => {
    const { ports } = world();

    expect(ports.targetState('Scene.ELSEWHERE.Token.Y')).toMatchObject({ exists: true, hp: 30 });
    expect(ports.targetState('Scene.S.Token.Gone')).toMatchObject({
      exists: false,
      hp: null,
      inCombat: false,
    });
    expect(ports.targetState('not a token')).toMatchObject({ exists: false, inCombat: false });
  });
});
