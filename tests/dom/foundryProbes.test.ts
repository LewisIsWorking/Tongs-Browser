import { afterEach, describe, expect, it } from 'vitest';

import {
  INTERACTION_STATE_NAMES,
  describeGrabTarget,
  describeInteractionState,
  describePointers,
} from '../../src/debug/FoundryProbes.js';

/**
 * The read only probes behind the diagnostics report.
 *
 * These were methods on the composition root until 2026-08-11 and therefore untestable, which is a
 * large part of why the report went through several rounds of confidently reporting numbers it had
 * never measured. A probe is a claim about the world, and a claim nothing checks is a rumour.
 */
const original = Object.getOwnPropertyDescriptor(globalThis, 'canvas');

afterEach(() => {
  if (original === undefined) {
    delete (globalThis as { canvas?: unknown }).canvas;
  } else {
    Object.defineProperty(globalThis, 'canvas', original);
  }
});

function setCanvas(value: unknown): void {
  Object.defineProperty(globalThis, 'canvas', { value, configurable: true, writable: true });
}

describe('INTERACTION_STATE_NAMES', () => {
  /**
   * These names ARE Foundry's MouseInteractionManager states, in order. A report that prints
   * "GRABBED (3)" when Foundry means something else is worse than printing the bare number, and the
   * ordering is the only thing making the name true.
   */
  it('maps each Foundry interaction state to its own name, in order', () => {
    expect(INTERACTION_STATE_NAMES).toEqual([
      'NONE',
      'HOVER',
      'CLICKED',
      'GRABBED',
      'DRAG',
      'DROP',
    ]);
  });
});

describe('describeGrabTarget', () => {
  const token = (x: number, y: number) => ({
    name: 'Anthony',
    document: { x, y, width: 1, height: 1 },
  });

  it('says YES and names the token when the pointer is standing on it', () => {
    setCanvas({
      mousePosition: { x: 2950, y: 2250 },
      grid: { size: 100 },
      tokens: { controlled: [token(2900, 2200)] },
    });

    expect(describeGrabTarget()).toBe('YES, on Anthony');
  });

  /**
   * The measured failure: token at (2900, 2200), pointer at (3083, 2152). Every other number in that
   * device report was correct and the gesture was simply started next to the token.
   */
  it('says how far OUTSIDE the token the pointer was, when it missed', () => {
    setCanvas({
      mousePosition: { x: 3083, y: 2152 },
      grid: { size: 100 },
      tokens: { controlled: [token(2900, 2200)] },
    });

    const answer = describeGrabTarget();

    expect(answer).toContain('NO');
    expect(answer).toContain('Anthony');
    // 83px right of the right edge, 48px above the top: hypot(83, 48) rounds to 96.
    expect(answer).toContain('96 canvas px OUTSIDE');
    expect(answer).toContain('Put the cursor ON the token');
  });

  it('counts the whole footprint of a token larger than one square', () => {
    setCanvas({
      mousePosition: { x: 3150, y: 2350 },
      grid: { size: 100 },
      // A 2x2 token spans 2900 to 3100 and 2200 to 2400, so this point is inside vertically and just
      // outside horizontally. Multiplying width by the grid is what makes that true.
      tokens: {
        controlled: [{ name: 'Ogre', document: { x: 2900, y: 2200, width: 2, height: 2 } }],
      },
    });

    expect(describeGrabTarget()).toContain('50 canvas px OUTSIDE');
  });

  /**
   * The other side of the token, which is a different branch and not a symmetry the code gets for
   * free: the distance is built from two three way ternaries, one per axis, and only the "beyond the
   * far edge" arm had ever run.
   */
  it('measures a miss to the LEFT and ABOVE the token too', () => {
    setCanvas({
      mousePosition: { x: 2860, y: 2170 },
      grid: { size: 100 },
      tokens: { controlled: [token(2900, 2200)] },
    });

    // 40px left of the left edge, 30px above the top: hypot(40, 30) is exactly 50.
    expect(describeGrabTarget()).toContain('50 canvas px OUTSIDE');
  });

  it('reports a miss on one axis only, with no contribution from the other', () => {
    setCanvas({
      mousePosition: { x: 2950, y: 2130 },
      grid: { size: 100 },
      tokens: { controlled: [token(2900, 2200)] },
    });

    // Inside horizontally, 70px above. The inside axis must contribute zero rather than a distance
    // to the nearest edge, or every near miss would read as further away than it is.
    expect(describeGrabTarget()).toContain('70 canvas px OUTSIDE');
  });

  /**
   * A token document with no size. Treating a missing width as one square keeps the answer sensible
   * rather than collapsing the footprint to a single point, which would report every grab as a miss.
   */
  it('treats a token with no declared size as one grid square', () => {
    setCanvas({
      mousePosition: { x: 2950, y: 2250 },
      grid: { size: 100 },
      tokens: { controlled: [{ name: 'Sizeless', document: { x: 2900, y: 2200 } }] },
    });

    expect(describeGrabTarget()).toBe('YES, on Sizeless');
  });

  it('says there was nothing to grab when no token is controlled', () => {
    setCanvas({ mousePosition: { x: 0, y: 0 }, grid: { size: 100 }, tokens: { controlled: [] } });

    expect(describeGrabTarget()).toBe('no controlled token, so there was nothing to grab');
  });

  it('says the same when the canvas is not there at all', () => {
    setCanvas(undefined);

    expect(describeGrabTarget()).toBe('no controlled token, so there was nothing to grab');
  });

  /** A missing grid must not become NaN. Foundry's default square is 100. */
  it('falls back to a 100px grid rather than producing NaN', () => {
    setCanvas({
      mousePosition: { x: 2950, y: 2250 },
      tokens: { controlled: [token(2900, 2200)] },
    });

    expect(describeGrabTarget()).toBe('YES, on Anthony');
  });

  it('falls back to a generic name for a token with none', () => {
    setCanvas({
      mousePosition: { x: 9999, y: 9999 },
      grid: { size: 100 },
      tokens: { controlled: [{ document: { x: 0, y: 0, width: 1, height: 1 } }] },
    });

    expect(describeGrabTarget()).toContain('the token');
  });
});

describe('describePointers', () => {
  it('prints our pointer, Foundry origin, the view rect and the resolution', () => {
    setCanvas({
      app: {
        view: { getBoundingClientRect: () => ({ x: 0, y: 0, width: 360, height: 607 }) },
        renderer: { events: { pointer: { global: { x: 12.4, y: 34.6 } } }, resolution: 3 },
      },
      tokens: {
        controlled: [
          { mouseInteractionManager: { interactionData: { screenOrigin: { x: 5, y: 6 } } } },
        ],
      },
    });

    const line = describePointers();

    expect(line).toContain('pixi=12,35');
    expect(line).toContain('origin=5,6');
    expect(line).toContain('viewRect=0,0 360x607');
    expect(line).toContain('res=3');
  });

  /**
   * `origin=n/a` is a real and important reading, not an error: Foundry clears interactionData once
   * a gesture ends, so a report written afterwards has no origin to show. Saying `n/a` is what stops
   * a reader taking a missing value for a zero.
   */
  it('says n/a for each part it cannot read, rather than inventing a value', () => {
    setCanvas({});

    const line = describePointers();

    expect(line).toContain('pixi=n/a');
    expect(line).toContain('origin=n/a');
    expect(line).toContain('viewRect=n/a');
    expect(line).toContain('res=n/a');
  });
});

describe('describeInteractionState', () => {
  it('names the state as well as printing its number', () => {
    expect(describeInteractionState({ mouseInteractionManager: { state: 3 } })).toBe('GRABBED (3)');
    expect(describeInteractionState({ mouseInteractionManager: { state: 0 } })).toBe('NONE (0)');
  });

  it('says so when there is no interaction manager to ask', () => {
    expect(describeInteractionState(undefined)).toBe('no interaction manager');
    expect(describeInteractionState({})).toBe('no interaction manager');
  });

  /** A future Foundry adding a state must read as UNKNOWN rather than silently as undefined. */
  it('reports a state it does not recognise as UNKNOWN', () => {
    expect(describeInteractionState({ mouseInteractionManager: { state: 99 } })).toBe(
      'UNKNOWN (99)'
    );
  });
});
