/**
 * What a player sends when asking a GM to make them a character sheet. Added 2026-09-03.
 *
 * ⚠️ EVERY field is untrusted input. This travels over Foundry's socket, which any connected client
 * can emit on, so the shape check below is a real boundary rather than a formality. Nothing here is
 * evidence of anything; it is a claim, and `CreationPolicy` decides what to believe.
 *
 * ⚠️ `userId` is CLAIMED, NOT PROVEN, and that limitation is the design's one real weakness. Core
 * Foundry rebroadcasts a socket payload without attaching a verified sender, so the GM's client
 * cannot tell who actually emitted this. A player could name another player's id and have the sheet
 * created owned by them. See the note in `CreationPolicy` for why that is bounded rather than
 * dangerous, and why it is still worth raising with Lewis rather than left implicit.
 *
 * Kept minimal so an older client cannot be confused by a field a newer one adds, which is the same
 * reason `PauseRelay` keeps its payload to two fields.
 */
export interface CreationRequest {
  readonly action: 'createSheet';
  /** Correlates the answer with the ask. The requester ignores answers to other people's requests. */
  readonly requestId: string;
  /** Who the requester SAYS they are. See the warning above. */
  readonly userId: string;
  readonly partyUuid: string;
  readonly name: string;
}

/** The longest name accepted, so a hostile or fat-fingered client cannot write an essay into a world. */
export const NAME_LIMIT = 80;

export function isCreationRequest(payload: unknown): payload is CreationRequest {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }
  const candidate = payload as Partial<CreationRequest>;
  return (
    candidate.action === 'createSheet' &&
    isNonEmptyString(candidate.requestId) &&
    isNonEmptyString(candidate.userId) &&
    isNonEmptyString(candidate.partyUuid) &&
    typeof candidate.name === 'string'
  );
}

/**
 * ⚠️ `name` is checked as a string but NOT required to be non-empty, unlike the others. An empty name
 * is a reasonable thing for a client to send, and the policy fills in a default. Rejecting it would
 * turn a blank field into a socket error the user cannot act on.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
