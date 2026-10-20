import { describe, expect, it, vi } from 'vitest';

import { startWelcomeDualClass } from '../../src/welcome/startWelcomeDualClass.js';
import type { WelcomeGlobals } from '../../src/welcome/startSheetRequests.js';

/**
 * The welcome's two classes become the Dual class window's own request once the sheet exists. 2026-10-20.
 * The GM's side and the landing are `DualClassRequests` and `startDualClassPlayer`, tested on their own.
 */
const F = 'Compendium.pf2e.classes.Item.F';
const W = 'Compendium.pf2e.classes.Item.W';
const WANTED = { forRequest: 'r1', first: W, second: F };
const settle = async (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

interface Options {
  sheet?: Record<string, unknown> | null;
  flags?: object;
  isGM?: boolean;
  crypto?: boolean;
}

function browser(options: Options = {}) {
  const flags: Record<string, unknown> = { welcomeDualClass: WANTED, ...options.flags };
  const user = {
    id: 'u1',
    isGM: options.isGM === true,
    getFlag: (_scope: string, key: string) => flags[key],
    setFlag: vi.fn(async (_scope: string, key: string, value: unknown) => {
      flags[key] = value;
      return Promise.resolve();
    }),
    unsetFlag: vi.fn(async (_scope: string, key: string) => {
      Reflect.deleteProperty(flags, key);
      return Promise.resolve();
    }),
  };
  const sheetFlags: Record<string, unknown> = { madeForRequest: 'r1' };
  const items: {
    id: string;
    type: string;
    name: string;
    getFlag(s: string, k: string): unknown;
  }[] = [];
  const sheet = {
    id: 'NEW',
    uuid: 'Actor.NEW',
    name: 'Theo',
    type: 'character',
    isOwner: true,
    items: { contents: items },
    getFlag: (_scope: string, key: string) => sheetFlags[key],
    ...options.sheet,
  };
  const actors = options.sheet === null ? [] : [sheet];
  const hooks: Record<string, () => unknown> = {};
  const globals = {
    game: { user, actors: { contents: actors } },
    ...(options.crypto === false ? {} : { crypto: { randomUUID: () => 'd1' } }),
  } as unknown as WelcomeGlobals;
  const summon = vi.fn();
  return {
    flags,
    user,
    actors,
    sheet,
    sheetFlags,
    items,
    hooks,
    summon,
    start: async () => {
      startWelcomeDualClass({ on: (name, fn) => (hooks[name] = fn) }, globals, summon);
      await settle();
    },
    fire: async (name = 'updateUser') => {
      hooks[name]?.();
      await settle();
    },
  };
}

describe('sending the welcome’s dual class', () => {
  it('asks for it on the new sheet, with both classes in order, then forgets the wish', async () => {
    const t = browser();
    await t.start();
    expect(t.flags['dualClassRequest']).toEqual({
      id: 'd1',
      actorId: 'NEW',
      first: W,
      second: F,
      at: expect.any(Number) as number,
    });
    expect(t.flags['welcomeDualClass']).toBeUndefined();
    expect(t.summon).toHaveBeenCalledOnce();
    await t.fire();
    expect(t.user.setFlag).toHaveBeenCalledOnce();
  });

  it('waits for the sheet, then sends when it is made', async () => {
    const t = browser({ sheet: null });
    await t.start();
    expect(t.user.setFlag).not.toHaveBeenCalled();
    t.actors.push(t.sheet);
    await t.fire('createActor');
    expect(t.flags['dualClassRequest']).toMatchObject({ actorId: 'NEW' });
  });

  it('ignores a sheet made for another request, or one not the player’s', async () => {
    const other = browser({ sheet: { getFlag: () => 'r0' } });
    await other.start();
    const theirs = browser({ sheet: { isOwner: false } });
    await theirs.start();
    expect(other.user.setFlag).not.toHaveBeenCalled();
    expect(theirs.user.setFlag).not.toHaveBeenCalled();
    expect(other.flags['welcomeDualClass']).toEqual(WANTED);
  });

  it('waits while an import is still filling the sheet', async () => {
    const t = browser();
    t.sheetFlags['importBuild'] = { name: 'Theo' };
    await t.start();
    expect(t.user.setFlag).not.toHaveBeenCalled();
    t.sheetFlags['importDone'] = true;
    await t.fire('updateActor');
    expect(t.flags['dualClassRequest']).toMatchObject({ actorId: 'NEW', first: W });
  });

  it('waits while a dual class request or answer is already on the user', async () => {
    const asking = { id: 'd0', actorId: 'NEW', first: F, second: W, at: 1 };
    const t = browser({ flags: { dualClassRequest: asking } });
    await t.start();
    expect(t.user.setFlag).not.toHaveBeenCalled();
    const answered = browser({
      flags: { dualClassResult: { kind: 'refused', requestId: 'd0', reason: 'No.' } },
    });
    await answered.start();
    expect(answered.user.setFlag).not.toHaveBeenCalled();
  });

  it('only forgets the wish when the sheet already has a dual class', async () => {
    const t = browser();
    t.items.push({ id: 'C', type: 'class', name: 'Wizard - Fighter', getFlag: () => 'd0' });
    await t.start();
    expect(t.user.setFlag).not.toHaveBeenCalled();
    expect(t.flags['welcomeDualClass']).toBeUndefined();
    expect(t.summon).not.toHaveBeenCalled();
  });

  it('counts a dual class the community macro made, by its name', async () => {
    const t = browser();
    t.items.push({ id: 'C', type: 'class', name: 'Rogue - Bard', getFlag: () => undefined });
    await t.start();
    expect(t.user.setFlag).not.toHaveBeenCalled();
    expect(t.flags['welcomeDualClass']).toBeUndefined();
  });

  it('does nothing without a wish, with a damaged one, or in a GM’s browser', async () => {
    for (const t of [
      browser({ flags: { welcomeDualClass: undefined } }),
      browser({ flags: { welcomeDualClass: { forRequest: 'r1', first: W } } }),
      browser({ isGM: true }),
    ]) {
      await t.start();
      await t.fire();
      expect(t.user.setFlag).not.toHaveBeenCalled();
    }
  });

  it('keeps the wish when writing the request fails, to try again at the next change', async () => {
    const t = browser();
    t.user.setFlag.mockRejectedValueOnce(new Error('offline'));
    await t.start();
    expect(t.flags['welcomeDualClass']).toEqual(WANTED);
    await t.fire();
    expect(t.flags['dualClassRequest']).toMatchObject({ actorId: 'NEW' });
  });

  it('makes up an id without randomUUID, and reads a sheet with no item list as one class', async () => {
    const t = browser({ crypto: false, sheet: { items: undefined } });
    await t.start();
    expect((t.flags['dualClassRequest'] as { id: string }).id).toMatch(/^\d+-/);
  });

  it('keeps the wish through a failure that is not an Error, too', async () => {
    const t = browser();
    t.user.setFlag.mockRejectedValueOnce('offline');
    await t.start();
    expect(t.flags['welcomeDualClass']).toEqual(WANTED);
  });
});
