/**
 * Which parties a user may create a sheet in, and who they may assign it to. Added 2026-09-01.
 *
 * ⚠️ Pure, and separate from the code that reaches Foundry, for the reason the sidebar split earned:
 * the DECISION is the part with rules in it, and a decision tangled up with `globalThis` can only be
 * tested by standing up a whole world. `PartyAccess` does the reaching; everything here is a function
 * of its arguments.
 *
 * ⚠️ THE RULE THIS FILE EXISTS FOR: a user must never be shown a party they cannot see. Foundry
 * already declines to send a client documents it has no permission for, so the honest description of
 * this filter is that it is the SECOND line rather than the first. It is written anyway, because
 * "the server would not have sent it" is a claim about somebody else's code that nothing here can
 * check, and because the flag test below has to run over the same list regardless.
 */

/** A party actor, described only as far as choosing one needs. */
export interface PartyCandidate {
  readonly uuid: string;
  readonly name: string;
  /** Whether the viewer has OWNER on the party itself. */
  readonly isOwner: boolean;
  /** The module flag a GM sets to let players create sheets in this party. */
  readonly playerCreationEnabled: boolean;
}

/** A user a sheet can be handed to. */
export interface AssignableUser {
  readonly id: string;
  readonly name: string;
  readonly isGm: boolean;
}

export interface Viewer {
  readonly isGm: boolean;
}

/**
 * The parties this user may create a sheet in.
 *
 * A GM may create in any party they can see. A player may create only in a party whose GM has
 * switched creation on, which is the whole content of requirement 2: the flag is the authorisation,
 * and it is per party rather than global.
 *
 * ⚠️ Ownership of the party is NOT the test for a player, deliberately. A player who happens to own a
 * party actor still needs the flag, so that "can edit this party" and "may add new characters to it"
 * stay separate questions. Conflating them would make the switch impossible to turn off for anyone
 * who already had edit rights.
 */
export function creatableParties(
  parties: readonly PartyCandidate[],
  viewer: Viewer
): PartyCandidate[] {
  if (viewer.isGm) {
    return [...parties];
  }
  return parties.filter((party) => party.playerCreationEnabled);
}

/**
 * The users a sheet may be assigned to.
 *
 * ⚠️ A PLAYER GETS A LIST OF ONE: themselves. Not a policy choice, a measured limit. Foundry's
 * `sanitizeDocumentOwnershipField` silently DELETES an ownership entry naming anyone else when the
 * document is being created, so a player-facing picker offering other users would appear to work and
 * quietly hand the sheet to nobody. Offering a choice that cannot be honoured is worse than offering
 * none.
 *
 * A GM sees everyone, because a GM may write any ownership.
 */
export function assignableUsers(
  users: readonly AssignableUser[],
  viewer: Viewer & { readonly id: string }
): AssignableUser[] {
  if (viewer.isGm) {
    return [...users];
  }
  return users.filter((user) => user.id === viewer.id);
}

/** What the create button should do when tapped, decided before any DOM exists. */
export type CreationVerdict =
  | { readonly kind: 'choose'; readonly parties: readonly PartyCandidate[] }
  | { readonly kind: 'onlyParty'; readonly party: PartyCandidate }
  | { readonly kind: 'noParties' }
  | { readonly kind: 'notAllowed' };

/**
 * Whether there is anything to offer, and how much choosing it needs.
 *
 * The shape mirrors the sidebar button's decision for the same reason: one control on a phone has to
 * serve every situation, and a picker offering a single row is a tap to reach a tap.
 *
 * ⚠️ `noParties` and `notAllowed` are DIFFERENT, and collapsing them would be a worse interface than
 * no button. "There are no parties here" invites making one; "you may not create sheets" tells a
 * player to ask their GM. Reporting the first when the truth is the second sends someone looking for
 * a party that already exists and that they simply cannot use.
 */
export function decideCreation(
  parties: readonly PartyCandidate[],
  viewer: Viewer
): CreationVerdict {
  const creatable = creatableParties(parties, viewer);

  if (creatable.length > 1) {
    return { kind: 'choose', parties: creatable };
  }

  const only = creatable[0];
  if (only !== undefined) {
    return { kind: 'onlyParty', party: only };
  }

  return parties.length > 0 && !viewer.isGm ? { kind: 'notAllowed' } : { kind: 'noParties' };
}
