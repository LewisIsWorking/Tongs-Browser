import type { MessageFacts } from './deckFacts.js';
import { readMessageFacts } from './readMessageFacts.js';
import type { MessageLike } from './readMessageFacts.js';

/**
 * The chat log read into deck facts. Added 2026-09-13.
 *
 * ⛔ THIS FILE IS ON THE `check-document-access` BOUNDARY LIST, because it enumerates chat messages.
 * The obligation that comes with that is to filter in the same breath. Two filters, both failing
 * closed:
 *
 * - **GM only.** A player gets an empty list, not a filtered one. The deck is a GM tool, and even a
 *   player's own visible messages carry the names of targets they may not be meant to know.
 * - **`visible === true`.** Foundry's own answer to "may this user see this message", which covers
 *   whispers and blind rolls. A message that cannot answer is left out.
 *
 * ⚠️ Globals are read on EVERY call, as `BuildRequestProof` does: the chat log grows while the deck is
 * open, and a list read against a snapshot would miss the roll that was just made.
 */
export interface ListedMessage extends MessageLike {
  readonly visible?: boolean;
}

export interface DeckListGlobals {
  readonly game?: {
    readonly user?: { readonly isGM?: boolean };
    readonly system?: { readonly id?: string };
    readonly messages?: { readonly contents?: readonly ListedMessage[] };
  };
  readonly fromUuidSync?: (uuid: string) => { readonly name?: string } | null | undefined;
}

/**
 * ⚠️ A uuid Foundry cannot parse THROWS rather than returning null, and one malformed target recorded
 * on one old message must not take the whole deck down with it. It reads as no target.
 */
function nameOf(globals: DeckListGlobals, uuid: string): string | null {
  try {
    return globals.fromUuidSync?.(uuid)?.name ?? null;
  } catch {
    return null;
  }
}

export function listDeckMessages(globals: DeckListGlobals): MessageFacts[] {
  const game = globals.game;
  if (game?.user?.isGM !== true) {
    return [];
  }
  const ports = {
    systemId: game.system?.id ?? '',
    tokenName: (uuid: string) => nameOf(globals, uuid),
  };
  return (game.messages?.contents ?? [])
    .filter((message) => message.visible === true)
    .map((message) => readMessageFacts(message, ports));
}
