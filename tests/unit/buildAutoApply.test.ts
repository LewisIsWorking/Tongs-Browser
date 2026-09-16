import { describe, expect, it } from 'vitest';

import { OPTIONS, damage, world } from './support/buildAutoApplyWorld.js';

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

describe("PF2e's own formula", () => {
  it("rolls the strike with no message, on the strike, with the attack's context and the target token", async () => {
    const { ports, strike, token } = world();

    expect(await ports.recomputeFormula(damage(), 'a1')).toBe('1d8 + 3 bludgeoning');
    expect(await ports.recomputeFormula(damage({ outcome: 'criticalSuccess' }), 'a1')).toBe(
      '2 * (1d8 + 3) bludgeoning'
    );
    expect(strike.seen[0]).toEqual({
      kind: 'damage',
      createMessage: false,
      target: { document: token },
      checkContext: { type: 'attack-roll', dc: 20, options: OPTIONS },
      options: ['target:distance:10', 'target:range-increment:1'],
      event: { shiftKey: false, ctrlKey: false, metaKey: false },
    });
    expect(strike.seen[1]).toMatchObject({ kind: 'critical' });
  });

  /*
   * ⛔ Found live 2026-09-16: Diabla's aimed crit on Ovvat was declined. PF2e's getFormula is view only and
   * drops the target, so the Aim die (`target:mark:aim`) was missing from the formula it was checked against.
   */
  it('never asks for a view-only formula, which leaves out damage that depends on the target', async () => {
    const { ports, strike } = world();
    await ports.recomputeFormula(damage({ outcome: 'criticalSuccess' }), 'a1');
    expect(strike.seen[0]).not.toHaveProperty('getFormula');
    expect(strike.seen[0]).toMatchObject({ createMessage: false });
  });

  it('skips the damage dialog whichever way this GM has it set, and survives a card with no options', async () => {
    const shown = world(true);
    await shown.ports.recomputeFormula(damage(), 'a1');
    expect(shown.strike.seen[0]).toMatchObject({ event: { shiftKey: true } });

    const bare = world();
    await bare.ports.recomputeFormula(damage({ id: 'unknown' }), 'a1');
    expect(bare.strike.seen[0]).toMatchObject({ options: [] });
  });

  /* ⛔ PF2e falls back to the GM's own target when given none, so an unfound target is still passed. */
  it("never lets PF2e fall back to the GM's own target", async () => {
    const { ports, strike } = world();
    await ports.recomputeFormula(damage({ targetToken: 'Scene.S.Token.Gone' }), 'a1');
    await ports.recomputeFormula(damage({ targetToken: null }), 'a1');
    expect(strike.seen.map((each) => (each as { target: unknown }).target)).toEqual([
      { document: null },
      { document: null },
    ]);
  });

  it('is null when the strike is missing, throws, or answers with no formula', async () => {
    const { ports, strike } = world();

    expect(await ports.recomputeFormula(damage({ strikeIndex: 5 }), 'a1')).toBeNull();
    strike.damage = () => Promise.reject(new Error('no'));
    expect(await ports.recomputeFormula(damage(), 'a1')).toBeNull();
    strike.damage = () => Promise.resolve({ not: 'a formula' });
    expect(await ports.recomputeFormula(damage(), 'a1')).toBeNull();
    strike.damage = () => Promise.resolve(null);
    expect(await ports.recomputeFormula(damage(), 'a1')).toBeNull();
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
