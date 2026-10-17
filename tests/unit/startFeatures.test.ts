import { beforeEach, describe, expect, it, vi } from 'vitest';

import { startFeatures } from '../../src/StartFeatures.js';
import type { FeatureParts } from '../../src/StartFeatures.js';
import type { CooClient } from '../../src/bands/CooClient.js';
import { startAutoApply } from '../../src/automation/startAutoApply.js';
import { startSaveSummary } from '../../src/automation/startSaveSummary.js';
import { startSpellSaves } from '../../src/automation/startSpellSaves.js';
import { startSpellDamage } from '../../src/automation/startSpellDamage.js';
import { startBands } from '../../src/bands/startBands.js';
import { startEncounterSync } from '../../src/encounter/startEncounterSync.js';
import { startWorldSwaps } from '../../src/swaps/startWorldSwaps.js';
import { startWelcome } from '../../src/welcome/startWelcome.js';
import { startHelperCall } from '../../src/helper/startHelperCall.js';
import { startDualClass } from '../../src/dualclass/startDualClass.js';

/**
 * What `ready` starts, and what it must not start without a ComeOnOverUno client. Written 2026-09-20.
 *
 * ⛔ THE CASE THIS EXISTS FOR: encounter sync and world swaps have settings that only exist when `init`
 * managed to build the client. Starting them anyway reads settings Foundry never registered, which
 * throws inside `ready` and takes the rest of the module's startup with it.
 */
vi.mock('../../src/automation/startAutoApply.js', () => ({ startAutoApply: vi.fn() }));
vi.mock('../../src/automation/startSpellSaves.js', () => ({ startSpellSaves: vi.fn() }));
vi.mock('../../src/automation/startSpellDamage.js', () => ({ startSpellDamage: vi.fn() }));
vi.mock('../../src/automation/startSaveSummary.js', () => ({
  startSaveSummary: vi.fn(() => ({ onDamageApplied: 'told' })),
}));
vi.mock('../../src/bands/startBands.js', () => ({ startBands: vi.fn() }));
vi.mock('../../src/encounter/startEncounterSync.js', () => ({ startEncounterSync: vi.fn() }));
vi.mock('../../src/swaps/startWorldSwaps.js', () => ({ startWorldSwaps: vi.fn() }));
vi.mock('../../src/welcome/startWelcome.js', () => ({ startWelcome: vi.fn() }));
vi.mock('../../src/dualclass/startDualClass.js', () => ({ startDualClass: vi.fn() }));
const { summon } = vi.hoisted(() => ({ summon: vi.fn(async () => Promise.resolve()) }));
vi.mock('../../src/helper/startHelperCall.js', () => ({
  startHelperCall: vi.fn(() => ({ summon })),
}));

const client = { call: vi.fn() } as unknown as CooClient;

const parts = (over: Partial<FeatureParts> = {}): FeatureParts =>
  ({
    deck: { deck: true },
    hooks: { on: vi.fn(), once: vi.fn(), off: vi.fn(), callAll: vi.fn() },
    settings: { register: vi.fn(), get: vi.fn(), set: vi.fn() },
    globals: globalThis,
    document: { nodeType: 9 },
    client,
    ...over,
  }) as unknown as FeatureParts;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('what ready starts', () => {
  it('starts every feature when init built a ComeOnOverUno client', () => {
    startFeatures(parts());

    for (const start of [
      startAutoApply,
      startSpellSaves,
      startSpellDamage,
      startBands,
      startEncounterSync,
      startWorldSwaps,
      startDualClass,
    ]) {
      expect(start).toHaveBeenCalledTimes(1);
    }
  });

  it('leaves the ComeOnOverUno features alone when there is no client, and starts the rest', () => {
    startFeatures(parts({ client: null }));

    expect(startAutoApply).toHaveBeenCalledTimes(1);
    expect(startSpellDamage).toHaveBeenCalledTimes(1);
    /* The saves card hears about the damage spell automation applies. */
    expect(startSaveSummary).toHaveBeenCalledTimes(1);
    expect(vi.mocked(startSpellDamage).mock.calls[0]?.[4]).toBe('told');
    /* Health bands take the client and handle a null themselves: signed out is a state they show. */
    expect(startBands).toHaveBeenCalledWith(expect.anything(), expect.anything(), globalThis, null);
    expect(startEncounterSync).not.toHaveBeenCalled();
    expect(startWorldSwaps).not.toHaveBeenCalled();
  });
});

describe('the welcome and the helper GM', () => {
  /* C00/C01, 2026-10-10: a world with no shared party list now calls the helper GM, which shares it. */
  it('hands the welcome a way to call the helper, and the helper the party list as work', async () => {
    startFeatures(parts());
    const call = vi.mocked(startWelcome).mock.calls[0]?.[4];
    call?.();
    await Promise.resolve();
    expect(summon).toHaveBeenCalledOnce();
    /* COO down: the call fails quietly, the welcome carries on. */
    summon.mockRejectedValueOnce(new Error('COO is down'));
    call?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(summon).toHaveBeenCalledTimes(2);
    const moreWork = vi.mocked(startHelperCall).mock.calls[0]?.[5];
    expect(moreWork?.()).toEqual([]);
  });
});

describe("what COO says about this world's players", () => {
  /* 2026-10-12: extra sheets and primary party owners, from the heartbeat and from the helper GM. */
  it('stores campaigns, extra sheets and party owners from both the heartbeat and the helper', async () => {
    const values: Record<string, unknown> = {};
    const set = vi.fn(async (_namespace: string, key: string, value: unknown) => {
      values[key] = value;
      return Promise.resolve();
    });
    startFeatures(
      parts({
        settings: {
          register: vi.fn(),
          get: (_namespace: string, key: string) => values[key],
          set,
        } as unknown as FeatureParts['settings'],
      })
    );
    const extras = vi.mocked(startWorldSwaps).mock.calls[0]?.[4];
    const ann = 'AnnAnnAnnAnnAnn1';
    await extras?.campaigns?.({ [ann]: ['C06'] });
    await extras?.extraSheets?.({ [ann]: 1 });
    await extras?.partyOwners?.([ann]);
    expect(values).toMatchObject({
      playerCampaigns: { [ann]: ['C06'] },
      extraSheets: { [ann]: 1 },
      partyOwners: { ids: [ann] },
    });
    const helperArgs = vi.mocked(startHelperCall).mock.calls[0];
    await helperArgs?.[6]?.({});
    await helperArgs?.[7]?.([]);
    expect(values).toMatchObject({ extraSheets: {}, partyOwners: { ids: [] } });
  });
});
