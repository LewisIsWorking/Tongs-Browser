import { describe, expect, it, vi } from 'vitest';

import type { CooClient } from '../../src/bands/CooClient.js';
import { CAMPAIGN_SETTING, startBands } from '../../src/bands/startBands.js';

/**
 * One HP change through the real hooks, ports and token reading, to the client. Written 2026-09-15.
 * The parts are tested alone elsewhere; this proves they are joined up.
 */
const world = () => {
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
    get: (_ns: string, key: string) => (key === CAMPAIGN_SETTING ? 'C06' : ''),
    set: vi.fn(() => Promise.resolve()),
  };
  return { handlers, hooks, goblin, globals, settings, warn };
};

describe('an HP change, end to end', () => {
  it('reaches the client with the band, and a failure reaches the GM as a warning', async () => {
    const { handlers, hooks, goblin, globals, settings, warn } = world();
    const postBand = vi.fn(() => Promise.resolve('failed' as const));
    startBands(hooks, settings, { ...globals, game: { ...globals.game, system: { id: 'pf2e' } } }, {
      postBand,
    } as unknown as CooClient);

    goblin.uuid = 'Scene.S.Token.G.Actor.A';
    goblin.system.attributes.hp.value = 13;
    handlers.get('updateActor')?.(goblin, { system: { attributes: { hp: { value: 13 } } } });
    /* PF2e's card arrives after the update, as measured; the watch was armed by the update. */
    handlers.get('createChatMessage')?.({
      flags: {
        pf2e: {
          context: { type: 'damage-taken' },
          appliedDamage: { uuid: 'Scene.S.Token.G.Actor.A', isHealing: false },
          origin: { uuid: 'Actor.V.Item.L', actor: 'Actor.V' },
        },
      },
      content:
        '<span class="iwr" data-applications="[{&quot;category&quot;:&quot;weakness&quot;,&quot;type&quot;:&quot;cold-iron&quot;,&quot;adjustment&quot;:3}]"></span>',
    });
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalled();
    });

    expect(postBand).toHaveBeenCalledWith('C06', {
      name: 'Goblin',
      segments: 5,
      word: 'Wounded',
      hp: 13,
      maxHp: 28,
      announce: true,
      cause: 'Longsword from Valeros; weakness cold-iron +3',
    });
  });

  it('builds its own client when none was built at init', async () => {
    const { handlers, hooks, goblin, globals, settings, warn } = world();
    startBands(hooks, settings, globals, null);
    goblin.system.attributes.hp.value = 20;

    handlers.get('updateActor')?.(goblin, { system: { attributes: { hp: { value: 20 } } } });
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('not signed in'));
    });
  });
});
