import { vi } from 'vitest';

import { AutoApply } from '../../../src/automation/AutoApply.js';
import type { AutoApplyPorts } from '../../../src/automation/AutoApply.js';
import type { StrikeMessage } from '../../../src/automation/strikeFacts.js';

/**
 * Strike cards and a port harness for the auto-apply tests. Split from `autoApply.test.ts` at the 200
 * line limit, 2026-09-14.
 *
 * ⚠️ The cards are the measured Reinforced Stock attack and damage from pf2e 8.5.0. Every port answers
 * as a clean case would (the active full GM, a player's hit, a target standing in the fight), so each
 * test overrides only what it is about.
 */
export const TARGET = 'Scene.S.Token.X';
export const card = (
  id: string,
  timestamp: number,
  type: 'attack' | 'damage',
  outcome = 'success'
): StrikeMessage => ({
  id,
  timestamp,
  isDamageRoll: type === 'damage',
  speaker: { actor: 'A' },
  author: { id: 'player' },
  flags: {
    pf2e: {
      context:
        type === 'attack'
          ? { type: 'attack-roll', outcome, target: { token: TARGET } }
          : {
              type: 'damage-roll',
              sourceType: 'attack',
              outcome: 'success',
              target: { token: TARGET },
            },
      origin: { uuid: 'Actor.A.Item.W' },
      ...(type === 'damage' ? { strike: { index: 1 } } : {}),
    },
  },
  ...(type === 'damage'
    ? { rolls: [{ formula: '1d8 + 3 bludgeoning', total: 7, minimumValue: 4, maximumValue: 11 }] }
    : {}),
});

export const harness = (overrides: Partial<AutoApplyPorts> = {}, log: StrikeMessage[] = []) => {
  const flags = new Map<string, unknown>();
  const ports: AutoApplyPorts = {
    role: () => 'act',
    myUserId: () => 'player',
    systemId: () => 'pf2e',
    recentMessages: () => log,
    flag: (message, key) => flags.get(`${message.id}.${key}`),
    isHandled: () => false,
    authorIsPlayer: () => true,
    attackerIsPlayers: () => true,
    targetState: () => ({
      exists: true,
      hp: 100,
      inCombat: true,
      playerOwned: false,
    }),
    apply: vi.fn(() => Promise.resolve({ kind: 'applied' as const })),
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
  return { auto: new AutoApply(ports), ports, flags };
};

export const attack = card('a1', 1_000, 'attack');
export const damage = card('d1', 1_088, 'damage');
