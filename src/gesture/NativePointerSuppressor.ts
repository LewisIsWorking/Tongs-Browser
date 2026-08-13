import { VIRTUAL_POINTER_ID } from '../constants.js';
import { OWN_UI_SUPPRESSED_MOUSE_EVENTS, SUPPRESSED_POINTER_EVENTS } from './SuppressedEvents.js';

/**
 * Keeping the browser's own touch derived pointer events away from PIXI. Added 2026-08-12.
 *
 * ⚠️ This is separate from `TouchBinder`, and every difference between them is load bearing. It was
 * written after a device report showed roughly two hundred `_onDragLeftCancel` calls, each triggered
 * by an event with `pointerType: 'touch'`, while `TouchBinder` was already suppressing exactly those.
 *
 * WHICH events are suppressed, and the reading of PIXI's own listener registration that decides both
 * the list and the binding target, live in gesture/SuppressedEvents.ts.
 */

/** Re-exported so callers and tests keep one import for the suppressor and its event lists. */
export { OWN_UI_SUPPRESSED_MOUSE_EVENTS, SUPPRESSED_POINTER_EVENTS };

export interface NativePointerSuppressorOptions {
  /**
   * ⚠️ The WINDOW, not the document. See the note above: PIXI binds `pointerup` here, and in the
   * capture phase the window runs first.
   */
  readonly window: Window;
  /** Whether suppression is wanted at all, read live so the setting takes effect without a reload. */
  readonly enabled: () => boolean;
  /** Regions that keep their native behaviour, such as the chat log. */
  readonly isExcluded: (target: EventTarget | null) => boolean;
  /**
   * The module's own interface, whose events must never reach the canvas.
   *
   * ⚠️ REQUIRED, and it was optional for exactly one edit. An optional predicate here fails silently
   * in the worst possible way: `isOwnInterface?.(t) !== true` is true when the option is absent, so
   * every event is treated as somebody else's and nothing is suppressed. The module builds, the
   * tests pass, and the leak this whole class exists to close stays open. Making it required moves
   * that from a runtime nothing to a compile error.
   */
  readonly isOwnInterface: (target: EventTarget | null) => boolean;
  /**
   * Controls inside our own interface that must still receive the browser's real pointer events.
   *
   * ⚠️ REQUIRED, for the same reason `isOwnInterface` is: an optional predicate defaulting to "no"
   * fails silently, and the failure here is a control nobody can use. Making it required means a
   * caller that forgets it does not compile.
   */
  readonly needsNativePointerEvents: (target: EventTarget | null) => boolean;
}

export class NativePointerSuppressor {
  private readonly abortController = new AbortController();
  private bound = false;

  public constructor(private readonly options: NativePointerSuppressorOptions) {}

  /**
   * ⚠️ Bind as EARLY as possible, before Foundry creates the canvas.
   *
   * Registration order decides which of two capture listeners on the window runs first, and PIXI
   * registers when the canvas is built. Binding on `ready`, as the gesture layer does, is already too
   * late: PIXI is there first and sees every pointerup before this does.
   */
  public bind(): void {
    if (this.bound) {
      return;
    }
    this.bound = true;
    for (const type of SUPPRESSED_POINTER_EVENTS) {
      this.options.window.addEventListener(type, this.onPointerEvent, {
        capture: true,
        signal: this.abortController.signal,
      });
    }
    for (const type of OWN_UI_SUPPRESSED_MOUSE_EVENTS) {
      this.options.window.addEventListener(type, this.onOwnUiMouseEvent, {
        capture: true,
        signal: this.abortController.signal,
      });
    }
  }

  public unbind(): void {
    if (!this.bound) {
      return;
    }
    this.abortController.abort();
    this.bound = false;
  }

  private readonly onPointerEvent = (event: Event): void => {
    if (!this.options.enabled()) {
      return;
    }
    const pointerEvent = event as PointerEvent;

    /*
     * Ours passes straight through. The virtual pointer dispatches with `pointerType: 'mouse'` and a
     * reserved id, so the two tests together are belt and braces: either alone would be enough today,
     * and neither costs anything.
     */
    if (pointerEvent.pointerType !== 'touch' || pointerEvent.pointerId === VIRTUAL_POINTER_ID) {
      return;
    }
    /*
     * ⚠️ FIRST of the three, because the stop below happens on the WINDOW in the capture phase and is
     * therefore upstream of every listener in the document. "PIXI must not see this" was implemented
     * as "nothing may see this", and it took the bar's own drag handle with it: the handle binds
     * pointerdown, pointermove, pointerup and pointercancel on itself, and capture never reached any
     * of them. Reported from a device 2026-08-13, "I can't move the tongs toolbox now."
     *
     * Deliberately narrow. Only the drag handle is marked, so a tap on a tray button still falls
     * through to the stop below, which is what keeps a held token drag alive when DROP is tapped.
     */
    if (this.options.needsNativePointerEvents(event.target)) {
      return;
    }
    /*
     * ⚠️ OUR OWN interface beats the exclusion. The two rules genuinely disagree here and the order
     * is the whole fix: the bar is an excluded region, because the gesture layer must keep away from
     * it, and it is also ours, so its events must never reach the canvas. Deciding this inside the
     * class rather than by composing predicates at the call site is deliberate: the first version put
     * the rule in main.ts, one edit silently failed to apply, and the leak stayed open with everything
     * still building and passing.
     */
    if (this.options.isOwnInterface(event.target)) {
      event.stopImmediatePropagation();
      return;
    }
    if (this.options.isExcluded(event.target)) {
      return;
    }

    /*
     * ⚠️ IMMEDIATE, not plain propagation. PIXI's listener is on this same node, and
     * `stopPropagation` only stops listeners on OTHER nodes: it would leave PIXI's untouched, which
     * is the entire failure this class exists to fix.
     */
    event.stopImmediatePropagation();
  };

  /**
   * A touch derived mouse event over our own bar, stopped before PIXI can map it onto the canvas.
   *
   * ⚠️ TRUSTED only. The module dispatches its own mouse events as part of driving the virtual
   * pointer, and swallowing those would stop the pointer working entirely.
   */
  private readonly onOwnUiMouseEvent = (event: Event): void => {
    if (!this.options.enabled()) {
      return;
    }
    /*
     * ⚠️ The TARGET decides, not `isTrusted`, and the first version used `isTrusted` instead. It is
     * the more obvious test and it cannot be exercised: jsdom cannot produce a trusted event, so
     * every test of it passed for the one reason that proves nothing. The target is the better rule
     * anyway. The module dispatches its own mouse events at the pointer, which is over the canvas,
     * never over its own bar.
     */
    if (!this.options.isOwnInterface(event.target)) {
      return;
    }
    event.stopImmediatePropagation();
  };
}
