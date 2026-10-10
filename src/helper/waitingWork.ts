import { MODULE_ID } from '../constants.js';
import { PENDING_FLAG } from '../automation/AutoApply.js';
import { recentStrikeMessages } from '../automation/recentStrikeMessages.js';
import type { RecentGlobals, VisibleMessage } from '../automation/recentStrikeMessages.js';
import { TARGETS_FLAG } from '../automation/spellFacts.js';
import { pendingRequests } from '../welcome/welcomeDocuments.js';
import type { WelcomeGame } from '../welcome/welcomeDocuments.js';

/**
 * Everything Tongs has queued for a GM's browser, in words. Added 2026-10-10.
 *
 * Lewis, 2026-10-10: "Can we queue up the sheet creation so I don't have to be on the world at the same
 * time?" and "can the nudge bot tell me when there's queued up tongs actions, what the actions are and
 * on what world?". ComeOnOverUno's helper GM opens the world, reads this, waits while Tongs does the work,
 * reads it again, and reports the difference to the Foundry topic.
 *
 * ⚠️ Lists nothing new: it reads the two GM-only listings the queues already use (`pendingRequests`,
 *    `recentStrikeMessages`), so a player's browser gets an empty list and the document boundary holds.
 */
export interface WaitingMessage extends VisibleMessage {
  readonly author?: { readonly id?: string; readonly name?: string | null } | null;
}

export type WaitingGame = WelcomeGame & NonNullable<RecentGlobals['game']>;

export function waitingWork(game: WaitingGame | undefined): string[] {
  const sheets = pendingRequests(game).map(
    (user) => `${user.userName}'s character sheet "${user.request.name}"`
  );
  const cards = recentStrikeMessages({ game }).flatMap((message: WaitingMessage) => {
    const flags = message.flags?.[MODULE_ID] as Record<string, unknown> | undefined;
    if (flags?.[PENDING_FLAG] !== true) {
      return [];
    }
    const who = message.author?.name ?? 'A player';
    return [`${who}'s ${flags[TARGETS_FLAG] === undefined ? 'damage' : 'spell saves'}`];
  });
  return [...sheets, ...cards];
}
