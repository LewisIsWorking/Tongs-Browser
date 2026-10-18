import { describe, expect, it, vi } from 'vitest';

import type { CooClient } from '../../src/bands/CooClient.js';
import { startBands } from '../../src/bands/startBands.js';
import { campaignOfCharacter, postHpChange } from '../../src/bands/startHpLog.js';
import type { HpChangePost } from '../../src/bands/hpChange.js';
import { world } from './support/bandsWorld.js';

/**
 * The HP log through the real hooks, party campaigns and ComeOnOverUno call. Written 2026-10-17. ⚠️ The character
 * is a world actor in the party, edited with no token and no fight: a sheet edit is a change too.
 */
const start = () => {
  const w = world();
  const lorn = {
    id: 'PC',
    uuid: 'Actor.PC',
    name: 'Lorn',
    type: 'character',
    system: { attributes: { hp: { value: 52, max: 52, sp: { value: 14, max: 14 } } } },
  };
  (w.globals.game.actors as unknown[]).push(lorn);
  const call = vi.fn(() =>
    Promise.resolve({ status: 200, json: () => Promise.resolve({ recorded: true }) })
  );
  const globals = { ...w.globals, game: { ...w.globals.game, system: { id: 'pf2e' } } };
  startBands(w.hooks, w.settings, globals, { postBand: vi.fn(), call } as unknown as CooClient);
  const edit = (sp: number) => {
    lorn.system.attributes.hp.sp.value = sp;
    w.handlers.get('updateActor')?.(lorn, {
      system: { attributes: { hp: { sp: { value: sp } } } },
    });
  };
  return { ...w, call, edit, lorn };
};

const change: HpChangePost = {
  actorId: 'PC',
  name: 'Lorn',
  hpAfter: 52,
  maxHp: 52,
  reason: 'manual change',
  at: '2026-10-17T12:00:00.000Z',
};

describe('the HP log, end to end', () => {
  it('records a sheet edit out of combat to the party campaign, with "manual change"', async () => {
    const { call, edit } = start();

    edit(3);

    /* No damage-taken card: the cause window closes and the change is a manual one. */
    await vi.waitFor(
      () => {
        expect(call).toHaveBeenCalledWith(
          'POST',
          '/api/pathwars/campaigns/C06/hp-change',
          expect.objectContaining({
            actorId: 'PC',
            name: 'Lorn',
            hpBefore: 52,
            hpAfter: 52,
            spBefore: 14,
            spAfter: 3,
            maxSp: 14,
            reason: 'manual change',
          })
        );
      },
      { timeout: 5000 }
    );
  });

  it('reads the campaign from the parties that list the character', () => {
    const { globals, lorn } = start();
    expect(campaignOfCharacter(lorn, globals.game as never)).toEqual({ kind: 'one', code: 'C06' });
    expect(campaignOfCharacter({ ...lorn, uuid: 'Actor.Other' }, globals.game as never).kind).toBe(
      'none'
    );
  });
});

describe('posting one change', () => {
  const answer = (status: number, json: () => Promise<unknown>) => ({
    call: vi.fn(() => Promise.resolve({ status, json })),
  });

  it('is sent only when COO says it recorded it', async () => {
    expect(
      await postHpChange(
        answer(200, () => Promise.resolve({ recorded: true })),
        'C06',
        change
      )
    ).toBe('sent');
  });

  it('reads a 404, or an older server\'s web page, as "not deployed"', async () => {
    expect(
      await postHpChange(
        answer(404, () => Promise.resolve({})),
        'C06',
        change
      )
    ).toBe('not-deployed');
    expect(
      await postHpChange(
        answer(200, () => Promise.reject(new Error('not JSON'))),
        'C06',
        change
      )
    ).toBe('not-deployed');
  });

  it('reads any other answer as failed, and no session as signed out', async () => {
    expect(
      await postHpChange(
        answer(400, () => Promise.resolve({})),
        'C06',
        change
      )
    ).toBe('failed');
    expect(
      await postHpChange(
        { call: vi.fn(() => Promise.resolve('signed-out' as const)) },
        'C06',
        change
      )
    ).toBe('signed-out');
  });
});
