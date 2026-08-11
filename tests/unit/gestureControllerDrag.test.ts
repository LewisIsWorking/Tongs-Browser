import { describe, expect, it, vi } from 'vitest';

import { GestureController } from '../../src/gesture/GestureController.js';
import type { CanvasController } from '../../src/gesture/CanvasController.js';
import type { GestureAction } from '../../src/gesture/GestureTypes.js';
import type { VirtualPointer } from '../../src/pointer/VirtualPointer.js';

/**
 * A click while a grab is held destroys the drag, and nothing in this repo could see it.
 *
 * `GestureController` had no test file at all, which is the second time on this project that the
 * class carrying out the actions went untested while the pure thing deciding them was covered
 * thoroughly. `CanvasController` was the first, and it was hiding a bug of exactly this shape.
 *
 * Measured on a OnePlus 13, Chrome 150, Foundry 14.365: 197 drag moves dispatched during one grab,
 * and Foundry's drag origin readable for only 6 of them, drifting 8.7px while the pointer travelled
 * 140.3px. The dispatch trace showed a complete pointerdown, mousedown, pointerup, mouseup, click
 * inside the held grab, which is a finger being lifted and read as a tap.
 *
 * Every click sequence opens with a pointerdown, and Foundry treats a pointerdown on a placeable as
 * the start of an interaction: it records a new `screenOrigin` under the pointer. Its drag begins
 * only once the pointer is 10px from that origin, so an origin that keeps being re-recorded under
 * the pointer can never be far enough away. The drag stalls at GRABBED and the token never moves.
 */
describe('GestureController while a grab is held', () => {
  function build(dragging: boolean) {
    const calls: string[] = [];
    const pointer = {
      isDragging: () => dragging,
      leftClick: () => calls.push('leftClick'),
      rightClick: () => calls.push('rightClick'),
      doubleClick: () => calls.push('doubleClick'),
      moveBy: () => calls.push('moveBy'),
      moveTo: () => calls.push('moveTo'),
      beginDrag: () => calls.push('beginDrag'),
      dragBy: () => calls.push('dragBy'),
      endDrag: () => calls.push('endDrag'),
      cancelDrag: () => calls.push('cancelDrag'),
    } as unknown as VirtualPointer;

    const canvas = {
      panBy: () => true,
      zoomBy: () => true,
    } as unknown as CanvasController;

    const controller = new GestureController({ pointer, canvas });
    // perform is private because nothing outside should choose the actions. Reaching it directly
    // keeps this test about the guard rather than about reproducing a five step touch sequence,
    // which the state machine's own tests already cover.
    const perform = (action: GestureAction): void => {
      (controller as unknown as { perform: (a: GestureAction) => void }).perform(action);
    };

    return { calls, perform };
  }

  const CLICKS: GestureAction[] = [
    { type: 'leftClick' },
    { type: 'rightClick' },
    { type: 'doubleClick' },
  ];

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

  /**
   * The timer feeds itself back in as an input, which is how a long press becomes a right click.
   * Starting a second must clear the first, or a stale timer fires into a finished gesture.
   */
  it('replaces a pending timer rather than stacking them, and cancels on reset', () => {
    const cleared: number[] = [];
    let fire: (() => void) | null = null;
    let handle = 0;

    const controller = new GestureController({
      pointer: {
        isDragging: () => false,
        cancelDrag: () => undefined,
      } as unknown as VirtualPointer,
      canvas: {} as unknown as CanvasController,
      setTimer: (callback) => {
        fire = callback;
        handle += 1;
        return handle;
      },
      clearTimer: (h) => {
        cleared.push(h);
      },
      now: () => 1000,
    });
    const perform = (action: GestureAction): void => {
      (controller as unknown as { perform: (a: GestureAction) => void }).perform(action);
    };

    perform({ type: 'startTimer', durationMs: 500 });
    perform({ type: 'startTimer', durationMs: 500 });
    expect(cleared).toEqual([1]);

    // Firing nulls the handle, so a following cancel has nothing to clear and must not clear twice.
    (fire as unknown as () => void)();
    perform({ type: 'cancelTimer' });
    expect(cleared).toEqual([1]);

    perform({ type: 'startTimer', durationMs: 500 });
    controller.reset();
    expect(cleared).toEqual([1, 3]);
  });

  /** reset must release a held grab, or the module can be switched off with a button still down. */
  it('cancels a held drag on reset, and leaves an idle pointer alone', () => {
    const heldCalls: string[] = [];
    const idleCalls: string[] = [];

    new GestureController({
      pointer: {
        isDragging: () => true,
        cancelDrag: () => heldCalls.push('cancelDrag'),
      } as unknown as VirtualPointer,
      canvas: {} as unknown as CanvasController,
    }).reset();

    new GestureController({
      pointer: {
        isDragging: () => false,
        cancelDrag: () => idleCalls.push('cancelDrag'),
      } as unknown as VirtualPointer,
      canvas: {} as unknown as CanvasController,
    }).reset();

    expect(heldCalls).toEqual(['cancelDrag']);
    expect(idleCalls).toEqual([]);
  });

  /**
   * The REAL timers, not the injected ones.
   *
   * Every other test here injects `setTimer`/`clearTimer`, which is the right default and also means
   * the production path, the one that actually runs on a phone, was never executed once. A defaulted
   * dependency is still a dependency, and "it works with the fake" is not evidence about the real
   * `setTimeout` call, including whether the handle it returns is the one `clearTimeout` wants back.
   */
  it('uses real timers when none are injected, and cancels them', () => {
    vi.useFakeTimers();
    try {
      const calls: string[] = [];
      const machine = {
        handle: () => ({ actions: [] }),
        reset: () => undefined,
        updateConfig: () => undefined,
      };
      const controller = new GestureController({
        pointer: {
          isDragging: () => false,
          rightClick: () => calls.push('rightClick'),
        } as unknown as VirtualPointer,
        canvas: {} as unknown as CanvasController,
        machine: machine as never,
      });
      const perform = (action: GestureAction): void => {
        (controller as unknown as { perform: (a: GestureAction) => void }).perform(action);
      };

      perform({ type: 'startTimer', durationMs: 500 });
      expect(vi.getTimerCount()).toBe(1);

      perform({ type: 'cancelTimer' });
      expect(vi.getTimerCount()).toBe(0);

      // And one that is allowed to fire, so the callback path runs against a real handle too.
      perform({ type: 'startTimer', durationMs: 500 });
      vi.advanceTimersByTime(500);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('exposes its machine and accepts config updates', () => {
    const controller = new GestureController({
      pointer: { isDragging: () => false } as unknown as VirtualPointer,
      canvas: {} as unknown as CanvasController,
      config: { longPressMs: 400 },
    });

    expect(controller.getMachine()).toBeDefined();
    expect(() => {
      controller.updateConfig({ longPressMs: 700 });
    }).not.toThrow();
  });

  /** handleInput is the real entry point, and it must run every action the machine returns. */
  it('performs every action the machine returns for one input', () => {
    const calls: string[] = [];
    const machine = {
      handle: () => ({ actions: [{ type: 'beginDrag' }, { type: 'endDrag' }] }),
      reset: () => undefined,
      updateConfig: () => undefined,
    };

    new GestureController({
      pointer: {
        isDragging: () => false,
        beginDrag: () => calls.push('beginDrag'),
        endDrag: () => calls.push('endDrag'),
      } as unknown as VirtualPointer,
      canvas: {} as unknown as CanvasController,
      machine: machine as never,
    }).handleInput({ type: 'touchend', at: 1, touches: [] } as never);

    expect(calls).toEqual(['beginDrag', 'endDrag']);
  });

  it('says why it ignored the click, rather than dropping it silently', () => {
    const debug = vi.fn();
    const pointer = {
      isDragging: () => true,
      leftClick: () => undefined,
    } as unknown as VirtualPointer;
    const controller = new GestureController({
      pointer,
      canvas: {} as unknown as CanvasController,
      logger: { debug } as never,
    });

    (controller as unknown as { perform: (a: GestureAction) => void }).perform({
      type: 'leftClick',
    });

    expect(debug).toHaveBeenCalledOnce();
    expect(String(debug.mock.calls[0]?.[0])).toContain('grab');
  });
});
