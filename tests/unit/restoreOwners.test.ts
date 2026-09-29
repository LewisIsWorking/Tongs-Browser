import { describe, expect, it, vi } from 'vitest';

import { restoreOwners, startRestoreOwners } from '../../src/owners/startRestoreOwners.js';
import type { OwnerGlobals, OwnerSettings } from '../../src/owners/startRestoreOwners.js';

/**
 * The GM's "Restore owners" dialog, driven through fake Foundry globals. Written 2026-09-29.
 */
const OLD_RYO = 'ForgeRyo00000001';
const NEW_RYO = 'CooRyo0000000001';
const GM = 'GameMaster000001';

const world = (answer: unknown, saved: Record<string, string> = {}) => {
  const actors = { updateDocuments: vi.fn(() => Promise.resolve([])) };
  const items = { updateDocuments: vi.fn(() => Promise.resolve([])) };
  const input = vi.fn<(options: object) => Promise<unknown>>(() => Promise.resolve(answer));
  const store: Record<string, unknown> = { restoredOwners: saved };
  const settings: OwnerSettings = {
    register: vi.fn(),
    registerMenu: vi.fn(),
    get: (_m, key) => store[key],
    set: (_m, key, value) => {
      store[key] = value;
      return Promise.resolve(value);
    },
  };
  const collections: Record<string, { contents: object[]; documentClass: typeof actors }> = {
    Actor: {
      contents: [{ id: 'a1', name: 'Kitt', type: 'character', ownership: { [OLD_RYO]: 3 } }],
      documentClass: actors,
    },
    Item: {
      contents: [{ id: 'i1', name: 'Sword', type: 'weapon', ownership: { [GM]: 3 } }],
      documentClass: items,
    },
  };
  const info = vi.fn();
  const globals = {
    game: {
      user: { isGM: true },
      users: {
        contents: [
          { id: GM, name: 'Lewis' },
          { id: NEW_RYO, name: 'Ryo Yamakawa' },
        ],
      },
      collections: { get: (name: string) => collections[name] },
    },
    foundry: {
      applications: {
        api: {
          DialogV2: { input },
          ApplicationV2: class Base {
            render() {
              return this;
            }
          },
        },
      },
    },
    ui: { notifications: { info, warn: vi.fn() } },
  } as unknown as OwnerGlobals;
  return { settings, globals, actors, items, input, store, info };
};

describe('restoring owners', () => {
  it('offers each orphaned owner with what they owned, and applies the GM choice', async () => {
    const w = world({ [OLD_RYO]: NEW_RYO });

    expect(await restoreOwners(w.settings, w.globals)).toBe(1);

    const content = (w.input.mock.calls[0]?.[0] as { content: string }).content;
    expect(content).toContain('1 owned: Kitt');
    expect(content).toContain('Ryo Yamakawa');
    expect(w.actors.updateDocuments).toHaveBeenCalledWith([
      { _id: 'a1', [`ownership.${NEW_RYO}`]: 3 },
    ]);
    expect(w.items.updateDocuments).not.toHaveBeenCalled();
    expect(w.store['restoredOwners']).toEqual({ [OLD_RYO]: NEW_RYO });
  });

  it('shows a saved answer as already chosen', async () => {
    const w = world(null, { [OLD_RYO]: NEW_RYO });
    await restoreOwners(w.settings, w.globals);
    expect((w.input.mock.calls[0]?.[0] as { content: string }).content).toContain(
      `value="${NEW_RYO}" selected`
    );
  });

  it('changes nothing when the GM cancels, or picks someone who is not a user', async () => {
    const cancelled = world(null);
    expect(await restoreOwners(cancelled.settings, cancelled.globals)).toBeNull();
    const stranger = world({ [OLD_RYO]: 'NotAUserHere0001' });
    expect(await restoreOwners(stranger.settings, stranger.globals)).toBe(0);
    expect(cancelled.actors.updateDocuments).not.toHaveBeenCalled();
    expect(stranger.actors.updateDocuments).not.toHaveBeenCalled();
  });

  it('says so, without a dialog, when nothing is orphaned', async () => {
    const w = world({});
    (w.globals.game?.collections?.get('Actor')?.contents[0] as { ownership: object }).ownership = {
      [GM]: 3,
    };
    expect(await restoreOwners(w.settings, w.globals)).toBeNull();
    expect(w.input).not.toHaveBeenCalled();
    expect(w.info).toHaveBeenCalledWith(expect.stringContaining('Nothing to restore'));
  });

  it('does nothing at all for a player, even if the menu were reached', async () => {
    const w = world({ [OLD_RYO]: NEW_RYO });
    (w.globals.game as { user: { isGM: boolean } }).user.isGM = false;
    expect(await restoreOwners(w.settings, w.globals)).toBeNull();
    expect(w.input).not.toHaveBeenCalled();
    expect(w.actors.updateDocuments).not.toHaveBeenCalled();
  });

  it('copes with documents and users missing their optional fields', async () => {
    const w = world({ [OLD_RYO]: NEW_RYO });
    const actors = w.globals.game?.collections?.get('Actor')?.contents as object[];
    actors.push({ id: null }, { id: 'a9', ownership: { [OLD_RYO]: 2 } }, { id: 'a8' });
    (w.globals.game?.users?.contents as object[]).push({ id: null }, { id: 'NoName0000000001' });
    w.store['restoredOwners'] = undefined;

    expect(await restoreOwners(w.settings, w.globals)).toBe(2);
    const content = (w.input.mock.calls[0]?.[0] as { content: string }).content;
    expect(content).toContain('2 owned: Kitt, (unnamed)');
    expect(content).toContain('>NoName0000000001</option>');
  });

  it('opens the dialog when the settings button is clicked', async () => {
    const w = world(null);
    startRestoreOwners(w.settings, w.globals);
    const data = (w.settings.registerMenu as ReturnType<typeof vi.fn>).mock.calls[0]?.[2] as {
      type: new () => { render(): unknown };
    };
    new data.type().render();
    await vi.waitFor(() => {
      expect(w.input).toHaveBeenCalledTimes(1);
    });
  });

  it('registers a GM-only settings button', () => {
    const w = world(null);
    expect(startRestoreOwners(w.settings, w.globals)).toBe(true);
    expect(w.settings.registerMenu).toHaveBeenCalledWith(
      'tongs-browser',
      'restoreOwnersMenu',
      expect.objectContaining({ restricted: true, label: 'Restore owners' })
    );
  });
});
