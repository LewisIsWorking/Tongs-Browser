import { RollDeck } from '../RollDeck.js';
import type { RollDeckGlobals } from '../RollDeck.js';
import { DeckPanel } from './DeckPanel.js';
import { readTokenCandidates } from './tokenCandidates.js';
import type { CandidateGlobals } from './tokenCandidates.js';

/**
 * The real Foundry behind the deck panel. Added 2026-09-14.
 *
 * ⛔ EVERY DECK METHOD IS CALLED ON THE DECK. `RollDeck`'s methods read `this`, and handing them over
 * bare (`cards: deck.cards`) is the detached-call bug that twice shipped working in tests and throwing
 * in Foundry. Each is wrapped so the call is made through the object.
 *
 * ⚠️ Globals are read on every call, never captured: the scene, the combat and PF2e's settings all
 * change while the panel is open.
 */
export interface PanelGlobals extends CandidateGlobals {
  readonly game?: CandidateGlobals['game'] & {
    readonly pf2e?: {
      readonly settings?: { readonly critFumble?: { readonly buttons?: boolean } };
    };
  };
}

export function buildDeckPanel(doc: Document, deck: RollDeck, globals: PanelGlobals): DeckPanel {
  return new DeckPanel({
    document: doc,
    deck: {
      cards: () => deck.cards(),
      apply: async (id, option, target) => deck.apply(id, option, target),
      rollSave: async (id, index, rollers) => deck.rollSave(id, index, rollers),
    },
    candidates: () => readTokenCandidates(globals),
    /* ⚠️ The setting PF2e itself reads to show Triple: `game.pf2e.settings.critFumble.buttons`. */
    offersTriple: () => globals.game?.pf2e?.settings?.critFumble?.buttons === true,
    isGM: () => globals.game?.user?.isGM === true,
  });
}

/** The deck and its panel, as the module holds them. */
export interface RollDeckParts {
  readonly deck: RollDeck;
  readonly panel: DeckPanel;
}

/**
 * ⚠️ The one place the deck meets Foundry's globals, so `ModuleParts` builds it in a line. Both read
 * `globalThis` lazily, on every call, never at construction.
 */
export function buildRollDeck(doc: Document): RollDeckParts {
  const deck = new RollDeck(globalThis as RollDeckGlobals, doc);
  return { deck, panel: buildDeckPanel(doc, deck, globalThis as PanelGlobals) };
}
