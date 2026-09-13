import { describe, expect, it } from 'vitest';

import { RollDeck } from '../../src/deck/RollDeck.js';

/**
 * The deck's cards and save rolling with a real document. Written 2026-09-14.
 *
 * ⚠️ In the DOM project because a save is read by parsing the message's stored HTML, which the node
 * suite's fake document cannot do. The fixture is the measured Fear card from pf2e 8.5.0.
 */
const FEAR = '<button data-action="spell-save" data-save="will" data-dc="17">Will Save</button>';

const world = () => ({
  game: {
    user: { isGM: true },
    system: { id: 'pf2e' },
    messages: {
      contents: [{ id: 'fear', timestamp: 1, visible: true, content: FEAR, alias: 'Quasit' }],
    },
  },
});

describe('a save card, read from its HTML', () => {
  it('is a card carrying its measured save', () => {
    const [card] = new RollDeck(world(), document).cards();

    expect(card?.saves).toEqual([{ statistic: 'will', dc: 17, control: 'spell-save', index: 0 }]);
  });

  /** Reaches PF2e's route, which refuses an empty choice before selecting or clicking anything. */
  it('refuses to roll it for nobody', async () => {
    const outcome = await new RollDeck(world(), document).rollSave('fear', 0, []);

    expect(outcome.kind === 'refused' && outcome.reason).toContain('choose who rolls');
  });

  it('refuses a save index the card does not have', async () => {
    const outcome = await new RollDeck(world(), document).rollSave('fear', 1, ['Scene.S.Token.T']);

    expect(outcome.kind === 'refused' && outcome.reason).toContain('no longer asks for a save');
  });
});
