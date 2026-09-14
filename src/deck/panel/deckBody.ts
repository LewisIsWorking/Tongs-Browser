import { applyLabel } from '../applyOptions.js';
import type { ApplyOption } from '../applyOptions.js';
import type { MessageFacts, SaveFacts } from '../deckFacts.js';
import { rollLabel } from './deckLabels.js';
import * as state from './deckPanelState.js';
import type { Choosing, DeckPanelState } from './deckPanelState.js';
import { buildCardView, buildPicker } from './deckViews.js';
import type { TokenCandidate } from './tokenCandidates.js';

/**
 * The middle of the panel: the card, or the choice the GM is part way through for it. Added 2026-09-14,
 * split from `DeckPanel` at the 200 line limit along the seam between WHAT is shown and the panel's
 * lifecycle.
 *
 * ⚠️ Decides nothing on its own. Every tap becomes either a new state (handed to `update`) or a request
 * to PF2e (handed to `applyTo` or `rollFor`), so the panel stays the one place that talks to the deck.
 */
export interface BodyContext {
  readonly doc: Document;
  readonly card: MessageFacts;
  readonly view: DeckPanelState;
  readonly candidates: readonly TokenCandidate[];
  readonly offersTriple: boolean;
  readonly update: (next: DeckPanelState) => void;
  /** Sends one apply. `label` is the sentence the tapped control showed, reported once done. */
  readonly applyTo: (optionId: ApplyOption['id'], targetUuid: string, label: string) => void;
  readonly rollFor: (
    saveIndex: number,
    save: SaveFacts,
    rollers: readonly TokenCandidate[]
  ) => void;
}

const NO_TOKENS = 'There are no tokens on this scene to choose from.';

/** A row names its creature's HP too, so two goblins of one name are still told apart. */
const withHp = (label: string, candidate: TokenCandidate) =>
  candidate.hp === null ? label : `${label} (${candidate.hp})`;

type ApplyChoice = Extract<Choosing, { kind: 'apply-target' }>;
type RollerChoice = Extract<Choosing, { kind: 'save-rollers' }>;

function targetPicker(ctx: BodyContext, choice: ApplyChoice): HTMLElement {
  return buildPicker(ctx.doc, {
    title: 'Who takes it?',
    /* ⚠️ Each row is the whole sentence, so the tap that decides also says what it will do. */
    rows: ctx.candidates.map((candidate) => ({
      id: candidate.tokenUuid,
      label: withHp(
        applyLabel(choice.option, choice.amount, choice.types, candidate.name),
        candidate
      ),
    })),
    onRow: (row) => {
      ctx.applyTo(choice.option.id, row.id, row.label);
    },
    empty: NO_TOKENS,
    onCancel: () => {
      ctx.update(state.choose(ctx.view, null));
    },
  });
}

function rollerPicker(ctx: BodyContext, choice: RollerChoice): HTMLElement {
  const chosen = ctx.candidates.filter((candidate) => choice.chosen.includes(candidate.tokenUuid));
  return buildPicker(ctx.doc, {
    title: 'Who rolls?',
    rows: ctx.candidates.map((candidate) => ({
      id: candidate.tokenUuid,
      label: withHp(candidate.name, candidate),
      pressed: choice.chosen.includes(candidate.tokenUuid),
    })),
    onRow: (row) => {
      ctx.update(state.toggleRoller(ctx.view, row.id));
    },
    empty: NO_TOKENS,
    confirm: {
      label: rollLabel(choice.save, chosen),
      enabled: chosen.length > 0,
      onTap: () => {
        ctx.rollFor(choice.saveIndex, choice.save, chosen);
      },
    },
    onCancel: () => {
      ctx.update(state.choose(ctx.view, null));
    },
  });
}

export function buildDeckBody(ctx: BodyContext): HTMLElement {
  const choosing = ctx.view.choosing;
  if (choosing?.kind === 'apply-target') {
    return targetPicker(ctx, choosing);
  }
  if (choosing?.kind === 'save-rollers') {
    return rollerPicker(ctx, choosing);
  }
  const target = ctx.card.target;
  return buildCardView(
    ctx.doc,
    ctx.card,
    {
      /* ⚠️ No recorded target means the button asks, decided 2026-09-13. It never guesses. */
      apply: (option, amount, types, label) => {
        if (target === null) {
          ctx.update(state.choose(ctx.view, { kind: 'apply-target', option, amount, types }));
        } else {
          ctx.applyTo(option.id, target.tokenUuid, label);
        }
      },
      chooseRollers: (saveIndex, save) => {
        ctx.update(state.choose(ctx.view, { kind: 'save-rollers', saveIndex, save, chosen: [] }));
      },
    },
    ctx.offersTriple
  );
}
