import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BarDragHandle } from '../../src/modifiers/BarDragHandle.js';
import type { BarPosition } from '../../src/modifiers/BarPosition.js';

/**
 * Dragging the bar around by its handle.
 *
 * The bar has to be movable because there is nowhere on a phone screen that is out of the way of
 * everything: whatever the default, some scene, sheet or dialog will sit under it.
 */
let handle: HTMLDivElement;
let position: BarPosition;
let setPosition: ReturnType<typeof vi.fn<(next: BarPosition) => void>>;

beforeEach(() => {
  document.body.innerHTML = '';
  handle = document.createElement('div');
  document.body.append(handle);
  position = { x: 100, y: 200 };
  setPosition = vi.fn<(next: BarPosition) => void>((next) => {
    position = next;
  });
});

const make = () =>
  new BarDragHandle({
    getPosition: () => position,
    setPosition: (next) => {
      setPosition(next);
    },
  });

const press = (drag: BarDragHandle, pointerId: number, clientX: number, clientY: number) => {
  const event = new PointerEvent('pointerdown', { pointerId, clientX, clientY, cancelable: true });
  Object.defineProperty(event, 'currentTarget', { value: handle });
  drag.onPointerDown(event);
  return event;
};

const move = (drag: BarDragHandle, pointerId: number, clientX: number, clientY: number) => {
  const event = new PointerEvent('pointermove', { pointerId, clientX, clientY, cancelable: true });
  Object.defineProperty(event, 'currentTarget', { value: handle });
  drag.onPointerMove(event);
  return event;
};

const lift = (drag: BarDragHandle, pointerId: number) => {
  const event = new PointerEvent('pointerup', { pointerId });
  Object.defineProperty(event, 'currentTarget', { value: handle });
  drag.onPointerUp(event);
  return event;
};

describe('BarDragHandle', () => {
  /**
   * ⚠️ Without the offset the bar's CORNER jumps to the finger on the first move, which reads as the
   * bar being snatched rather than dragged. Recorded once at the press and held for the gesture.
   */
  it('keeps the grab point under the finger rather than snapping the corner to it', () => {
    const drag = make();
    // Pressed 30 right and 10 down from the bar's origin.
    press(drag, 1, 130, 210);

    move(drag, 1, 180, 260);

    expect(setPosition).toHaveBeenCalledWith({ x: 150, y: 250 });
  });

  it('follows the finger for as long as it moves', () => {
    const drag = make();
    press(drag, 1, 100, 200);

    move(drag, 1, 150, 200);
    move(drag, 1, 150, 400);

    expect(setPosition).toHaveBeenLastCalledWith({ x: 150, y: 400 });
  });

  /**
   * ⚠️ Keyed to ONE pointer id, and every handler checks it. A second finger landing anywhere while
   * the bar is being dragged would otherwise deliver its moves here too and the bar would jump
   * between the two. On a phone that is not rare: it is what happens when somebody steadies the
   * device with their other hand.
   */
  it('ignores a second finger entirely', () => {
    const drag = make();
    press(drag, 1, 100, 200);

    move(drag, 2, 999, 999);

    expect(setPosition).not.toHaveBeenCalled();
  });

  it('ignores a lift from a finger that was not the one dragging', () => {
    const drag = make();
    press(drag, 1, 100, 200);

    lift(drag, 2);

    expect(drag.isDragging()).toBe(true);
  });

  it('stops following once the dragging finger lifts', () => {
    const drag = make();
    press(drag, 1, 100, 200);
    lift(drag, 1);

    move(drag, 1, 500, 500);

    expect(setPosition).not.toHaveBeenCalled();
    expect(drag.isDragging()).toBe(false);
  });

  it('ignores movement before anything was pressed', () => {
    move(make(), 1, 500, 500);

    expect(setPosition).not.toHaveBeenCalled();
  });

  describe('pointer capture', () => {
    /**
     * Capture, so the drag survives the finger leaving the small handle. Without it, moving faster
     * than the bar follows drops the drag immediately.
     */
    it('captures the pointer on press and releases it on lift', () => {
      const setPointerCapture = vi.fn();
      const releasePointerCapture = vi.fn();
      Object.assign(handle, { setPointerCapture, releasePointerCapture });
      const drag = make();

      press(drag, 7, 100, 200);
      expect(setPointerCapture).toHaveBeenCalledWith(7);

      lift(drag, 7);
      expect(releasePointerCapture).toHaveBeenCalledWith(7);
    });

    /**
     * ⚠️ Feature detected rather than trusted from the type. `lib.dom` declares pointer capture as
     * always present on Element, but jsdom does not implement it, so calling it blind throws in every
     * test that presses this handle. This test IS that case: no capture methods are attached.
     */
    it('does not throw where the browser has no pointer capture', () => {
      const drag = make();

      expect(() => {
        press(drag, 1, 100, 200);
        lift(drag, 1);
      }).not.toThrow();
    });
  });

  /**
   * `preventDefault` on both, or the browser scrolls the page while the bar is being dragged and the
   * bar and the page move together.
   */
  it('prevents the default on the press and on every move', () => {
    const drag = make();

    expect(press(drag, 1, 100, 200).defaultPrevented).toBe(true);
    expect(move(drag, 1, 120, 220).defaultPrevented).toBe(true);
  });

  it('does not prevent the default for a finger it is ignoring', () => {
    const drag = make();
    press(drag, 1, 100, 200);

    expect(move(drag, 2, 300, 300).defaultPrevented).toBe(false);
  });
});
