import { describe, expect, it } from 'vitest';

import { expectationFor } from '../../scripts/sheets/expectations.ts';

/**
 * What the live sheet check should expect of the tray, given who is looking. Written 2026-09-07.
 *
 * ⛔ WHY THIS EXISTS AS A UNIT TEST. The live check assumed a GM: it named its assertions "for a GM"
 * while never establishing that it was one, because `FOUNDRY_USER` defaults to `Gamemaster` and
 * nobody had ever run it as anything else. Run as a player it reported the module's gate working
 * correctly as two module failures, which is the harness accusing the feature.
 *
 * ⚠️ The GM half of the fix CANNOT be run here: that account has a password this session does not
 * have. Rather than ship an unverified branch, the decision was made a pure function so every
 * combination can be proven at a desk with no Foundry at all.
 */
describe('what a GM should see', () => {
  it('expects both buttons, whatever the world holds', () => {
    for (const parties of [0, 3]) {
      expect(
        expectationFor('create-sheet', 'the create button', { isGm: true, parties }).kind
      ).toBe('present');
      expect(expectationFor('party-access', 'the button', { isGm: true, parties }).kind).toBe(
        'present'
      );
    }
  });
});

describe('what a player should see', () => {
  /** ⚠️ GM only, permanently, so its absence is assertable in every world. */
  it('never expects the party access button', () => {
    const result = expectationFor('party-access', 'the button', { isGm: false, parties: 5 });

    expect(result.kind).toBe('absent');
    expect(result.kind === 'absent' && result.because).toContain('GM only');
  });

  /**
   * ⛔ The case that was reported as a failure. With no parties in the world there is nothing a GM
   * could have opened, so the create button MUST be absent, and its presence would be the bug.
   */
  it('expects the create button absent when the world holds no parties at all', () => {
    const result = expectationFor('create-sheet', 'the create button', { isGm: false, parties: 0 });

    expect(result.kind).toBe('absent');
    expect(result.kind === 'absent' && result.because).toContain('no party actors');
  });

  /**
   * ⚠️ SKIPS rather than guessing. Whether a party is open to this player is the decision under
   * test; asserting either way would be asserting the module's own answer back at it, which passes
   * whatever the module does and is therefore worth nothing.
   */
  it('cannot judge the create button when the world does hold parties', () => {
    const result = expectationFor('create-sheet', 'the create button', { isGm: false, parties: 2 });

    expect(result.kind).toBe('skip');
    expect(result.kind === 'skip' && result.because).toContain('2 party actor(s)');
  });
});

describe('the names it produces', () => {
  /** ⚠️ Says WHO it judged. A result reading "for a GM" after running as a player is the original bug. */
  it('names the viewer it actually judged', () => {
    expect(
      expectationFor('create-sheet', 'the create button', { isGm: true, parties: 0 }).name
    ).toContain('for a GM');
    expect(
      expectationFor('create-sheet', 'the create button', { isGm: false, parties: 0 }).name
    ).toContain('for a player');
  });
});
