import type { SaveFacts } from './deckFacts.js';
import { SAVE_CONTROL_SELECTORS } from './readSaveControls.js';
import type { TargetToken } from './aimAt.js';

/**
 * Rolling a card's save by clicking PF2e's OWN save control, for the tokens the GM chose. Added
 * 2026-09-13.
 *
 * ⛔ WHY CLICK RATHER THAN CALL. PF2e's handlers for both controls are private (`#rollActorSaves` on
 * the chat card, `#onClickInlineCheck` for an `@Check`), and the inline one assembles traits, roll
 * options, DC adjustments and origin before rolling. Calling `actor.saves.will.check.roll()` directly
 * would skip whichever of those a given card uses. Clicking runs all of it.
 *
 * ✅ PROVEN LIVE on pf2e 8.5.0, 2026-09-13: with a Xorn selected, clicking a Quasit's Fear `spell-save`
 * button and its Venom inline check each rolled the Xorn's save against DC 17, with no dialog.
 *
 * ⛔ THE CARD MUST BE IN THE DOCUMENT when clicked. `ChatCards.listen` binds the button directly, but
 * `InlineRollLinks` listens on `document` and a detached element's click never reaches it. Measured: the
 * inline check did nothing detached and rolled once attached. The card is attached hidden and removed
 * straight after.
 *
 * ⛔ SHIFT IS SET FROM THE GM's `showCheckDialogs`, exactly as a shift-click does. PF2e derives
 * `skipDialog` from the event, and a roll that opens its dialog waits for a tap nobody sees.
 *
 * ⚠️ AIMED, NOT SELECTED (since 2026-09-15), so a token on another scene rolls too: both handlers read
 * `game.user.getActiveTokens()` synchronously, before their first `await`. Read in the 8.5.0 bundle;
 * see `aimAt.ts`.
 *
 * ⚠️ WHO ROLLS IS THE GM's CHOICE. Neither measured message recorded a target, so there is nothing to
 * aim at. PF2e rolls every selected token from one click, so all chosen tokens are selected at once.
 */
export interface SavePorts {
  /** The token document, on ANY scene, or null when it no longer exists. */
  readonly tokenFor: (tokenUuid: string) => TargetToken | null;
  readonly canAim: () => boolean;
  readonly aimAt: (tokens: readonly TargetToken[], click: () => void) => void;
  /** The message rendered by Foundry, PF2e's listeners attached, or null when it is gone. */
  readonly renderCard: (messageId: string) => Promise<HTMLElement | null>;
  /** Puts the card into the document, hidden, and returns what takes it out again. */
  readonly attachHidden: (card: HTMLElement) => () => void;
  readonly click: (control: Element, shiftKey: boolean) => void;
  /** The GM's own `showCheckDialogs`; Shift inverts it, as it does for a real click. */
  readonly showsCheckDialogs: () => boolean;
  /** Resolves true once PF2e posts a `saving-throw` for every one of these tokens. */
  readonly savesLanded: (tokenUuids: readonly string[]) => Promise<boolean>;
  readonly markHandled: (messageId: string) => Promise<void>;
}

export interface SaveRequest {
  readonly messageId: string;
  readonly save: SaveFacts;
  readonly tokenUuids: readonly string[];
}

export type SaveOutcome =
  | { readonly kind: 'rolled' }
  /** Nothing was sent to PF2e. The card stays. */
  | { readonly kind: 'refused'; readonly reason: string }
  /** Clicked, but PF2e never posted every save. The card stays, and says so. */
  | { readonly kind: 'unconfirmed'; readonly reason: string };

export async function rollSaveThroughSystem(
  ports: SavePorts,
  request: SaveRequest
): Promise<SaveOutcome> {
  if (request.tokenUuids.length === 0) {
    return { kind: 'refused', reason: 'choose who rolls the save first' };
  }
  const tokens = request.tokenUuids.map((uuid) => ports.tokenFor(uuid));
  if (tokens.some((token) => token === null)) {
    return { kind: 'refused', reason: 'a chosen token is no longer on the scene' };
  }
  if (!ports.canAim()) {
    return { kind: 'refused', reason: 'this browser has no user to roll the save as' };
  }

  /* ⚠️ Rendered BEFORE aiming, so nothing awaits while PF2e is aimed. */
  const card = await ports.renderCard(request.messageId);
  const control = card?.querySelectorAll(SAVE_CONTROL_SELECTORS[request.save.control])[
    request.save.index
  ];
  if (card === null || control === undefined) {
    return { kind: 'refused', reason: 'the card no longer asks for that save' };
  }

  const detach = ports.attachHidden(card);
  let landing: Promise<boolean>;
  try {
    /* ⛔ WATCH BEFORE CLICKING, as `applyThroughSystem` does, or a fast save is missed. */
    landing = ports.savesLanded(request.tokenUuids);
    ports.aimAt(tokens as TargetToken[], () => {
      ports.click(control, ports.showsCheckDialogs());
    });
  } finally {
    detach();
  }

  if (!(await landing)) {
    return { kind: 'unconfirmed', reason: 'PF2e never reported every save, so the card was kept' };
  }
  await ports.markHandled(request.messageId);
  return { kind: 'rolled' };
}
