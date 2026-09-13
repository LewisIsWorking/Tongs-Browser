import { APPLY_OPTIONS, applyLabel } from '../applyOptions.js';
import type { ApplyOption } from '../applyOptions.js';
import type { MessageFacts, SaveFacts } from '../deckFacts.js';
import { rollLabel } from './deckLabels.js';
import * as state from './deckPanelState.js';
import type { DeckPanelState } from './deckPanelState.js';
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
  readonly applyTo: (optionId: ApplyOption['id'], targetUuid: string) => void;
  readonly rollFor: (
    saveIndex: number,
    save: SaveFacts,
    rollers: readonly TokenCandidate[]
  ) => void;
}

const NO_TOKENS = 'There are no tokens on this scene to choose from.';

function targetPicker(ctx: BodyContext, optionId: ApplyOption['id']): HTMLElement {
  const option = APPLY_OPTIONS.find((each) => each.id === optionId);
  const roll = ctx.card.damage.find((each) => each.rollIndex === 0);
  const amount = roll?.amounts[optionId];
  return buildPicker(ctx.doc, {
    title: 'Who takes it?',
    /* ⚠️ Each row is the whole sentence, so the tap that decides also says what it will do. */
    rows: ctx.candidates.map((candidate) => ({
      id: candidate.tokenUuid,
      label:
        option === undefined || roll === undefined || amount === undefined
          ? candidate.name
          : applyLabel(option, amount, roll.types, candidate.name),
    })),
    onRow: (uuid) => {
      ctx.applyTo(optionId, uuid);
    },
    empty: NO_TOKENS,
    onCancel: () => {
      ctx.update(state.choose(ctx.view, null));
    },
  });
}

function rollerPicker(ctx: BodyContext, saveIndex: number, chosenUuids: readonly string[]) {
  const save = ctx.card.saves[saveIndex];
  const chosen = ctx.candidates.filter((candidate) => chosenUuids.includes(candidate.tokenUuid));
  return buildPicker(ctx.doc, {
    title: 'Who rolls?',
    rows: ctx.candidates.map((candidate) => ({
      id: candidate.tokenUuid,
      label: candidate.name,
      pressed: chosenUuids.includes(candidate.tokenUuid),
    })),
    onRow: (uuid) => {
      ctx.update(state.toggleRoller(ctx.view, uuid));
    },
    empty: NO_TOKENS,
    ...(save === undefined
      ? {}
      : {
          confirm: {
            label: rollLabel(save, chosen),
            enabled: chosen.length > 0,
            onTap: () => {
              ctx.rollFor(saveIndex, save, chosen);
            },
          },
        }),
    onCancel: () => {
      ctx.update(state.choose(ctx.view, null));
    },
  });
}

export function buildDeckBody(ctx: BodyContext): HTMLElement {
  const choosing = ctx.view.choosing;
  if (choosing?.kind === 'apply-target') {
    return targetPicker(ctx, choosing.optionId);
  }
  if (choosing?.kind === 'save-rollers') {
    return rollerPicker(ctx, choosing.saveIndex, choosing.chosen);
  }
  const target = ctx.card.target;
  return buildCardView(
    ctx.doc,
    ctx.card,
    {
      /* ⚠️ No recorded target means the button asks, decided 2026-09-13. It never guesses. */
      apply: (optionId) => {
        if (target === null) {
          ctx.update(state.choose(ctx.view, { kind: 'apply-target', optionId }));
        } else {
          ctx.applyTo(optionId, target.tokenUuid);
        }
      },
      chooseRollers: (saveIndex) => {
        ctx.update(state.choose(ctx.view, { kind: 'save-rollers', saveIndex, chosen: [] }));
      },
    },
    ctx.offersTriple
  );
}
