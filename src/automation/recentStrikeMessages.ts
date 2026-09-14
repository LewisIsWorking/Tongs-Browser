import type { StrikeMessage } from './strikeFacts.js';

/**
 * The recent chat log, for pairing a damage roll with the attack before it. Added 2026-09-14.
 *
 * ⛔ THIS FILE IS ON THE `check-document-access` BOUNDARY LIST, because it enumerates chat messages.
 * It filters in the same breath, and both filters fail closed: only a GM's browser gets anything (the
 * only browser that acts is the active full GM), and only messages Foundry says are `visible`. Nothing
 * it returns is ever shown; it is read to find an attack and to find queued hits.
 *
 * ⚠️ The most recent RECENT_LIMIT only. A play-by-post world's log holds thousands of messages, the
 * attack that goes with a damage roll is moments before it, and a queue left longer than this many
 * messages is well past the point the GM should look at it in the roll deck anyway.
 */
export const RECENT_LIMIT = 400;

export interface VisibleMessage extends StrikeMessage {
  readonly visible?: boolean;
}

export interface RecentGlobals {
  readonly game?: {
    readonly user?: { readonly isGM?: boolean };
    readonly messages?: { readonly contents?: readonly VisibleMessage[] };
  };
}

export function recentStrikeMessages(globals: RecentGlobals): VisibleMessage[] {
  const game = globals.game;
  if (game?.user?.isGM !== true) {
    return [];
  }
  return (game.messages?.contents ?? [])
    .slice(-RECENT_LIMIT)
    .filter((message) => message.visible === true);
}
