import { describe, expect, it } from 'vitest';

import {
  pointerMoveActions,
  type TranslationConfig,
} from '../../src/gesture/PointerTranslation.js';

/**
 * How finger movement becomes pointer movement.
 *
 * The two modes exist because a phone and a tablet want different things, and neither is a
 * compromise for the other: trackpad multiplies reach, offset keeps the finger off the target.
 */
const finger = (clientX: number, clientY: number) => ({ id: 1, clientX, clientY });

const trackpad: TranslationConfig = {
  pointerMode: 'trackpad',
  offsetDistancePx: 60,
  sensitivity: 2,
};
const offset: TranslationConfig = { pointerMode: 'offset', offsetDistancePx: 60, sensitivity: 2 };

describe('trackpad mode', () => {
  /** Relative, so the pointer stays where it was left and sensitivity multiplies reach. */
  it('moves BY the distance travelled, scaled by sensitivity', () => {
    const actions = pointerMoveActions(finger(150, 220), finger(100, 200), trackpad);

    expect(actions).toEqual([{ type: 'movePointerBy', deltaX: 100, deltaY: 40 }]);
  });

  it('carries the sign, so moving back moves the pointer back', () => {
    const actions = pointerMoveActions(finger(50, 180), finger(100, 200), trackpad);

    expect(actions).toEqual([{ type: 'movePointerBy', deltaX: -100, deltaY: -40 }]);
  });

  it('applies a sensitivity of 1 as one to one', () => {
    const actions = pointerMoveActions(finger(110, 200), finger(100, 200), {
      ...trackpad,
      sensitivity: 1,
    });

    expect(actions).toEqual([{ type: 'movePointerBy', deltaX: 10, deltaY: 0 }]);
  });

  /**
   * ⚠️ Nothing at all, rather than a delta measured from zero. Without a previous position the only
   * available origin is the origin, so a first move would fling the pointer by the full distance
   * from the top left corner of the screen to the finger.
   */
  it('emits NOTHING when there is no previous position to measure from', () => {
    expect(pointerMoveActions(finger(400, 800), null, trackpad)).toEqual([]);
  });

  it('emits a zero move for a finger that has not moved', () => {
    const actions = pointerMoveActions(finger(100, 200), finger(100, 200), trackpad);

    expect(actions).toEqual([{ type: 'movePointerBy', deltaX: 0, deltaY: 0 }]);
  });
});

describe('offset mode', () => {
  /** The pointer sits a fixed distance ABOVE the finger, so the finger never covers the target. */
  it('places the pointer above the finger by the configured distance', () => {
    const actions = pointerMoveActions(finger(300, 500), null, offset);

    expect(actions).toEqual([{ type: 'movePointerTo', position: { clientX: 300, clientY: 440 } }]);
  });

  /**
   * ⚠️ ABSOLUTE, so no previous position is needed. That is why this mode works from the very first
   * move of a gesture while trackpad mode has nothing to measure from yet.
   */
  it('works from the first move, with no previous position', () => {
    const first = pointerMoveActions(finger(300, 500), null, offset);
    const later = pointerMoveActions(finger(300, 500), finger(10, 10), offset);

    expect(first).toEqual(later);
  });

  it('ignores sensitivity, which has no meaning for an absolute placement', () => {
    const doubled = pointerMoveActions(finger(300, 500), null, { ...offset, sensitivity: 10 });

    expect(doubled).toEqual([{ type: 'movePointerTo', position: { clientX: 300, clientY: 440 } }]);
  });
});
