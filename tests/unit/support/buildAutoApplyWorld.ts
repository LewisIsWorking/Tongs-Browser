/**
 * The real Foundry behind the automation, faked for `buildAutoApply`'s tests. Moved here 2026-09-16 when
 * the strike formula tests outgrew the file.
 */
import { vi } from 'vitest';

import { buildAutoApply } from '../../../src/automation/buildAutoApply.js';
import type { AutoGlobals } from '../../../src/automation/buildAutoApply.js';
import type { StrikeDamageFacts } from '../../../src/automation/strikeFacts.js';
import type { RollDeck } from '../../../src/deck/RollDeck.js';

/** A card's roll options: the distance ones are the canvas's, the rest are worked out afresh. */
export const OPTIONS = [
  'target:distance:10',
  'target:range-increment:1',
  'target:mark:aim',
  7,
  'self:x',
];

/** The real Foundry behind the automation. ⛔ Fakes read `this`, so a detached call fails here. */
class Strike {
  public readonly seen: object[] = [];
  public async damage(this: Strike, params: object): Promise<unknown> {
    this.seen.push({ kind: 'damage', ...params });
    return Promise.resolve({ formula: '1d8 + 3 bludgeoning', total: 7 });
  }
  public async critical(this: Strike, params: object): Promise<unknown> {
    this.seen.push({ kind: 'critical', ...params });
    return Promise.resolve({ formula: '2 * (1d8 + 3) bludgeoning', total: 14 });
  }
}

export const world = (dialogs = false) => {
  const strike = new Strike();
  const flags = new Map<string, unknown>();
  const token = { actor: { hasPlayerOwner: false, system: { attributes: { hp: { value: 30 } } } } };
  const message = {
    id: 'd1',
    timestamp: 1,
    flags: { pf2e: { context: { type: 'attack-roll', dc: 20, options: OPTIONS } } },
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
      user: { id: 'gm', role: 4, isGM: true, settings: { showDamageDialogs: dialogs } },
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
      combats: {
        contents: [
          { started: true, combatants: { contents: [{ tokenId: 'Other', sceneId: 'S' }] } },
          { started: true, combatants: { contents: [{ tokenId: 'X', sceneId: 'S' }] } },
        ],
      },
    },
    /* Any scene: Foundry's own lookup, which the deck and the automation both use since 2026-09-15. */
    fromUuidSync: (uuid: string) =>
      uuid === 'Scene.S.Token.X' || uuid === 'Scene.ELSEWHERE.Token.Y' ? token : undefined,
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

export const damage = (overrides: Partial<StrikeDamageFacts> = {}): StrikeDamageFacts => ({
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
