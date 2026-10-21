import { afterEach, describe, expect, it, vi } from 'vitest';

import { startSheetRequests, WELCOME_SETTING } from '../../src/welcome/startSheetRequests.js';
import type { WelcomeGlobals, WelcomeSettings } from '../../src/welcome/startSheetRequests.js';

/** The sheet cap, wired to Foundry: a request at the cap is refused and no actor is made. 2026-10-12. */
afterEach(() => {
  vi.unstubAllGlobals();
});

const flags =
  (values: Record<string, unknown>) =>
  (scope: string, key: string): unknown =>
    scope === 'tongs-browser' ? values[key] : undefined;

const sheet = (uuid: string, ...slugs: string[]) => ({
  id: uuid.slice(6),
  uuid,
  name: uuid,
  type: 'character',
  ownership: { LaiLaiLaiLaiLai1: 3 },
  items: { contents: slugs.map((slug) => ({ system: { slug } })) },
  getFlag: flags({}),
});

function serve(sheets: unknown[], extraSheets: Record<string, number> = {}) {
  const create = vi.fn(async () => Promise.resolve(undefined));
  vi.stubGlobal('Actor', { create });
  const update = vi.fn(async () => Promise.resolve());
  const gm = { id: 'gm', name: 'GM', isGM: true };
  const player = {
    id: 'LaiLaiLaiLaiLai1',
    name: 'Lai',
    update,
    getFlag: flags({ sheetRequest: { id: 'r2', name: 'Kibwe', at: 1 } }),
  };
  const party = {
    uuid: 'Actor.P',
    name: 'The Party',
    type: 'party',
    getFlag: flags({ bandsCampaign: 'C06' }),
  };
  const actors = [party, ...sheets];
  const game = {
    user: gm,
    users: { activeGM: gm, contents: [gm, player] },
    actors: Object.assign(actors, { contents: actors }),
  };
  const values: Record<string, unknown> = { [WELCOME_SETTING]: true, extraSheets };
  const settings: WelcomeSettings = {
    register: vi.fn(),
    get: (_namespace, key) => values[key],
    set: vi.fn(async () => Promise.resolve()),
  };
  startSheetRequests({ on: vi.fn() }, settings, {
    game,
    ui: { notifications: { info: vi.fn() } },
  } as unknown as WelcomeGlobals);
  return { create, update };
}

const LAI = 'LaiLaiLaiLaiLai1';

async function refused(update: ReturnType<typeof vi.fn>, create: ReturnType<typeof vi.fn>) {
  await vi.waitFor(() => {
    expect(update).toHaveBeenCalled();
  });
  expect(create).not.toHaveBeenCalled();
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({
      'flags.tongs-browser.sheetResult': expect.objectContaining({ kind: 'refused' }),
    })
  );
}

describe('wired to Foundry (2026-10-21: 1 each, 2 with /extrasheet, 2 at most)', () => {
  it('refuses a second sheet from a player with no grant', async () => {
    const { create, update } = serve([sheet('Actor.A')]);
    await refused(update, create);
  });

  it('refuses a second sheet without a grant even when the first grants a familiar', async () => {
    const { create, update } = serve([sheet('Actor.A', 'familiar-witch', 'animal-companion')]);
    await refused(update, create);
  });

  it('makes a second sheet for a player with a grant', async () => {
    const { create } = serve([sheet('Actor.A')], { [LAI]: 1 });
    await vi.waitFor(() => {
      expect(create).toHaveBeenCalled();
    });
  });

  it('refuses a third sheet with a grant, whatever companions the two grant', async () => {
    const { create, update } = serve(
      [sheet('Actor.A', 'familiar-witch'), sheet('Actor.B', 'eidolon')],
      { [LAI]: 1 }
    );
    await refused(update, create);
  });
});
