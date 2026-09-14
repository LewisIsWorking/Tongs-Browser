import { afterEach, describe, expect, it } from 'vitest';

import { fear, jaws, labels, panelWith, root, settle, tap } from './support/deckPanelWorld.js';

/**
 * The GM roll deck on screen: save cards, and moving through the deck. Split from
 * `deckPanel.test.ts` at the 200 line limit, 2026-09-14.
 */
afterEach(() => {
  document.body.replaceChildren();
});

describe('a save card', () => {
  it('rolls for exactly the creatures chosen, naming them first', async () => {
    const { panel, deck } = panelWith([fear]);
    panel.open();

    tap('Choose who rolls Will DC 17');
    const confirm = () => root()?.querySelector<HTMLButtonElement>('[data-deck-action="confirm"]');
    expect(confirm()?.disabled).toBe(true);
    tap('Goblin');
    tap('Orc');
    tap('Goblin');
    expect(
      root()?.querySelector('[data-token-uuid="Scene.S.Token.G2"]')?.getAttribute('aria-pressed')
    ).toBe('true');
    tap('Roll Will DC 17 for Orc');
    await settle();

    expect(deck.rollSave).toHaveBeenCalledWith('fear', 0, ['Scene.S.Token.G2']);
  });

  it('goes back to the card without rolling', () => {
    const { panel, deck } = panelWith([fear]);
    panel.open();

    tap('Choose who rolls Will DC 17');
    tap('Back to the card');

    expect(labels()).toContain('Choose who rolls Will DC 17');
    expect(deck.rollSave).not.toHaveBeenCalled();
  });
});

describe('moving through the deck', () => {
  it('disables Previous on the first card and Next on the last', () => {
    panelWith([jaws, fear]).panel.open();
    const control = (action: string) =>
      root()?.querySelector<HTMLButtonElement>(`[data-deck-action="${action}"]`);

    expect(control('previous')?.disabled).toBe(true);
    tap('Next card');
    expect(root()?.textContent).toContain('Card 2 of 2');
    expect(control('next')?.disabled).toBe(true);
  });

  it('picks up new rolls when asked', () => {
    const { panel, deck } = panelWith([jaws]);
    panel.open();
    deck.cards.mockReturnValue([jaws, fear]);

    tap('Check for new rolls');

    expect(root()?.textContent).toContain('Card 1 of 2');
  });
});
