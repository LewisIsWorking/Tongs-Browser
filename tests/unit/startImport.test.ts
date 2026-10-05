import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../src/core/Logger.js';
import { storedImport, readImportBuild } from '../../src/welcome/importBuild.js';
import { sameName, startImport } from '../../src/welcome/startImport.js';
import type { ImportGlobals } from '../../src/welcome/startImport.js';
import { COO_EXPORT } from './support/cooFoundryExport.js';

/** The import wired to Foundry: which sheets it runs on, the compendium lookup, and once only. 2026-10-05. */
afterEach(() => {
  vi.restoreAllMocks();
});

const STORED = storedImport(readImportBuild(COO_EXPORT)!);

function world(
  options: { flags?: Record<string, unknown>; isGM?: boolean; isOwner?: boolean } = {}
) {
  const flags: Record<string, unknown> = { importBuild: STORED, ...options.flags };
  const created: Record<string, unknown>[] = [];
  const update = vi.fn(async () => Promise.resolve());
  const sheet = {
    id: 'NEW',
    uuid: 'Actor.NEW',
    name: 'Theo',
    type: 'character',
    isOwner: options.isOwner ?? true,
    items: { contents: [{ type: 'background', name: 'Acolyte' }] },
    getFlag: (_scope: string, key: string) => flags[key],
    setFlag: vi.fn(async (_scope: string, key: string, value: unknown) => {
      flags[key] = value;
      return Promise.resolve();
    }),
    update,
    createEmbeddedDocuments: vi.fn(async (_type: string, data: readonly object[]) => {
      created.push(...(data as Record<string, unknown>[]));
      return Promise.resolve();
    }),
  };
  const pack = (names: string[]) => ({
    getIndex: async () =>
      Promise.resolve(names.map((name, index) => ({ _id: String(index), name }))),
    getDocument: async (id: string) =>
      Promise.resolve({
        uuid: `Compendium.pf2e.x.Item.${id}`,
        toObject: () => ({ name: names[Number(id)], type: 'x', _stats: { a: 1 } }),
      }),
  });
  const packs: Record<string, ReturnType<typeof pack>> = {
    'pf2e.ancestries': pack(['Dwarf']),
    'pf2e.heritages': pack(['Rock Dwarf']),
    'pf2e.classes': pack(['Fighter']),
  };
  const info = vi.fn();
  const handlers: (() => void)[] = [];
  const globals = {
    game: {
      user: { id: 'u1', isGM: options.isGM ?? false },
      actors: { contents: [sheet] },
      packs: { get: (id: string) => packs[id] },
    },
    ui: { notifications: { info } },
  } as unknown as ImportGlobals;
  const hooks = { on: (_name: string, fn: () => void) => handlers.push(fn) };
  return {
    flags,
    created,
    update,
    sheet,
    info,
    globals,
    hooks,
    fire: () => {
      handlers.forEach((fn) => {
        fn();
      });
    },
  };
}

describe('importing onto a new sheet', () => {
  it('fills the sheet from the compendiums, marks it done, and tells the player', async () => {
    const t = world();
    startImport(t.hooks, t.globals);
    await vi.waitFor(() => {
      expect(t.flags['importDone']).toBe(true);
    });
    expect(t.update).toHaveBeenCalledOnce();
    expect(t.created.map((item) => item['name'])).toEqual([
      'Dwarf',
      'Rock Dwarf',
      'Fighter',
      'Scribing Lore',
    ]);
    expect(t.created[0]).toMatchObject({
      _stats: { a: 1, compendiumSource: 'Compendium.pf2e.x.Item.0' },
    });
    expect(t.info.mock.calls[0]?.[0]).toContain(
      'Not found, add by hand: Dwarven Weapon Familiarity, Sudden Charge.'
    );
  });

  it('runs once, even when hooks fire while it is running', async () => {
    const t = world();
    startImport(t.hooks, t.globals);
    t.fire();
    t.fire();
    await vi.waitFor(() => {
      expect(t.flags['importDone']).toBe(true);
    });
    t.fire();
    expect(t.update).toHaveBeenCalledOnce();
  });

  it('does nothing for a GM, a sheet already imported, or a sheet with no import', async () => {
    for (const t of [
      world({ isGM: true }),
      world({ flags: { importDone: true } }),
      world({ flags: { importBuild: undefined } }),
    ]) {
      startImport(t.hooks, t.globals);
      await Promise.resolve();
      expect(t.update).not.toHaveBeenCalled();
    }
  });

  it('logs a failed import and leaves it to run again', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const t = world();
    t.update.mockRejectedValueOnce(new Error('offline'));
    startImport(t.hooks, t.globals);
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith('Import failed: offline');
    });
    expect(t.flags['importDone']).toBeUndefined();
  });
});

describe('matching names', () => {
  it('ignores case, spacing and curly apostrophes', () => {
    expect(sameName('Champion’s  Reaction', "champion's reaction")).toBe(true);
    expect(sameName('Dwarf', 'Dwarven')).toBe(false);
  });
});
