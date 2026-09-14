import { afterEach, describe, expect, it } from 'vitest';

import type { MessageFacts } from '../../src/deck/deckFacts.js';
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
 * The GM roll deck on screen: the less travelled paths. Written 2026-09-14.
 */
afterEach(() => {
  document.body.replaceChildren();
});

describe('closing while PF2e is still working', () => {
  /** ⚠️ The module's own disable closes the panel, and it may do so mid-apply. Nothing may reappear. */
  it('stays closed when the answer arrives', async () => {
    let answer: (value: { kind: 'applied' }) => void = () => undefined;
    const { panel, deck } = panelWith([jaws]);
    deck.apply.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      })
    );
    panel.open();

    tap('Apply 6 piercing and fire to Xorn');
    panel.close();
    answer({ kind: 'applied' });
    await settle();

    expect(root()).toBeNull();
  });
});

describe('going back', () => {
  it('moves to the previous card', () => {
    panelWith([jaws, fear]).panel.open();

    tap('Next card');
    tap('Previous card');

    expect(root()?.textContent).toContain('Card 1 of 2');
  });

  it('leaves the choice of target without applying', () => {
    const { panel, deck } = panelWith([untargeted]);
    panel.open();

    tap('Choose who takes 6 piercing and fire');
    tap('Back to the card');

    expect(labels()).toContain('Choose who takes 6 piercing and fire');
    expect(deck.apply).not.toHaveBeenCalled();
  });
});

describe('what a card cannot offer', () => {
  it('says so when damage sits only on a later roll, offering no apply', () => {
    const later: MessageFacts = {
      ...jaws,
      damage: [{ rollIndex: 1, total: 4, types: ['fire'], amounts: { full: 4 } }],
    };
    panelWith([later]).panel.open();

    expect(root()?.textContent).toContain("PF2e can only apply this message's first roll");
    expect(labels().some((label) => label.startsWith('Apply'))).toBe(false);
  });

  it('says so when there is nobody on the scene to choose', () => {
    panelWith([fear], { candidates: () => [] }).panel.open();

    tap('Choose who rolls Will DC 17');

    expect(root()?.textContent).toContain('There are no tokens on this scene to choose from.');
  });

  it('shows no card at all when the deck is empty', () => {
    panelWith([]).panel.open();

    expect(root()?.textContent).toContain('Nothing to apply or roll');
  });
});

describe('naming a card', () => {
  it('says so when the speaker is unknown, and shows no item when there is none', () => {
    panelWith([{ ...jaws, speaker: '', title: null }]).panel.open();

    expect(root()?.querySelector('.tb-roll-deck__title')?.textContent).toBe('Unknown speaker');
  });
});

describe('opening again', () => {
  /** A second tap on the tray button re-reads the deck into the same panel rather than stacking one. */
  it('reuses the open panel and picks up new cards', () => {
    const { panel, deck } = panelWith([jaws]);
    panel.open();
    deck.cards.mockReturnValue([jaws, fear]);

    panel.open();

    expect(document.querySelectorAll('.tb-roll-deck')).toHaveLength(1);
    expect(root()?.textContent).toContain('Card 1 of 2');
  });
});

describe('a failure that is not an Error', () => {
  it('still says what PF2e reported', async () => {
    const { panel, deck } = panelWith([jaws]);
    deck.apply.mockRejectedValueOnce('socket closed');
    panel.open();

    tap('Apply 6 piercing and fire to Xorn');
    await settle();

    expect(root()?.textContent).toContain('PF2e reported an error: socket closed');
  });
});

describe('telling creatures apart', () => {
  it("shows each row's HP beside the name", () => {
    const wounded = [
      { tokenUuid: 'Scene.S.Token.G1', name: 'Goblin 1', hp: '15/15 HP' },
      { tokenUuid: 'Scene.S.Token.G2', name: 'Goblin 2', hp: '3/15 HP' },
    ];
    panelWith([untargeted, fear], { candidates: () => wounded }).panel.open();

    tap('Choose who takes 6 piercing and fire');
    expect(labels()).toContain('Apply 6 piercing and fire to Goblin 2 (3/15 HP)');
    tap('Back to the card');
    tap('Next card');
    tap('Choose who rolls Will DC 17');
    expect(labels()).toContain('Goblin 1 (15/15 HP)');
  });
});
