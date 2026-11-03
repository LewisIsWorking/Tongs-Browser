import { describe, expect, it } from 'vitest';

import {
  BREATHER_TITLE,
  NO_CHARACTER_TEXT,
  NO_STAMINA_TEXT,
  breatherCard,
  takeABreatherNoLimit,
} from '../../src/breather/takeABreather.js';
import type { BreatherActor } from '../../src/breather/takeABreather.js';
import { character, world } from './support/breatherWorld.js';
/**
 * Take a Breather without the Resolve Point, 2026-11-02. Lewis: "an unlimited stamina version of the take a
 * breather macro ... that doesn't use a resolve point for out of combat healing". Compared against PF2e
 * 8.6.1's `takeABreather`, which spends one Resolve Point and refills Stamina Points to their max.
 */

describe('take a breather, no resolve', () => {
  it('refills Stamina to max, spends no Resolve, and posts a card that says so', async () => {
    const kibwe = character();
    const w = world({ tokens: [{ actor: kibwe.actor }] });

    const outcome = await takeABreatherNoLimit(w.globals);

    expect(outcome).toEqual({ kind: 'done', refreshed: ['Kibwe (token)'], skipped: [] });
    expect(kibwe.update).toHaveBeenCalledWith({ 'system.attributes.hp.sp.value': 20 });
    expect(kibwe.update).toHaveBeenCalledTimes(1);
    const sent = (kibwe.update.mock.calls[0] as unknown as [object])[0];
    expect(Object.keys(sent).some((key) => key.includes('resolve'))).toBe(false);
    expect(w.create).toHaveBeenCalledWith({
      speaker: { alias: 'Kibwe (token)' },
      content: breatherCard('Kibwe (token)', { value: 3, max: 20 }),
      /* What the GM's browser posts to the combat topic from (breatherPost.ts). */
      flags: {
        'tongs-browser': {
          breather: {
            actorUuid: 'Actor.Kibwe',
            name: 'Kibwe (token)',
            spBefore: 3,
            maxSp: 20,
            img: 'tokens/kibwe.webp',
          },
        },
      },
    });
    expect(w.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ window: { title: BREATHER_TITLE } })
    );
  });

  it('works with no Resolve Points left, where PF2e would send you to bed', async () => {
    const kibwe = character();
    const w = world({ tokens: [{ actor: kibwe.actor }] });
    await takeABreatherNoLimit(w.globals);
    expect(kibwe.actor.system?.attributes?.hp?.sp).toEqual({ value: 3, max: 20 });
    expect(kibwe.update).toHaveBeenCalled();
  });

  it('names the 10 minute rest and says plainly no Resolve Point was spent', () => {
    const card = breatherCard('Lai', { value: 5, max: 12 });
    expect(card).toContain('Lai has 5/12 SP and takes a 10 minute breather out of combat.');
    expect(card).toContain('Stamina refreshed to 12/12.');
    expect(card).toContain('No-Limit Stamina: no Resolve Point spent');
    expect(card).toContain('out of combat');
  });

  it('says so and does nothing in a world without the Stamina variant', async () => {
    const kibwe = character();
    const w = world({ stamina: false, tokens: [{ actor: kibwe.actor }] });
    expect(await takeABreatherNoLimit(w.globals)).toEqual({ kind: 'no-stamina' });
    expect(w.warn).toHaveBeenCalledWith(NO_STAMINA_TEXT);
    expect(w.confirm).not.toHaveBeenCalled();
    expect(kibwe.update).not.toHaveBeenCalled();
    expect(await takeABreatherNoLimit({})).toEqual({ kind: 'no-stamina' });
  });

  it('asks for a character when none is selected or assigned, as PF2e does', async () => {
    const npc = { isOfType: () => false } as BreatherActor;
    const w = world({ tokens: [{ actor: npc }, { actor: null }, {}] });
    expect(await takeABreatherNoLimit(w.globals)).toEqual({ kind: 'no-character' });
    expect(w.error).toHaveBeenCalledWith(NO_CHARACTER_TEXT);
    const bare = world();
    bare.globals = { ...bare.globals, game: { ...bare.globals.game, user: {} } };
    expect(await takeABreatherNoLimit(bare.globals)).toEqual({ kind: 'no-character' });
  });

  it('uses the assigned character when nothing is selected, even with no token placed', async () => {
    const kibwe = character();
    const w = world({ character: kibwe.actor });
    expect(await takeABreatherNoLimit(w.globals)).toMatchObject({ refreshed: ['Kibwe (token)'] });
  });

  it('does nothing when the dialog is declined, or there is no dialog to ask', async () => {
    const kibwe = character();
    expect(
      await takeABreatherNoLimit(
        world({ tokens: [{ actor: kibwe.actor }], confirm: false }).globals
      )
    ).toEqual({ kind: 'cancelled' });
    expect(
      await takeABreatherNoLimit(
        world({ tokens: [{ actor: kibwe.actor }], noDialog: true }).globals
      )
    ).toEqual({ kind: 'cancelled' });
    expect(kibwe.update).not.toHaveBeenCalled();
  });
});
