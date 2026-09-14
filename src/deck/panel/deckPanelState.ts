import type { ApplyOption } from '../applyOptions.js';
import type { MessageFacts, SaveFacts } from '../deckFacts.js';

/**
 * Where the GM is in the roll deck, as plain data. Added 2026-09-14.
 *
 * ⚠️ Pure, with no DOM and no Foundry, so the rules a GM would notice breaking are provable at a desk:
 * which card is shown after one drops out, and that a half-made choice never survives a card change.
 */

/** A choice the GM is part way through making for the card on screen. */
export type Choosing =
  /** A damage card with no recorded target: pick the one token that takes it. */
  | {
      readonly kind: 'apply-target';
      readonly option: ApplyOption;
      /* ⚠️ Carried from the button that was tapped, so every row can say the same hit it did. */
      readonly amount: number;
      readonly types: readonly string[];
    }
  /** A save: pick every token that rolls, then confirm. */
  | {
      readonly kind: 'save-rollers';
      readonly saveIndex: number;
      readonly save: SaveFacts;
      readonly chosen: readonly string[];
    };

export interface DeckPanelState {
  readonly cards: readonly MessageFacts[];
  readonly index: number;
  readonly choosing: Choosing | null;
  /** True while PF2e is working, so a second tap cannot send the same thing twice. */
  readonly busy: boolean;
  /** The last outcome, in words, or null. */
  readonly status: string | null;
}

export function initialState(cards: readonly MessageFacts[]): DeckPanelState {
  return { cards, index: 0, choosing: null, busy: false, status: null };
}

export function currentCard(state: DeckPanelState): MessageFacts | null {
  return state.cards[state.index] ?? null;
}

/**
 * The deck re-read from the chat log.
 *
 * ⚠️ STAYS ON THE SAME CARD when it is still there, because new rolls arriving must not move the GM.
 * When it is gone (it was just handled) the POSITION is kept, which shows the card that came after it:
 * applying one card lands the GM on the next, which is the catch-up flow the deck exists for.
 *
 * ⛔ A choice survives only on the same card. Picking rollers for one card and confirming on another
 * would roll the wrong save.
 */
export function withCards(state: DeckPanelState, cards: readonly MessageFacts[]): DeckPanelState {
  const currentId = currentCard(state)?.id;
  const same = cards.findIndex((card) => card.id === currentId);
  const index = same >= 0 ? same : Math.max(0, Math.min(state.index, cards.length - 1));
  return { ...state, cards, index, choosing: same >= 0 ? state.choosing : null };
}

/** Previous or next, clamped at either end. Moving abandons a half-made choice and the old status. */
export function step(state: DeckPanelState, delta: -1 | 1): DeckPanelState {
  const index = Math.max(0, Math.min(state.index + delta, state.cards.length - 1));
  if (index === state.index) {
    return state;
  }
  return { ...state, index, choosing: null, status: null };
}

export function choose(state: DeckPanelState, choosing: Choosing | null): DeckPanelState {
  return { ...state, choosing, status: null };
}

/** Adds or removes one token from the rollers being chosen. Does nothing outside that choice. */
export function toggleRoller(state: DeckPanelState, tokenUuid: string): DeckPanelState {
  const choosing = state.choosing;
  if (choosing?.kind !== 'save-rollers') {
    return state;
  }
  const chosen = choosing.chosen.includes(tokenUuid)
    ? choosing.chosen.filter((uuid) => uuid !== tokenUuid)
    : [...choosing.chosen, tokenUuid];
  return { ...state, choosing: { ...choosing, chosen } };
}
