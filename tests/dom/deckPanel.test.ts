import { afterEach, describe, expect, it } from 'vitest';

import {
  fear,
  jaws,
  labels,
  panelWith,
  root,
  settle,
  tap,
  untargeted,
} from './support/deckPanelWorld.js';

/**
 * The GM roll deck on screen: who can open it, and damage cards. Written 2026-09-14.
 *
 * ⚠️ Driven through its buttons, found by what they SAY, because the label is the contract with a GM
 * on a phone: a button whose text is wrong still clicks perfectly. Save cards and moving through the
 * deck are in `deckPanelSaves.test.ts`.
 */
afterEach(() => {
  document.body.replaceChildren();
});

describe('who can open it', () => {
  /** ⛔ Players must never see this view, whatever route opened it. */
  it('does nothing for a player', () => {
    panelWith([jaws], { isGM: () => false }).panel.open();

    expect(root()).toBeNull();
  });

  it('opens for a GM as our own interface, and closes', () => {
    const { panel } = panelWith([jaws]);

    panel.open();
    expect(root()?.getAttribute('data-tongs-browser')).toBe('ignore');
    expect(panel.isOpen()).toBe(true);

    tap('Close the roll deck');
    expect(root()).toBeNull();
    expect(panel.isOpen()).toBe(false);
  });
});

describe('a damage card', () => {
  it('says what it is and names every apply on its button, without Triple unless PF2e offers it', () => {
    panelWith([jaws]).panel.open();

    expect(root()?.textContent).toContain('Card 1 of 1');
    expect(root()?.textContent).toContain('Fire Mephit: Jaws');
    expect(labels()).toContain('Apply 6 piercing and fire to Xorn');
    expect(labels()).toContain('Apply 2 piercing and fire to Xorn (half)');
    expect(labels()).toContain('Heal Xorn for 6');
    expect(labels().some((label) => label.includes('(triple)'))).toBe(false);
  });

  it('offers Triple when PF2e shows it', () => {
    panelWith([jaws], { offersTriple: () => true }).panel.open();

    expect(labels()).toContain('Apply 18 piercing and fire to Xorn (triple)');
  });

  /** ⛔ A player names their character; nothing they type is parsed as HTML in the GM's browser. */
  it('shows a speaker as text, never as markup', () => {
    panelWith([{ ...jaws, speaker: '<img src=x id=injected>' }]).panel.open();

    expect(document.getElementById('injected')).toBeNull();
    expect(root()?.textContent).toContain('<img src=x id=injected>');
  });

  it('applies to the recorded target, then moves on to the next card', async () => {
    const { panel, deck } = panelWith([jaws, fear]);
    panel.open();

    tap('Apply 6 piercing and fire to Xorn');
    expect(labels().every((_, i) => root()?.querySelectorAll('button')[i]?.disabled)).toBe(true);
    await settle();

    expect(deck.apply).toHaveBeenCalledWith('jaws', 'full', 'Scene.S.Token.X');
    expect(root()?.textContent).toContain('Done: Apply 6 piercing and fire to Xorn.');
    expect(root()?.textContent).toContain('Fire Mephit: Fear');
  });

  it('asks who takes it when no target was recorded, naming the hit on every row', async () => {
    const { panel, deck } = panelWith([untargeted]);
    panel.open();

    tap('Choose who takes 2 piercing and fire (half)');
    tap('Apply 2 piercing and fire to Orc (half)');
    await settle();

    expect(deck.apply).toHaveBeenCalledWith('loose', 'half', 'Scene.S.Token.G2');
  });

  it('keeps the card and shows the reason when PF2e refuses', async () => {
    const { panel, deck } = panelWith([jaws]);
    deck.apply.mockResolvedValueOnce({ kind: 'refused', reason: 'the target is gone' } as never);
    panel.open();

    tap('Apply 6 piercing and fire to Xorn');
    await settle();

    expect(root()?.textContent).toContain('the target is gone');
    expect(root()?.textContent).toContain('Card 1 of 1');
  });

  /** ⛔ Never left busy: a throw from PF2e would otherwise lock every button until a reload. */
  it('reports a throw and unlocks the buttons', async () => {
    const { panel, deck } = panelWith([jaws]);
    deck.apply.mockRejectedValueOnce(new Error('PF2e broke'));
    panel.open();

    tap('Apply 6 piercing and fire to Xorn');
    await settle();

    expect(root()?.textContent).toContain('PF2e reported an error: PF2e broke');
    expect(root()?.querySelector<HTMLButtonElement>('[data-deck-action="close"]')?.disabled).toBe(
      false
    );
  });
});
