import { describe, expect, it } from 'vitest';

import {
  describeControlledToken,
  describeScenePoint,
  isPointerInsideToken,
  type TokenBox,
} from '../../src/debug/TokenHitTest.js';

/**
 * Was the pointer actually on the token?
 *
 * This answers `insideSelectedToken` in the report, the field that separates "the drag did not work"
 * from "the drag was never aimed at anything". Those are completely different problems, so a wrong
 * answer in EITHER direction costs a round of investigation.
 */
const token = (overrides: Partial<TokenBox> = {}): TokenBox => ({
  document: { x: 100, y: 200 },
  w: 50,
  h: 60,
  ...overrides,
});

describe('isPointerInsideToken', () => {
  it('is true inside the box, including on its edges', () => {
    expect(isPointerInsideToken({ x: 120, y: 220 }, token())).toBe(true);
    expect(isPointerInsideToken({ x: 100, y: 200 }, token())).toBe(true);
    expect(isPointerInsideToken({ x: 150, y: 260 }, token())).toBe(true);
  });

  it.each([
    ['left of it', 99, 220],
    ['right of it', 151, 220],
    ['above it', 120, 199],
    ['below it', 120, 261],
  ])('is false %s', (_where, x, y) => {
    expect(isPointerInsideToken({ x, y }, token())).toBe(false);
  });

  /**
   * ⚠️ The defect this file exists for, and it was asymmetric: x was guarded and y was not.
   *
   * y read `(mouse.y ?? 0) >= (document.y ?? 0)`, so a token or a mouse position with no y at all
   * evaluated `0 >= 0 && 0 <= 0` and reported INSIDE. A false "inside" sends somebody hunting a drag
   * bug when the pointer was never on the token.
   */
  it('does NOT report inside when the y coordinates are missing entirely', () => {
    expect(isPointerInsideToken({ x: 0 }, { document: { x: 0 }, w: 10, h: 10 })).toBe(false);
    expect(isPointerInsideToken({}, { document: {}, w: 10, h: 10 })).toBe(false);
  });

  /**
   * ⚠️ The same defect in the other direction. `w ?? 0` makes the box zero pixels wide, so only the
   * exact left edge counted as a hit and every real position reported outside. A false "outside"
   * sends somebody to aim a pointer that was already on target.
   */
  it('does NOT report outside merely because the size is unknown', () => {
    expect(isPointerInsideToken({ x: 100, y: 200 }, { document: { x: 100, y: 200 } })).toBe(false);
    // Written out rather than overridden: `exactOptionalPropertyTypes` is on, so an explicit
    // undefined is a different thing from an absent key, and it is the ABSENT key Foundry gives us.
    expect(isPointerInsideToken({ x: 120, y: 220 }, { document: { x: 100, y: 200 }, h: 60 })).toBe(
      false
    );
    expect(isPointerInsideToken({ x: 120, y: 220 }, { document: { x: 100, y: 200 }, w: 50 })).toBe(
      false
    );
  });

  it('is false when there is nothing to test against', () => {
    expect(isPointerInsideToken(undefined, token())).toBe(false);
    expect(isPointerInsideToken({ x: 1, y: 1 }, undefined)).toBe(false);
    expect(isPointerInsideToken({ x: 1, y: 1 }, {})).toBe(false);
  });
});

describe('describeScenePoint', () => {
  it('rounds, because sub-pixels say nothing a reader can use', () => {
    expect(describeScenePoint({ x: 10.4, y: 20.6 })).toBe('(10, 21)');
  });

  it('says n/a rather than inventing a zero', () => {
    expect(describeScenePoint(undefined)).toBe('n/a');
    expect(describeScenePoint({ x: 5 })).toBe('n/a');
    expect(describeScenePoint({})).toBe('n/a');
  });
});

describe('describeControlledToken', () => {
  /** The reader needs the next ACTION, not the state: every drag field is meaningless without one. */
  it('names the next action when nothing is selected', () => {
    expect(describeControlledToken(undefined)).toBe('NONE, tap a token first');
  });

  it('gives the name and where it is', () => {
    expect(describeControlledToken({ ...token(), name: 'Goblin' })).toBe('Goblin at (100, 200)');
  });

  it('still reports a position for a token with no name', () => {
    expect(describeControlledToken(token())).toBe('unnamed at (100, 200)');
  });
});
