/**
 * Creating a character sheet, owned by somebody, inside a party. Added 2026-09-02.
 *
 * ⚠️ Ownership is set AT CREATION rather than by a follow-up update, and that is a measured decision
 * rather than a style one. Foundry's `sanitizeDocumentOwnershipField` treats the two paths
 * differently: an update naming another user THROWS, while a create SILENTLY DELETES the offending
 * entry and proceeds. Neither is acceptable for a player, which is why player creation goes through a
 * GM relay, but for the GM path the create form is the one that says what it means in a single
 * operation with nothing to roll back.
 *
 * ⚠️ Two writes, and the second can fail on its own. `Actor.create` then `party.addMembers`. If the
 * membership write fails the sheet still exists, owned correctly, just not in the party. That is
 * reported rather than swallowed and rather than dressed up as total failure: telling somebody
 * "creation failed" when a sheet is sitting in their actors list is how duplicates get made.
 */
import { DEFAULT_SHEET_TYPE, OWNER_LEVEL } from './SheetCreationTypes.js';
import type {
  CreatedSheet,
  CreationRequest,
  SheetCreationDeps,
  SheetCreationOutcome,
} from './SheetCreationTypes.js';

/**
 * The document data for a new sheet.
 *
 * ⚠️ `ownership` names ONLY the intended owner. It deliberately does not touch `default`, which would
 * change what every other user in the world can see of this sheet. A sheet is for its owner and the
 * GM, and widening that silently is the opposite of what requirement 3 asks for.
 */
export function sheetDocumentData(request: CreationRequest): Record<string, unknown> {
  return {
    name: request.name,
    type: request.type ?? DEFAULT_SHEET_TYPE,
    ownership: { [request.ownerId]: OWNER_LEVEL },
  };
}

/**
 * Create the sheet, then put it in the party.
 *
 * The order is not interchangeable. The actor has to exist before it can be a member, and creating it
 * already owned means there is never a moment where it exists unowned: a sheet that briefly belongs
 * to nobody is a sheet a player briefly cannot open, and on a phone that reads as the button having
 * failed.
 */
export async function createSheetInParty(
  request: CreationRequest,
  deps: SheetCreationDeps
): Promise<SheetCreationOutcome> {
  let created: CreatedSheet | null;
  try {
    created = await deps.createActor(sheetDocumentData(request));
  } catch (error) {
    return { kind: 'notCreated', reason: describe(error) };
  }

  if (created === null) {
    return { kind: 'notCreated', reason: 'Foundry returned no actor.' };
  }

  try {
    await deps.addToParty(request.partyUuid, created);
  } catch (error) {
    /*
     * ⚠️ The sheet EXISTS. Reporting this as a failure would invite a second attempt and a duplicate,
     * and the fix a user needs here is "drag it into the party", not "try again".
     */
    return { kind: 'createdOutsideParty', sheet: created, reason: describe(error) };
  }

  return { kind: 'created', sheet: created };
}

/** ⚠️ The MESSAGE, not the object. A thrown non-Error stringifies to `[object Object]` otherwise. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
