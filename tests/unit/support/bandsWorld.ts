import { vi } from 'vitest';

/**
 * A world with a goblin and a player character in combat, and the active full GM, for driving health
 * bands through their real hooks. Split out of `bandsFlow.test.ts` 2026-09-15 when the cause tests
 * needed the same world. `campaign` is the flag on the character's party, since campaigns are per party.
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
      user: { id: 'gm', role: 4, isGM: true },
      actors: [
        {
          type: 'party',
          uuid: 'Actor.Party',
          name: 'Party',
          getFlag: () => campaign,
          system: { details: { members: [{ uuid: 'Actor.PC' }] } },
        },
      ],
      users: { activeGM: { id: 'gm', role: 4 } },
      combat: {
        combatants: {
          contents: [
            { tokenId: 'G', token: goblin.token as never, actor: goblin as never },
            {
              tokenId: 'P',
              token: null,
              actor: { uuid: 'Actor.PC', type: 'character', hasPlayerOwner: true },
            },
          ],
        },
      },
    },
    ui: { notifications: { warn } },
    fromUuidSync: (uuid: string) => ({ name: uuid === 'Actor.V.Item.L' ? 'Longsword' : 'Valeros' }),
  };
  const settings = {
    register: vi.fn(),
    get: () => '',
    set: vi.fn(() => Promise.resolve()),
  };
  return { handlers, hooks, goblin, globals, settings, warn };
};
