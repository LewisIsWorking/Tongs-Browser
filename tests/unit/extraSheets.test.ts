import { describe, expect, it, vi } from 'vitest';

import {
  EXTRA_SHEETS_SETTING,
  allowedSheets,
  readExtraSheets,
  registerExtraSheets,
  storeExtraSheets,
} from '../../src/welcome/extraSheets.js';
import type { CampaignSettings } from '../../src/welcome/playerCampaigns.js';
import { startHelperCall } from '../../src/helper/startHelperCall.js';
import { WorldSwapGm } from '../../src/swaps/WorldSwapGm.js';

/**
 * A second character sheet, granted through ComeOnOverUno. 2026-10-12.
 *
 * Lewis: "a maximum of 1 additional sheet if they already have 1 sheet ... (maximum 2 in total)".
 */
const ANN = 'AnnAnnAnnAnnAnn1';
const BOB = 'BobBobBobBobBob2';

function settingsHolding(value: unknown) {
  let stored = value;
  const settings: CampaignSettings = {
    register: vi.fn(),
    get: () => stored,
    set: vi.fn(async (_namespace: string, _key: string, next: unknown) => {
      stored = next;
      return Promise.resolve(next);
    }),
  };
  return settings;
}

describe('what COO said', () => {
  it('keeps Foundry ids with a whole number above 0, capped at one extra', () => {
    expect(
      readExtraSheets({ [BOB]: 1, [ANN]: 5, short: 1, CarlCarlCarlCar3: 0, DanDanDanDanDan4: 0.5 })
    ).toEqual({ [ANN]: 1, [BOB]: 1 });
    expect(readExtraSheets({ [ANN]: '1' })).toEqual({});
    for (const junk of [null, 'x', [ANN], 3]) {
      expect(readExtraSheets(junk)).toEqual({});
    }
  });

  it('allows 1 sheet, or 2 with a grant, never more', () => {
    const settings = settingsHolding({ [ANN]: 1, [BOB]: 9 });
    expect(allowedSheets(settings, ANN)).toBe(2);
    expect(allowedSheets(settings, BOB)).toBe(2);
    expect(allowedSheets(settings, 'CarlCarlCarlCar3')).toBe(1);
    expect(allowedSheets(settingsHolding(undefined), ANN)).toBe(1);
  });

  it('is a hidden world setting', () => {
    const settings = settingsHolding({});
    registerExtraSheets(settings);
    expect(settings.register).toHaveBeenCalledWith('tongs-browser', EXTRA_SHEETS_SETTING, {
      scope: 'world',
      config: false,
      type: Object,
      default: {},
    });
  });

  it('is written only when it changed, in any order', async () => {
    const settings = settingsHolding({ [ANN]: 1, [BOB]: 1 });
    await storeExtraSheets(settings, { [BOB]: 1, [ANN]: 1 });
    expect(settings.set).not.toHaveBeenCalled();
    await storeExtraSheets(settings, { [ANN]: 1 });
    expect(settings.set).toHaveBeenCalledWith('tongs-browser', EXTRA_SHEETS_SETTING, { [ANN]: 1 });
  });
});

describe('how it arrives', () => {
  it("is stored from the GM heartbeat's reply, beside playerCampaigns", async () => {
    const extraSheets = vi.fn(async () => Promise.resolve());
    const gm = new WorldSwapGm({
      isGm: () => true,
      worldId: () => 'c06',
      call: async () =>
        Promise.resolve({
          status: 200,
          json: async () => Promise.resolve({ pending: [], extraSheets: { [ANN]: 1 } }),
        }),
      ask: async () => Promise.resolve(false),
      notify: vi.fn(),
      extraSheets,
    });
    expect(await gm.beat()).toBe('beat');
    expect(extraSheets).toHaveBeenCalledWith({ [ANN]: 1 });
  });

  it('is not touched when the reply says nothing about it', async () => {
    const extraSheets = vi.fn(async () => Promise.resolve());
    const gm = new WorldSwapGm({
      isGm: () => true,
      worldId: () => 'c06',
      call: async () => Promise.resolve({ status: 200, json: async () => Promise.resolve({}) }),
      ask: async () => Promise.resolve(false),
      notify: vi.fn(),
      extraSheets,
    });
    await gm.beat();
    expect(extraSheets).not.toHaveBeenCalled();
  });

  it("is stored from COO's helper GM, through helper.extraSheets(map)", async () => {
    const store = vi.fn(async () => Promise.resolve());
    const entry: { helper?: { extraSheets(map: object): Promise<void> } } = {};
    startHelperCall({ on: () => undefined }, {}, vi.fn(), entry, undefined, undefined, store);
    await entry.helper?.extraSheets({ [ANN]: 1 });
    expect(store).toHaveBeenCalledWith({ [ANN]: 1 });

    const bare: { helper?: { extraSheets(map: object): Promise<void> } } = {};
    startHelperCall({ on: () => undefined }, {}, vi.fn(), bare);
    await expect(bare.helper?.extraSheets({})).resolves.toBeUndefined();
  });
});
