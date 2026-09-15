import { vi } from 'vitest';

import { SpellSaves } from '../../../src/automation/SpellSaves.js';
import type { SpellSavePorts } from '../../../src/automation/SpellSaves.js';
import type { CastMessage } from '../../../src/automation/spellFacts.js';
import type { TargetState } from '../../../src/automation/targetCheck.js';

/**
 * A cast card and a port harness for the spell-saves tests. Split from `spellSaves.test.ts` at the 200
 * line limit, 2026-09-14.
 *
 * ⚠️ The cast card is the measured Daze cast: `context.type "spell-cast"`, the spell's uuid on `origin`,
 * a `spell-save` button, and the targets the caster's browser recorded.
 */
export const X1 = 'Scene.S.Token.X1';
export const X2 = 'Scene.S.Token.X2';
export const ENEMY: TargetState = {
  exists: true,
  hp: 100,
  inCombat: true,
  playerOwned: false,
};

export const castCard = (targets: string[] = [X1, X2]): CastMessage => ({
  id: 'c1',
  timestamp: 1,
  speaker: { actor: 'Caster' },
  flags: {
    pf2e: {
      context: { type: 'spell-cast' },
      origin: { uuid: 'Actor.Caster.Item.Daze', type: 'spell' },
    },
    'tongs-browser': { targets },
  },
});

export const harness = (
  overrides: Partial<SpellSavePorts> = {},
  states: Record<string, TargetState> = {}
) => {
  const flags = new Map<string, unknown>();
  const ports: SpellSavePorts = {
    role: () => 'act',
    systemId: () => 'pf2e',
    moduleId: 'tongs-browser',
    recentMessages: () => [castCard()],
    flag: (message, key) => flags.get(`${message.id}.${key}`),
    isHandled: () => false,
    authorIsPlayer: () => true,
    attackerIsPlayers: () => true,
    targetState: (token) => states[token] ?? ENEMY,
    saveControls: () => [{ statistic: 'will', dc: 21, control: 'spell-save', index: 0 }],
    rollSave: vi.fn(() => Promise.resolve({ kind: 'rolled' as const })),
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
  return { saves: new SpellSaves(ports), ports, flags };
};
