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
  ownership: { u1: 3 },
  items: { contents: slugs.map((slug) => ({ system: { slug } })) },
  getFlag: flags({}),
});

function serve(sheets: unknown[]) {
  const create = vi.fn(async () => Promise.resolve(undefined));
  vi.stubGlobal('Actor', { create });
  const update = vi.fn(async () => Promise.resolve());
  const gm = { id: 'gm', name: 'GM', isGM: true };
  const player = {
    id: 'u1',
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
  const values: Record<string, unknown> = { [WELCOME_SETTING]: true };
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

describe('wired to Foundry', () => {
  it('refuses a request from a player who already owns 2 sheets and has no grant', async () => {
    const { create, update } = serve([sheet('Actor.A'), sheet('Actor.B')]);
    await vi.waitFor(() => {
      expect(update).toHaveBeenCalled();
    });
    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        'flags.tongs-browser.sheetResult': expect.objectContaining({ kind: 'refused' }),
      })
    );
  });

  it('makes a third sheet when one of the two grants a familiar (2026-10-21)', async () => {
    const { create } = serve([sheet('Actor.A', 'familiar-witch'), sheet('Actor.B')]);
    await vi.waitFor(() => {
      expect(create).toHaveBeenCalled();
    });
  });
});
