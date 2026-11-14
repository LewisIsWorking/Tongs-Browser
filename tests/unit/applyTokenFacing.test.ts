import { describe, expect, it, vi } from 'vitest';

import {
  applyTokenFacing,
  facingApi,
  startTokenFacing,
} from '../../src/facing/startTokenFacing.js';
import { logger } from '../../src/core/Logger.js';
import { facingWorld as world, withActors } from './support/facingWorld.js';
import type { FacingWorld } from './support/facingWorld.js';

/**
 * Default token facing for every existing actor, 2026-11-14: never by itself, only from the GM's settings
 * button (which asks first) or the API call a GM's macro makes.
 */
describe('applying the facing to every actor', () => {
  it('changes only the actors not already facing that way, and tells the GM how many', async () => {
    const w = world();

    await expect(applyTokenFacing(w.globals)).resolves.toBe(2);
    expect(w.updateDocuments).toHaveBeenCalledWith([
      { _id: 'new', prototypeToken: { texture: { scaleX: -1, scaleY: -1 }, lockRotation: false } },
      {
        _id: 'small',
        prototypeToken: { texture: { scaleX: -0.8, scaleY: -0.8 }, lockRotation: false },
      },
    ]);
    expect(w.info).toHaveBeenCalledWith('Tongs set the default token facing on 2 actors.');
  });

  it('writes nothing when every actor already faces that way, and says so', async () => {
    const w = world();
    const done = { texture: { scaleX: -1, scaleY: -1 }, lockRotation: false };

    await expect(
      applyTokenFacing(withActors(w, [{ id: 'done', prototypeToken: done }]))
    ).resolves.toBe(0);
    expect(w.updateDocuments).not.toHaveBeenCalled();
    expect(w.info).toHaveBeenCalledWith('Tongs set the default token facing on 0 actors.');
    const quiet = world({ ui: false });
    await expect(applyTokenFacing(quiet.globals)).resolves.toBe(2);
  });

  it('names one actor in the singular', async () => {
    const w = world();

    await applyTokenFacing(withActors(w, [{ id: 'new', prototypeToken: {} }]));

    expect(w.info).toHaveBeenCalledWith('Tongs set the default token facing on 1 actor.');
  });

  it("does nothing in a player's browser, or where there are no actors", async () => {
    const w = world({ gm: false });

    await expect(applyTokenFacing(w.globals)).resolves.toBeNull();
    await expect(applyTokenFacing({ game: { user: { isGM: true } } })).resolves.toBeNull();
    expect(w.updateDocuments).not.toHaveBeenCalled();
  });

  it("is the API's applyTokenFacingToAllActors, for a GM's macro", async () => {
    const w = world();

    await expect(facingApi(w.globals).applyTokenFacingToAllActors()).resolves.toBe(2);
  });
});

describe("the GM's settings button", () => {
  const press = async (w: FacingWorld): Promise<void> => {
    startTokenFacing(w.hooks, w.settings, w.globals);
    const menu = w.settings.registerMenu.mock.calls[0]?.[2] as {
      type: new () => { render(): unknown };
      restricted: boolean;
    };
    expect(menu.restricted).toBe(true);
    new menu.type().render();
    await vi.waitFor(() => {
      expect(w.confirm).toHaveBeenCalledTimes(1);
    });
    await Promise.resolve();
  };

  it('asks first, then applies', async () => {
    const w = world({ confirm: true });
    await press(w);

    await vi.waitFor(() => {
      expect(w.updateDocuments).toHaveBeenCalledTimes(1);
    });
  });

  it('changes nothing when the GM says no', async () => {
    const w = world({ confirm: false });
    await press(w);

    expect(w.updateDocuments).not.toHaveBeenCalled();
  });

  it('logs a failure rather than throwing it into Foundry', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const w = world();
    w.updateDocuments.mockRejectedValueOnce(new Error('refused'));
    await press(w);

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith('Default token facing was not applied: refused');
    });
    expect(w.info).not.toHaveBeenCalled();
    const odd = world();
    odd.updateDocuments.mockRejectedValueOnce('offline');
    await press(odd);

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith('Default token facing was not applied: offline');
    });
    warn.mockRestore();
  });
});
