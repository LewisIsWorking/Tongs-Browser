/**
 * The shapes `SheetCreation` works in. Its own file so the creation logic can describe an outcome
 * without importing the module that produces it. Added 2026-09-02.
 */

/**
 * ⚠️ 3, read from Foundry 14.366's `CONST.DOCUMENT_OWNERSHIP_LEVELS` rather than remembered:
 * INHERIT -1, NONE 0, LIMITED 1, OBSERVER 2, OWNER 3.
 *
 * Written as a constant rather than read from `CONST` at run time because this value is part of the
 * document data being sent, and a module that silently wrote `undefined` here would create a sheet
 * its owner cannot open, with nothing to say why.
 */
export const OWNER_LEVEL = 3;

/**
 * ⚠️ `character`, not the system's own default. PF2e and its derivatives both use this type, and
 * `addMembers` treats `character` and `npc` specially: it is the type that gets an alliance and gets
 * pulled out of its folder. Creating anything else would join the party without becoming a party
 * member in the sense the system means.
 */
export const DEFAULT_SHEET_TYPE = 'character';

export interface CreationRequest {
  readonly name: string;
  /** The user who will own the sheet. A player may only ever name themselves; see `PartyRoster`. */
  readonly ownerId: string;
  readonly partyUuid: string;
  /** Overridable for a system that names its player type differently. */
  readonly type?: string;
}

/** The created actor, described only as far as reporting and adding to a party needs. */
export interface CreatedSheet {
  readonly uuid?: string;
  readonly name?: string;
  readonly sheet?: { render?: (force: boolean) => void };
}

export interface SheetCreationDeps {
  readonly createActor: (data: Record<string, unknown>) => Promise<CreatedSheet | null>;
  readonly addToParty: (partyUuid: string, sheet: CreatedSheet) => Promise<void>;
}

/**
 * What happened, in enough detail to tell the user something useful.
 *
 * ⚠️ `createdOutsideParty` is a THIRD outcome rather than a failure, because the sheet exists. Calling
 * it a failure invites a second attempt and a duplicate, and the action a user needs is "put it in the
 * party", not "try again".
 */
export type SheetCreationOutcome =
  | { readonly kind: 'created'; readonly sheet: CreatedSheet }
  | { readonly kind: 'createdOutsideParty'; readonly sheet: CreatedSheet; readonly reason: string }
  | { readonly kind: 'notCreated'; readonly reason: string };
