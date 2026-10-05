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
  options: {
    flags?: Record<string, unknown>;
    isGM?: boolean;
    isOwner?: boolean;
    noUi?: boolean;
  } = {}
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
    items: { contents: [{ type: 'feat', name: 'Toughness' }] },
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
  /* `bare` documents carry no uuid or _stats; `gone` ones are in the index but not the pack. */
  const pack = (names: string[], shape: 'full' | 'bare' | 'gone' = 'full') => ({
    getIndex: async () =>
      Promise.resolve(names.map((name, index) => ({ _id: String(index), name }))),
    getDocument: async (id: string) =>
      Promise.resolve(
        shape === 'gone'
          ? null
          : {
              ...(shape === 'full' ? { uuid: `Compendium.pf2e.x.Item.${id}` } : {}),
              toObject: () => ({
                name: names[Number(id)],
                type: 'x',
                ...(shape === 'full' ? { _stats: { a: 1 } } : {}),
              }),
            }
      ),
  });
  const packs: Record<string, ReturnType<typeof pack>> = {
    'pf2e.ancestries': pack(['Dwarf']),
    'pf2e.heritages': pack(['Rock Dwarf']),
    'pf2e.classes': pack(['Fighter'], 'bare'),
    'pf2e.feats-srd': pack(['Sudden Charge'], 'gone'),
  };
  const info = vi.fn();
  const handlers: (() => void)[] = [];
  const globals = {
    game: {
      user: { id: 'u1', isGM: options.isGM ?? false },
      actors: { contents: [sheet] },
      packs: { get: (id: string | undefined) => packs[id ?? ''] },
    },
    ...(options.noUi === true ? {} : { ui: { notifications: { info } } }),
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
    /* This world has no backgrounds pack, so Acolyte cannot be found. */
    expect(t.created[0]).toMatchObject({
      _stats: { a: 1, compendiumSource: 'Compendium.pf2e.x.Item.0' },
    });
    expect(t.created[2]).toMatchObject({ _stats: { compendiumSource: null } });
    expect(t.info.mock.calls[0]?.[0]).toContain(
      'Not found, add by hand: Acolyte, Dwarven Weapon Familiarity, Sudden Charge.'
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

  it('still finishes before Foundry has its notifications up', async () => {
    const t = world({ noUi: true });
    startImport(t.hooks, t.globals);
    await vi.waitFor(() => {
      expect(t.flags['importDone']).toBe(true);
    });
    expect(t.info).not.toHaveBeenCalled();
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

  it('logs a failure that is not an Error, too', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const t = world();
    t.update.mockRejectedValueOnce('offline');
    startImport(t.hooks, t.globals);
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith('Import failed: offline');
    });
  });
});

describe('matching names', () => {
  it('ignores case, spacing and curly apostrophes', () => {
    expect(sameName('Champion’s  Reaction', "champion's reaction")).toBe(true);
    expect(sameName('Dwarf', 'Dwarven')).toBe(false);
  });
});
