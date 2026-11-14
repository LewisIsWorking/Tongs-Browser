import { describe, expect, it, vi } from 'vitest';

import { pendingLevelApi, startPendingLevels } from '../../src/levels/startPendingLevels.js';
import { logger } from '../../src/core/Logger.js';
import { drained, gate, levelActor, levelWorld } from './support/levelWorld.js';

/**
 * Pending levels wired to Foundry, 2026-11-14: at `ready` and on `updateActor`, only the designated GM's
 * browser acts, and everything waits its turn in one queue. The API is a GM's own call.
 */
const LEVEL = 'system.details.level.value';
const setFlag = (value: unknown) => ({ flags: { 'tongs-browser': { pendingLevel: value } } });

describe('at ready', () => {
  it("applies every pending level in the designated GM's browser", async () => {
    const log: string[] = [];
    const w = levelWorld(log, [levelActor(log, 'Scout', { level: 3, pending: 7 })]);

    startPendingLevels(w.hooks, w.globals);
    await drained();

    expect(log).toContain('info: Tongs levelled Scout to 7');
  });

  it('leaves it to the designated GM when this is another GM, and to any GM in a player browser', async () => {
    const log: string[] = [];
    const scout = levelActor(log, 'Scout', { pending: 7 });

    const other = levelWorld(log, [scout], { designated: false });
    startPendingLevels(other.hooks, other.globals);
    const player = levelWorld(log, [scout], { gm: false, designated: false });
    startPendingLevels(player.hooks, player.globals);
    await drained();

    expect(log).toEqual([]);
  });
});

describe('when the flag is set on a running world', () => {
  it('applies it in the designated GM browser', async () => {
    const log: string[] = [];
    const scout = levelActor(log, 'Scout', { level: 3 });
    const w = levelWorld(log, [scout]);
    startPendingLevels(w.hooks, w.globals);
    await drained();

    scout.flags['tongs-browser']['pendingLevel'] = 4;
    w.handlers.get('updateActor')?.(scout, setFlag(4), {}, 'me');
    await drained();

    expect(log).toEqual([
      `Scout {"${LEVEL}":4}`,
      expect.stringContaining('Scout {"system.attributes.hp.value":40}'),
      'Scout unset tongs-browser.pendingLevel',
      'info: Tongs levelled Scout to 4',
    ]);
  });

  it('ignores the writes made while applying it, and other GMs and players', async () => {
    const log: string[] = [];
    const scout = levelActor(log, 'Scout', { pending: 4 });
    const other = levelWorld(log, [], { designated: false });
    startPendingLevels(other.hooks, other.globals);
    const me = levelWorld(log, []);
    startPendingLevels(me.hooks, me.globals);

    other.handlers.get('updateActor')?.(scout, setFlag(4));
    me.handlers.get('updateActor')?.(scout, { system: { details: { level: { value: 4 } } } });
    await drained();

    expect(log).toEqual([]);
  });

  it('waits for the launch sweep to finish before starting, so prompts never pile up', async () => {
    const log: string[] = [];
    const prompt = gate();
    const first = levelActor(log, 'First', { pending: 5, gate: prompt.promise });
    const late = levelActor(log, 'Late');
    const w = levelWorld(log, [first, late]);
    startPendingLevels(w.hooks, w.globals);
    await new Promise((resolve) => setTimeout(resolve, 0));

    late.flags['tongs-browser']['pendingLevel'] = 2;
    w.handlers.get('updateActor')?.(late, setFlag(2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(log).toEqual([`First {"${LEVEL}":5}`]);

    prompt.open();
    await drained();
    expect(log.indexOf('info: Tongs levelled First to 5')).toBeLessThan(
      log.indexOf(`Late {"${LEVEL}":2}`)
    );
    expect(log.at(-1)).toBe('info: Tongs levelled Late to 2');
  });

  it('logs, rather than throws, when telling the GM fails', async () => {
    const log: string[] = [];
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const scout = levelActor(log, 'Scout', { pending: 4 });
    const w = levelWorld(log, [scout]);
    let thrown: unknown = new Error('no ui yet');
    const broken = {
      ...w.globals,
      ui: {
        notifications: {
          info: () => {
            throw thrown;
          },
        },
      },
    };

    startPendingLevels(w.hooks, broken);
    await drained();
    thrown = 'still none';
    scout.flags['tongs-browser']['pendingLevel'] = 5;
    w.handlers.get('updateActor')?.(scout, setFlag(5));
    await drained();

    expect(warn).toHaveBeenCalledWith('Pending levels failed: no ui yet');
    expect(warn).toHaveBeenCalledWith('Pending levels failed: still none');
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

describe('the API', () => {
  it("is applyPendingLevels, for a GM's macro, and resolves to how many were levelled", async () => {
    const log: string[] = [];
    const w = levelWorld(log, [levelActor(log, 'Scout', { pending: 7 })], { designated: false });

    await expect(pendingLevelApi(w.globals).applyPendingLevels()).resolves.toBe(1);
    await expect(
      pendingLevelApi(levelWorld(log, [], { gm: false }).globals).applyPendingLevels()
    ).resolves.toBeNull();
  });
});
