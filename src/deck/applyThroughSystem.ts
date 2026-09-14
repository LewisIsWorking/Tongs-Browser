import type { ApplyOption } from './applyOptions.js';
import { restoreSelection, selectOnly } from './selection.js';
import type { TokenLike } from './selection.js';

export type { TokenLike };

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

/** Some of a card's targets, all taking the card's damage the same way. */
export interface ApplyGroup {
  readonly option: ApplyOption;
  readonly targetTokenUuids: readonly string[];
}

export interface GroupsRequest {
  readonly messageId: string;
  readonly groups: readonly ApplyGroup[];
}

const PART_APPLIED =
  'some of the damage landed before the rest could not be applied, so the card was kept';

export async function applyThroughSystem(
  ports: ApplyPorts,
  request: ApplyRequest
): Promise<ApplyOutcome> {
  return applyGroupsThroughSystem(ports, {
    messageId: request.messageId,
    groups: [{ option: request.option, targetTokenUuids: [request.targetTokenUuid] }],
  });
}

/**
 * One card applied to several targets in several ways, then marked handled ONCE. Added 2026-09-14 for a
 * basic save, where each target takes the damage by its own degree of success.
 *
 * ⛔ ONE CARD, ONE MARK. Applying target by target through `applyThroughSystem` cannot work: the first
 * apply marks the card handled and the second is refused (measured). So each group is sent with all of
 * its tokens selected together, and the card is marked only once every group has landed. Measured
 * 2026-09-14: PF2e's Half entry with two Xorns selected halved the damage for each and posted one
 * `damage-taken` per token.
 *
 * ⚠️ Everything that can be checked without clicking is checked before the FIRST click, so a refusal
 * means nothing was sent. Once a group has landed, a later failure is reported as unconfirmed.
 *
 * ⚠️ No groups is a card nobody takes damage from, such as every target critically succeeding: it is
 * marked handled with nothing sent.
 */
export async function applyGroupsThroughSystem(
  ports: ApplyPorts,
  request: GroupsRequest
): Promise<ApplyOutcome> {
  const planned = [];
  for (const group of request.groups) {
    const entry = ports
      .contextEntries()
      .find((each) => each.label === ENTRY_LABEL[group.option.id]);
    if (entry === undefined) {
      return {
        kind: 'refused',
        reason: 'this game system does not offer that way of applying damage',
      };
    }
    const tokens = group.targetTokenUuids.map((uuid) => ports.tokenFor(uuid));
    if (tokens.length === 0 || tokens.some((token) => token === null)) {
      return { kind: 'refused', reason: 'the target is no longer on the scene' };
    }
    planned.push({ entry, tokens: tokens as TokenLike[], uuids: group.targetTokenUuids });
  }

  const listItem = ports.listItemFor(request.messageId);
  let sent = 0;
  for (const { entry, tokens, uuids } of planned) {
    const previous = [...ports.controlled()];
    let landing: Promise<boolean[]>;
    selectOnly(tokens);

    try {
      /*
       * ⚠️ Asked AFTER selecting, because PF2e's `visible` checks for controlled tokens itself. Triple is
       * hidden unless PF2e's crit and fumble buttons are enabled; the deck must follow that, not offer it.
       */
      if (entry.visible !== undefined && !entry.visible(listItem)) {
        return sent === 0
          ? { kind: 'refused', reason: 'PF2e does not offer that option for this message' }
          : { kind: 'unconfirmed', reason: PART_APPLIED };
      }
      /*
       * ⛔ WATCH BEFORE CLICKING. PF2e can post `damage-taken` before a watcher armed afterwards has
       * subscribed, and a missed message would report a hit that landed as unconfirmed. The same ordering
       * bug was fixed once already in `CreationRelay.ask()`, which now starts waiting before it sends.
       */
      landing = Promise.all(uuids.map(async (uuid) => ports.landed(uuid)));
      entry.onClick(null, listItem);
    } finally {
      restoreSelection(ports.controlled(), previous);
    }

    if (!(await landing).every(Boolean)) {
      return {
        kind: 'unconfirmed',
        reason:
          sent === 0
            ? 'PF2e never reported the damage landing, so the card was kept'
            : PART_APPLIED,
      };
    }
    sent += 1;
  }

  await ports.markHandled(request.messageId);
  return { kind: 'applied' };
}
