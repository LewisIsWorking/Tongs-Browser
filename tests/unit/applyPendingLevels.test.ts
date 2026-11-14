import { describe, expect, it } from 'vitest';

import { applyPendingLevels } from '../../src/levels/startPendingLevels.js';
import { gate, levelActor, levelWorld } from './support/levelWorld.js';

/**
 * Applying pending levels, 2026-11-14: the level through PF2e, then HP to the new maximum, then the flag
 * unset, then the GM told, one actor at a time. The flag goes whatever happens.
 */
const LEVEL = 'system.details.level.value';
const HP = 'system.attributes.hp.value';
const UNSET = 'unset tongs-browser.pendingLevel';

describe('applying pending levels', () => {
  it('levels, then sets HP to the new maximum, then unsets the flag, then tells the GM', async () => {
    const log: string[] = [];
    const scout = levelActor(log, 'Scout', { level: 3, pending: 7 });
    const idle = levelActor(log, 'Idle', { level: 2 });
    const w = levelWorld(log, [idle, scout]);

    await expect(applyPendingLevels(w.globals)).resolves.toBe(1);

    expect(log).toEqual([
      `Scout {"${LEVEL}":7}`,
      `Scout {"${HP}":70}`,
      `Scout ${UNSET}`,
      'info: Tongs levelled Scout to 7',
    ]);
    expect(idle.update).not.toHaveBeenCalled();
    expect(idle.unsetFlag).not.toHaveBeenCalled();
  });

  it('lowers a level too', async () => {
    const log: string[] = [];
    const w = levelWorld(log, [levelActor(log, 'Scout', { level: 9, pending: 4 })]);

    await expect(applyPendingLevels(w.globals)).resolves.toBe(1);

    expect(log).toEqual([
      `Scout {"${LEVEL}":4}`,
      `Scout {"${HP}":40}`,
      `Scout ${UNSET}`,
      'info: Tongs levelled Scout to 4',
    ]);
  });

  it('does one actor at a time, the next only once the last level change has finished', async () => {
    const log: string[] = [];
    const prompt = gate();
    const first = levelActor(log, 'First', { pending: 5, gate: prompt.promise });
    const second = levelActor(log, 'Second', { pending: 6 });
    const w = levelWorld(log, [first, second]);

    const done = applyPendingLevels(w.globals);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(log).toEqual([`First {"${LEVEL}":5}`]);

    prompt.open();
    await expect(done).resolves.toBe(2);
    expect(log.indexOf('info: Tongs levelled First to 5')).toBeLessThan(
      log.indexOf(`Second {"${LEVEL}":6}`)
    );
  });

  it('ignores a value that is not a whole number from 1 to 20, warns the GM and clears it', async () => {
    const log: string[] = [];
    const odd = levelActor(log, 'Odd', { level: 3, pending: 21 });
    const text = levelActor(log, 'Text', { level: 3, pending: '7' });
    const w = levelWorld(log, [odd, text]);

    await expect(applyPendingLevels(w.globals)).resolves.toBe(0);

    expect(odd.update).not.toHaveBeenCalled();
    expect(text.update).not.toHaveBeenCalled();
    expect(log).toEqual([
      `Odd ${UNSET}`,
      expect.stringMatching(/^warn: Tongs ignored the pending level 21 on Odd: /),
      `Text ${UNSET}`,
      expect.stringMatching(/^warn: Tongs ignored the pending level "7" on Text: /),
    ]);
  });

  it('unsets the flag even when the level update throws, warns, and goes on to the next', async () => {
    const log: string[] = [];
    const broken = levelActor(log, 'Broken', { pending: 5, failWith: new Error('no class') });
    const fine = levelActor(log, 'Fine', { pending: 2 });
    const w = levelWorld(log, [broken, fine]);

    await expect(applyPendingLevels(w.globals)).resolves.toBe(1);

    expect(log.slice(0, 3)).toEqual([
      `Broken {"${LEVEL}":5}`,
      `Broken ${UNSET}`,
      expect.stringMatching(/^warn: Tongs could not level Broken to 5: no class\. /),
    ]);
    expect(log).toContain('info: Tongs levelled Fine to 2');
  });

  it('warns when the actor was already at that level, because PF2e then grants nothing', async () => {
    const log: string[] = [];
    const w = levelWorld(log, [levelActor(log, 'Same', { level: 7, pending: 7 })]);

    await expect(applyPendingLevels(w.globals)).resolves.toBe(1);

    expect(log.at(-2)).toBe(`Same ${UNSET}`);
    expect(log.at(-1)).toMatch(/^warn: Tongs found Same already at level 7, so PF2e granted/);
  });

  it('carries on when a flag will not clear, and with no ui to tell anybody', async () => {
    const log: string[] = [];
    const stuck = levelActor(log, 'Stuck', { pending: 3 });
    stuck.unsetFlag.mockRejectedValueOnce(new Error('locked'));
    const odd = levelActor(log, 'Odd', { pending: 0 });
    const broken = levelActor(log, 'Broken', { pending: 5, failWith: 'offline' });
    const w = levelWorld(log, [stuck, odd, broken], { ui: false });

    await expect(applyPendingLevels(w.globals)).resolves.toBe(1);

    expect(broken.unsetFlag).toHaveBeenCalledWith('tongs-browser', 'pendingLevel');
    expect(log.filter((line) => line.startsWith('info') || line.startsWith('warn'))).toEqual([]);
  });

  it('names an actor with no name, and sets no HP where there is no maximum', async () => {
    const log: string[] = [];
    const nameless = { ...levelActor(log, 'Nameless', { pending: 2 }), name: null, system: {} };
    const w = levelWorld(log, [nameless]);

    await applyPendingLevels(w.globals);

    expect(log).toEqual([
      `Nameless {"${LEVEL}":2}`,
      `Nameless ${UNSET}`,
      'info: Tongs levelled an actor to 2',
    ]);
  });

  it("does nothing in a player's browser", async () => {
    const log: string[] = [];
    const scout = levelActor(log, 'Scout', { pending: 7 });

    await expect(
      applyPendingLevels(levelWorld(log, [scout], { gm: false }).globals)
    ).resolves.toBeNull();
    expect(log).toEqual([]);
  });
});
