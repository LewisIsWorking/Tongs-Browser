/**
 * What the create flow says when it cannot just get on with it. Added 2026-09-02.
 *
 * ⚠️ Their own file so they can be asserted as CONTENT rather than as wiring. A build catches a
 * missing message; nothing catches a message that says the wrong thing, and these are read by
 * somebody on a phone who cannot open a console to find out what really happened.
 *
 * ⚠️ Every one says what to DO. "No parties exist" is a fact; "ask your GM to make one" is a way
 * forward. The difference matters most in exactly the cases below, because each of them is a dead end
 * for the person reading it.
 */

/**
 * ⚠️ A DEFAULT rather than a prompt, because a text field on a phone puts the keyboard over most of
 * the screen. The sheet is opened straight after creating, so renaming happens in Foundry's own sheet
 * where there is room for it and where the user was going anyway.
 */
export const DEFAULT_SHEET_NAME = 'New Character';

export const NOTICES = {
  /**
   * ⚠️ NOT the same as `notAllowed`, and the distinction is the point. This one invites making a
   * party, because none exists to use.
   */
  noParties: {
    title: 'No parties yet',
    message: 'There is no party to put a character in. Ask your GM to make one.',
  },

  /**
   * ⚠️ NOT the same as `noParties`. Parties exist; this user may not create in any of them. Telling
   * them nothing exists would send them looking for something that is already there.
   */
  notAllowed: {
    title: 'Not your call',
    message: 'Your GM has not opened any party for players to add characters to. Ask them to.',
  },

  /** Rare, and only reachable with no users at all, but silence here would be a dead button. */
  noUsers: {
    title: 'Nobody to own it',
    message: 'There is no user to give this character to.',
  },

  /**
   * ⚠️ Says the sheet EXISTS, first. Leading with the failure invites a second attempt and a second
   * sheet, when what is needed is to drag this one into the party.
   */
  outsideParty: {
    title: 'Made, but not in the party',
    message: 'The character was created and is yours, but could not be added to the party:',
  },

  notCreated: {
    title: 'Not created',
    message: 'The character could not be created:',
  },
} as const;

/**
 * What the party access flow says. Added 2026-09-03.
 *
 * ⚠️ Separate from `NOTICES` because they answer a different question. These are read by a GM
 * changing a setting, not by somebody trying to make a character, and the advice that helps each is
 * not the same advice.
 */
export const ACCESS_NOTICES = {
  /**
   * ⚠️ Reachable even though the button is hidden from players. A permission enforced only by a
   * control's visibility is not enforced, and this is what the check behind it says when it fires.
   */
  notGm: {
    title: 'GM only',
    message: 'Only a GM can change who may add characters to a party.',
  },

  noParties: {
    title: 'No parties yet',
    message: 'There is no party to open. Make one first.',
  },

  /** A party deleted between opening this list and tapping a row. An ordinary race, not a fault. */
  vanished: {
    title: 'Party gone',
    message: 'That party is no longer there.',
  },

  failed: {
    title: 'Not changed',
    message: 'Who may add characters could not be changed:',
  },
} as const;
