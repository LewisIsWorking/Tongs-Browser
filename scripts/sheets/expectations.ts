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
