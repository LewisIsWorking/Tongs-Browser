import { describe, expect, it, vi } from 'vitest';

import { checkWorldSize, registerWorldSizeSetting } from '../../src/world/startWorldSize.js';
import type { SizeGlobals } from '../../src/world/startWorldSize.js';
import { readWorldSize, sizeWarning } from '../../src/world/worldSize.js';
import type { CooClient } from '../../src/bands/CooClient.js';

/**
 * Warning a GM that their world has grown, asked for by Lewis 2026-09-23 ("warn if the world size exceeds
 * 100MB"). ComeOnOverUno measures it: a browser cannot. ⛔ Everything it cannot answer is silence.
 */
const MB = 1024 * 1024;
const size = (over: Partial<Record<string, unknown>> = {}) => ({
  size: {
    world: 'doomsday-funtime',
    bytes: 128 * MB,
    files: 4211,
    databaseBytes: 96 * MB,
    assetBytes: 32 * MB,
    ...over,
  },
});

const world = (
  options: { role?: number; limit?: unknown; body?: unknown; status?: number } = {}
) => {
  const warn = vi.fn();
  const call = vi.fn(async () =>
    Promise.resolve({
      status: options.status ?? 200,
      json: async () => Promise.resolve(options.body ?? size()),
    })
  );
  const settings = { register: vi.fn(), get: () => options.limit ?? 100 };
  const globals = {
    game: {
      world: { id: 'doomsday-funtime' },
      user: { id: 'gm', role: options.role ?? 4, isGM: true },
      users: { activeGM: { id: 'gm', role: options.role ?? 4 } },
    },
    ui: { notifications: { warn } },
  } as unknown as SizeGlobals;
  return { settings, globals, warn, call, client: { call } as unknown as CooClient };
};

describe('reading the size the server measured', () => {
  it('takes the numbers, and refuses a shape it cannot trust', () => {
    expect(readWorldSize(size())).toEqual({
      world: 'doomsday-funtime',
      bytes: 128 * MB,
      files: 4211,
      databaseBytes: 96 * MB,
      assetBytes: 32 * MB,
    });
    expect(readWorldSize({ size: null })).toBeNull();
    expect(readWorldSize({ size: { world: 'x' } })).toBeNull();
    expect(readWorldSize({ size: { bytes: 1 } })).toBeNull();
    expect(readWorldSize(null)).toBeNull();
    /* Missing halves are not a reason to say nothing: the total is what the warning is about. */
    expect(readWorldSize({ size: { world: 'x', bytes: 5 } })).toMatchObject({
      files: 0,
      assetBytes: 0,
    });
  });
});

describe('whether it is worth telling the GM', () => {
  it('warns over the limit, naming the bigger half', () => {
    const warning = sizeWarning(readWorldSize(size()), 100);
    expect(warning).toContain('doomsday-funtime is 128.0 MB across 4211 files');
    expect(warning).toContain('over the 100 MB');
    expect(warning).toContain("world's own data (96.0 MB), which is usually the chat log");
  });

  it('names uploads when they are the bigger half', () => {
    const uploads = readWorldSize(size({ databaseBytes: 8 * MB, assetBytes: 120 * MB }));
    expect(sizeWarning(uploads, 100)).toContain('uploaded files (120.0 MB)');
  });

  /* ⛔ Silence everywhere it cannot answer: a courtesy must never interrupt a GM with a failure. */
  it('says nothing under the limit, with no size, or with the warning turned off', () => {
    expect(sizeWarning(readWorldSize(size({ bytes: 100 * MB })), 100)).toBeNull();
    expect(sizeWarning(null, 100)).toBeNull();
    expect(sizeWarning(readWorldSize(size()), 0)).toBeNull();
    expect(sizeWarning(readWorldSize(size()), -1)).toBeNull();
  });
});

describe('asking at launch', () => {
  it("asks this world's size once and warns the GM, permanently", async () => {
    const w = world();

    const warning = await checkWorldSize(w.settings, w.client, w.globals);

    expect(w.call).toHaveBeenCalledWith('GET', '/api/foundry/worlds/doomsday-funtime/size');
    expect(warning).toContain('128.0 MB');
    expect(w.warn).toHaveBeenCalledWith(expect.stringContaining('128.0 MB'), { permanent: true });
  });

  it('asks nothing without a client, with the warning off, or from a browser that is not the acting GM', async () => {
    const none = world();
    expect(await checkWorldSize(none.settings, null, none.globals)).toBeNull();

    const off = world({ limit: 0 });
    expect(await checkWorldSize(off.settings, off.client, off.globals)).toBeNull();
    expect(off.call).not.toHaveBeenCalled();

    /* A player's browser: one browser asks, like every other automation here. */
    const player = world({ role: 1 });
    expect(await checkWorldSize(player.settings, player.client, player.globals)).toBeNull();
    expect(player.call).not.toHaveBeenCalled();
  });

  it('stays silent when the server refuses, answers nothing, or is signed out', async () => {
    const refused = world({ status: 404 });
    expect(await checkWorldSize(refused.settings, refused.client, refused.globals)).toBeNull();
    expect(refused.warn).not.toHaveBeenCalled();

    const empty = world({ body: { size: null } });
    expect(await checkWorldSize(empty.settings, empty.client, empty.globals)).toBeNull();

    const out = world();
    const signedOut = {
      call: vi.fn(async () => Promise.resolve('signed-out' as const)),
    } as unknown as CooClient;
    expect(await checkWorldSize(out.settings, signedOut, out.globals)).toBeNull();
    expect(out.warn).not.toHaveBeenCalled();
  });

  it('registers the limit as a world setting a GM can change', () => {
    const w = world();
    registerWorldSizeSetting(w.settings);
    expect(w.settings.register).toHaveBeenCalledWith(
      'tongs-browser',
      'worldSizeWarnMb',
      expect.objectContaining({ scope: 'world', config: true, type: Number, default: 100 })
    );
  });
});
