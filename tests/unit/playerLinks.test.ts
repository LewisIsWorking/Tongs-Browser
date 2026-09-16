import { describe, expect, it, vi } from 'vitest';

import type { CooClient, CooResponse } from '../../src/bands/CooClient.js';
import {
  editPlayerLinks,
  readPlayerLinks,
  registerPlayerLinksMenu,
} from '../../src/encounter/playerLinks.js';
import type { LinkGlobals, LinkSettings } from '../../src/encounter/playerLinks.js';

/**
 * Linking each Foundry player user to their Telegram player, chosen from the Path Wars roster. Written 2026-09-16;
 * per-user linking was decided with Lewis.
 */
const ROSTER = [
  { telegramUserId: '111', displayName: 'StorybookRhizome' },
  { telegramUserId: '222', displayName: 'exspiravit_<1>' },
  { telegramUserId: 7, displayName: 'broken row' },
];
const USERS = [
  { id: 'ryo', name: 'ryo yamakawa' },
  { id: 'bella', name: 'Bella' },
  { id: 'kitt', name: 'Kitt' },
];

const world = (answer: unknown, response: CooResponse | 'signed-out' = reply(200, ROSTER)) => {
  const stored = new Map<string, unknown>([['tongs-browser.playerLinks', { ryo: '111' }]]);
  const settings: LinkSettings = {
    register: vi.fn(),
    get: (scope, key) => stored.get(`${scope}.${key}`),
    set: vi.fn((scope: string, key: string, value: unknown) => {
      stored.set(`${scope}.${key}`, value);
      return Promise.resolve(value);
    }),
  };
  const input = vi.fn((options: { content: string }) =>
    Promise.resolve(options.content === '' ? null : answer)
  );
  const globals: LinkGlobals = {
    foundry: { applications: { api: { DialogV2: { input } } } },
    ui: { notifications: { info: vi.fn(), warn: vi.fn() } },
  };
  const client = { call: vi.fn(() => Promise.resolve(response)) } as unknown as CooClient;
  return { settings, globals, client, input, stored };
};
function reply(status: number, body: unknown): CooResponse {
  return { status, json: () => Promise.resolve(body) };
}

describe('the saved links', () => {
  it('keep only a Foundry user linked to a Telegram id of digits', () => {
    const settings = { get: () => ({ ryo: '111', bad: '12ab', empty: '', number: 5 }) };
    expect(readPlayerLinks(settings)).toEqual({ ryo: '111' });
    expect(readPlayerLinks({ get: () => null })).toEqual({});
  });
});

describe('the Telegram players menu', () => {
  it('offers the roster per player, with the saved choice selected and names escaped, and saves only roster players', async () => {
    const w = world({ ryo: '222', bella: '999', kitt: '' });

    expect(await editPlayerLinks(w.settings, w.globals, w.client, () => USERS)).toBe(1);

    const content = w.input.mock.calls[0]?.[0].content ?? '';
    expect(content).toContain('<option value="111" selected>StorybookRhizome</option>');
    expect(content).toContain('exspiravit_&#60;1&#62;');
    expect(content).not.toContain('broken row');
    expect(w.stored.get('tongs-browser.playerLinks')).toEqual({ ryo: '222' });
    expect(w.globals.ui?.notifications?.info).toHaveBeenCalledWith('Linked 1 player to Telegram.');
  });

  it('changes nothing when the dialog is closed, or the roster cannot be loaded', async () => {
    const closed = world(null);
    expect(
      await editPlayerLinks(closed.settings, closed.globals, closed.client, () => USERS)
    ).toBeNull();
    expect(closed.settings.set).not.toHaveBeenCalled();

    for (const response of ['signed-out' as const, reply(403, {}), reply(200, { not: 'a list' })]) {
      const w = world({}, response);
      expect(await editPlayerLinks(w.settings, w.globals, w.client, () => USERS)).toBeNull();
      expect(w.globals.ui?.notifications?.warn).toHaveBeenCalledWith(
        expect.stringContaining('Sign in')
      );
      expect(w.input).not.toHaveBeenCalled();
    }
  });

  it('counts players, and is registered as a GM menu', async () => {
    const w = world({ ryo: '111', bella: '222' });
    expect(await editPlayerLinks(w.settings, w.globals, w.client, () => USERS)).toBe(2);
    expect(w.globals.ui?.notifications?.info).toHaveBeenCalledWith('Linked 2 players to Telegram.');
    expect(registerPlayerLinksMenu(w.settings, w.globals, w.client, () => USERS)).toBe(false);
  });
});
