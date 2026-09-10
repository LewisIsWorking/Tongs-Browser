import { describe, expect, it } from 'vitest';

import { pressOutcomeFor } from '../../scripts/sheets/expectations.ts';

/**
 * What pressing a sheet button should PRODUCE, given what the world holds. Written 2026-09-10.
 *
 * ⛔ WHY THIS EXISTS. The live check hard-coded the two no-party notices, because every world it had
 * ever run against ran `coo`, where `party` is not an actor type and the count is always zero. The
 * first run against real PF2e failed two checks WHILE THE MODULE WAS CORRECT: PF2e creates a party
 * actor with every new world, so there is a party, so the module rightly offered a picker instead of
 * saying there was none.
 *
 * ⚠️ A hard-coded expectation is only ever right for the world it was written in. Making this a pure
 * function is what lets the same check be correct in both, and lets every branch be proven here with
 * no Foundry running.
 */
describe('a world with no parties', () => {
  const empty = { parties: 0, assignable: 1 };

  /**
   * ⚠️ The two texts must DIFFER. "No party to put a character in" and "no party to open" are the
   * pair this feature is most likely to confuse, and a check asserting only that a notice appeared
   * would pass with either message in either place.
   */
  it('tells the create button there is nowhere to create', () => {
    const outcome = pressOutcomeFor('create-sheet', empty);

    expect(outcome.kind).toBe('notice');
    expect(outcome.kind === 'notice' && outcome.text).toBe('Ask your GM to make one');
  });

  it('tells the party access button there is nothing to open', () => {
    const outcome = pressOutcomeFor('party-access', empty);

    expect(outcome.kind).toBe('notice');
    expect(outcome.kind === 'notice' && outcome.text).toBe('Make one first');
  });

  it('gives the two buttons different text', () => {
    const create = pressOutcomeFor('create-sheet', empty);
    const access = pressOutcomeFor('party-access', empty);

    expect(
      create.kind === 'notice' && access.kind === 'notice' && create.text === access.text
    ).toBe(false);
  });
});

describe('a world that holds parties', () => {
  /** ⚠️ Party access only ever lists; it never creates, whatever the user count is. */
  it.each([1, 2, 9])('offers party access a picker with %i user(s)', (assignable) => {
    expect(pressOutcomeFor('party-access', { parties: 1, assignable }).kind).toBe('picker');
  });

  /**
   * ⛔ THE CASE THAT WRITES, and the reason this function takes the user count at all. The create
   * flow collapses every step with a single answer: one party skips "which party?", one assignable
   * user skips "who plays them?". A world with one of each creates an actor on the FIRST TAP.
   *
   * A brand new PF2e world is exactly one party and one user, so the most ordinary world there is
   * hits this. The live harness promises it writes nothing, so it has to be told.
   */
  it('warns that one party and one user creates immediately', () => {
    expect(pressOutcomeFor('create-sheet', { parties: 1, assignable: 1 }).kind).toBe('creates');
  });

  /** ⚠️ A second user restores a choice, so the flow must ask rather than decide. */
  it('asks who plays the character once there is more than one user', () => {
    expect(pressOutcomeFor('create-sheet', { parties: 1, assignable: 2 }).kind).toBe('picker');
  });

  /** ⚠️ Zero assignable users is still "no choice to offer", so it must not read as a picker. */
  it('treats no assignable users as the writing case rather than a picker', () => {
    expect(pressOutcomeFor('create-sheet', { parties: 1, assignable: 0 }).kind).toBe('creates');
  });

  it('always explains itself, whichever branch it takes', () => {
    for (const assignable of [0, 1, 2]) {
      for (const id of ['create-sheet', 'party-access'] as const) {
        expect(pressOutcomeFor(id, { parties: 2, assignable }).because.length).toBeGreaterThan(0);
      }
    }
  });
});
