import { describe, expect, it, vi } from 'vitest';

import { buildAutoApply } from '../../src/automation/buildAutoApply.js';
import type { AutoGlobals } from '../../src/automation/buildAutoApply.js';
import type { StrikeDamageFacts } from '../../src/automation/strikeFacts.js';
import type { RollDeck } from '../../src/deck/RollDeck.js';

/** The real Foundry behind the automation. ⛔ Fakes read `this`, so a detached call fails here. */
class Strike {
  public readonly seen: object[] = [];
  public async damage(this: Strike, params: object): Promise<unknown> {
    this.seen.push({ kind: 'damage', ...params });
    return Promise.resolve('1d8 + 3 bludgeoning');
  }
  public async critical(this: Strike, params: object): Promise<unknown> {
    this.seen.push({ kind: 'critical', ...params });
    return Promise.resolve('2 * (1d8 + 3) bludgeoning');
  }
}

const world = () => {
  const strike = new Strike();
  const flags = new Map<string, unknown>();
  const token = { actor: { hasPlayerOwner: false, system: { attributes: { hp: { value: 30 } } } } };
  const message = {
    id: 'd1',
    timestamp: 1,
    flags: { pf2e: { context: { type: 'attack-roll', dc: 20 } } },
    getFlag(this: { id: string }, scope: string, key: string) {
      return flags.get(`${this.id}.${scope}.${key}`);
    },
    async setFlag(this: { id: string }, scope: string, key: string, value: unknown) {
      flags.set(`${this.id}.${scope}.${key}`, value);
      return Promise.resolve();
    },
    async unsetFlag(this: { id: string }, scope: string, key: string) {
      flags.delete(`${this.id}.${scope}.${key}`);
      return Promise.resolve();
    },
  };
  const globals: AutoGlobals = {
    game: {
      user: { id: 'gm', role: 4, isGM: true },
      users: { activeGM: { id: 'gm', role: 4 } },
      system: { id: 'pf2e' },
      messages: {
        get(this: unknown, id: string) {
          return id === 'd1' || id === 'a1' ? message : undefined;
        },
      },
      actors: {
        get(this: unknown, id: string) {
          return id === 'A'
            ? { hasPlayerOwner: true, system: { actions: [strike, strike] } }
            : undefined;
        },
      },
      combat: {
        combatants: {
          some(this: unknown, test: (c: { tokenId?: string }) => boolean) {
            return [{ tokenId: 'X' }].some(test);
          },
        },
      },
    },
    canvas: {
      scene: { id: 'S' },
      tokens: {
        get(this: unknown, id: string) {
          return id === 'X' ? token : undefined;
        },
      },
    },
  };
  const deck = { apply: vi.fn(async () => Promise.resolve({ kind: 'applied' as const })) };
  return {
    ports: buildAutoApply(globals, deck as unknown as RollDeck),
    strike,
    flags,
    token,
    deck,
  };
};

const damage = (overrides: Partial<StrikeDamageFacts> = {}): StrikeDamageFacts => ({
  id: 'd1',
  timestamp: 2,
  actorId: 'A',
  itemUuid: 'W',
  targetToken: 'Scene.S.Token.X',
  outcome: 'success',
  authorId: 'p',
  strikeIndex: 1,
  formula: '1d8 + 3 bludgeoning',
  total: 7,
  min: 4,
  max: 11,
  ...overrides,
});

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
  it("asks the strike, on the strike, with the attack's context and the target token", async () => {
    const { ports, strike, token } = world();

    expect(await ports.recomputeFormula(damage(), 'a1')).toBe('1d8 + 3 bludgeoning');
    expect(await ports.recomputeFormula(damage({ outcome: 'criticalSuccess' }), 'a1')).toBe(
      '2 * (1d8 + 3) bludgeoning'
    );
    expect(strike.seen[0]).toEqual({
      kind: 'damage',
      getFormula: true,
      target: token,
      checkContext: { type: 'attack-roll', dc: 20 },
    });
    expect(strike.seen[1]).toMatchObject({ kind: 'critical' });
  });

  it('is null when the strike is missing, throws, or answers with no formula', async () => {
    const { ports, strike } = world();

    expect(await ports.recomputeFormula(damage({ strikeIndex: 5 }), 'a1')).toBeNull();
    strike.damage = () => Promise.reject(new Error('no'));
    expect(await ports.recomputeFormula(damage(), 'a1')).toBeNull();
    strike.damage = () => Promise.resolve({ not: 'a formula' });
    expect(await ports.recomputeFormula(damage(), 'a1')).toBeNull();
  });
});

describe('the target as it is now', () => {
  it('reads an enemy standing in the combat on this scene', () => {
    expect(world().ports.targetState('Scene.S.Token.X')).toEqual({
      elsewhere: false,
      exists: true,
      hp: 30,
      inCombat: true,
      playerOwned: false,
    });
  });

  it('reads another scene as elsewhere, and a missing token as gone', () => {
    const { ports } = world();

    expect(ports.targetState('Scene.Other.Token.X')).toMatchObject({
      elsewhere: true,
      exists: false,
    });
    expect(ports.targetState('Scene.S.Token.Gone')).toMatchObject({
      elsewhere: false,
      exists: false,
      hp: null,
      inCombat: false,
    });
    expect(ports.targetState('not a token')).toMatchObject({ exists: false, inCombat: false });
  });
});
