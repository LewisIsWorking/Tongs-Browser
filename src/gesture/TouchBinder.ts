import { actionableTouches } from './ActionableTouches.js';
import type { ExclusionZones } from './ExclusionZones.js';
import type { GestureInput } from './GestureTypes.js';
import {
  TOUCH_LISTENER_SPECS,
  toListenerOptions,
  type TouchHandlerName,
} from './TouchListenerSpecs.js';

export interface TouchBinderOptions {
  readonly target: Document;
  readonly exclusions: ExclusionZones;
  readonly onInput: (input: GestureInput) => void;
  /** Reject real touch derived pointer events so Foundry never sees both them and ours. */
  readonly suppressNativeTouch: () => boolean;
  readonly now: () => number;
}

/**
 * Bridges real touch events into the gesture state machine.
 *
 * Listeners are registered with passive false so preventDefault actually works. Without it the
 * browser scrolls the page, fires its own synthetic mouse events roughly 300ms later, and shows
 * text selection handles, all on top of whatever this module is doing.
 *
 * The suppression half is separately toggleable because it is the single most likely thing to
 * conflict with another module. TouchVTT in particular binds the same events, and a user may
 * reasonably want both installed with only one of them acting.
 */
export class TouchBinder {
  private bound = false;
  private readonly abortController = new AbortController();

  public constructor(private readonly options: TouchBinderOptions) {}

  public bind(): void {
    if (this.bound) {
      return;
    }
    this.bound = true;

    const { signal } = this.abortController;
    const handlers: Record<TouchHandlerName, EventListener> = {
      onTouchStart: this.onTouchStart,
      onTouchMove: this.onTouchMove,
      onTouchEnd: this.onTouchEnd,
      onTouchCancel: this.onTouchCancel,
      onNativeContextMenu: this.onNativeContextMenu,
    };

    /*
     * The table lives in TouchListenerSpecs, where the terms can be ASSERTED. Every entry there
     * encodes a bug that took a physical device to find, and each is one option flag away from
     * silently not working: a bubble phase listener still fires and a passive one still runs, and
     * both look completely normal in a debugger while what they exist to prevent goes right past.
     */
    for (const spec of TOUCH_LISTENER_SPECS) {
      this.options.target.addEventListener(
        spec.type,
        handlers[spec.handler],
        toListenerOptions(spec, signal)
      );
    }
  }

  public unbind(): void {
    if (!this.bound) {
      return;
    }
    this.abortController.abort();
    this.bound = false;
  }

  public isBound(): boolean {
    return this.bound;
  }

  /**
   * Swallow the browser's own contextmenu, which Foundry treats as "cancel the drag".
   *
   * Only the TRUSTED one. This module synthesises a `contextmenu` for its long press gesture, and
   * that one is deliberate and must reach Foundry; the browser's, produced by a finger dwelling
   * during a drag, must not. `isTrusted` is exactly that distinction and needs no bookkeeping.
   *
   * `preventDefault` as well as `stopPropagation`, so the platform's own menu does not appear either.
   * An excluded region keeps its normal behaviour, so a long press in chat still offers copy.
   */
  private readonly onNativeContextMenu = (event: Event): void => {
    if (!this.options.suppressNativeTouch() || !event.isTrusted) {
      return;
    }
    if (this.options.exclusions.isExcluded(event.target)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  /**
   * The part every touch handler shares: ignore excluded regions, stop the browser and PIXI from
   * also acting, and report.
   *
   * ⚠️ Returns whether the event was ours to act on, so `touchcancel` can share all of this and
   * still differ in the one way it genuinely differs. Three byte-identical handlers previously sat
   * beside a fourth that quietly omitted `preventDefault`, with nothing saying whether that was a
   * decision or an oversight. It is a decision, asserted in tests/dom/touchBinder.test.ts: a cancel
   * has no default left to prevent.
   */
  private claim(event: Event, prevent: boolean): boolean {
    if (this.options.exclusions.isExcluded(event.target)) {
      return false;
    }
    if (prevent) {
      event.preventDefault();
    }
    // Keep the raw touch away from PIXI, which would otherwise turn it into a second pointer.
    // See bind() for why preventDefault alone was not enough.
    if (this.options.suppressNativeTouch()) {
      event.stopPropagation();
    }
    return true;
  }

  /** touchstart, touchmove and touchend differ only in the name they report under. */
  private readonly report = (type: 'touchstart' | 'touchmove' | 'touchend') => {
    return (event: Event): void => {
      if (!this.claim(event, true)) {
        return;
      }
      this.options.onInput({
        type,
        touches: actionableTouches((event as TouchEvent).touches, this.options.exclusions),
        at: this.options.now(),
      });
    };
  };

  private readonly onTouchStart = this.report('touchstart');
  private readonly onTouchMove = this.report('touchmove');
  private readonly onTouchEnd = this.report('touchend');

  /** No `preventDefault`: a cancelled touch has no default action left to prevent. */
  private readonly onTouchCancel = (event: Event): void => {
    if (!this.claim(event, false)) {
      return;
    }
    this.options.onInput({ type: 'touchcancel', at: this.options.now() });
  };
}
