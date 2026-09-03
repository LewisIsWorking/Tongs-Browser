import type { UserLike } from './PartyAccess.js';

/**
 * Which GM answers, and whether there is one at all. Added 2026-09-03.
 *
 * ⚠️ `activeGM`, never "am I a GM", and `PauseRelay`'s docblock already records why: with three GMs
 * connected, every one of them answers a request and the result lands wherever the race left it.
 * Foundry's `game.users.activeGM` picks the same single user on every client, which is the only
 * reason a relay is safe to run at all.
 *
 * ⚠️ Both answers come from ONE read. The relay needs "am I the one who should act" and the UI needs
 * "is anybody there to ask"; taking those separately invites a moment where a player is told a GM is
 * online by one call and refused by the next. They are two views of a single fact, so they are read
 * as one.
 *
 * ⚠️ This is NOT an enumeration, and `scripts/documents/rules.ts` allows `activeGM` explicitly for
 * that reason: it is one lookup of one user, by Foundry's own rule, and cannot tell anybody that a
 * document they lack permission for exists.
 */
export interface GmPresence {
  /** Whether any GM is connected and therefore able to act on a request. */
  readonly online: boolean;
  /** The designated GM's name, for saying WHO will be asked. Null when nobody is online. */
  readonly name: string | null;
  /** Whether this client is the designated GM, and so should act rather than ask. */
  readonly isMe: boolean;
}

/** Foundry's `game`, described only as far as this reads it. Narrow on purpose, trivial to fake. */
export interface GmGame {
  readonly users?: { readonly activeGM?: UserLike | null };
  readonly user?: UserLike;
}

export interface GmPresenceOptions {
  /** Read live rather than captured: a GM can connect or drop between one tap and the next. */
  readonly getGame: () => GmGame | undefined;
}

export function readGmPresence(options: GmPresenceOptions): GmPresence {
  const game = options.getGame();
  const gm = game?.users?.activeGM ?? null;

  if (gm === null) {
    return { online: false, name: null, isMe: false };
  }

  /*
   * ⚠️ Compared by ID, and a MISSING id on either side counts as NOT me. Comparing `undefined` to
   * `undefined` would make an unidentifiable client believe it was the designated GM, which is the
   * one client that should never act on somebody else's request.
   */
  const myId = game?.user?.id;
  const isMe = typeof myId === 'string' && myId.length > 0 && gm.id === myId;

  return { online: true, name: gm.name ?? null, isMe };
}
