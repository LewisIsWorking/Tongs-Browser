/**
 * Proving who actually sent a create request, without socketlib. Added 2026-09-06.
 *
 * ⛔ THE HOLE THIS CLOSES. `CreationRequest.userId` is a CLAIM. Core Foundry rebroadcasts a socket
 * payload without attaching a verified sender, so a player could name another player's id and have
 * the sheet created owned by them. Bounded, but real, and it was documented rather than fixed
 * because closing it was believed to require a socketlib dependency.
 *
 * ⭐ IT DOES NOT. Foundry already has a verified channel: its own document permissions. Measured
 * 2026-09-06 from Foundry 14.366's own source rather than assumed.
 *
 *     common/documents/user.mjs, BaseUser.#canUpdate:
 *         const restricted = ["permissions", "passwordSalt"];
 *         if ( user.role < roles.ASSISTANT ) restricted.push("name", "role");
 *         if ( restricted.some(k => k in changes) ) return false;
 *         return user.isGM || (user.id === doc.id);
 *
 * `flags` is NOT restricted, and `User` carries `flags: new fields.DocumentFlagsField()`. So a
 * player may write a flag onto their OWN user document and onto nobody else's.
 *
 * ⭐ AND IT IS THE SERVER THAT SAYS SO, which is the part that makes this a proof rather than a
 * politeness. `dist/database/backend/server-backend.mjs` runs, on the update path:
 *
 *     if (r && !o.canUserModify(r, "update", u)) throw new Error(this._logError(r, "update", o, ...));
 *
 * A client cannot talk its way past that, because it is not the client deciding. Therefore a claim
 * found on user X's document was written by user X or by a GM, and a request naming X is only
 * believable if X's own document is carrying that request's id.
 *
 * ⚠️ WHAT THIS IS NOT. It does not encrypt, sign, or hide anything. Every client sees every claim,
 * exactly as every client sees every socket payload. It proves AUTHORSHIP and nothing else, which is
 * precisely the one thing that was missing.
 */

/** The flag key a claim is written under, on the claiming user's own document. */
export const CLAIM_FLAG = 'creationClaim';

export interface ProofPorts {
  /**
   * Write this request id onto MY OWN user document.
   *
   * ⚠️ Deliberately takes no user id. There is no honest reason for this to write anywhere but the
   * caller's own document, and a parameter would invite exactly the mistake the whole module exists
   * to make impossible. The server would refuse it anyway; not offering it is cheaper than relying
   * on that.
   */
  readonly claim: (requestId: string) => Promise<void>;
  /** The request id the named user is currently claiming, read from THEIR document. */
  readonly readClaim: (userId: string) => string | null;
  /**
   * Drop a claim once it has been served.
   *
   * ⚠️ This is the replay defence, and it is needed because a claim is PUBLIC. Every client sees the
   * flag update, so a hostile client can read a real request id and re-emit the payload verbatim.
   * Without a release that replay verifies perfectly and buys a second sheet. It cannot buy a sheet
   * for the WRONG person, which is the original hole, but a duplicate is still a bug.
   */
  readonly release: (userId: string) => Promise<void>;
}

/**
 * Does the claim on the named user's document vouch for this request?
 *
 * ⚠️ Compared for EQUALITY against the id the payload carries, not merely tested for presence. A
 * "has any claim at all" check would be satisfied by a victim's unrelated pending request, so an
 * attacker could ride along on somebody else's genuine ask. What has to match is the specific
 * request.
 */
export function proves(claimed: string | null, requestId: string): boolean {
  if (claimed === null || claimed.length === 0 || requestId.length === 0) {
    return false;
  }
  return claimed === requestId;
}

/**
 * Why a request was not believed. Shown to the requester, so it says what to do rather than what
 * went wrong internally.
 *
 * ⚠️ It does NOT say "you are an impostor". The overwhelmingly likely cause is the benign race
 * below, and accusing an ordinary player of forgery because their flag write landed late would be
 * both wrong and unactionable.
 */
export const UNPROVEN_REASON = 'That request could not be verified. Please tap again.';

/**
 * ⚠️ THE RACE, stated rather than hidden. A player writes the claim and then emits; the flag update
 * and the socket payload travel by different routes, and nothing guarantees the GM's client applies
 * the update before it handles the payload. `CreationRelay.ask` awaits the write, which resolves
 * only once the server has accepted it, so the ordering holds in practice.
 *
 * ⭐ It is made SAFE rather than merely unlikely by which way it fails. A claim that has not arrived
 * yet reads as "not proven", which REFUSES. The failure direction is a player tapping again, never a
 * sheet created for the wrong person, and that is the property worth having.
 */
