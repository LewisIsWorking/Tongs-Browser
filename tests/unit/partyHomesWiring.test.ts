import { afterEach, describe, expect, it, vi } from 'vitest';

import { WELCOME_SETTING, startSheetRequests } from '../../src/welcome/startSheetRequests.js';
import type { WelcomeGlobals, WelcomeSettings } from '../../src/welcome/startSheetRequests.js';

/** PartyHomes wired to Foundry through the welcome's GM side. 2026-10-10. */
afterEach(() => {
  vi.unstubAllGlobals();
});

const settingsWith = (values: Record<string, unknown>): WelcomeSettings => ({
  register: vi.fn(),
  get: (_namespace, key) => values[key],
  set: vi.fn(async (_namespace: string, key: string, value: unknown) => {
    values[key] = value;
    return Promise.resolve(value);
  }),
});

const flags =
  (values: Record<string, unknown>) =>
  (scope: string, key: string): unknown =>
    scope === 'tongs-browser' ? values[key] : undefined;

describe('a sheet in no party (PartyHomes, 2026-10-10)', () => {
  it("puts a player's only sheet in the one campaign party, and marks it", async () => {
    const livy = { uuid: 'Actor.L', setFlag: vi.fn(async () => Promise.resolve()) };
    const addMembers = vi.fn(async () => Promise.resolve());
    vi.stubGlobal('fromUuid', async (uuid: string) =>
      Promise.resolve(uuid === 'Actor.L' ? livy : { addMembers })
    );
    const gm = { id: 'gm', name: 'GM', isGM: true, role: 4 };
    const antoine = { id: 'a', name: 'MrNegetZ', role: 1, getFlag: flags({}) };
    const party = { uuid: 'Actor.P', name: 'The Party', type: 'party', getFlag: flags({}) };
    const sheet = {
      uuid: 'Actor.L',
      name: 'Livy',
      type: 'character',
      ownership: { a: 3 },
      getFlag: flags({}),
    };
    const actors = Object.assign([party, sheet], {
      contents: [party, sheet],
      party: { uuid: 'Actor.P' },
    });
    const info = vi.fn();
    startSheetRequests({ on: vi.fn() }, settingsWith({ [WELCOME_SETTING]: true }), {
      game: { user: gm, users: { activeGM: gm, contents: [gm, antoine] }, actors },
      ui: { notifications: { info } },
    } as unknown as WelcomeGlobals);

    await vi.waitFor(() => {
      expect(info).toHaveBeenCalledWith("Tongs added MrNegetZ's Livy to The Party.");
    });
    expect(addMembers).toHaveBeenCalledWith(livy);
    expect(livy.setFlag).toHaveBeenCalledWith('tongs-browser', 'joinedParty', 'Actor.P');
  });
});
