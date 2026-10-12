import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../src/core/Logger.js';
import { startDualClass } from '../../src/dualclass/startDualClass.js';
import type { DualClassGlobals } from '../../src/dualclass/startDualClass.js';
import { fighter, wizard } from './support/dualClasses.js';

/** The GM side wired to Foundry: hooks, compendiums and a request answered end to end. 2026-10-12. */
afterEach(() => {
  vi.restoreAllMocks();
});

const FIGHTER = 'Compendium.pf2e.classes.Item.F';
const WIZARD = 'Compendium.pf2e.classes.Item.W';
const DOCS: Record<string, unknown> = {
  [FIGHTER]: { type: 'class', name: 'Fighter', toObject: () => ({ system: fighter().system }) },
  [WIZARD]: { type: 'class', name: 'Wizard', toObject: () => ({ system: wizard().system }) },
};

function table(over: { system?: string; fromUuid?: DualClassGlobals['fromUuid'] } = {}) {
  const update = vi.fn(async () => Promise.resolve());
  const info = vi.fn();
  const hooks: Record<string, () => unknown> = {};
  const gm = { id: 'gm', name: 'GM', isGM: true };
  const request = { id: 'r1', actorId: 'A1', first: FIGHTER, second: WIZARD, at: 1 };
  const player = {
    id: 'u1',
    name: 'Lai',
    update,
    getFlag: (scope: string, key: string) =>
      scope === 'tongs-browser' && key === 'dualClassRequest' ? request : undefined,
  };
  const globals = {
    game: {
      user: gm,
      users: { activeGM: gm, contents: [gm, player] },
      actors: {
        get: (id: string) =>
          id === 'A1' ? { name: 'Kibwe', type: 'character', ownership: { u1: 3 } } : undefined,
      },
      packs: { get: (key: string) => (key === 'pf2e.classes' ? {} : undefined) },
      ...(over.system === undefined ? {} : { system: { id: over.system } }),
    },
    ui: { notifications: { info } },
    fromUuid:
      'fromUuid' in over
        ? over.fromUuid
        : async (uuid: string) => Promise.resolve(DOCS[uuid] ?? null),
  } as unknown as DualClassGlobals;
  const start = (doc = {} as Document): void => {
    startDualClass({ on: (name, fn) => (hooks[name] = fn) }, globals, doc);
  };
  return { start, update, info, hooks, globals };
}

const settle = async (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('the GM side', () => {
  it('answers a waiting request at start, puts the item on the answer and tells the GM', async () => {
    const { start, update, info } = table();
    start();
    await settle();
    expect(info).toHaveBeenCalledExactlyOnceWith(
      "Tongs gave Lai's Kibwe the Fighter - Wizard dual class."
    );
    expect(update).toHaveBeenCalledOnce();
    const written = (update.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(written['flags.tongs-browser.-=dualClassRequest']).toBeNull();
    expect(written['flags.tongs-browser.dualClassResult']).toMatchObject({
      kind: 'built',
      actorId: 'A1',
      item: { name: 'Fighter - Wizard', img: 'systems/pf2e/icons/spells/guidance.webp' },
    });
  });

  it('uses the world system for the picture', async () => {
    const { start, update } = table({ system: 'sf2e' });
    start();
    await settle();
    expect(JSON.stringify(update.mock.calls[0])).toContain(
      'systems/sf2e/icons/spells/guidance.webp'
    );
  });

  it('is not started in a player’s browser', async () => {
    const { start, update, hooks, globals } = table();
    (globals.game as { user: object }).user = { id: 'u1', isGM: false };
    start({ addEventListener: vi.fn() } as unknown as Document);
    await settle();
    expect(update).not.toHaveBeenCalled();
    expect(Object.keys(hooks)).toEqual(['updateUser']);
  });

  it('wakes on a user changing and a user connecting', () => {
    const { start, hooks } = table();
    start();
    expect(Object.keys(hooks).sort()).toEqual(['updateUser', 'userConnected']);
  });

  it('refuses a class it cannot load, or that is not a document with a source', async () => {
    for (const found of [
      null,
      { name: 'Wizard' },
      { toObject: () => ({ system: {} }) },
      { name: 'W', toObject: () => ({}) },
      { name: 'W', toObject: () => ({ system: {} }) },
    ]) {
      const { start, update } = table({
        fromUuid: async (uuid) => Promise.resolve(uuid === WIZARD ? found : DOCS[uuid]),
      });
      start();
      await settle();
      expect(JSON.stringify(update.mock.calls[0])).toContain('could not find that class');
    }
  });

  it('refuses when this client has no fromUuid', async () => {
    const { start, update } = table({ fromUuid: undefined });
    start();
    await settle();
    expect(JSON.stringify(update.mock.calls[0])).toContain('could not find that class');
  });

  it('logs a failed pass rather than throwing into Foundry', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const { start, update } = table({ fromUuid: async () => Promise.reject(new Error('offline')) });
    start();
    await settle();
    expect(update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('Dual class requests failed: offline');
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the case under test
    const odd = table({ fromUuid: async () => Promise.reject('down') });
    odd.start();
    await settle();
    expect(warn).toHaveBeenCalledWith('Dual class requests failed: down');
  });
});
