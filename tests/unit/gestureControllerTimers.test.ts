import { describe, expect, it, vi } from 'vitest';

import { GestureController } from '../../src/gesture/GestureController.js';
import type { CanvasController } from '../../src/gesture/CanvasController.js';
import type { GestureAction } from '../../src/gesture/GestureTypes.js';
import type { VirtualPointer } from '../../src/pointer/VirtualPointer.js';

/**
 * The long press timer, which feeds itself back in as an input. Extracted from
 * gestureControllerDrag 2026-08-12.
 *
 * ⚠️ Kept together because every test here is about a timer OUTLIVING the gesture that started it.
 * A stale timer firing into a finished gesture is the failure, and it is invisible to any test that
 * only looks at one gesture in isolation.
 */
describe('GestureController timers', () => {
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
});
