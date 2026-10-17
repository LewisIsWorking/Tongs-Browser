import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../src/core/Logger.js';
import { ITEM, settle, table } from './support/dualClassWorld.js';

/** The player side, answered: a dual class lands on the sheet, or the refusal is shown. 2026-10-12. */
afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const built = (actorId = 'A1') => ({ kind: 'built', requestId: 'r1', actorId, item: ITEM });

describe('the GM’s answer', () => {
  it('lands a dual class on the sheet, says so, and clears the answer', async () => {
    const world = table({ flags: { dualClassResult: built() } });
    await settle();
    expect(world.create).toHaveBeenCalledExactlyOnceWith('Item', [ITEM]);
    const done = 'Kibwe is now a Fighter - Wizard. PF2e may ask you to choose class features.';
    expect(world.info).toHaveBeenCalledExactlyOnceWith(done);
    expect(world.text()).toContain(done);
    expect(world.flags['dualClassResult']).toBeUndefined();
  });

  it('says so when the sheet is not theirs any more', async () => {
    const world = table({ flags: { dualClassResult: built('GONE') } });
    await settle();
    expect(world.create).not.toHaveBeenCalled();
    expect(world.text()).toContain('That did not work');
    expect(world.info).toHaveBeenCalledWith(
      'That character sheet is not yours to change any more.'
    );
  });

  it('shows a refusal with its reason, and clears it', async () => {
    const world = table();
    world.flags['dualClassResult'] = { kind: 'refused', requestId: 'r1', reason: 'Not this one.' };
    world.hooks['updateUser']?.();
    await settle();
    expect(world.text()).toContain('Not this one.');
    expect(world.flags['dualClassResult']).toBeUndefined();
  });

  it('lands it once when the user changes again mid-landing', async () => {
    const world = table({ flags: { dualClassResult: built() } });
    world.hooks['updateUser']?.();
    world.hooks['updateUser']?.();
    await settle();
    expect(world.create).toHaveBeenCalledOnce();
  });

  it('keeps the answer for next time when landing fails, and logs why', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const world = table({
      flags: { dualClassResult: built() },
      create: async () => Promise.reject(new Error('socket closed')),
    });
    await settle();
    expect(warn).toHaveBeenCalledWith('Dual class did not land: socket closed');
    expect(world.flags['dualClassResult']).toEqual(built());
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the case under test
    table({ flags: { dualClassResult: built() }, create: async () => Promise.reject('down') });
    await settle();
    expect(warn).toHaveBeenCalledWith('Dual class did not land: down');
  });
});
