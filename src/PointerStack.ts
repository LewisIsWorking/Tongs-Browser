import { CursorOverlay } from './pointer/CursorOverlay.js';
import { EventDispatcher } from './pointer/EventDispatcher.js';
import { HitTester } from './pointer/HitTester.js';
import { VirtualPointer } from './pointer/VirtualPointer.js';
import type { EventDescriptor } from './pointer/EventDescriptor.js';

/**
 * Wiring the cursor, the hit tester, the dispatcher and the pointer together. Extracted from
 * TongsBrowser 2026-08-12.
 *
 * These four are one unit: none of them is useful alone, and the couple of decisions in how they are
 * joined are the sort that a build cannot check and that read as arbitrary until something breaks.
 */
export interface PointerStackOptions {
  readonly document: Document;
  /** Where the viewport size is read from. */
  readonly window: Window;
  /**
   * The window events are attributed to, as `UIEvent.view`.
   *
   * ⚠️ Separate from `window`, and omitted under test on purpose: vitest's jsdom window is not a
   * BRANDED Window, so `new PointerEvent({ view })` rejects it with "member view is not of type
   * Window". The viewport still has to be read from somewhere, hence two fields rather than one.
   */
  readonly eventView?: Window;
  readonly cursorSize?: number;
  /** Every dispatched event, for the debug overlay and the drag record. */
  readonly onDispatch: (
    descriptor: EventDescriptor & { position?: { clientX: number; clientY: number } },
    target: Element
  ) => void;
}

export interface PointerStack {
  readonly pointer: VirtualPointer;
  readonly cursor: CursorOverlay;
}

export function createPointerStack(options: PointerStackOptions): PointerStack {
  const doc = options.document;
  const win = options.window;

  const cursor = new CursorOverlay({
    document: doc,
    ...(options.cursorSize === undefined ? {} : { size: options.cursorSize }),
  });

  /*
   * ⚠️ No getTransform here, deliberately, even though the interface is scaled.
   *
   * Browser hit testing is transform aware: `elementFromPoint` takes viewport coordinates and
   * accounts for CSS transforms itself, so the cursor and the hit test already agree at any scale.
   * Verified against Chromium rather than assumed. Feeding the UI scale in here would convert
   * coordinates that are already correct and break a case that currently works.
   */
  const hitTester = new HitTester({
    /*
     * ⚠️ Bound to the document rather than passed as a reference. `elementFromPoint` throws if it
     * loses its receiver, and `elementFromPoint: doc.elementFromPoint` is exactly how that happens:
     * it looks like a shorter way to say the same thing and is a TypeError at the first hit test.
     */
    elementFromPoint: (x, y) => doc.elementFromPoint(x, y),
    getViewport: () => ({ width: win.innerWidth, height: win.innerHeight }),
  });

  const pointer = new VirtualPointer({
    hitTester,
    dispatcher: new EventDispatcher({
      ...(options.eventView === undefined ? {} : { view: options.eventView }),
      onDispatch: options.onDispatch,
    }),
    cursor,
    /*
     * Starts in the MIDDLE of the viewport. Anywhere else and the first thing a user does is drag it
     * out of a corner, and a pointer starting at (0, 0) is easy to mistake for one that has not
     * appeared at all.
     */
    initialPosition: { clientX: win.innerWidth / 2, clientY: win.innerHeight / 2 },
  });

  return { pointer, cursor };
}
