/**
 * Stopping Foundry from reading a deliberately held drag as a long press. Added 2026-08-12.
 *
 * ⚠️ This is the bug that survived five rounds of diagnosis, and the report that finally named it
 * said only one new thing: `manager.cancel at GRABBED via ControlsLayer._onLongPress`.
 *
 * From Foundry 14.365, `MouseInteractionManager`:
 *
 *     static LONG_PRESS_DURATION_MS = 500;
 *     // in #handleLeftDown:
 *     clearTimeout(this.constructor.longPressTimeout);
 *     this.constructor.longPressTimeout = setTimeout(() => { ... }, LONG_PRESS_DURATION_MS);
 *
 * and from `ControlsLayer`:
 *
 *     _onLongPress(event, origin) {
 *       ...
 *       event.interactionData.cancelled = true;
 *       canvas.currentMouseManager.cancel(event);    // Cancel drag workflow
 *       return canvas.ping(origin);
 *     }
 *
 * The timer is armed by every pointerdown and cleared only when a drag actually STARTS, which needs
 * the pointer 10px from where it went down. That is a sound inference for a finger: a finger held
 * still on the map for half a second means a ping.
 *
 * It is the wrong inference for this module, and the difference is exactly what the user found by
 * experiment. Dragging with the touch gesture works because the finger is already moving, so the
 * 10px gate trips within the 500ms and Foundry clears its own timer. Dragging with the grab button
 * does not: you tap the button, lift your finger, reposition it, and only then start to move, which
 * is comfortably longer than half a second. Foundry pings the canvas and cancels a drag the user is
 * in the middle of.
 *
 * ⚠️ `VirtualPointer.onDragBegun` is REQUIRED rather than optional, and calls this AFTER the opening
 * pointerdown. Both matter. A drag that silently skips the disarm is cancelled half a second later
 * with nothing in any log to say why, which is the failure this ends; and disarming BEFORE the
 * pointerdown clears a timer Foundry immediately replaces, which is a fix that runs on every drag,
 * reports success, and changes nothing.
 *
 * ⚠️ Disarming rather than preventing. The ping is a feature and this must not break it: the timer is
 * re-armed by the next pointerdown, so a genuine long press with no drag held still pings.
 */
export interface LongPressGuardOptions {
  /**
   * Foundry's MouseInteractionManager CLASS, or undefined before the canvas exists.
   *
   * ⚠️ The class, not an instance. `longPressTimeout` is a static and there is exactly one of them
   * for the whole application; clearing it on an instance would write a shadowing own property and
   * leave the real timer running, which is a fix that changes nothing and reports success.
   */
  readonly getManagerClass: () => { longPressTimeout?: unknown } | undefined;
  readonly clearTimeout: (handle: number) => void;
}

export class LongPressGuard {
  public constructor(private readonly options: LongPressGuardOptions) {}

  /**
   * Cancel a pending long press, and say whether there was one.
   *
   * Returns false when the canvas is not up, or when no timer was pending. Both are ordinary rather
   * than errors, and the caller wants to be able to tell them from a disarm that did something.
   */
  public disarm(): boolean {
    const managerClass = this.options.getManagerClass();
    if (managerClass === undefined) {
      return false;
    }
    const pending = managerClass.longPressTimeout;
    if (typeof pending !== 'number') {
      return false;
    }
    this.options.clearTimeout(pending);
    /*
     * Set to null as well, matching what Foundry's own clear sites leave behind. Clearing the handle
     * without clearing the field would leave a stale number that reads as "a press is pending".
     */
    managerClass.longPressTimeout = null;
    return true;
  }
}
