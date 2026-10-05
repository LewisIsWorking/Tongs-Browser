import { afterEach, describe, expect, it, vi } from 'vitest';

import { PARTIES_SETTING, WELCOME_SETTING } from '../../src/welcome/startSheetRequests.js';
import type { WelcomeGlobals, WelcomeSettings } from '../../src/welcome/startSheetRequests.js';
import { GUIDE_DONE_FLAG, startWelcome } from '../../src/welcome/startWelcome.js';

/** The player's side: which face shows, from the documents alone. 2026-10-05. */
afterEach(() => {
  document.body.replaceChildren();
});

const PARTY = { uuid: 'Actor.P', name: 'The Party', code: 'C06' };

function player(options: { on?: boolean; parties?: unknown[]; isGM?: boolean } = {}) {
  const userFlags: Record<string, unknown> = {};
  const values: Record<string, unknown> = {
    [WELCOME_SETTING]: options.on ?? true,
    [PARTIES_SETTING]: { parties: options.parties ?? [PARTY] },
  };
  const user = {
    id: 'u1',
    isGM: options.isGM ?? false,
    getFlag: (_scope: string, key: string) => userFlags[key],
    setFlag: vi.fn(async (_scope: string, key: string, value: unknown) => {
      userFlags[key] = value;
      return Promise.resolve();
    }),
    unsetFlag: vi.fn(async (_scope: string, key: string) => {
      userFlags[key] = undefined;
      return Promise.resolve();
    }),
  };
  const actors: Record<string, unknown>[] = [];
  const game = {
    user,
    users: { activeGM: null },
    actors: { contents: actors },
    world: { title: 'Riddleport' },
  };
  const handlers: (() => void)[] = [];
  const hooks = { on: (_name: string, fn: () => void) => handlers.push(fn) };
  const settings: WelcomeSettings = {
    register: vi.fn(),
    get: (_namespace, key) => values[key],
    set: vi.fn(),
  };
  const globals = { game, crypto: { randomUUID: () => 'r1' } } as unknown as WelcomeGlobals;
  const change = () => {
    handlers[0]?.();
  };
  return { userFlags, values, user, actors, hooks, settings, globals, change };
}

const welcomeText = () => document.querySelector('#tongs-welcome')?.textContent ?? null;
const guideText = () => document.querySelector('#tongs-build-guide')?.textContent ?? null;
const press = (text: string) => {
  [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find((b) => b.textContent === text)
    ?.click();
};
const madeSheet = (flags: Record<string, unknown>, render = vi.fn()) => ({
  id: 'NEW',
  uuid: 'Actor.NEW',
  name: 'Theo',
  type: 'character',
  isOwner: true,
  ancestry: { name: 'Dwarf' },
  sheet: { render },
  getFlag: (_scope: string, key: string) => flags[key],
  setFlag: vi.fn(async () => Promise.resolve()),
});

describe('the welcome', () => {
  it('welcomes a player with no sheet, and asking stores the request on their user', async () => {
    const t = player();
    startWelcome(t.hooks, t.settings, t.globals, document);
    expect(welcomeText()).toContain('Welcome to Riddleport!');
    document.querySelector<HTMLInputElement>('#tongs-welcome input')!.value = ' Theo ';
    press('Create my character');
    await vi.waitFor(() => {
      expect(t.user.setFlag).toHaveBeenCalled();
    });
    expect(t.userFlags['sheetRequest']).toMatchObject({ id: 'r1', name: 'Theo', partyUuid: null });
    t.change();
    expect(welcomeText()).toContain('the next time they are online');
  });

  it('never shows for a GM, when switched off, with a sheet already, or with no campaign party', () => {
    for (const t of [player({ isGM: true }), player({ on: false }), player({ parties: [] })]) {
      startWelcome(t.hooks, t.settings, t.globals, document);
    }
    const owner = player();
    owner.actors.push({ uuid: 'Actor.X', type: 'character', isOwner: true });
    startWelcome(owner.hooks, owner.settings, owner.globals, document);
    expect(welcomeText()).toBeNull();
  });

  it('stays closed after Not now', () => {
    const t = player();
    startWelcome(t.hooks, t.settings, t.globals, document);
    press('Not now');
    t.change();
    expect(welcomeText()).toBeNull();
  });

  it('shows a refusal, and Try again clears it back to the welcome', async () => {
    const t = player();
    t.userFlags['sheetResult'] = { kind: 'refused', requestId: 'r0', reason: 'Foundry said no.' };
    startWelcome(t.hooks, t.settings, t.globals, document);
    expect(welcomeText()).toContain('Foundry said no.');
    press('Try again');
    await vi.waitFor(() => {
      expect(t.user.unsetFlag).toHaveBeenCalledWith('tongs-browser', 'sheetResult');
    });
    t.change();
    expect(welcomeText()).toContain('Welcome to Riddleport!');
  });
});

describe('the checklist', () => {
  it('opens the new sheet once, clears the answer, and shows the checklist', () => {
    const t = player();
    const render = vi.fn();
    t.userFlags['sheetResult'] = { kind: 'created', requestId: 'r1', actorUuid: 'Actor.NEW' };
    t.actors.push(madeSheet({ madeForRequest: 'r1' }, render));
    startWelcome(t.hooks, t.settings, t.globals, document);
    t.change();
    expect(render).toHaveBeenCalledOnce();
    expect(t.user.unsetFlag).toHaveBeenCalledWith('tongs-browser', 'sheetResult');
    expect(guideText()).toContain('Building Theo');
    expect(guideText()).toContain('Dwarf');
    expect(welcomeText()).toBeNull();
  });

  it('Done marks the sheet finished; a finished sheet shows nothing', () => {
    const t = player();
    const sheet = madeSheet({ madeForRequest: 'r1' });
    t.actors.push(sheet);
    startWelcome(t.hooks, t.settings, t.globals, document);
    press('Hide');
    t.change();
    expect(guideText()).toBeNull();

    const done = player();
    done.actors.push(madeSheet({ madeForRequest: 'r1', [GUIDE_DONE_FLAG]: true }));
    startWelcome(done.hooks, done.settings, done.globals, document);
    expect(guideText()).toBeNull();
    expect(welcomeText()).toBeNull();
  });

  it('Open sheet renders the sheet, and switching off closes the checklist', () => {
    const t = player();
    const render = vi.fn();
    t.actors.push(madeSheet({ madeForRequest: 'r1' }, render));
    startWelcome(t.hooks, t.settings, t.globals, document);
    press('Open sheet');
    expect(render).toHaveBeenCalledWith(true);
    t.values[WELCOME_SETTING] = false;
    t.change();
    expect(guideText()).toBeNull();
  });
});
