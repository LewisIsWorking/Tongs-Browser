import { describe, expect, it, vi } from 'vitest';

import {
  editPartyCampaigns,
  registerPartyCampaignsMenu,
} from '../../src/bands/partyCampaignsMenu.js';
import { escapeHtml } from '../../src/bands/settingsMenu.js';
import type { PartyCampaignEntry } from '../../src/foundry/PartyAccess.js';

/**
 * Setting each party's campaign from the module settings. Written 2026-09-15.
 *
 * ⚠️ Party fakes read `this`, so writing a flag through a detached `setFlag` fails here.
 */
const PARTIES: PartyCampaignEntry[] = [
  { uuid: 'Actor.Kibwe', name: 'Kibwe <The Brave>', campaign: 'C06' },
  { uuid: 'Actor.Metal', name: 'Metal City', campaign: undefined },
  { uuid: 'Actor.Theria', name: 'Theria', campaign: 'C08' },
];

const world = (answer: unknown) => {
  const written: [string, unknown][] = [];
  const actor = (uuid: string) => ({
    uuid,
    async setFlag(this: { uuid: string }, scope: string, key: string, value: unknown) {
      written.push([`${this.uuid} ${scope}.${key}`, value]);
      return Promise.resolve();
    },
  });
  const input = vi.fn<(options: { content: string }) => Promise<unknown>>(() =>
    Promise.resolve(answer)
  );
  const globals = {
    foundry: { applications: { api: { DialogV2: { input } } } },
    ui: { notifications: { info: vi.fn(), warn: vi.fn() } },
    fromUuidSync: (uuid: string) => actor(uuid),
  };
  return { globals, input, written };
};

describe('setting party campaigns', () => {
  it('shows every party with its code, escaped, and saves only what changed', async () => {
    const w = world({ party0: 'C06', party1: ' c09 ', party2: '' });

    expect(await editPartyCampaigns(w.globals, () => PARTIES)).toBe(2);

    const content = w.input.mock.calls[0]?.[0].content ?? '';
    expect(content).toContain('Kibwe &#60;The Brave&#62;');
    expect(content).toContain('value="C08"');
    expect(w.written).toEqual([
      ['Actor.Metal tongs-browser.bandsCampaign', 'C09'],
      ['Actor.Theria tongs-browser.bandsCampaign', ''],
    ]);
    expect(w.globals.ui.notifications.info).toHaveBeenCalledWith(
      'Saved the campaign for 2 parties.'
    );
  });

  it('refuses a value that is not a code, leaving that party as it was', async () => {
    const w = world({ party0: 'Kibwe', party1: 'C09', party2: 'C08' });

    expect(await editPartyCampaigns(w.globals, () => PARTIES)).toBe(1);

    expect(w.globals.ui.notifications.warn).toHaveBeenCalledWith(
      expect.stringContaining('"Kibwe" is not a campaign code')
    );
    expect(w.written).toEqual([['Actor.Metal tongs-browser.bandsCampaign', 'C09']]);
    expect(w.globals.ui.notifications.info).toHaveBeenCalledWith('Saved the campaign for 1 party.');
  });

  it('does nothing when the dialog is closed, and says so when there are no parties', async () => {
    const closed = world(null);
    expect(await editPartyCampaigns(closed.globals, () => PARTIES)).toBe(0);
    expect(closed.written).toEqual([]);

    const empty = world({});
    expect(await editPartyCampaigns(empty.globals, () => [])).toBe(0);
    expect(empty.globals.ui.notifications.warn).toHaveBeenCalledWith(
      expect.stringContaining('no parties')
    );
    expect(empty.input).not.toHaveBeenCalled();

    expect(await editPartyCampaigns({}, () => PARTIES)).toBe(0);
    const unwritable = world({ party1: 'C09' });
    expect(
      await editPartyCampaigns({ ...unwritable.globals, fromUuidSync: () => null }, () => PARTIES)
    ).toBe(1);
  });

  it('registers a GM-only menu, an ApplicationV2, that opens the dialog', () => {
    const registerMenu = vi.fn();
    class ApplicationV2 {
      public render(): unknown {
        return undefined;
      }
    }
    const w = world(null);
    const globals = {
      ...w.globals,
      foundry: { applications: { api: { ...w.globals.foundry.applications.api, ApplicationV2 } } },
    };

    expect(registerPartyCampaignsMenu({ registerMenu }, globals, () => PARTIES)).toBe(true);
    const data = registerMenu.mock.calls[0]?.[2] as {
      restricted: boolean;
      type: new () => { render(): unknown };
    };
    expect(registerMenu.mock.calls[0]?.[1]).toBe('partyCampaigns');
    expect(data.restricted).toBe(true);
    new data.type().render();
    expect(w.input).toHaveBeenCalled();
    expect(escapeHtml(`"it's" & <b>`)).toBe('&#34;it&#39;s&#34; &#38; &#60;b&#62;');
  });
});
