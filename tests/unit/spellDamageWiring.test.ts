import { describe, expect, it, vi } from 'vitest';

import type { AutoGlobals } from '../../src/automation/buildAutoApply.js';
import { readSaveResult, readSpellDamage } from '../../src/automation/spellDamageFacts.js';
import { readSpellCast } from '../../src/automation/spellFacts.js';
import {
  SPELL_DAMAGE_SETTING,
  buildSpellDamagePorts,
  registerSpellDamageSetting,
  startSpellDamage,
} from '../../src/automation/startSpellDamage.js';
import { logger } from '../../src/core/Logger.js';
import type { RollDeck } from '../../src/deck/RollDeck.js';
import { cast, damageCard, saveCard } from './support/spellDamageWorld.js';

/**
 * Reading spell damage and save cards, the spell's own rule at its cast rank, and the setting and hooks.
 * Written 2026-09-14.
 */
describe('reading the cards', () => {
  it('reads the measured damage, save and cast cards, and nothing that is not one', () => {
    expect(readSpellDamage(damageCard, 'pf2e')).toEqual({
      id: 'd1',
      timestamp: 2_000,
      actorId: 'Caster',
      authorId: 'player',
      spellUuid: 'Actor.Caster.Item.Feast',
      castRank: 5,
      formula: '10d6 void',
      total: 24,
      min: 10,
      max: 60,
    });
    expect(readSaveResult(saveCard('s1', 'Scene.S.Token.X1', 'failure'), 'pf2e')).toEqual({
      id: 's1',
      timestamp: 1_500,
      spellUuid: 'Actor.Caster.Item.Feast',
      tokenUuid: 'Scene.S.Token.X1',
      outcome: 'failure',
    });
    expect(readSpellCast(cast, 'pf2e')?.castRank).toBe(5);

    const strike = { pf2e: { context: { type: 'damage-roll', sourceType: 'attack' }, origin: {} } };
    expect(readSpellDamage({ ...damageCard, flags: strike }, 'pf2e')).toBeNull();
    expect(readSpellDamage({ ...damageCard, rolls: [{ formula: '1d6' }] }, 'pf2e')).toBeNull();
    expect(readSpellDamage(damageCard, 'sf2e')).toBeNull();
    expect(readSaveResult(damageCard, 'pf2e')).toBeNull();
  });

  it('reads a damage card with no rank and no author as unknown, not as zero', () => {
    const bare = {
      ...damageCard,
      author: null,
      flags: {
        pf2e: { context: { type: 'damage-roll', sourceType: 'save' }, origin: { uuid: 'S' } },
      },
    };
    expect(readSpellDamage(bare, 'pf2e')).toMatchObject({ castRank: null, authorId: null });
  });
});

describe("the spell's own rule", () => {
  const world = (spell: object | undefined): AutoGlobals =>
    ({
      game: {
        actors: {
          get(this: unknown, id: string) {
            return id === 'C'
              ? { items: { get: (item: string) => (item === 'S' ? spell : undefined) } }
              : undefined;
          },
        },
      },
    }) as unknown as AutoGlobals;
  const spell = (formula: unknown, basic = true) => ({
    rank: 3,
    system: { defense: { save: { basic } } },
    loadVariant(this: { rank: number }, options: { castRank: number }) {
      return { ...this, rank: options.castRank };
    },
    async getDamage(this: { rank: number }) {
      return Promise.resolve({
        template: { damage: { roll: { formula: `${String(formula)} r${String(this.rank)}` } } },
      });
    },
  });

  it('asks the spell at the cast rank, called on its own object', async () => {
    const ports = buildSpellDamagePorts(world(spell('2d6')), {} as RollDeck);

    expect(await ports.spellRule('Actor.C.Item.S', 5)).toEqual({ formula: '2d6 r5', basic: true });
    expect(await ports.spellRule('Actor.C.Item.S', null)).toEqual({
      formula: '2d6 r3',
      basic: true,
    });
  });

  it('knows nothing of a spell it cannot find, a formula it cannot read, or a spell that throws', async () => {
    const unread = { system: {}, getDamage: () => Promise.resolve({}), loadVariant: () => null };
    const throws = { getDamage: () => Promise.reject(new Error('no')) };

    expect(
      await buildSpellDamagePorts(world(undefined), {} as RollDeck).spellRule('Actor.C.Item.S', 5)
    ).toBeNull();
    expect(
      await buildSpellDamagePorts(world(spell('x')), {} as RollDeck).spellRule(
        'Scene.S.Token.T.Actor.C.Item.S',
        5
      )
    ).toBeNull();
    expect(
      await buildSpellDamagePorts(world(unread), {} as RollDeck).spellRule('Actor.C.Item.S', 5)
    ).toEqual({ formula: null, basic: false });
    expect(
      await buildSpellDamagePorts(world(throws), {} as RollDeck).spellRule('Actor.C.Item.S', 5)
    ).toBeNull();
    expect(
      await buildSpellDamagePorts({}, {} as RollDeck).spellRule('Actor.C.Item.S', 5)
    ).toBeNull();
  });

  it("applies through the deck's own groups", async () => {
    const applyGroups = vi.fn(() => Promise.resolve({ kind: 'applied' as const }));
    const groups = [{ optionId: 'half' as const, targetTokenUuids: ['Scene.S.Token.X1'] }];

    await buildSpellDamagePorts({}, { applyGroups } as unknown as RollDeck).applyGroups(
      'd1',
      groups
    );

    expect(applyGroups).toHaveBeenCalledWith('d1', groups);
  });
});

describe('the setting and the hooks', () => {
  it('registers its own world setting, off by default', () => {
    const register = vi.fn();
    registerSpellDamageSetting({ register, get: () => undefined });
    expect(register).toHaveBeenCalledWith(
      'tongs-browser',
      SPELL_DAMAGE_SETTING,
      expect.objectContaining({ scope: 'world', default: false })
    );
  });

  it('catches up at start, acts only while switched on, and logs a failure', async () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const hooks = {
      on(this: unknown, name: string, fn: (...args: never[]) => unknown) {
        handlers.set(name, fn as (...args: unknown[]) => void);
        return handlers.size;
      },
    };
    let enabled = true;
    const recent = vi.fn(() => []);
    const globals = {
      game: {
        user: { id: 'gm', role: 4, isGM: true },
        users: { activeGM: { id: 'gm', role: 4 } },
        messages: {
          get contents() {
            return recent();
          },
        },
      },
    };
    startSpellDamage({} as RollDeck, hooks, { register: vi.fn(), get: () => enabled }, globals);
    expect([...handlers.keys()].sort()).toEqual([
      'canvasReady',
      'createChatMessage',
      'userConnected',
    ]);
    expect(recent).toHaveBeenCalledTimes(1);
    enabled = false;
    handlers.get('canvasReady')?.();
    expect(recent).toHaveBeenCalledTimes(1);

    enabled = true;
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    recent
      .mockImplementationOnce(() => {
        throw new Error('log gone');
      })
      .mockImplementationOnce(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- a non-Error rejection is the case
        throw 'not an error';
      });
    handlers.get('canvasReady')?.();
    handlers.get('userConnected')?.();
    handlers.get('createChatMessage')?.({ id: 'x', timestamp: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warn).toHaveBeenCalledWith('Spell damage failed: log gone');
    expect(warn).toHaveBeenCalledWith('Spell damage failed: not an error');
    warn.mockRestore();
  });
});
