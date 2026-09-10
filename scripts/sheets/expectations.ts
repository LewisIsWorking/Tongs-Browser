/**
 * What the tray SHOULD show, given who is looking. Added 2026-09-07.
 *
 * ⛔ Extracted as a pure function for a specific reason, not for tidiness. The bug this fixes was a
 * check that assumed a GM and reported the module's gate working as two module failures. The fix
 * changes what is expected of a GM as well as of a player, and the GM half cannot be run here: that
 * account has a password this session does not have.
 *
 * ⚠️ So the choice was between shipping an unverified branch and making it verifiable. A decision
 * that takes three values and returns a verdict can be proven at a desk, for every combination, with
 * no Foundry at all. What is left in the live check is reading the three values and doing as it says.
 */
export type Expectation =
  /** Assert the button IS there. */
  | { readonly kind: 'present'; readonly name: string }
  /** Assert the button is NOT there, because something specific forbids it. */
  | { readonly kind: 'absent'; readonly name: string; readonly because: string }
  /** Cannot be judged from outside the module. Say so rather than guess. */
  | { readonly kind: 'skip'; readonly name: string; readonly because: string };

export interface Viewer {
  readonly isGm: boolean;
  /** How many party actors the world holds at all. */
  readonly parties: number;
}

/**
 * ⚠️ `party-access` is GM only and stays that way. `create-sheet` opens to a player the moment a GM
 * opens a party to them, which is why a world holding parties makes a player's case unjudgeable from
 * out here: whether one is open IS the decision under test, and asserting either way would be
 * asserting the module's own answer back at it.
 */
export function expectationFor(
  id: 'create-sheet' | 'party-access',
  what: string,
  viewer: Viewer
): Expectation {
  const who = viewer.isGm ? 'a GM' : 'a player';

  if (viewer.isGm) {
    return { kind: 'present', name: `${what} is on the tray for ${who}` };
  }

  if (id === 'party-access') {
    return {
      kind: 'absent',
      name: `${what} is correctly absent for ${who}`,
      because: 'party access is GM only',
    };
  }

  if (viewer.parties > 0) {
    return {
      kind: 'skip',
      name: `${what} is correctly gated for ${who}`,
      because:
        `this world holds ${String(viewer.parties)} party actor(s), so whether one is open to this ` +
        'player is the decision under test and cannot be judged from outside it',
    };
  }

  return {
    kind: 'absent',
    name: `${what} is correctly absent for ${who}`,
    because: 'this world holds no party actors, so there is nothing that could have been opened',
  };
}

/**
 * What pressing the button should PRODUCE, given how many parties the world holds. Added 2026-09-10.
 *
 * ⛔ WHY THIS EXISTS. The live check hard-coded the no-party notices, because the world it was
 * written against ran `coo`, where `party` is not an actor type and the count is always zero. Run
 * against real PF2e the same assertions failed, and they failed while the module was behaving
 * CORRECTLY: PF2e creates a party actor with every new world, so there IS a party, so the module
 * rightly offers a picker instead of saying there is none.
 *
 * ⚠️ A hard-coded expectation is only ever right for the world it was written in. This takes the
 * count and says what follows from it, so the same check is correct in both worlds and neither one
 * has to be the "supported" one.
 *
 * ⚠️ Pure, like `expectationFor` above and for the same reason: every branch can be proven at a desk
 * with no Foundry, leaving the live check to read one number and do as it is told.
 */
export type PressOutcome =
  /** A notice, whose text is the whole point: the two notices must not be confusable. */
  | { readonly kind: 'notice'; readonly text: string; readonly because: string }
  /** A list to choose from. */
  | { readonly kind: 'picker'; readonly because: string }
  /** ⛔ No prompt at all: pressing it WRITES AN ACTOR to the world. See below. */
  | { readonly kind: 'creates'; readonly because: string };

/** What the world holds, which is what decides how much choosing a press needs. */
export interface WorldShape {
  readonly parties: number;
  /** Users a GM could assign a sheet to. A GM may assign to anyone, so for a GM this is all of them. */
  readonly assignable: number;
}

export function pressOutcomeFor(
  id: 'create-sheet' | 'party-access',
  world: WorldShape
): PressOutcome {
  if (world.parties > 0 && id === 'party-access') {
    return {
      kind: 'picker',
      because:
        `this world holds ${String(world.parties)} party actor(s), so there is something to ` +
        'choose between and the module should offer the list rather than a notice',
    };
  }

  if (world.parties > 0) {
    /*
     * ⛔ THE CASE THAT WRITES. `CreateSheetFlow` collapses every step that has only one answer: one
     * party skips "which party?", and one assignable user skips "who plays them?". A world with one
     * of each therefore creates an actor on the FIRST TAP, with nothing shown in between.
     *
     * That is right for a user and a trap for this harness, whose docblock promises it writes
     * nothing to the world. A brand new PF2e world is exactly one party and exactly one user, so the
     * promise is broken by the most ordinary world there is. A caller seeing this must clean up
     * after itself or not press at all, and it cannot know which without being told.
     */
    if (world.assignable <= 1) {
      return {
        kind: 'creates',
        because:
          'one party and one assignable user means every choice has a single answer, so the flow ' +
          'skips both pickers and writes an actor immediately',
      };
    }

    return {
      kind: 'picker',
      because:
        `this world holds ${String(world.assignable)} assignable user(s), so the flow must ask ` +
        'who plays the new character rather than deciding for them',
    };
  }

  /*
   * ⚠️ The two texts differ ON PURPOSE and the check asserts each one. "There is no party to put a
   * character in" and "there is no party to open" are the pair this feature is most likely to
   * confuse, and an assertion that only asked "did a notice appear" would pass with either message
   * in either place.
   */
  return id === 'create-sheet'
    ? {
        kind: 'notice',
        text: 'Ask your GM to make one',
        because: 'there is no party to put a character in',
      }
    : {
        kind: 'notice',
        text: 'Make one first',
        because: 'there is no party to open',
      };
}
