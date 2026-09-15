import { vi } from 'vitest';

import { CAMPAIGN_SETTING } from '../../../src/bands/startBands.js';

/**
 * A world with one goblin in combat and the active full GM, for driving health bands through their real
 * hooks. Split out of `bandsFlow.test.ts` 2026-09-15 when the cause tests needed the same world.
 */
export const world = (campaign: unknown = 'C06') => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const hooks = {
    on(this: unknown, name: string, fn: (...args: never[]) => unknown) {
      handlers.set(name, fn as (...args: unknown[]) => void);
      return handlers.size;
    },
    off: vi.fn(),
  };
  const goblin = {
    uuid: undefined as string | undefined,
    isToken: true,
    hasPlayerOwner: false,
    alliance: 'opposition',
    system: { attributes: { hp: { value: 28, max: 28 } }, traits: { value: ['goblin'] } },
    token: null as unknown,
  };
  goblin.token = {
    id: 'G',
    uuid: 'Scene.S.Token.G',
    name: 'Goblin',
    playersCanSeeName: true,
    actor: goblin,
  };
  const warn = vi.fn();
  const globals = {
    game: {
      user: { id: 'gm', role: 4 },
      users: { activeGM: { id: 'gm', role: 4 } },
      combat: { combatants: { contents: [{ tokenId: 'G', token: goblin.token as never }] } },
    },
    ui: { notifications: { warn } },
    fromUuidSync: (uuid: string) => ({ name: uuid === 'Actor.V.Item.L' ? 'Longsword' : 'Valeros' }),
  };
  const settings = {
    register: vi.fn(),
    get: (_ns: string, key: string) => (key === CAMPAIGN_SETTING ? campaign : ''),
    set: vi.fn(() => Promise.resolve()),
  };
  return { handlers, hooks, goblin, globals, settings, warn };
};
