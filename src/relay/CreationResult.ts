/**
 * What a GM sends back after acting on a create request. Added 2026-09-03.
 *
 * ⚠️ Checked as carefully as the request, and for a reason that is easy to miss: this arrives at a
 * PLAYER's client, so it is not "our own message coming home". Any connected client can emit it, and
 * a malformed or hostile one would otherwise decide what a player is told happened. The worst it can
 * do is lie about an outcome, but a player acting on a lie about their own character sheet is exactly
 * the kind of confusion that gets reported as the module being broken.
 *
 * ⚠️ `requestId` is what makes a broadcast usable as a reply. Everybody at the table receives every
 * result; a client that did not match on the id it sent would resolve on somebody else's answer.
 */
export interface CreationResult {
  readonly action: 'createSheetResult';
  readonly requestId: string;
  readonly ok: boolean;
  /** Why it was refused or failed. Absent on success. */
  readonly reason?: string;
  /** What was made, so the requester can open it. Absent on failure. */
  readonly actorUuid?: string;
}

export function isCreationResult(payload: unknown): payload is CreationResult {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }
  const candidate = payload as Partial<CreationResult>;
  return (
    candidate.action === 'createSheetResult' &&
    typeof candidate.requestId === 'string' &&
    candidate.requestId.length > 0 &&
    typeof candidate.ok === 'boolean' &&
    isAbsentOrString(candidate.reason) &&
    isAbsentOrString(candidate.actorUuid)
  );
}

/**
 * ⚠️ `undefined` is allowed but a wrong TYPE is not. Letting a number through as `reason` would put
 * it straight into a message shown to a user, and `String(42)` reads as a plausible explanation.
 */
function isAbsentOrString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}
