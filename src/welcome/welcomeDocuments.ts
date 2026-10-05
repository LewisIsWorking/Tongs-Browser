import { MODULE_ID } from '../constants.js';
import { MADE_FOR_FLAG, REQUEST_FLAG, RESULT_FLAG, readSheetRequest } from './sheetRequest.js';
import type { SheetResult } from './sheetRequest.js';
import type { PendingUser } from './SheetRequests.js';
import type { GuideActor } from './buildGuide.js';

/**
 * Every document listing the new-player welcome makes. Added 2026-10-05, and in `check:documents`'
 * BOUNDARY because it enumerates actors and users.
 *
 * ⚠️ The GM's listings (`pendingRequests`, `actorMadeFor`) return nothing to a player, and the player's
 *    (`ownCharacters`) keeps only sheets they OWN, so nobody is ever told about a sheet they cannot see.
 */
export interface WelcomeUser {
  readonly id: string | null;
  readonly name?: string | null;
  readonly isGM?: boolean;
  readonly character?: { readonly id?: string | null } | null;
  getFlag?(scope: string, key: string): unknown;
  update?(data: object): Promise<unknown>;
  setFlag?(scope: string, key: string, value: unknown): Promise<unknown>;
  unsetFlag?(scope: string, key: string): Promise<unknown>;
}

export interface WelcomeActor extends Omit<GuideActor, 'gearCount'> {
  readonly id: string | null;
  readonly uuid: string;
  readonly name: string | null;
  readonly type: string;
  readonly isOwner?: boolean;
  readonly inventory?: { readonly contents?: readonly unknown[] };
  readonly sheet?: { render?(force: boolean): unknown };
  getFlag?(scope: string, key: string): unknown;
  setFlag?(scope: string, key: string, value: unknown): Promise<unknown>;
}

export interface WelcomeGame {
  readonly user?: WelcomeUser;
  readonly users?: { readonly contents: readonly WelcomeUser[] };
  readonly actors?: { readonly contents: readonly WelcomeActor[] };
  readonly world?: { readonly title?: string };
}

/** GM only: every player with a request waiting on their user. */
export function pendingRequests(game: WelcomeGame | undefined): PendingUser[] {
  if (game?.user?.isGM !== true) {
    return [];
  }
  return (game.users?.contents ?? []).flatMap((user) => {
    const request = readSheetRequest(user.getFlag?.(MODULE_ID, REQUEST_FLAG));
    return user.isGM === true || user.id === null || request === null
      ? []
      : [{ userId: user.id, userName: user.name ?? 'A player', request }];
  });
}

/** GM only: the sheet already made for a request, if any. */
export function actorMadeFor(game: WelcomeGame | undefined, requestId: string): string | null {
  if (game?.user?.isGM !== true) {
    return null;
  }
  const actor = (game.actors?.contents ?? []).find(
    (each) => each.getFlag?.(MODULE_ID, MADE_FOR_FLAG) === requestId
  );
  return actor?.uuid ?? null;
}

/** The player's own character sheets. ⚠️ `isOwner` must be exactly true: unknown counts as not theirs. */
export function ownCharacters(game: WelcomeGame | undefined): WelcomeActor[] {
  return (game?.actors?.contents ?? []).filter(
    (actor) => actor.type === 'character' && actor.isOwner === true
  );
}

/** How many pieces of gear a sheet carries, for the checklist. */
export function gearCount(actor: WelcomeActor): number {
  return actor.inventory?.contents?.length ?? 0;
}

/**
 * GM only: clears a player's request and writes the answer, in ONE update, so the player never sees both
 * or neither. The new sheet also becomes the player's assigned character, unless they already have one.
 */
export async function answerRequest(
  game: WelcomeGame | undefined,
  userId: string,
  result: SheetResult
): Promise<void> {
  if (game?.user?.isGM !== true) {
    return;
  }
  const user = game.users?.contents.find((each) => each.id === userId);
  const actorId = result.kind === 'created' ? (result.actorUuid.split('.').pop() ?? '') : '';
  await user?.update?.({
    [`flags.${MODULE_ID}.-=${REQUEST_FLAG}`]: null,
    [`flags.${MODULE_ID}.${RESULT_FLAG}`]: result,
    ...(actorId !== '' && !user.character ? { character: actorId } : {}),
  });
}
