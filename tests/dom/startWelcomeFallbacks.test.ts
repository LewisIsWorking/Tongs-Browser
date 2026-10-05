import { afterEach, describe, expect, it, vi } from 'vitest';

import { PARTIES_SETTING, WELCOME_SETTING } from '../../src/welcome/startSheetRequests.js';
import type { WelcomeGlobals, WelcomeSettings } from '../../src/welcome/startSheetRequests.js';
import { startWelcome } from '../../src/welcome/startWelcome.js';

/** The player's side in a browser or world missing the usual parts. 2026-10-05. */
afterEach(() => {
  document.body.replaceChildren();
});

const settings = (): WelcomeSettings => ({
  register: vi.fn(),
  get: (_namespace, key) =>
    ({
      [WELCOME_SETTING]: true,
      [PARTIES_SETTING]: { parties: [{ uuid: 'Actor.P', name: 'P', code: 'C06' }] },
    })[key],
  set: vi.fn(),
});

describe('a bare browser and world', () => {
  /** ⚠️ `crypto.randomUUID` only exists in a secure context, and a LAN address over http is not one. */
  it('still makes a request id without crypto, and names an untitled world', async () => {
    const setFlag = vi.fn(async () => Promise.resolve());
    const user = {
      id: 'u1',
      isGM: false,
      getFlag: () => undefined,
      setFlag,
      unsetFlag: async () => Promise.resolve(),
    };
    const game = { user, users: {}, actors: { contents: [] } };
    startWelcome(
      { on: () => undefined },
      settings(),
      { game } as unknown as WelcomeGlobals,
      document
    );
    expect(document.querySelector('#tongs-welcome')?.textContent).toContain('Welcome to the game!');
    [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent === 'Create my character')
      ?.click();
    await vi.waitFor(() => {
      expect(setFlag).toHaveBeenCalled();
    });
    const request = (setFlag.mock.calls[0] as unknown as [string, string, { id: string }])[2];
    expect(request.id).toMatch(/^\d+-0\.\d+$/);
  });

  it('shows the checklist for a nameless sheet with nothing on it yet', () => {
    const sheet = {
      uuid: 'Actor.NEW',
      name: null,
      type: 'character',
      isOwner: true,
      getFlag: (_scope: string, key: string) => (key === 'madeForRequest' ? 'r1' : undefined),
    };
    const game = {
      user: { id: 'u1', isGM: false, getFlag: () => undefined },
      users: {},
      actors: { contents: [sheet] },
    };
    startWelcome(
      { on: () => undefined },
      settings(),
      { game } as unknown as WelcomeGlobals,
      document
    );
    const text = document.querySelector('#tongs-build-guide')?.textContent ?? '';
    expect(text).toContain('Building your character');
    expect(text).not.toContain('✓');
  });
});
