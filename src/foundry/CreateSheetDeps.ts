import { createSheetInParty } from './SheetCreation.js';
import type { CreatedSheet, SheetCreationOutcome } from './SheetCreationTypes.js';

/**
 * The real Foundry calls behind sheet creation. Added 2026-09-02.
 *
 * ⚠️ Its own file so `SheetCreation` stays a pure sequence of two injected writes. Everything Foundry
 * specific and untestable-without-a-world lives here, which is a boundary worth keeping: the rules
 * about ownership and outcomes are in code a test can reach, and this is only the plumbing.
 *
 * ⚠️ NOT in `check:documents`' BOUNDARY, and correctly so. `Actor.create` and `fromUuid` address ONE
 * document each, by id, chosen by a user who was already shown only what they may see. They are not
 * enumerations, and nothing here can leak a name.
 */

/** Foundry's document globals, described only as far as creating and joining needs. */
interface CreationGlobals {
  readonly Actor?: { create?: (data: Record<string, unknown>) => Promise<CreatedSheet | null> };
  readonly fromUuid?: (uuid: string) => Promise<PartyLike | null>;
}

/** A party actor, as far as adding a member needs. */
interface PartyLike {
  addMembers?: (...members: CreatedSheet[]) => Promise<unknown>;
}

/**
 * Create a sheet and put it in a party, using the real Foundry.
 *
 * ⚠️ Both absences THROW rather than resolving quietly, because `createSheetInParty` turns a thrown
 * error into a reported outcome with its reason attached. Returning null here instead would produce
 * the one thing this feature must never do: a tap that changes nothing and says nothing.
 */
export async function createSheetWithFoundry(request: {
  name: string;
  ownerId: string;
  partyUuid: string;
}): Promise<SheetCreationOutcome> {
  const globals = globalThis as CreationGlobals;

  return createSheetInParty(request, {
    createActor: async (data) => {
      const create = globals.Actor?.create;
      if (create === undefined) {
        throw new Error('Foundry has no Actor.create on this client.');
      }
      return create(data);
    },
    addToParty: async (partyUuid, sheet) => {
      const resolve = globals.fromUuid;
      if (resolve === undefined) {
        throw new Error('Foundry has no fromUuid on this client.');
      }

      const party = await resolve(partyUuid);
      /*
       * ⚠️ A party that resolves to nothing, or to something without `addMembers`, is reported rather
       * than ignored. The second is the likelier of the two: this module knows about parties from
       * PF2e and its derivatives, and a world on some other system may have an actor at that uuid
       * with no such method. Saying so is how somebody finds out their system is not supported.
       */
      if (party?.addMembers === undefined) {
        throw new Error('That party cannot take members on this system.');
      }
      await party.addMembers(sheet);
    },
  });
}
