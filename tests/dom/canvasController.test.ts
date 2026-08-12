import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasController, type CanvasLike } from '../../src/gesture/CanvasController.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('CanvasController', () => {
  type PanFn = (options: { x?: number; y?: number; scale?: number }) => void;
  type FakeCanvas = CanvasLike & {
    pan: ReturnType<typeof vi.fn<PanFn>>;
    scale: number;
    pivot: { x: number; y: number };
  };

  /**
   * The fake applies scale AND position changes to itself, rather than merely recording the call.
   *
   * That is not the fake growing fields to satisfy a test. A real canvas is where the scale and the
   * view centre live, and pan is what changes them, so a fake that accepts a value and then keeps
   * reporting the old one cannot express the bugs these tests exist for.
   *
   * ⚠️ The pivot half was added 2026-08-11 after a real bug. panBy passed its screen delta straight
   * into canvas.pan, which is ABSOLUTE, so a 50px drag teleported the view to scene coordinate -50
   * instead of panning. The fake could not catch it because it never applied x or y, and the live
   * guard could not catch it because it asserted only that the pivot moved NEGATIVELY, which the bug
   * satisfies perfectly.
   */
  function fakeCanvas(ready = true, initialScale = 1): FakeCanvas {
    const canvas: FakeCanvas = {
      ready,
      scale: initialScale,
      pivot: { x: 1000, y: 1000 },
      pan: vi.fn<PanFn>((options) => {
        if (options.scale !== undefined) {
          canvas.scale = options.scale;
        }
        if (options.x !== undefined) {
          canvas.pivot.x = options.x;
        }
        if (options.y !== undefined) {
          canvas.pivot.y = options.y;
        }
      }),
    };
    return canvas;
  }

  function controllerFor(
    canvas: FakeCanvas,
    extra: Partial<ConstructorParameters<typeof CanvasController>[0]> = {}
  ) {
    return new CanvasController({
      getCanvas: () => canvas,
      getScale: () => canvas.scale,
      getPivot: () => canvas.pivot,
      ...extra,
    });
  }

  /**
   * Panning is RELATIVE to where the view already is, and the delta is in SCREEN pixels.
   *
   * Both halves matter and each hides the other. Passing the delta straight through looks correct
   * whenever the pivot happens to be near the origin, and forgetting the scale division looks
   * correct at 1x, which is the one zoom level a scene almost never loads at.
   */
  it('pans relative to the current pivot rather than jumping to the delta', () => {
    const canvas = fakeCanvas(true, 1);
    canvas.pivot = { x: 1000, y: 800 };

    controllerFor(canvas).panBy(120, 60);

    // Inverted, because the map moves WITH the fingers, so the viewport centre goes the other way.
    expect(canvas.pan).toHaveBeenLastCalledWith({ x: 880, y: 740 });
  });

  it('converts the screen delta into scene units using the live scale', () => {
    const canvas = fakeCanvas(true, 0.5);
    canvas.pivot = { x: 1000, y: 800 };

    controllerFor(canvas).panBy(100, 100);

    // At 0.5 zoom, 100 screen pixels is 200 scene units.
    expect(canvas.pan).toHaveBeenLastCalledWith({ x: 800, y: 600 });
  });

  it('declines to pan when the pivot cannot be read at all', () => {
    const canvas = fakeCanvas();
    const controller = new CanvasController({
      getCanvas: () => canvas,
      getScale: () => canvas.scale,
      getPivot: () => null,
    });

    expect(controller.panBy(50, 50)).toBe(false);
    expect(canvas.pan).not.toHaveBeenCalled();
  });

  /**
   * The map should move with the fingers, like dragging paper. That means moving the viewport
   * centre the opposite way, hence the inverted sign.
   *
   * ⚠️ This assertion used to read `{ x: -30, y: -20 }`, which was the BUG written down as a
   * requirement: it treated the raw delta as an absolute destination, because canvas.pan is
   * absolute. The pivot has to be added, or a drag teleports the view near the scene origin instead
   * of panning. A test can freeze a mistake exactly as easily as it can protect a behaviour.
   */
  it('inverts the pan delta so the map follows the fingers', () => {
    const canvas = fakeCanvas();
    canvas.pivot = { x: 500, y: 400 };
    const controller = controllerFor(canvas);

    expect(controller.panBy(30, 20)).toBe(true);
    expect(canvas.pan).toHaveBeenCalledWith({ x: 470, y: 380 });
  });

  it('reports failure and signals the caller when the canvas is not ready', () => {
    const onUnavailable = vi.fn();
    const controller = controllerFor(fakeCanvas(false), { onUnavailable });

    expect(controller.panBy(10, 10)).toBe(false);
    expect(onUnavailable).toHaveBeenCalledOnce();
  });

  it('applies a relative zoom ratio to the running scale', () => {
    const canvas = fakeCanvas();
    const controller = controllerFor(canvas);

    controller.zoomBy(2);
    expect(canvas.pan).toHaveBeenCalledWith({ scale: 2 });

    controller.zoomBy(1.5);
    expect(canvas.pan).toHaveBeenLastCalledWith({ scale: 3 });
  });

  /**
   * The regression test for the first pinch of a session, measured against a real Foundry on
   * 2026-08-09 before the fix.
   *
   * The controller used to seed its own scale to 1 and correct it only through a syncScale method
   * that nothing called. Foundry fits a scene to the viewport on load, so a scene sitting at 0.5
   * took a 1.6x pinch and jumped straight to 1.6 rather than to 0.8. The error is exactly
   * 1/initialScale, which makes it worst on the scenes that are zoomed furthest out, and it fired on
   * the very first pinch every session.
   */
  it('builds the pinch on the scale the canvas is actually at', () => {
    const canvas = fakeCanvas(true, 0.5);
    const controller = controllerFor(canvas);

    controller.zoomBy(1.6);

    expect(canvas.pan).toHaveBeenCalledWith({ scale: 0.8 });
  });

  /**
   * The same bug from the other side. Anything that zooms without going through this controller,
   * Foundry's own zoom buttons, the mouse wheel, or switching scene, would leave a cached value
   * stale, and the next pinch would lurch back to wherever the module last thought it was.
   */
  it('follows a zoom that happened outside the module', () => {
    const canvas = fakeCanvas(true, 1);
    const controller = controllerFor(canvas);

    controller.zoomBy(2);
    expect(canvas.pan).toHaveBeenLastCalledWith({ scale: 2 });

    canvas.scale = 4;
    controller.zoomBy(2);

    expect(canvas.pan).toHaveBeenLastCalledWith({ scale: 8 });
  });

  it('falls back to the last applied scale when the live scale cannot be read', () => {
    const canvas = fakeCanvas();
    const controller = new CanvasController({
      getCanvas: () => canvas,
      getScale: () => null,
      getPivot: () => canvas.pivot,
    });

    controller.zoomBy(2);
    expect(canvas.pan).toHaveBeenLastCalledWith({ scale: 2 });
    expect(controller.getLastAppliedScale()).toBe(2);

    controller.zoomBy(2);
    expect(canvas.pan).toHaveBeenLastCalledWith({ scale: 4 });
  });

  /**
   * An unclamped pinch can drive the scale to a value Foundry refuses, after which the canvas stops
   * responding to zoom at all until the scene is reloaded.
   */
  it('clamps to the configured zoom bounds', () => {
    const canvas = fakeCanvas();
    const controller = controllerFor(canvas, {
      getZoomLimits: () => ({ minimum: 0.5, maximum: 2 }),
    });

    controller.zoomBy(100);
    expect(canvas.pan).toHaveBeenLastCalledWith({ scale: 2 });

    controller.zoomBy(0.0001);
    expect(canvas.pan).toHaveBeenLastCalledWith({ scale: 0.5 });
  });

  it('falls back to wide bounds when Foundry exposes no zoom limits', () => {
    const canvas = fakeCanvas();
    const controller = controllerFor(canvas);

    controller.zoomBy(1000);
    expect(canvas.pan).toHaveBeenLastCalledWith({ scale: 10 });
  });

  it('does not call pan again once already at the limit', () => {
    const canvas = fakeCanvas();
    const controller = controllerFor(canvas, {
      getZoomLimits: () => ({ minimum: 0.5, maximum: 2 }),
    });

    controller.zoomBy(100);
    canvas.pan.mockClear();
    controller.zoomBy(100);

    expect(canvas.pan).not.toHaveBeenCalled();
  });

  it.each([0, -1, Number.NaN])('ignores %s as a zoom ratio', (ratio) => {
    const canvas = fakeCanvas();
    const controller = controllerFor(canvas);

    expect(controller.zoomBy(ratio)).toBe(false);
    expect(canvas.pan).not.toHaveBeenCalled();
  });
});
