import { MODULE_ID } from '../constants.js';
import { OWNER_LEVEL } from '../foundry/SheetCreationTypes.js';
import { DUAL_REQUEST_FLAG, DUAL_RESULT_FLAG, readDualClassRequest } from './dualClassRequest.js';
import type { DualClassResult } from './dualClassRequest.js';
import type { PendingDualClass } from './DualClassRequests.js';

/**
 * Every user and actor the GM's side of dual class reads. Added 2026-10-12, and in `check:documents`'
 * BOUNDARY because it enumerates users.
 *
 * ⚠️ All three are GM only, failing closed on `game.user.isGM !== true`: a player's browser gets no
 *    requests, no sheet and writes nothing. A GM can already see every user and actor here, and the
 *    only thing shown to anyone is the asker's own sheet name, to the GM.
 */
export interface DualClassUser {
  readonly id: string | null;
  readonly name?: string | null;
  readonly isGM?: boolean;
  getFlag?(scope: string, key: string): unknown;
  update?(data: object): Promise<unknown>;
}

export interface DualClassGame {
  readonly user?: { readonly isGM?: boolean };
  readonly users?: { readonly contents: readonly DualClassUser[] };
  readonly actors?: {
    get(id: string):
      | {
          readonly name?: string | null;
          readonly type?: string;
          readonly ownership?: Readonly<Record<string, number>>;
        }
      | undefined;
  };
}

/** GM only: every player with a dual class request waiting on their user. */
export function pendingDualClasses(game: DualClassGame | undefined): PendingDualClass[] {
  if (game?.user?.isGM !== true) {
    return [];
  }
  return (game.users?.contents ?? []).flatMap((user) => {
    const request = readDualClassRequest(user.getFlag?.(MODULE_ID, DUAL_REQUEST_FLAG));
    return user.isGM === true || user.id === null || request === null
      ? []
      : [{ userId: user.id, userName: user.name ?? 'A player', request }];
  });
}

/**
 * GM only: a character sheet by id, and whether this user OWNS it. ⛔ Owner means Foundry's OWNER level,
 * given to them or to everyone by default: a sheet they can only observe is not theirs to change.
 */
export function dualClassSheet(
  game: DualClassGame | undefined,
  actorId: string,
  userId: string
): { readonly name: string; readonly owned: boolean } | null {
  if (game?.user?.isGM !== true) {
    return null;
  }
  const actor = game.actors?.get(actorId);
  if (actor?.type !== 'character') {
    return null;
  }
  const level = actor.ownership?.[userId] ?? actor.ownership?.['default'] ?? 0;
  return { name: actor.name ?? 'their character', owned: level >= OWNER_LEVEL };
}

/** GM only: clears the request and writes the answer in ONE update, so the player sees one or the other. */
export async function answerDualClass(
  game: DualClassGame | undefined,
  userId: string,
  result: DualClassResult
): Promise<void> {
  if (game?.user?.isGM !== true) {
    return;
  }
  const user = game.users?.contents.find((each) => each.id === userId);
  await user?.update?.({
    [`flags.${MODULE_ID}.-=${DUAL_REQUEST_FLAG}`]: null,
    [`flags.${MODULE_ID}.${DUAL_RESULT_FLAG}`]: result,
  });
}
