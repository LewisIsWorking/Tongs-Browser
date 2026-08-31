import { beforeEach, describe, expect, it } from 'vitest';

import { buildModuleParts } from '../../src/ModuleParts.js';
import { makeTouchEvent } from './support/touchEvents.js';
import { stubFoundryEnvironment } from './support/moduleUnderTest.js';

/**
 * A two-finger gesture reaching Foundry's canvas, through every thunk in between. Written 2026-08-31.
 *
 * ⚠️ `ModuleParts` builds the CanvasController out of four thunks onto `FoundryAccess`, and no test
 * called any of them. They are the last link in the chain: a two-finger drag becomes a pan action,
 * the action asks the controller, and the controller asks these. A thunk wired to the wrong reader
 * gives a canvas that pans by a plausible but wrong amount, which is the failure mode the controller's
 * own docblock records as measured on a live 14.365 - a +120,+120 drag putting the pivot at
 * (-1940, -980).
 *
 * COVERS: the scale, pivot and zoom-limit thunks, and the arithmetic that depends on them.
 * MISSES: whether Foundry's own `canvas.pan` does what its signature says. Only the live harness can
 *   answer that, and `check:foundry` and `check:multitouch` do.
 */
interface PanCall {
  x?: number;
  y?: number;
  scale?: number;
}

/**
 * The canvas surface the readers actually touch, and nothing more.
 *
 * ⚠️ Deliberately minimal. A fuller fake would start describing Foundry, and a partial description of
 * somebody else's API that claims to be complete is worse than an obvious stub. `ready`, `stage.scale.x`,
 * `stage.pivot` and `pan` is the whole of what `CanvasReaders` and `CanvasController` read.
 */
function stubCanvas(scale: number, pivot: { x: number; y: number }): PanCall[] {
  const calls: PanCall[] = [];
  Object.assign(globalThis, {
    canvas: {
      ready: true,
      stage: { scale: { x: scale }, pivot: { ...pivot } },
      pan: (args: PanCall) => {
        calls.push(args);
      },
    },
  });
  return calls;
}

function parts() {
  return buildModuleParts(
    { document, window, suppressNativeTouch: () => true },
    { isEnabled: () => true }
  );
}

/** Two fingers down, then both moved by the same delta, which is a pan rather than a pinch. */
function twoFingerDrag(deltaX: number, deltaY: number): void {
  document.dispatchEvent(
    makeTouchEvent('touchstart', [
      { identifier: 1, clientX: 100, clientY: 100 },
      { identifier: 2, clientX: 200, clientY: 100 },
    ])
  );
  document.dispatchEvent(
    makeTouchEvent('touchmove', [
      { identifier: 1, clientX: 100 + deltaX, clientY: 100 + deltaY },
      { identifier: 2, clientX: 200 + deltaX, clientY: 100 + deltaY },
    ])
  );
}

beforeEach(() => {
  stubFoundryEnvironment();
});

describe('a two finger drag reaching the canvas', () => {
  /**
   * ⚠️ THE CONVERSION THAT WAS A MEASURED BUG. `canvas.pan({x, y})` is ABSOLUTE: it sets where the
   * viewport is centred in SCENE coordinates. Passing the delta straight through teleports the view.
   * The pivot thunk is what makes the absolute form possible at all.
   */
  it('pans relative to the pivot it read, not to the origin', () => {
    const calls = stubCanvas(1, { x: 1000, y: 800 });
    const built = parts();
    built.binder.bind();

    twoFingerDrag(60, 40);

    expect(calls).not.toHaveLength(0);
    const last = calls[calls.length - 1];
    expect(last?.x).toBeLessThan(1000);
    expect(last?.y).toBeLessThan(800);
  });

  /**
   * ⚠️ THE SECOND CONVERSION, and the one that is invisible at 1x. The delta is in SCREEN pixels
   * while the pivot is in SCENE units, so it must be divided by the live scale. Skipping it makes
   * panning correct at 1x and wrong everywhere else - and a scene fitted to a phone sits at 0.5,
   * where every pan would go twice as far as the finger.
   *
   * Asserted by comparing two runs rather than by pinning an absolute number: at half the scale the
   * same finger movement must move the pivot TWICE as far.
   */
  it('divides the screen delta by the live scale it read', () => {
    const atOne = stubCanvas(1, { x: 1000, y: 800 });
    const first = parts();
    first.binder.bind();
    twoFingerDrag(60, 0);
    const movedAtOne = 1000 - (atOne[atOne.length - 1]?.x ?? 1000);
    first.binder.unbind();

    const atHalf = stubCanvas(0.5, { x: 1000, y: 800 });
    const second = parts();
    second.binder.bind();
    twoFingerDrag(60, 0);
    const movedAtHalf = 1000 - (atHalf[atHalf.length - 1]?.x ?? 1000);

    expect(movedAtOne).toBeGreaterThan(0);
    expect(movedAtHalf).toBeCloseTo(movedAtOne * 2, 5);
  });

  /**
   * ⚠️ The sign is inverted on purpose: dragging two fingers right moves the map WITH the fingers,
   * which means moving the viewport CENTRE left. That is what makes it feel like dragging paper
   * rather than dragging a scrollbar, and flipping it is the kind of change that reads as harmless.
   */
  it('moves the viewport centre against the fingers, so the map follows them', () => {
    const calls = stubCanvas(1, { x: 1000, y: 800 });
    const built = parts();
    built.binder.bind();

    twoFingerDrag(50, 0);

    expect(calls[calls.length - 1]?.x).toBeLessThan(1000);
  });

  it('does nothing at all when the canvas is not ready', () => {
    const calls = stubCanvas(1, { x: 1000, y: 800 });
    (globalThis as { canvas?: { ready: boolean } }).canvas!.ready = false;
    const built = parts();
    built.binder.bind();

    twoFingerDrag(60, 40);

    expect(calls).toHaveLength(0);
  });
});
