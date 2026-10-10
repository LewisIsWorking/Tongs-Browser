import { describe, expect, it, vi } from 'vitest';

import {
  CALL_GAP_MS,
  HelperCall,
  WAITING_PATH,
  startHelperCall,
} from '../../src/helper/startHelperCall.js';
import type { HelperCallPorts } from '../../src/helper/startHelperCall.js';
import type { FoundryGame } from '../../src/foundry/PartyAccess.js';
import { PARTY_LIST_WORK, partyListBehind } from '../../src/welcome/partyListWork.js';
import { PARTIES_SETTING, WELCOME_SETTING } from '../../src/welcome/startSheetRequests.js';

/**
 * A world no GM has opened since its parties got a code: the helper GM is called to share the list.
 * Found live in C00/C01, 2026-10-10: "Day 3 of asking for char sheets".
 */
const riddleport = {
  type: 'party',
  uuid: 'Actor.R',
  name: 'C00: Riddleport',
  getFlag: (_scope: string, key: string) => (key === 'bandsCampaign' ? 'C00' : undefined),
  system: { details: { members: [] } },
};

function gmGame(isGM = true): FoundryGame {
  return { user: { id: 'helper', isGM }, actors: [riddleport] } as unknown as FoundryGame;
}

function settingsWith(values: Record<string, unknown>) {
  return {
    register: vi.fn(),
    get: (_namespace: string, key: string) => values[key],
    set: vi.fn(async () => Promise.resolve()),
  };
}

describe('the party list as waiting work', () => {
  it("is owed while the shared list misses the world's coded parties", () => {
    expect(partyListBehind(settingsWith({ [WELCOME_SETTING]: true }), gmGame())).toBe(true);
  });

  it('is not owed once shared, when the welcome is off, or in a player browser', () => {
    const shared = { parties: [{ uuid: 'Actor.R', name: 'C00: Riddleport', code: 'C00' }] };
    expect(
      partyListBehind(
        settingsWith({ [WELCOME_SETTING]: true, [PARTIES_SETTING]: shared }),
        gmGame()
      )
    ).toBe(false);
    expect(partyListBehind(settingsWith({ [WELCOME_SETTING]: false }), gmGame())).toBe(false);
    expect(partyListBehind(settingsWith({ [WELCOME_SETTING]: true }), gmGame(false))).toBe(false);
  });

  it('is listed first in what the helper reads', () => {
    const entry: { helper?: { waiting(): string[] } } = {};
    startHelperCall({ on: () => undefined }, {}, vi.fn(), entry, undefined, () => [
      PARTY_LIST_WORK,
    ]);
    expect(entry.helper?.waiting()).toEqual([PARTY_LIST_WORK]);
  });
});

function caller(overrides: Partial<HelperCallPorts> = {}) {
  let now = 1_000_000;
  const tell = vi.fn(() => Promise.resolve(200));
  const call = new HelperCall({
    myId: () => 'me',
    queues: () => true,
    worldId: () => 'doomsday-funtime',
    tell,
    now: () => now,
    ...overrides,
  });
  return { call, tell, wait: (ms: number) => (now += ms) };
}

describe('summoning the helper', () => {
  it('asks COO for the world, once a minute at most', async () => {
    const { call, tell, wait } = caller();
    await call.summon();
    await call.summon();
    expect(tell).toHaveBeenCalledTimes(1);
    expect(tell).toHaveBeenCalledWith(WAITING_PATH, { world: 'doomsday-funtime' });
    wait(CALL_GAP_MS);
    await call.summon();
    expect(tell).toHaveBeenCalledTimes(2);
  });

  it('does not ask with a GM online, or with no world', async () => {
    const online = caller({ queues: () => false });
    await online.call.summon();
    const nowhere = caller({ worldId: () => undefined });
    await nowhere.call.summon();
    expect(online.tell).not.toHaveBeenCalled();
    expect(nowhere.tell).not.toHaveBeenCalled();
  });
});
