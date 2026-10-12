import { describe, expect, it, vi } from 'vitest';

import { logger } from '../../src/core/Logger.js';
import { startHelperCall } from '../../src/helper/startHelperCall.js';
import {
  PARTY_OWNERS_SETTING,
  readPartyOwners,
  storePartyOwners,
} from '../../src/owners/partyOwners.js';
import type { OwnerSettings } from '../../src/owners/partyOwners.js';
import { startPartyOwners } from '../../src/owners/startPartyOwners.js';
import { WorldSwapGm } from '../../src/swaps/WorldSwapGm.js';

/**
 * COO's listed users made owners of the world's primary party, and of nothing else. 2026-10-12.
 *
 * Lewis: "Anthony needs to be an owner of every world's primary party sheet (only that sheet, don't be
 * giving him ownership of every party sheet!)".
 */
const ANTHONY = 'AntAntAntAntAnt1';

function settingsHolding(ids: unknown) {
  const values: Record<string, unknown> = { [PARTY_OWNERS_SETTING]: { ids } };
  const settings: OwnerSettings = {
    register: vi.fn(),
    get: (_namespace, key) => values[key],
    set: vi.fn(async (_namespace: string, key: string, value: unknown) => {
      values[key] = value;
      return Promise.resolve();
    }),
  };
  return settings;
}

function party(name: string, ownership: Record<string, number>) {
  const update = vi.fn(async () => Promise.resolve());
  return { name, ownership, update };
}

function table(options: { gm?: 'me' | 'other'; primary?: ReturnType<typeof party> | null } = {}) {
  const me = { id: 'gm', name: 'GM', isGM: true };
  const other = { id: 'gm2', name: 'Other GM', isGM: true };
  const users = new Map<string, { readonly name: string | null }>([
    ['gm', me],
    [ANTHONY, { name: 'MrNegetZ' }],
    ['u1', { name: null }],
  ]);
  return {
    user: me,
    users: { activeGM: options.gm === 'other' ? other : me, get: (id: string) => users.get(id) },
    actors: { party: options.primary === undefined ? party('The Party', {}) : options.primary },
  };
}

const settle = async () => new Promise((resolve) => setTimeout(resolve, 0));

describe('what COO said', () => {
  it('keeps non-empty strings once each, and nothing from junk', () => {
    expect(readPartyOwners([ANTHONY, ' ', 7, ANTHONY, 'x'.repeat(65), ' u1 '])).toEqual([
      ANTHONY,
      'u1',
    ]);
    expect(readPartyOwners({ ids: [ANTHONY] })).toEqual([]);
  });

  it('is written only when it changed', async () => {
    const settings = settingsHolding([ANTHONY]);
    await storePartyOwners(settings, [ANTHONY]);
    expect(settings.set).not.toHaveBeenCalled();
    await storePartyOwners(settings, [ANTHONY, 'u1']);
    expect(settings.set).toHaveBeenCalledWith('tongs-browser', PARTY_OWNERS_SETTING, {
      ids: [ANTHONY, 'u1'],
    });
  });

  it('arrives with the GM heartbeat and through helper.partyOwners(ids)', async () => {
    const store = vi.fn(async () => Promise.resolve());
    const gm = new WorldSwapGm({
      isGm: () => true,
      worldId: () => 'c06',
      call: async () =>
        Promise.resolve({
          status: 200,
          json: async () => Promise.resolve({ partyOwners: [ANTHONY] }),
        }),
      ask: async () => Promise.resolve(false),
      notify: vi.fn(),
      partyOwners: store,
    });
    await gm.beat();
    expect(store).toHaveBeenCalledWith([ANTHONY]);

    const helped = vi.fn(async () => Promise.resolve());
    const entry: { helper?: { partyOwners(ids: string[]): Promise<void> } } = {};
    startHelperCall(
      { on: () => undefined },
      {},
      vi.fn(),
      entry,
      undefined,
      undefined,
      undefined,
      helped
    );
    await entry.helper?.partyOwners([ANTHONY]);
    expect(helped).toHaveBeenCalledWith([ANTHONY]);
    const bare: { helper?: { partyOwners(ids: string[]): Promise<void> } } = {};
    startHelperCall({ on: () => undefined }, {}, vi.fn(), bare);
    await expect(bare.helper?.partyOwners([])).resolves.toBeUndefined();
  });
});

describe('the primary party', () => {
  it('makes a listed user an owner of the primary party, and tells the GM', async () => {
    const primary = party('The Party', { u1: 3, [ANTHONY]: 2 });
    const info = vi.fn();
    const names: string[] = [];
    const settings = settingsHolding([ANTHONY]);
    startPartyOwners({ on: (name: string) => names.push(name) }, settings, {
      game: table({ primary }),
      ui: { notifications: { info } },
    });
    await settle();
    expect(primary.update).toHaveBeenCalledWith({ [`ownership.${ANTHONY}`]: 3 });
    expect(info).toHaveBeenCalledWith('Tongs made MrNegetZ an owner of The Party.');
    expect(settings.register).toHaveBeenCalledWith('tongs-browser', PARTY_OWNERS_SETTING, {
      scope: 'world',
      config: false,
      type: Object,
      default: { ids: [] },
    });
    expect(names).toContain('updateActor');
  });

  it('touches only the primary party, never a second one', async () => {
    const primary = party('The Party', {});
    const second = party('Side Quest', {});
    const game = { ...table({ primary }), parties: [primary, second] };
    startPartyOwners({ on: vi.fn() }, settingsHolding([ANTHONY]), { game });
    await settle();
    expect(primary.update).toHaveBeenCalledOnce();
    expect(second.update).not.toHaveBeenCalled();
  });

  it('makes no update for an owner already, an unknown user, or several named at once', async () => {
    const owned = party('The Party', { [ANTHONY]: 3 });
    startPartyOwners({ on: vi.fn() }, settingsHolding([ANTHONY, 'NobodyNobodyNob1']), {
      game: table({ primary: owned }),
    });
    await settle();
    expect(owned.update).not.toHaveBeenCalled();

    const both = party('The Party', {});
    const info = vi.fn();
    startPartyOwners({ on: vi.fn() }, settingsHolding([ANTHONY, 'u1']), {
      game: table({ primary: both }),
      ui: { notifications: { info } },
    });
    await settle();
    expect(both.update).toHaveBeenCalledWith({ [`ownership.${ANTHONY}`]: 3, 'ownership.u1': 3 });
    expect(info).toHaveBeenCalledWith('Tongs made MrNegetZ and A player an owner of The Party.');
  });

  it('skips a world with no primary party, and does nothing unless this is the designated GM', async () => {
    startPartyOwners({ on: vi.fn() }, settingsHolding([ANTHONY]), {
      game: table({ primary: null }),
    });
    const other = party('The Party', {});
    startPartyOwners({ on: vi.fn() }, settingsHolding([ANTHONY]), {
      game: table({ gm: 'other', primary: other }),
    });
    const player = party('The Party', {});
    startPartyOwners({ on: vi.fn() }, settingsHolding([ANTHONY]), {
      game: { ...table({ primary: player }), user: { id: 'u1', isGM: false } },
    });
    await settle();
    expect(other.update).not.toHaveBeenCalled();
    expect(player.update).not.toHaveBeenCalled();
  });

  it('runs one pass at a time, and logs a failed update', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const primary = party('', {});
    primary.update.mockRejectedValue(new Error('no'));
    const owners = startPartyOwners({ on: vi.fn() }, settingsHolding([ANTHONY]), {
      game: { ...table({ primary }), actors: { party: { ...primary, name: null } } },
    });
    await owners.serve();
    await settle();
    expect(warn).toHaveBeenCalledWith('Party owners failed: no');
    warn.mockRestore();
  });
});
