import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PARTIES_SETTING,
  WELCOME_SETTING,
  registerWelcomeSettings,
  sharedParties,
  startSheetRequests,
} from '../../src/welcome/startSheetRequests.js';
import { readImportBuild, storedImport } from '../../src/welcome/importBuild.js';
import { COO_EXPORT } from './support/cooFoundryExport.js';
import type { WelcomeGlobals, WelcomeSettings } from '../../src/welcome/startSheetRequests.js';

/** The GM side wired to Foundry: settings, hooks, and a real request served end to end. 2026-10-05. */
afterEach(() => {
  vi.unstubAllGlobals();
});

function settingsWith(values: Record<string, unknown>) {
  const registered: Record<string, Record<string, unknown>> = {};
  const settings: WelcomeSettings & { registered: typeof registered } = {
    registered,
    register: (_namespace, key, data) => {
      registered[key] = data as Record<string, unknown>;
    },
    get: (_namespace, key) => values[key],
    set: vi.fn(async (_namespace: string, key: string, value: unknown) => {
      values[key] = value;
      return Promise.resolve(value);
    }),
  };
  return settings;
}

const flags =
  (values: Record<string, unknown>) =>
  (scope: string, key: string): unknown =>
    scope === 'tongs-browser' ? values[key] : undefined;

function table(isGM = true, request: Record<string, unknown> = {}) {
  const update = vi.fn(async () => Promise.resolve());
  const gm = { id: 'gm', name: 'GM', isGM: true };
  const player = {
    id: 'u1',
    name: 'Melody',
    character: null,
    update,
    getFlag: flags({ sheetRequest: { id: 'r1', name: 'Theo', at: 1, ...request } }),
  };
  const party = {
    uuid: 'Actor.P',
    name: 'The Party',
    type: 'party',
    getFlag: flags({ bandsCampaign: 'C06' }),
  };
  const actors = Object.assign([party], { contents: [party] });
  const game = {
    user: isGM ? gm : { id: 'u1', isGM: false },
    users: { activeGM: gm, contents: [gm, player] },
    actors,
  };
  return { game, update };
}

const settle = async () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the settings', () => {
  it('registers the switch as a world setting, on by default, and the shared parties as hidden', () => {
    const settings = settingsWith({});
    registerWelcomeSettings(settings);
    expect(settings.registered[WELCOME_SETTING]).toMatchObject({
      scope: 'world',
      config: true,
      default: true,
    });
    expect(settings.registered[PARTIES_SETTING]).toMatchObject({ scope: 'world', config: false });
  });

  it('offers only stored parties that still have a real code, and nothing when damaged', () => {
    const stored = {
      parties: [{ uuid: 'A', name: 'A', code: 'C06' }, { uuid: 'B', name: 'B', code: 'x' }, null],
    };
    expect(sharedParties(settingsWith({ [PARTIES_SETTING]: stored }))).toEqual([
      { uuid: 'A', name: 'A', code: 'C06' },
    ]);
    expect(sharedParties(settingsWith({ [PARTIES_SETTING]: 'junk' }))).toEqual([]);
  });
});

describe('serving from the GM browser', () => {
  it('shares the campaign parties, makes the marked sheet, and answers the player', async () => {
    const create = vi.fn(async () => Promise.resolve({ id: 'NEW', uuid: 'Actor.NEW' }));
    const addMembers = vi.fn(async () => Promise.resolve());
    vi.stubGlobal('Actor', { create });
    vi.stubGlobal('fromUuid', async () => Promise.resolve({ addMembers }));
    const { game, update } = table();
    const info = vi.fn();
    const settings = settingsWith({ [WELCOME_SETTING]: true });
    const names: string[] = [];
    const hooks = { on: (name: string) => names.push(name) };
    startSheetRequests(hooks, settings, {
      game,
      ui: { notifications: { info } },
    } as unknown as WelcomeGlobals);
    await vi.waitFor(() => {
      expect(update).toHaveBeenCalled();
    });
    expect(settings.set).toHaveBeenCalledWith('tongs-browser', PARTIES_SETTING, {
      parties: [{ uuid: 'Actor.P', name: 'The Party', code: 'C06' }],
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Theo',
        flags: { 'tongs-browser': { madeForRequest: 'r1' } },
      })
    );
    expect(addMembers).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledWith('Tongs made Theo for Melody, in The Party.');
    expect(names).toContain('updateUser');
  });

  it("carries the player's chosen export onto the sheet, for their browser to apply", async () => {
    const create = vi.fn(async () => Promise.resolve({ id: 'NEW', uuid: 'Actor.NEW' }));
    vi.stubGlobal('Actor', { create });
    vi.stubGlobal('fromUuid', async () => Promise.resolve({ addMembers: vi.fn() }));
    const stored = storedImport(readImportBuild(COO_EXPORT)!);
    const { game, update } = table(true, { importBuild: stored });
    startSheetRequests({ on: vi.fn() }, settingsWith({ [WELCOME_SETTING]: true }), {
      game,
      ui: { notifications: { info: vi.fn() } },
    } as unknown as WelcomeGlobals);
    await vi.waitFor(() => {
      expect(update).toHaveBeenCalled();
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        flags: { 'tongs-browser': { madeForRequest: 'r1', importBuild: stored } },
      })
    );
  });

  it('does nothing when switched off, or in a player browser', async () => {
    const create = vi.fn();
    vi.stubGlobal('Actor', { create });
    const off = table();
    startSheetRequests({ on: vi.fn() }, settingsWith({ [WELCOME_SETTING]: false }), {
      game: off.game,
    } as unknown as WelcomeGlobals);
    const player = table(false);
    startSheetRequests({ on: vi.fn() }, settingsWith({ [WELCOME_SETTING]: true }), {
      game: player.game,
    } as unknown as WelcomeGlobals);
    await settle();
    expect(create).not.toHaveBeenCalled();
    expect(off.update).not.toHaveBeenCalled();
    expect(player.update).not.toHaveBeenCalled();
  });

  it('does not rewrite the shared parties when they have not changed', async () => {
    vi.stubGlobal('Actor', {
      create: async () => Promise.resolve({ id: 'NEW', uuid: 'Actor.NEW' }),
    });
    vi.stubGlobal('fromUuid', async () =>
      Promise.resolve({ addMembers: async () => Promise.resolve() })
    );
    const { game, update } = table();
    const settings = settingsWith({
      [WELCOME_SETTING]: true,
      [PARTIES_SETTING]: { parties: [{ uuid: 'Actor.P', name: 'The Party', code: 'C06' }] },
    });
    startSheetRequests({ on: vi.fn() }, settings, { game } as unknown as WelcomeGlobals);
    await vi.waitFor(() => {
      expect(update).toHaveBeenCalled();
    });
    expect(settings.set).not.toHaveBeenCalled();
  });
});
