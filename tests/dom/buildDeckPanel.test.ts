import { afterEach, describe, expect, it } from 'vitest';

import type { RollDeck } from '../../src/deck/RollDeck.js';
import { buildDeckPanel } from '../../src/deck/panel/buildDeckPanel.js';
import type { PanelGlobals } from '../../src/deck/panel/buildDeckPanel.js';
import { jaws } from './support/deckPanelWorld.js';

/**
 * The real Foundry behind the deck panel. Written 2026-09-14.
 *
 * ⛔ The fake deck's methods read `this`, like `RollDeck`'s. Handing them over bare would work on an
 * arrow-function stub and throw in a real game, which has happened twice in this module.
 */
afterEach(() => {
  document.body.replaceChildren();
});

class FakeDeck {
  public readonly applied: string[] = [];
  private readonly held = [jaws];

  public cards() {
    return this.held;
  }

  public async apply(id: string, option: string, target: string) {
    this.applied.push(`${id} ${option} ${target}`);
    return Promise.resolve({ kind: 'applied' as const });
  }

  public async rollSave() {
    this.applied.push('save');
    return Promise.resolve({ kind: 'rolled' as const });
  }
}

const gm = (critFumbleButtons: boolean): PanelGlobals => ({
  game: {
    user: { isGM: true },
    pf2e: { settings: { critFumble: { buttons: critFumbleButtons } } },
  },
});

const buttonLabels = () =>
  [...document.querySelectorAll('.tb-roll-deck button')].map((button) => button.textContent);

describe('the deck behind the panel', () => {
  it('lists and applies through the deck object itself', async () => {
    const deck = new FakeDeck();
    buildDeckPanel(document, deck as unknown as RollDeck, gm(false)).open();

    document.querySelector<HTMLButtonElement>('[data-deck-action="apply-full"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(deck.applied).toEqual(['jaws full Scene.S.Token.X']);
  });
});

describe("PF2e's settings and the viewer", () => {
  it("offers Triple exactly when PF2e's crit and fumble buttons are on", () => {
    buildDeckPanel(document, new FakeDeck() as unknown as RollDeck, gm(true)).open();
    expect(buttonLabels().some((label) => label.includes('(triple)'))).toBe(true);

    document.body.replaceChildren();
    buildDeckPanel(document, new FakeDeck() as unknown as RollDeck, gm(false)).open();
    expect(buttonLabels().some((label) => label.includes('(triple)'))).toBe(false);
  });

  it('does not open for a player', () => {
    const player = { game: { user: { isGM: false } } } as PanelGlobals;

    buildDeckPanel(document, new FakeDeck() as unknown as RollDeck, player).open();

    expect(document.querySelector('.tb-roll-deck')).toBeNull();
  });
});

describe('rolling a save through the panel', () => {
  it('calls rollSave on the deck object, for the token chosen from the scene', async () => {
    const deck = new FakeDeck();
    const saveCard = {
      ...jaws,
      id: 'fear',
      damage: [],
      saves: [{ statistic: 'will' as const, dc: 17, control: 'spell-save' as const, index: 0 }],
    };
    Object.assign(deck, { held: [saveCard] });
    const globals: PanelGlobals = {
      game: { user: { isGM: true } },
      canvas: { tokens: { placeables: [{ document: { uuid: 'Scene.S.Token.X', name: 'Xorn' } }] } },
    };
    buildDeckPanel(document, deck as unknown as RollDeck, globals).open();

    document.querySelector<HTMLButtonElement>('[data-deck-action="save-0"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-token-uuid="Scene.S.Token.X"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-deck-action="confirm"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(deck.applied).toEqual(['save']);
  });
});
