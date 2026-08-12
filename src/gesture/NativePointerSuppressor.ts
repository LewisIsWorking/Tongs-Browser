import { VIRTUAL_POINTER_ID } from '../constants.js';

/**
 * Keeping the browser's own touch derived pointer events away from PIXI. Added 2026-08-12.
 *
 * ⚠️ This is separate from `TouchBinder`, and every difference between them is load bearing. It was
 * written after a device report showed roughly two hundred `_onDragLeftCancel` calls, each triggered
 * by an event with `pointerType: 'touch'`, while `TouchBinder` was already suppressing exactly those.
 *
 * PIXI's own registration, read out of `@pixi/events/lib/EventSystem.mjs` in Foundry 14.365:
 *
 *     globalThis.document.addEventListener('pointermove', this.onPointerMove, true)
 *     this.domElement.addEventListener('pointerdown', this.onPointerDown, true)
 *     this.domElement.addEventListener('pointerover', this.onPointerOverOut, true)
 *     this.domElement.addEventListener('pointerleave', this.onPointerOverOut, true)
 *     globalThis.addEventListener('pointerup', this.onPointerUp, true)
 *
 * Three things follow, and missing any one of them makes the suppression useless:
 *
 * 1. **`pointerup` is on the WINDOW.** In the capture phase the window fires BEFORE the document, so
 *    a document listener cannot stop it however early it is registered. This binds to the window.
 * 2. **Two listeners on the SAME node fire in registration order**, and `stopPropagation` does not
 *    stop them. Being on the window is not enough on its own: this must also be registered before
 *    PIXI, and it must use `stopImmediatePropagation`.
 * 3. **`pointerover` and `pointerout` were never suppressed at all.** Foundry's
 *    `MouseInteractionManager` binds both, and the same device report opens with
 *    `manager.cancel at GRABBED [pointerover ... touch]`.
 *
 * Why it matters: `#handlePointerUp` ends with `this.#handleDragCancel(event)`. ANY pointerup that
 * reaches the manager cancels the drag, and `_onDragLeftCancel` writes nothing, so the token returns
 * to where it started while every other measurement looks healthy.
 */

/**
 * Every pointer event PIXI listens for, so none of them reaches it from a real finger.
 *
 * ⚠️ `pointerout` is included although PIXI itself binds `pointerleave`: Foundry's manager binds
 * `pointerout` on its own objects, and PIXI delivers a federated `pointerout` derived from the same
 * native stream. Suppressing one and not the other leaves half the door open.
 */
export const SUPPRESSED_POINTER_EVENTS = [
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'pointerover',
  'pointerout',
  'pointerenter',
  'pointerleave',
] as const;

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
}
