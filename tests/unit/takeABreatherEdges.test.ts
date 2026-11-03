import { describe, expect, it, vi } from 'vitest';

import { breatherCard, takeABreatherNoLimit } from '../../src/breather/takeABreather.js';
import type { BreatherActor } from '../../src/breather/takeABreather.js';
import { character, world } from './support/breatherWorld.js';

/** Take a Breather (No-Limit Stamina) in an encounter, and when Foundry's chat class is missing. 2026-11-02. */
describe('take a breather, no resolve, at the edges', () => {
  it('skips a character in a started encounter, with a card saying why', async () => {
    const fighting = character({ name: 'Lai', inCombat: true });
    const resting = character({ name: 'Kibwe' });
    const w = world({
      started: true,
      tokens: [{ actor: fighting.actor }, { actor: resting.actor }, { actor: resting.actor }],
    });

    const outcome = await takeABreatherNoLimit(w.globals);

    expect(outcome).toEqual({
      kind: 'done',
      refreshed: ['Kibwe (token)'],
      skipped: ['Lai (token)'],
    });
    expect(fighting.update).not.toHaveBeenCalled();
    expect(resting.update).toHaveBeenCalledTimes(1);
    expect(w.create).toHaveBeenCalledWith({
      speaker: { alias: 'Lai (token)' },
      content:
        'Lai (token) is in an encounter, so cannot take the out-of-combat breather until it ends.',
    });
  });

  it('lets an encounter that has not started yet go ahead', async () => {
    const lai = character({ name: 'Lai', inCombat: true });
    const w = world({ started: false, tokens: [{ actor: lai.actor }] });
    expect(await takeABreatherNoLimit(w.globals)).toMatchObject({ refreshed: ['Lai (token)'] });
  });

  it('passes over a character with no Stamina pool, as PF2e does', async () => {
    const none = character({ sp: null });
    const w = world({ tokens: [{ actor: none.actor }] });
    expect(await takeABreatherNoLimit(w.globals)).toEqual({
      kind: 'done',
      refreshed: [],
      skipped: [],
    });
    expect(w.create).not.toHaveBeenCalled();
  });

  it('falls back to the base ChatMessage, then to an alias, and to the actor name', async () => {
    const create = vi.fn(async () => Promise.resolve());
    const actor = {
      name: 'Lai',
      system: { attributes: { hp: { sp: { value: 1, max: 9 } } } },
      isOfType: () => true,
      img: 'lai.webp',
    } as BreatherActor;
    const w = world({ tokens: [{ actor }] });
    w.globals = { ...w.globals, ChatMessage: { create } };
    await takeABreatherNoLimit(w.globals);
    expect(create).toHaveBeenCalledWith({
      speaker: { alias: 'Lai' },
      content: breatherCard('Lai', { value: 1, max: 9 }),
      flags: {
        'tongs-browser': { breather: { name: 'Lai', spBefore: 1, maxSp: 9, img: 'lai.webp' } },
      },
    });
    const nameless = { ...actor, name: null } as BreatherActor;
    const n = world({ tokens: [{ actor: nameless }] });
    const { ChatMessage, ...withoutChat } = n.globals;
    expect(ChatMessage).toBeDefined();
    expect(await takeABreatherNoLimit(withoutChat)).toMatchObject({ refreshed: ['A character'] });
    expect(nameless.update).toBeUndefined();
  });
});
