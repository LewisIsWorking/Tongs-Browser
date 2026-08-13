import { describe, expect, it } from 'vitest';

import { describeTokenMovement } from '../../src/debug/TokenMovement.js';

/**
 * Did the token actually move?
 *
 * ⚠️ The single most important line in the diagnostics report, and the only one that answers the
 * question anybody actually asked. Every other field describes EVENTS, and all of those can look
 * perfectly healthy while the token sits exactly where it started, which is precisely what happened
 * for three rounds of diagnosis.
 */
describe('describeTokenMovement', () => {
  it('says YES with both positions when the token moved', () => {
    expect(describeTokenMovement({ x: 100, y: 200 }, { x: 300, y: 400 })).toEqual({
      verdict: 'moved',
      sentence: 'YES (100,200 -> 300,400)',
    });
  });

  /**
   * ⚠️ Both coordinates are printed whatever the answer, because a NO is not the end of the enquiry.
   * "NO (3000,1900 -> 3000,1900)" says the token was found and did not move; a bare NO leaves open
   * whether it was even the same token.
   */
  it('says NO with both positions when it did not', () => {
    expect(describeTokenMovement({ x: 3000, y: 1900 }, { x: 3000, y: 1900 })).toEqual({
      verdict: 'unmoved',
      sentence: 'NO (3000,1900 -> 3000,1900)',
    });
  });

  it('counts movement on either axis alone', () => {
    expect(describeTokenMovement({ x: 100, y: 200 }, { x: 101, y: 200 }).verdict).toBe('moved');
    expect(describeTokenMovement({ x: 100, y: 200 }, { x: 100, y: 201 }).verdict).toBe('moved');
  });

  /**
   * ⚠️ Exact inequality rather than a threshold. Foundry snaps a dropped token to the grid, so a
   * committed move is always a whole square and never a sub pixel drift. A tolerance would only hide
   * the case where the token moved a little and should not have.
   */
  it('reports even a one pixel difference, with no tolerance', () => {
    expect(describeTokenMovement({ x: 0, y: 0 }, { x: 0.5, y: 0 }).verdict).toBe('moved');
  });

  /**
   * ⚠️ The two "cannot say" answers are DIFFERENT and neither is a NO.
   *
   * "No grab recorded" means the button was never pressed, so the report is about nothing. "No token
   * selected now" means the selection was lost between the grab and the report, which is itself a
   * finding: a token that deselects mid drag is one of the ways a drag silently ends. Collapsing
   * either into NO would report a failure that was never measured.
   */
  it('distinguishes "never grabbed" from "selection lost", and neither is a NO', () => {
    const neverGrabbed = describeTokenMovement(null, { x: 1, y: 2 });
    const lostSelection = describeTokenMovement({ x: 1, y: 2 }, undefined);

    expect(neverGrabbed).toEqual({ verdict: 'no-grab', sentence: 'no grab recorded yet' });
    expect(lostSelection).toEqual({ verdict: 'no-token', sentence: 'no token selected now' });
    expect(neverGrabbed.verdict).not.toBe(lostSelection.verdict);
    expect(neverGrabbed.sentence).not.toContain('NO (');
    expect(lostSelection.sentence).not.toContain('NO (');
  });

  it('treats a half read position as no token rather than as the origin', () => {
    expect(describeTokenMovement({ x: 1, y: 2 }, { x: 5 }).verdict).toBe('no-token');
    expect(describeTokenMovement({ x: 1, y: 2 }, { y: 5 }).verdict).toBe('no-token');
    expect(describeTokenMovement({ x: 1, y: 2 }, {}).verdict).toBe('no-token');
  });

  /** Zero is a real coordinate, not a missing one, and a token at the origin must still report. */
  it('reads a coordinate of zero as a position', () => {
    expect(describeTokenMovement({ x: 0, y: 0 }, { x: 0, y: 0 }).sentence).toBe('NO (0,0 -> 0,0)');
  });
});

/**
 * ⚠️ The verdict and the sentence come from ONE computation, and this is the test that keeps them
 * that way. The verdict exists because a caller needed the answer and had only the sentence, and the
 * reachable move was to match `YES` out of it. A second derivation of the same fact is a competitor
 * to the first, and competitors disagree - usually long after anyone remembers there are two.
 */
describe('the verdict and the sentence agree, always', () => {
  const cases: {
    atGrab: { x: number; y: number } | null;
    now: { x?: number; y?: number } | undefined;
  }[] = [
    { atGrab: { x: 1, y: 1 }, now: { x: 2, y: 2 } },
    { atGrab: { x: 1, y: 1 }, now: { x: 1, y: 1 } },
    { atGrab: null, now: { x: 1, y: 1 } },
    { atGrab: { x: 1, y: 1 }, now: undefined },
  ];

  it.each(cases)('agrees for %j', ({ atGrab, now }) => {
    const movement = describeTokenMovement(atGrab, now);

    expect(movement.sentence.startsWith('YES')).toBe(movement.verdict === 'moved');
    expect(movement.sentence.startsWith('NO (')).toBe(movement.verdict === 'unmoved');
  });
});
