/**
 * A new player's request for a character sheet, and the GM's answer. Added 2026-10-05.
 *
 * ⭐ The request lives on the player's OWN user document, as a flag. Foundry's server lets a player write
 *    their own user and nobody else's (`BaseUser.#canUpdate`, see docs/CHARACTER-SHEET-CREATION.md 5d), so
 *    whoever a request sits on is who asked: nobody can ask in somebody else's name.
 *
 * ⭐ It also WAITS. Lewis, 2026-10-05: a new player usually arrives with no GM connected, so the request
 *    stays on the user until a GM's browser connects and makes the sheet. The answer is written back to the
 *    same user, where the player's browser sees it, now or at their next visit.
 */
export const REQUEST_FLAG = 'sheetRequest';
export const RESULT_FLAG = 'sheetResult';
/** On the created actor, so a request finished twice (a crash between create and answer) makes one sheet. */
export const MADE_FOR_FLAG = 'madeForRequest';

/** Used when the name box is left blank, so a blank field is not an error the player must fix. */
export const DEFAULT_NAME = 'New Character';
const MAX_NAME = 60;

export interface SheetRequest {
  readonly id: string;
  readonly name: string;
  /** The campaign party the player picked, or null when there was only one to pick. */
  readonly partyUuid: string | null;
  readonly at: number;
}

export type SheetResult =
  | { readonly kind: 'created'; readonly requestId: string; readonly actorUuid: string }
  | { readonly kind: 'refused'; readonly requestId: string; readonly reason: string };

/** A name as the sheet will carry it: trimmed, spaces collapsed, cut to length, never empty. */
export function cleanName(raw: unknown): string {
  const name =
    typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME).trim() : '';
  return name === '' ? DEFAULT_NAME : name;
}

/**
 * ⚠️ Read defensively: the flag is written by a player's browser, so it is untrusted input. Anything that is
 *    not the expected shape reads as no request at all.
 */
export function readSheetRequest(raw: unknown): SheetRequest | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const value = raw as Record<string, unknown>;
  if (typeof value['id'] !== 'string' || value['id'] === '' || typeof value['at'] !== 'number') {
    return null;
  }
  const party = value['partyUuid'];
  return {
    id: value['id'],
    name: cleanName(value['name']),
    partyUuid: typeof party === 'string' && party !== '' ? party : null,
    at: value['at'],
  };
}

/** The GM's answer, read on the player's side. Written only by a GM, but still read as untrusted. */
export function readSheetResult(raw: unknown): SheetResult | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const requestId = value['requestId'];
  if (typeof requestId !== 'string') {
    return null;
  }
  if (value['kind'] === 'created' && typeof value['actorUuid'] === 'string') {
    return { kind: 'created', requestId, actorUuid: value['actorUuid'] };
  }
  if (value['kind'] === 'refused' && typeof value['reason'] === 'string') {
    return { kind: 'refused', requestId, reason: value['reason'] };
  }
  return null;
}
