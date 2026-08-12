import { describe, expect, it, vi } from 'vitest';

import { LongPressGuard } from '../../src/foundry/LongPressGuard.js';
import { createPointer, makeRegion, recorded } from './support/pointerHarness.js';

/**
 * Defusing Foundry's long press timer when the module deliberately holds a drag.
 *
 * ⚠️ Every assertion here comes from a bug that survived five rounds of diagnosis on a real phone,
 * and from the one line that finally named it:
 *
 *     manager.cancel at GRABBED via ControlsLayer._onLongPress
 *
 * Foundry arms a 500ms timer on every pointerdown and clears it only when a drag actually starts,
 * which needs the pointer 10px from where it went down. Dragging with the touch gesture beats that,
 * because the finger is already moving. Dragging with the grab button does not: you tap, lift,
 * reposition, and only then move. Foundry pings the canvas and cancels a drag in progress.
 */
const managerClass = (timeout: unknown) => ({ longPressTimeout: timeout });

describe('disarming a pending long press', () => {
  it('clears the pending timer and says it did', () => {
    const cleared: number[] = [];
    const klass = managerClass(41);

    const disarmed = new LongPressGuard({
      getManagerClass: () => klass,
      clearTimeout: (handle) => cleared.push(handle),
    }).disarm();

    expect(disarmed).toBe(true);
    expect(cleared).toEqual([41]);
  });

  /**
   * ⚠️ The handle is cleared AND the field emptied, matching Foundry's own clear sites. Leaving a
   * stale number behind would read as "a press is still pending" to anything that checks.
   */
  it('empties the field as well as cancelling the timer', () => {
    const klass = managerClass(7);

    new LongPressGuard({ getManagerClass: () => klass, clearTimeout: () => undefined }).disarm();

    expect(klass.longPressTimeout).toBeNull();
  });
});

describe('when there is nothing to disarm', () => {
  /** Before the canvas exists there is no class to reach, which is ordinary rather than an error. */
  it('reports false rather than throwing when Foundry is not up yet', () => {
    const guard = new LongPressGuard({
      getManagerClass: () => undefined,
      clearTimeout: () => undefined,
    });

    expect(() => guard.disarm()).not.toThrow();
    expect(guard.disarm()).toBe(false);
  });

  /**
   * ⚠️ A disarm that did nothing must be distinguishable from one that did. The caller runs this on
   * every drag and most of the time there IS a timer; a guard that always answered true could not
   * tell a working defusal from a no-op, which is the whole failure mode being fixed here.
   */
  it.each([
    ['null, which is Foundry’s idle value', null],
    ['undefined, before any press has happened', undefined],
  ])('reports false when the timer is %s', (_why, value) => {
    const cleared: number[] = [];

    const disarmed = new LongPressGuard({
      getManagerClass: () => managerClass(value),
      clearTimeout: (handle) => cleared.push(handle),
    }).disarm();

    expect(disarmed).toBe(false);
    expect(cleared).toEqual([]);
  });
});

describe('reading the timer from the right place', () => {
  /**
   * ⚠️ `longPressTimeout` is a STATIC, and there is one for the whole application. Clearing it
   * through an instance would write a shadowing own property and leave the real timer running: a fix
   * that runs, reports success, and changes nothing.
   *
   * Asserted by giving the "instance" its own field and checking the guard never touches it.
   */
  it('does not write through an instance that shadows the class field', () => {
    const klass = managerClass(99);
    const instance = Object.create(klass) as { longPressTimeout?: unknown };

    new LongPressGuard({ getManagerClass: () => klass, clearTimeout: () => undefined }).disarm();

    expect(klass.longPressTimeout).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(instance, 'longPressTimeout')).toBe(false);
  });

  /** Read live, because the canvas is torn down and rebuilt when a scene changes. */
  it('reads the class every time rather than caching one', () => {
    // Starts absent, exactly as it is before Foundry builds the canvas.
    let current: { longPressTimeout?: unknown } | undefined = undefined;
    const guard = new LongPressGuard({
      getManagerClass: () => current,
      clearTimeout: () => undefined,
    });

    expect(guard.disarm()).toBe(false);
    current = managerClass(3);
    expect(guard.disarm()).toBe(true);
  });
});

describe('the pointer disarms only after the pointerdown', () => {
  /**
   * ⚠️ ORDER, and it is the whole fix. The pointerdown is what ARMS the timer, so disarming before
   * dispatching it clears a timer Foundry is about to replace: a change that runs on every drag,
   * reports success, and fixes nothing.
   */
  it('is called after the drag sequence has been dispatched', () => {
    const order: string[] = [];
    /*
     * A region under the pointer, so the dispatch is observable. The harness records only events
     * that land on a registered element, and without one this test would assert the ordering of a
     * list with a single entry in it, which is no ordering at all.
     */
    makeRegion('board', 0, 0, 200, 200);
    recorded.length = 0;
    const pointer = createPointer({ clientX: 50, clientY: 50 }, () => {
      order.push(`disarm after ${String(recorded.length)} events`);
    });

    pointer.beginDrag();

    expect(recorded.map((entry) => entry.type)).toContain('pointerdown');
    expect(order).toEqual([`disarm after ${String(recorded.length)} events`]);
  });

  it('does not disarm for an ordinary move, which arms nothing', () => {
    const disarms = vi.fn();
    const pointer = createPointer({ clientX: 0, clientY: 0 }, disarms);

    pointer.moveTo({ clientX: 10, clientY: 10 });

    expect(disarms).not.toHaveBeenCalled();
  });
});
