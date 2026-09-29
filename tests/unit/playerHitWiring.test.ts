import { describe, expect, it, vi } from 'vitest';

import type { CooClient } from '../../src/bands/CooClient.js';
import { startBands } from '../../src/bands/startBands.js';
import { PLAYER_HITS_SETTING, registerPlayerHitSetting } from '../../src/bands/startPlayerHits.js';
import { world } from './support/bandsWorld.js';

/**
 * A hit on a player character through the real hooks, ports and token reading, to ComeOnOverUno. Written
 * 2026-09-28. ⚠️ The world's goblin is dressed as an unowned character on the party's side: since the move to
 * the self-hosted Foundry that is what every player character is.
 */
const start = (setting: unknown = true) => {
  const w = world();
  Object.assign(w.goblin, { type: 'character', alliance: 'party' });
  const call = vi.fn(() => Promise.resolve({ status: 200, json: () => Promise.resolve({}) }));
  const postBand = vi.fn(() => Promise.resolve('sent' as const));
  const settings = {
    ...w.settings,
    get: (_module: string, key: string) => (key === PLAYER_HITS_SETTING ? setting : ''),
  };
  const globals = { ...w.globals, game: { ...w.globals.game, system: { id: 'pf2e' } } };
  startBands(w.hooks, settings, globals, { postBand, call } as unknown as CooClient);
  const hurt = (hp: number) => {
    w.goblin.system.attributes.hp.value = hp;
    w.handlers.get('updateActor')?.(w.goblin, { system: { attributes: { hp: { value: hp } } } });
  };
  return { ...w, call, postBand, hurt };
};

describe('a hit on a player character, end to end', () => {
  it('posts the damage and HP left to the campaign, and no band', async () => {
    const { call, postBand, hurt } = start();

    hurt(16);

    /* No damage-taken card: the cause window closes and the hit is posted without a source. */
    await vi.waitFor(
      () => {
        expect(call).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );
    expect(call).toHaveBeenCalledWith('POST', '/api/pathwars/campaigns/C06/player-hit', {
      name: 'Goblin',
      damage: 12,
      hp: 16,
      maxHp: 28,
    });
    expect(postBand).not.toHaveBeenCalled();
  });

  it('posts nothing once a GM turns the setting off', async () => {
    const { call, hurt, handlers } = start(false);

    hurt(16);
    handlers.get('canvasReady')?.();
    await new Promise((resolve) => setTimeout(resolve, 3200));

    expect(call).not.toHaveBeenCalled();
  });

  it('registers as a world setting, on by default', () => {
    const register = vi.fn();
    registerPlayerHitSetting({ register });
    expect(register).toHaveBeenCalledWith(
      'tongs-browser',
      'postPlayerHits',
      expect.objectContaining({ scope: 'world', config: true, type: Boolean, default: true })
    );
  });
});
