import { describe, expect, it, vi } from 'vitest';

import type { AutoGlobals } from '../../src/automation/buildAutoApply.js';
import {
  buildSpellDamagePorts,
  ENEMY_SPELLS_SETTING,
  SPELL_DAMAGE_SETTING,
  registerSpellDamageSetting,
  startSpellDamage,
} from '../../src/automation/startSpellDamage.js';
import { SPELL_SAVES_SETTING, startSpellSaves } from '../../src/automation/startSpellSaves.js';
import type { RollDeck } from '../../src/deck/RollDeck.js';

/**
 * The setting for enemies' spells on player characters, and the hooks it switches on. Written 2026-09-28.
 * ⚠️ The GM casts an enemy's spell, so the GM's own browser must record the targets: with only this setting
 * on, the players' settings off, recording still has to happen.
 */
const only =
  (key: string) =>
  (_module: string, asked: string): boolean =>
    asked === key;

const start = (get: (module: string, key: string) => boolean) => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const hooks = {
    on(this: unknown, name: string, fn: (...args: never[]) => unknown) {
      handlers.set(name, fn as (...args: unknown[]) => void);
      return handlers.size;
    },
  };
  const recent = vi.fn(() => []);
  const globals = {
    game: {
      user: {
        id: 'gm',
        role: 4,
        isGM: true,
        targets: [{ document: { uuid: 'Scene.S.Token.PC' } }],
      },
      users: { activeGM: { id: 'gm', role: 4 } },
      system: { id: 'pf2e' },
      messages: {
        get contents() {
          return recent();
        },
      },
    },
  };
  startSpellSaves({} as RollDeck, hooks, { register: vi.fn(), get }, globals, {} as Document);
  const cast = {
    id: 'c',
    timestamp: 1,
    flags: { pf2e: { context: { type: 'spell-cast' } } },
    updateSource: vi.fn(),
  };
  handlers.get('preCreateChatMessage')?.(cast, {}, {}, 'gm');
  return { cast, recent };
};

describe("enemies' spells on player characters", () => {
  it('registers as a world setting, off by default', () => {
    const register = vi.fn();
    registerSpellDamageSetting({ register, get: () => undefined });
    expect(register).toHaveBeenCalledWith(
      'tongs-browser',
      ENEMY_SPELLS_SETTING,
      expect.objectContaining({ scope: 'world', config: true, type: Boolean, default: false })
    );
  });

  it("records the GM's targets and looks at cards with only the enemies' setting on", () => {
    const { cast, recent } = start(only(ENEMY_SPELLS_SETTING));

    expect(cast.updateSource).toHaveBeenCalledWith({
      flags: { 'tongs-browser': { targets: ['Scene.S.Token.PC'] } },
    });
    expect(recent).toHaveBeenCalled();
  });

  it('records nothing and looks at nothing with every spell setting off', () => {
    const { cast, recent } = start(() => false);

    expect(cast.updateSource).not.toHaveBeenCalled();
    expect(recent).not.toHaveBeenCalled();
  });

  it("applies damage with only the enemies' setting on, and never with both off", () => {
    for (const [get, runs] of [
      [only(ENEMY_SPELLS_SETTING), true],
      [only(SPELL_DAMAGE_SETTING), true],
      [only(SPELL_SAVES_SETTING), false],
    ] as const) {
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
      startSpellDamage({} as RollDeck, { on: () => 1 }, { register: vi.fn(), get }, globals);
      expect(recent.mock.calls.length > 0).toBe(runs);
    }
  });

  /* ⛔ Found live 2026-10-03: an enemy's token is usually unlinked, so its spell lives on the token's own actor. */
  it("finds an unlinked token's spell through Foundry's own lookup", async () => {
    const token = 'Scene.S.Token.T.Actor.C.Item.S';
    const spell = {
      system: { defense: { save: { basic: true } } },
      loadVariant: () => null,
      getDamage: () =>
        Promise.resolve({ template: { damage: { roll: { formula: '2d4 electricity' } } } }),
    };
    const globals = {
      fromUuidSync: (uuid: string) => (uuid === token ? spell : undefined),
    } as AutoGlobals;

    expect(await buildSpellDamagePorts(globals, {} as RollDeck).spellRule(token, 1)).toEqual({
      formula: '2d4 electricity',
      basic: true,
    });
  });
});
