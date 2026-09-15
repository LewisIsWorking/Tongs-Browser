import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CooClient } from '../../src/bands/CooClient.js';
import { startBands } from '../../src/bands/startBands.js';
import { world } from './support/bandsWorld.js';

/**
 * The cause of an HP change through the real hooks, when the world gives less than it should. Written
 * 2026-09-15.
 */
afterEach(() => {
  vi.useRealTimers();
});

const HIT = { system: { attributes: { hp: { value: 13 } } } };
const taken = {
  flags: {
    pf2e: {
      context: { type: 'damage-taken' },
      appliedDamage: { uuid: 'Scene.S.Token.G.Actor.A' },
      origin: { uuid: 'Actor.V.Item.L', actor: 'Actor.V' },
    },
  },
};

describe('a cause the world cannot fully explain', () => {
  it('still records the damage when a name cannot be looked up', async () => {
    const w = world();
    const postBand = vi.fn(() => Promise.resolve('sent' as const));
    const globals = {
      ...w.globals,
      game: { ...w.globals.game, system: { id: 'pf2e' } },
      fromUuidSync: () => {
        throw new Error('not loaded');
      },
    };
    startBands(w.hooks, w.settings, globals, { postBand } as unknown as CooClient);

    w.goblin.uuid = 'Scene.S.Token.G.Actor.A';
    w.goblin.system.attributes.hp.value = 13;
    w.handlers.get('updateActor')?.(w.goblin, HIT);
    w.handlers.get('createChatMessage')?.(taken);

    await vi.waitFor(() => {
      expect(postBand).toHaveBeenCalledWith(
        'C06',
        expect.objectContaining({ cause: 'damage applied' })
      );
    });
  });

  it('calls it a manual change when no system says otherwise before the window closes', async () => {
    vi.useFakeTimers();
    const w = world();
    const postBand = vi.fn(() => Promise.resolve('sent' as const));
    startBands(w.hooks, w.settings, w.globals, { postBand } as unknown as CooClient);

    w.goblin.uuid = 'Scene.S.Token.G.Actor.A';
    w.goblin.system.attributes.hp.value = 13;
    w.handlers.get('updateActor')?.(w.goblin, HIT);
    w.handlers.get('createChatMessage')?.(taken);
    await vi.advanceTimersByTimeAsync(3000);

    expect(postBand).toHaveBeenCalledWith(
      'C06',
      expect.objectContaining({ cause: 'manual change' })
    );
  });

  it('posts nothing when the party campaign is not a code', async () => {
    const w = world(42);
    const postBand = vi.fn(() => Promise.resolve('sent' as const));
    startBands(w.hooks, w.settings, w.globals, { postBand } as unknown as CooClient);

    w.goblin.system.attributes.hp.value = 13;
    w.handlers.get('updateActor')?.(w.goblin, HIT);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(postBand).not.toHaveBeenCalled();
  });
});
