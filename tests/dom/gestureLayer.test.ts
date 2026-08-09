import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VIRTUAL_POINTER_ID } from '../../src/constants.js';
import { CanvasController, type CanvasLike } from '../../src/gesture/CanvasController.js';
import { ExclusionZones } from '../../src/gesture/ExclusionZones.js';
import { TouchBinder } from '../../src/gesture/TouchBinder.js';
import type { GestureInput } from '../../src/gesture/GestureTypes.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('ExclusionZones', () => {
  const zones = new ExclusionZones();

  function withMarkup(html: string, selector: string): Element {
    document.body.innerHTML = html;
    const element = document.querySelector(selector);
    if (element === null) {
      throw new Error(`Fixture selector ${selector} matched nothing.`);
    }
    return element;
  }

  it('excludes text inputs, so typing in chat keeps a real keyboard and caret', () => {
    expect(zones.isExcluded(withMarkup('<input id="x">', '#x'))).toBe(true);
  });

  it('excludes textareas', () => {
    expect(zones.isExcluded(withMarkup('<textarea id="x"></textarea>', '#x'))).toBe(true);
  });

  it('excludes contenteditable regions', () => {
    expect(zones.isExcluded(withMarkup('<div id="x" contenteditable="true"></div>', '#x'))).toBe(
      true
    );
  });

  it('does not exclude contenteditable explicitly turned off', () => {
    expect(zones.isExcluded(withMarkup('<div id="x" contenteditable="false"></div>', '#x'))).toBe(
      false
    );
  });

  it('excludes the chat log, so native momentum scrolling keeps working', () => {
    expect(zones.isExcluded(withMarkup('<ol id="chat-log"></ol>', '#chat-log'))).toBe(true);
  });

  /**
   * Uses closest rather than matches, so a tap on a nested span inside an excluded container is
   * excluded too. Checking only the exact element hit would leak every child.
   */
  it('excludes descendants of an excluded container, not just the container itself', () => {
    const span = withMarkup(
      '<ol id="chat-log"><li class="message"><span id="inner">rolled 17</span></li></ol>',
      '#inner'
    );
    expect(zones.isExcluded(span)).toBe(true);
  });

  it('honours the explicit opt out attribute, so other modules can carve themselves out', () => {
    expect(
      zones.isExcluded(withMarkup('<div id="x" data-tongs-browser="ignore"></div>', '#x'))
    ).toBe(true);
  });

  it('does not exclude the canvas or ordinary interface elements', () => {
    expect(zones.isExcluded(withMarkup('<canvas id="board"></canvas>', '#board'))).toBe(false);
    expect(zones.isExcluded(withMarkup('<div id="plain"></div>', '#plain'))).toBe(false);
  });

  it('treats a null target as not excluded rather than throwing', () => {
    expect(zones.isExcluded(null)).toBe(false);
  });

  it('accepts additional selectors without a code change', () => {
    const widened = new ExclusionZones({ additionalSelectors: ['.my-module-panel'] });
    expect(widened.isExcluded(withMarkup('<div id="x" class="my-module-panel"></div>', '#x'))).toBe(
      true
    );
  });
});

/**
 * jsdom does not construct real TouchEvents with a populated TouchList, so touches are supplied as
 * a plain array shaped like one. The binder only ever reads length and item, which is exactly the
 * surface being stood in for.
 */
function touchList(points: { identifier: number; clientX: number; clientY: number }[]): TouchList {
  return {
    length: points.length,
    item: (index: number) => points[index] ?? null,
  } as unknown as TouchList;
}

function makeTouchEvent(
  type: string,
  points: { identifier: number; clientX: number; clientY: number }[]
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: touchList(points) });
  return event;
}

describe('TouchBinder', () => {
  function setup(options: { suppress?: boolean } = {}) {
    const inputs: GestureInput[] = [];
    const binder = new TouchBinder({
      target: document,
      exclusions: new ExclusionZones(),
      onInput: (input) => inputs.push(input),
      suppressNativeTouch: () => options.suppress ?? true,
      now: () => 1000,
    });
    binder.bind();
    return { binder, inputs };
  }

  it('translates a touchstart into a gesture input carrying the finger positions', () => {
    const { binder, inputs } = setup();
    const board = document.createElement('canvas');
    document.body.append(board);

    board.dispatchEvent(
      makeTouchEvent('touchstart', [{ identifier: 3, clientX: 40, clientY: 50 }])
    );

    expect(inputs).toEqual([
      { type: 'touchstart', touches: [{ id: 3, clientX: 40, clientY: 50 }], at: 1000 },
    ]);
    binder.unbind();
  });

  /**
   * Without preventDefault the browser scrolls the page, fires its own synthetic mouse events about
   * 300ms later, and shows text selection handles, all on top of what this module is doing.
   */
  it('cancels the touch so the browser does not scroll or synthesise its own clicks', () => {
    const { binder } = setup();
    const board = document.createElement('canvas');
    document.body.append(board);

    const event = makeTouchEvent('touchstart', [{ identifier: 0, clientX: 1, clientY: 1 }]);
    board.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    binder.unbind();
  });

  it('leaves excluded regions entirely alone, neither cancelling nor reporting them', () => {
    const { binder, inputs } = setup();
    const input = document.createElement('input');
    document.body.append(input);

    const event = makeTouchEvent('touchstart', [{ identifier: 0, clientX: 1, clientY: 1 }]);
    input.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(inputs).toEqual([]);
    binder.unbind();
  });

  it('reports a touchcancel without cancelling it, since there is nothing left to prevent', () => {
    const { binder, inputs } = setup();
    const board = document.createElement('canvas');
    document.body.append(board);

    board.dispatchEvent(makeTouchEvent('touchcancel', []));

    expect(inputs).toEqual([{ type: 'touchcancel', at: 1000 }]);
    binder.unbind();
  });

  it('stops listening after unbind', () => {
    const { binder, inputs } = setup();
    const board = document.createElement('canvas');
    document.body.append(board);
    binder.unbind();

    board.dispatchEvent(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 1, clientY: 1 }]));

    expect(inputs).toEqual([]);
    expect(binder.isBound()).toBe(false);
  });
});

describe('TouchBinder native pointer suppression', () => {
  function dispatchNativePointer(pointerId: number, pointerType: string, target: Element): boolean {
    let reached = false;
    const listener = (): void => {
      reached = true;
    };
    document.body.addEventListener('pointerdown', listener);
    target.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId, pointerType })
    );
    document.body.removeEventListener('pointerdown', listener);
    return reached;
  }

  it('stops a real touch derived pointer event from reaching Foundry', () => {
    const inputs: GestureInput[] = [];
    const binder = new TouchBinder({
      target: document,
      exclusions: new ExclusionZones(),
      onInput: (input) => inputs.push(input),
      suppressNativeTouch: () => true,
      now: () => 0,
    });
    binder.bind();

    const board = document.createElement('canvas');
    document.body.append(board);

    expect(dispatchNativePointer(1, 'touch', board)).toBe(false);
    binder.unbind();
  });

  it('lets our own synthesised pointer through, identified by the reserved id', () => {
    const binder = new TouchBinder({
      target: document,
      exclusions: new ExclusionZones(),
      onInput: () => undefined,
      suppressNativeTouch: () => true,
      now: () => 0,
    });
    binder.bind();

    const board = document.createElement('canvas');
    document.body.append(board);

    expect(dispatchNativePointer(VIRTUAL_POINTER_ID, 'mouse', board)).toBe(true);
    binder.unbind();
  });

  it('leaves a real mouse alone, so a plugged in mouse still works', () => {
    const binder = new TouchBinder({
      target: document,
      exclusions: new ExclusionZones(),
      onInput: () => undefined,
      suppressNativeTouch: () => true,
      now: () => 0,
    });
    binder.bind();

    const board = document.createElement('canvas');
    document.body.append(board);

    expect(dispatchNativePointer(1, 'mouse', board)).toBe(true);
    binder.unbind();
  });

  it('suppresses nothing when the setting is off, so a conflicting module can take over', () => {
    const binder = new TouchBinder({
      target: document,
      exclusions: new ExclusionZones(),
      onInput: () => undefined,
      suppressNativeTouch: () => false,
      now: () => 0,
    });
    binder.bind();

    const board = document.createElement('canvas');
    document.body.append(board);

    expect(dispatchNativePointer(1, 'touch', board)).toBe(true);
    binder.unbind();
  });
});

describe('CanvasController', () => {
  type PanFn = (options: { x?: number; y?: number; scale?: number }) => void;
  type FakeCanvas = CanvasLike & { pan: ReturnType<typeof vi.fn<PanFn>>; scale: number };

  /**
   * The fake applies scale changes to itself, rather than merely recording the call.
   *
   * That is not the fake growing a field to satisfy a test. A real canvas is where the scale lives,
   * and pan is what changes it, so a fake that accepts a scale and then keeps reporting the old one
   * is a fake that cannot express the bug these tests exist for.
   */
  function fakeCanvas(ready = true, initialScale = 1): FakeCanvas {
    const canvas: FakeCanvas = {
      ready,
      scale: initialScale,
      pan: vi.fn<PanFn>((options) => {
        if (options.scale !== undefined) {
          canvas.scale = options.scale;
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
      ...extra,
    });
  }

  /**
   * The map should move with the fingers, like dragging paper. That means moving the viewport
   * centre the opposite way, hence the inverted sign.
   */
  it('inverts the pan delta so the map follows the fingers', () => {
    const canvas = fakeCanvas();
    const controller = controllerFor(canvas);

    expect(controller.panBy(30, 20)).toBe(true);
    expect(canvas.pan).toHaveBeenCalledWith({ x: -30, y: -20 });
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
    const controller = new CanvasController({ getCanvas: () => canvas, getScale: () => null });

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
