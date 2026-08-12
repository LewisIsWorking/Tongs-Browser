import { describe, expect, it, vi } from 'vitest';

import { GestureController } from '../../src/gesture/GestureController.js';
import type { CanvasController } from '../../src/gesture/CanvasController.js';
import type { GestureAction } from '../../src/gesture/GestureTypes.js';
import type { VirtualPointer } from '../../src/pointer/VirtualPointer.js';
import { CLICKS, build } from './support/gestureController.js';

/**
 * A click while a grab is held destroys the drag, and nothing in this repo could see it.
 *
 * `GestureController` had no test file at all, which is the second time on this project that the
 * class carrying out the actions went untested while the pure thing deciding them was covered
 * thoroughly. `CanvasController` was the first, and it was hiding a bug of exactly this shape.
 *
 * Measured on a OnePlus 13, Chrome 150, Foundry 14.365: 197 drag moves dispatched during one grab,
 * and Foundry's drag origin readable for only 6 of them, drifting 8.7px while the pointer travelled
 * 140.3px. Every click sequence opens with a pointerdown, and Foundry treats a pointerdown on a
 * placeable as the start of an interaction: it records a new `screenOrigin` under the pointer, which
 * can then never be 10px away, so the drag stalls at GRABBED and the token never moves.
 */
describe('GestureController while a grab is held', () => {
  it.each(CLICKS)('swallows $type so it cannot restart the drag', (action) => {
    const { calls, perform } = build(true);

    perform(action);

    expect(calls).toEqual([]);
  });

  it.each(CLICKS)('still performs $type when nothing is being dragged', (action) => {
    const { calls, perform } = build(false);

    perform(action);

    expect(calls).toEqual([action.type]);
  });

  /**
   * The suppression has to be surgical. Swallowing movement during a drag would be a far worse bug
   * than the one being fixed, since moving the pointer IS the drag.
   */
  it('still moves the pointer while a grab is held', () => {
    const { calls, perform } = build(true);

    perform({ type: 'movePointerBy', deltaX: 10, deltaY: 4 });
    perform({ type: 'movePointerTo', position: { clientX: 1, clientY: 2 } });
    perform({ type: 'dragBy', deltaX: 3, deltaY: 3 });

    expect(calls).toEqual(['moveBy', 'moveTo', 'dragBy']);
  });

  /** Releasing must never be swallowed, or a held grab would have no way out. */
  it('still ends and cancels a drag while a grab is held', () => {
    const { calls, perform } = build(true);

    perform({ type: 'endDrag' });
    perform({ type: 'cancelDrag' });

    expect(calls).toEqual(['endDrag', 'cancelDrag']);
  });

  /**
   * The rest of the controller, because it had no test file at all and that is how the click bug
   * survived. Every action it can carry out is exercised, including the branches that only run when
   * the canvas refuses, which are the ones that would otherwise fail silently.
   */
  it('carries out beginDrag as well as the releases', () => {
    const { calls, perform } = build(false);

    perform({ type: 'beginDrag' });

    expect(calls).toEqual(['beginDrag']);
  });

  it('pans and zooms the canvas, and says so when the canvas refuses', () => {
    const debug = vi.fn();
    const controller = new GestureController({
      pointer: { isDragging: () => false } as unknown as VirtualPointer,
      canvas: { panBy: () => false, zoomBy: () => false } as unknown as CanvasController,
      logger: { debug } as never,
    });
    const perform = (action: GestureAction): void => {
      (controller as unknown as { perform: (a: GestureAction) => void }).perform(action);
    };

    perform({ type: 'panCanvasBy', deltaX: 5, deltaY: 5 });
    perform({ type: 'zoomCanvas', ratio: 1.5, centerX: 0, centerY: 0 });

    // Both refusals are reported. A pan that silently does nothing is the ADR 0007 bug's shape.
    expect(debug).toHaveBeenCalledTimes(2);
  });

  it('stays quiet when the canvas accepts the pan and the zoom', () => {
    const debug = vi.fn();
    const controller = new GestureController({
      pointer: { isDragging: () => false } as unknown as VirtualPointer,
      canvas: { panBy: () => true, zoomBy: () => true } as unknown as CanvasController,
      logger: { debug } as never,
    });
    const perform = (action: GestureAction): void => {
      (controller as unknown as { perform: (a: GestureAction) => void }).perform(action);
    };

    perform({ type: 'panCanvasBy', deltaX: 5, deltaY: 5 });
    perform({ type: 'zoomCanvas', ratio: 1.5, centerX: 0, centerY: 0 });

    expect(debug).not.toHaveBeenCalled();
  });

  /** Haptics are optional at every level, so an absent vibrate must not throw. */
  it('vibrates when it can and does not throw when it cannot', () => {
    const vibrate = vi.fn();
    const base = {
      pointer: { isDragging: () => false } as unknown as VirtualPointer,
      canvas: {} as unknown as CanvasController,
    };
    const fire = (controller: GestureController): void => {
      (controller as unknown as { perform: (a: GestureAction) => void }).perform({
        type: 'haptic',
        durationMs: 10,
      });
    };

    fire(new GestureController({ ...base, vibrate }));
    expect(vibrate).toHaveBeenCalledWith(10);

    expect(() => {
      fire(new GestureController(base));
    }).not.toThrow();
  });
});
