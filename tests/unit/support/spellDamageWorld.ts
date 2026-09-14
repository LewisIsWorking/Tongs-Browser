import { vi } from 'vitest';

import { SpellDamage } from '../../../src/automation/SpellDamage.js';
import type { SpellDamagePorts } from '../../../src/automation/SpellDamage.js';
import type { SpellMessage } from '../../../src/automation/spellDamageFacts.js';
import type { TargetState } from '../../../src/automation/targetCheck.js';

/**
 * Cards and a port harness for the basic-save spell damage tests. Written 2026-09-14.
 *
 * ⚠️ The cards are the measured rank 5 Vampiric Feast: a cast card carrying the caster's recorded
 * targets, one saving-throw card per target with the spell's uuid on `origin`, and a damage card with
 * `sourceType "save"`, no target and no outcome.
 */
export const X1 = 'Scene.S.Token.X1';
export const X2 = 'Scene.S.Token.X2';
const SPELL = { uuid: 'Actor.Caster.Item.Feast', castRank: 5 };
export const ENEMY: TargetState = {
  elsewhere: false,
  exists: true,
  hp: 100,
  inCombat: true,
  playerOwned: false,
};

export const cast: SpellMessage = {
  id: 'c1',
  timestamp: 1_000,
  speaker: { actor: 'Caster' },
  flags: {
    pf2e: { context: { type: 'spell-cast' }, origin: SPELL },
    'tongs-browser': { targets: [X1, X2] },
  },
};

export const saveCard = (id: string, token: string, outcome: string, timestamp = 1_500) => ({
  id,
  timestamp,
  flags: { pf2e: { context: { type: 'saving-throw', outcome, target: { token } }, origin: SPELL } },
});

export const damageCard: SpellMessage = {
  id: 'd1',
  timestamp: 2_000,
  isDamageRoll: true,
  speaker: { actor: 'Caster' },
  author: { id: 'player' },
  flags: { pf2e: { context: { type: 'damage-roll', sourceType: 'save' }, origin: SPELL } },
  rolls: [{ formula: '10d6 void', total: 24, minimumValue: 10, maximumValue: 60 }],
};

export const SAVES = [saveCard('s1', X1, 'success'), saveCard('s2', X2, 'failure')];

export const harness = (
  overrides: Partial<SpellDamagePorts> = {},
  messages: readonly SpellMessage[] = [cast, ...SAVES, damageCard],
  states: Record<string, TargetState> = {}
) => {
  const flags = new Map<string, unknown>();
  const ports: SpellDamagePorts = {
    role: () => 'act',
    myUserId: () => 'player',
    systemId: () => 'pf2e',
    moduleId: 'tongs-browser',
    recentMessages: () => messages,
    flag: (message, key) => flags.get(`${message.id}.${key}`),
    isHandled: () => false,
    authorIsPlayer: () => true,
    attackerIsPlayers: () => true,
    targetState: (token) => states[token] ?? ENEMY,
    spellRule: () => Promise.resolve({ formula: '10d6 void', basic: true }),
    applyGroups: vi.fn(() => Promise.resolve({ kind: 'applied' as const })),
    setFlag: (id, key, value) => {
      flags.set(`${id}.${key}`, value);
      return Promise.resolve();
    },
    unsetFlag: (id, key) => {
      flags.delete(`${id}.${key}`);
      return Promise.resolve();
    },
    ...overrides,
  };
  return { damage: new SpellDamage(ports), ports, flags };
};
