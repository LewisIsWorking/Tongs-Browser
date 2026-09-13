import type { ApplyOption } from './applyOptions.js';

/**
 * Applying a damage card by making PF2e run its OWN apply, aimed at the roll's target. Added 2026-09-13.
 *
 * ⛔ WHY NOT REBUILD PF2e's APPLY. Its `applyDamageFromMessage` is private to the system bundle, and so
 * is `extractEphemeralEffects`, which it calls to apply origin-conditional rules: effects that depend on
 * WHO is dealing the damage. A rebuilt apply cannot reach it, so some hits would land wrong with nothing
 * looking wrong, which is the one failure the brief says must not happen. Measured in pf2e 8.5.0.
 *
 * ✅ WHAT IT DOES INSTEAD. PF2e's chat context menu (`ui.chat._getEntryContextOptions()`) carries five
 * entries whose `onClick` calls that private function with the right multiplier. SF2e's are identical,
 * labels included. Calling the entry runs PF2e's whole path, IWR and ephemeral effects included.
 *
 * ⛔ THE TARGET IS SELECTED FIRST, then restored. PF2e applies to `game.user.getActiveTokens()`, the
 * CONTROLLED tokens, and `canApplyDamage` refuses outright with none controlled. The deck applies to the
 * roll's target (decided with Lewis), so it controls exactly that token, runs the entry, then puts the
 * GM's own selection back.
 *
 * ⚠️ RESTORING STRAIGHT AFTER `onClick` IS SAFE, and the reason is load-bearing. `applyDamageFromMessage`
 * reads the controlled tokens synchronously, before its first `await`, so the target list is captured
 * by the time `onClick` returns. Restoring any earlier, or reading tokens later, would aim elsewhere.
 *
 * ⛔ HANDLED ONLY ONCE IT LANDED. `onClick` returns nothing (PF2e does not return the promise), so there
 * is no completion to await. The caller confirms by watching for PF2e's own `damage-taken` message about
 * the target. Marking a card handled at the tap would hide a hit that silently failed.
 */

/** Only what this reads of one context menu entry. */
export interface ContextEntry {
  readonly label: string;
  readonly visible?: (listItem: HTMLElement) => boolean;
  readonly onClick: (event: Event | null, listItem: HTMLElement) => unknown;
}

export interface TokenLike {
  readonly control: (options: { releaseOthers: boolean }) => unknown;
  readonly release: () => unknown;
}

export interface ApplyPorts {
  readonly contextEntries: () => readonly ContextEntry[];
  readonly controlled: () => readonly TokenLike[];
  /** The token on the current scene, or null when it is no longer there. */
  readonly tokenFor: (tokenUuid: string) => TokenLike | null;
  /** An element carrying `dataset.messageId`, which is all PF2e's `onClick` reads. */
  readonly listItemFor: (messageId: string) => HTMLElement;
  /** Resolves true once PF2e posts `damage-taken` for this token, false if it never does. */
  readonly landed: (tokenUuid: string) => Promise<boolean>;
  readonly markHandled: (messageId: string) => Promise<void>;
}

/** PF2e's own labels for its five entries. SF2e uses the same keys. */
export const ENTRY_LABEL: Readonly<Record<ApplyOption['id'], string>> = Object.freeze({
  full: 'PF2E.DamageButton.FullContext',
  half: 'PF2E.DamageButton.HalfContext',
  double: 'PF2E.DamageButton.DoubleContext',
  triple: 'PF2E.DamageButton.TripleContext',
  healing: 'PF2E.DamageButton.HealingContext',
});

export type ApplyOutcome =
  | { readonly kind: 'applied' }
  /** Nothing was sent to PF2e. The card stays. */
  | { readonly kind: 'refused'; readonly reason: string }
  /** Sent, but PF2e never confirmed it landed. The card stays, and says so. */
  | { readonly kind: 'unconfirmed'; readonly reason: string };

export interface ApplyRequest {
  readonly messageId: string;
  readonly option: ApplyOption;
  readonly targetTokenUuid: string;
}

function restoreSelection(ports: ApplyPorts, previous: readonly TokenLike[]): void {
  for (const token of ports.controlled()) {
    token.release();
  }
  for (const token of previous) {
    token.control({ releaseOthers: false });
  }
}

export async function applyThroughSystem(
  ports: ApplyPorts,
  request: ApplyRequest
): Promise<ApplyOutcome> {
  const entry = ports
    .contextEntries()
    .find((each) => each.label === ENTRY_LABEL[request.option.id]);
  if (entry === undefined) {
    return {
      kind: 'refused',
      reason: 'this game system does not offer that way of applying damage',
    };
  }

  const target = ports.tokenFor(request.targetTokenUuid);
  if (target === null) {
    return { kind: 'refused', reason: 'the target is no longer on the scene' };
  }

  const previous = [...ports.controlled()];
  const listItem = ports.listItemFor(request.messageId);
  let landing: Promise<boolean>;
  target.control({ releaseOthers: true });

  try {
    /*
     * ⚠️ Asked AFTER selecting, because PF2e's `visible` checks for controlled tokens itself. Triple is
     * hidden unless PF2e's crit and fumble buttons are enabled; the deck must follow that, not offer it.
     */
    if (entry.visible !== undefined && !entry.visible(listItem)) {
      return { kind: 'refused', reason: 'PF2e does not offer that option for this message' };
    }
    /*
     * ⛔ WATCH BEFORE CLICKING. PF2e can post `damage-taken` before a watcher armed afterwards has
     * subscribed, and a missed message would report a hit that landed as unconfirmed. The same ordering
     * bug was fixed once already in `CreationRelay.ask()`, which now starts waiting before it sends.
     */
    landing = ports.landed(request.targetTokenUuid);
    entry.onClick(null, listItem);
  } finally {
    restoreSelection(ports, previous);
  }

  if (!(await landing)) {
    return {
      kind: 'unconfirmed',
      reason: 'PF2e never reported the damage landing, so the card was kept',
    };
  }

  await ports.markHandled(request.messageId);
  return { kind: 'applied' };
}
