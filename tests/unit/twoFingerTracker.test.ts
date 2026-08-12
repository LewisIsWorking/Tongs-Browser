import { describe, expect, it } from 'vitest';

import { TwoFingerTracker } from '../../src/gesture/TwoFingerTracker.js';

/**
 * Two fingers: pan, or zoom, but never both at once.
 *
 * ⚠️ Kept apart deliberately. Applying both from one gesture makes the canvas lurch, because a small
 * pinch always drags the centroid slightly too, so a user trying to zoom gets a shove sideways they
 * did not ask for.
 */
let nextId = 0;
const finger = (clientX: number, clientY: number) => ({ id: (nextId += 1), clientX, clientY });

/** A pair a fixed distance apart, centred where asked. */
const pair = (centreX: number, centreY: number, gap: number) => [
  finger(centreX - gap / 2, centreY),
  finger(centreX + gap / 2, centreY),
];

const THRESHOLD = 10;

describe('TwoFingerTracker', () => {
  it('pans when the fingers move together without changing their separation', () => {
    const tracker = new TwoFingerTracker();
    tracker.begin(pair(100, 100, 80));

    const outcome = tracker.update(pair(130, 150, 80), THRESHOLD, false);

    expect(outcome).toEqual({ kind: 'pan', deltaX: 30, deltaY: 50 });
  });

  it('zooms once the separation changes past the threshold', () => {
    const tracker = new TwoFingerTracker();
    tracker.begin(pair(100, 100, 80));

    const outcome = tracker.update(pair(100, 100, 160), THRESHOLD, false);

    expect(outcome).toMatchObject({ kind: 'zoom', ratio: 2, centerX: 100, centerY: 100 });
  });

  it('stays panning while the separation change is within the threshold', () => {
    const tracker = new TwoFingerTracker();
    tracker.begin(pair(100, 100, 80));

    expect(tracker.update(pair(105, 100, 88), THRESHOLD, false).kind).toBe('pan');
  });

  /**
   * ⚠️ Once committed to zooming the gesture does NOT fall back to panning. Alternating between the
   * two mid gesture is what makes the canvas lurch, and a pinch that briefly holds still would
   * otherwise emit a pan from whatever drift the fingers had.
   */
  it('keeps zooming once committed, even when the fingers barely move', () => {
    const tracker = new TwoFingerTracker();
    tracker.begin(pair(100, 100, 80));

    const outcome = tracker.update(pair(101, 100, 81), THRESHOLD, true);

    expect(outcome.kind).toBe('zoom');
  });

  /**
   * ⚠️ A ratio of 1, never a division producing Infinity. Zero separation means both touches arrived
   * at the same coordinate, which happens on the first move of a fast pinch, and Infinity would zoom
   * the canvas to nothing in a single frame.
   */
  it('reports a ratio of 1 rather than Infinity when the fingers started together', () => {
    const tracker = new TwoFingerTracker();
    tracker.begin([finger(50, 50), finger(50, 50)]);

    const outcome = tracker.update(pair(50, 50, 100), THRESHOLD, false);

    expect(outcome).toMatchObject({ kind: 'zoom', ratio: 1 });
  });

  it('does nothing at all when a finger has lifted', () => {
    const tracker = new TwoFingerTracker();
    tracker.begin(pair(100, 100, 80));

    expect(tracker.update([finger(100, 100)], THRESHOLD, false)).toEqual({ kind: 'nothing' });
    expect(tracker.update([], THRESHOLD, true)).toEqual({ kind: 'nothing' });
  });

  /**
   * ⚠️ A pan updates the SEPARATION as well as the centroid. Leaving it stale would measure the next
   * pinch against wherever the fingers were when the gesture started, so a slow spread during a long
   * pan would cross the threshold all at once and jump the zoom.
   */
  it('does not accumulate a hidden pinch across a long pan', () => {
    const tracker = new TwoFingerTracker();
    tracker.begin(pair(100, 100, 80));

    // Six pans, each spreading by 8px: under the threshold every time, 48px in total.
    for (let step = 1; step <= 6; step += 1) {
      const outcome = tracker.update(pair(100 + step * 5, 100, 80 + step * 8), THRESHOLD, false);
      expect(outcome.kind).toBe('pan');
    }
  });

  it('measures each pan from the previous position, not the starting one', () => {
    const tracker = new TwoFingerTracker();
    tracker.begin(pair(100, 100, 80));

    tracker.update(pair(110, 100, 80), THRESHOLD, false);
    const second = tracker.update(pair(125, 100, 80), THRESHOLD, false);

    expect(second).toEqual({ kind: 'pan', deltaX: 15, deltaY: 0 });
  });

  it('measures each zoom from the previous separation, so ratios compose', () => {
    const tracker = new TwoFingerTracker();
    tracker.begin(pair(100, 100, 50));

    const first = tracker.update(pair(100, 100, 100), THRESHOLD, true);
    const second = tracker.update(pair(100, 100, 200), THRESHOLD, true);

    expect(first).toMatchObject({ ratio: 2 });
    expect(second).toMatchObject({ ratio: 2 });
  });

  it('anchors the zoom at the centroid, which moves with the fingers', () => {
    const tracker = new TwoFingerTracker();
    tracker.begin(pair(100, 100, 50));

    const outcome = tracker.update(pair(300, 400, 150), THRESHOLD, true);

    expect(outcome).toMatchObject({ centerX: 300, centerY: 400 });
  });
});
