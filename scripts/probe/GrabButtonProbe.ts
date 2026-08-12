import type { Page } from 'playwright';

/**
 * Does tapping the module's OWN grab button send anything to Foundry's canvas? Added 2026-08-12.
 *
 * ⚠️ This exists because a device does something no desktop harness had ever done: it reaches the
 * grab button with a FINGER. Every drag check here calls `api.getPointer().beginDrag()` straight
 * from JavaScript, which produces no DOM events at all, and every one of them passes. The user
 * found the difference by experiment: "dragging works when I have the hand off, then I turn the
 * hand on and it breaks".
 *
 * The suspicion this measures: a tap on the bar also produces the browser's touch COMPATIBILITY
 * mouse events, `mousedown`, `mouseup` and `click`, emitted at the finger's coordinates a moment
 * after touchend. `SUPPRESSED_POINTER_EVENTS` covers `pointer*` only, and the bar is an excluded
 * region anyway, so nothing stops them. PIXI maps events onto the canvas BY COORDINATE rather than
 * by DOM target, and the bar sits over the canvas.
 *
 * If that is what happens, the drag we just started is cancelled by a `mouseup` we caused ourselves,
 * which is exactly the `[pointerup button=0 mouse]` the device reported.
 *
 * ⚠️ It records what ARRIVES rather than asserting a mechanism. A probe that asked "were the
 * compatibility events suppressed" would answer yes while PIXI received them by another route.
 */
export interface ArrivedEvent {
  readonly type: string;
  readonly pointerType: string;
  readonly target: string;
  readonly x: number;
  readonly y: number;
  /** Whether the browser produced it, as opposed to the module synthesising it. */
  readonly trusted: boolean;
}

export interface GrabButtonProbeResult {
  readonly buttonFound: boolean;
  readonly buttonBox: { x: number; y: number } | null;
  /** Everything that reached the WINDOW in the capture phase, which is where PIXI listens. */
  readonly arrived: readonly ArrivedEvent[];
  /** Whether the module considers a drag to be held after the tap. */
  readonly draggingAfter: boolean;
}

const WATCHED = [
  'pointerdown',
  'pointerup',
  'mousedown',
  'mouseup',
  'click',
  'touchstart',
  'touchend',
];

/** Start listening exactly where PIXI does: the window, capture phase. */
export async function watchWindowEvents(page: Page): Promise<void> {
  await page.evaluate((types: string[]) => {
    const arrived: unknown[] = [];
    (globalThis as unknown as { __tbArrived: unknown[] }).__tbArrived = arrived;
    for (const type of types) {
      globalThis.addEventListener(
        type,
        (event: Event) => {
          const detail = event as PointerEvent;
          const target = event.target as Element | null;
          arrived.push({
            type: event.type,
            pointerType: detail.pointerType ?? 'n/a',
            target:
              target === null
                ? 'none'
                : `${target.tagName.toLowerCase()}${target.className ? `.${String(target.className)}` : ''}`,
            x: Number.isFinite(detail.clientX) ? detail.clientX : -1,
            y: Number.isFinite(detail.clientY) ? detail.clientY : -1,
            trusted: event.isTrusted,
          });
        },
        true
      );
    }
  }, WATCHED);
}

/** Where the grab button is, in client coordinates, or null when the bar is not showing one. */
export async function grabButtonCentre(
  page: Page
): Promise<{ x: number; y: number; label: string } | null> {
  return page.evaluate(() => {
    const button = document.querySelector('[data-action="grab"]');
    if (button === null) {
      return null;
    }
    const box = button.getBoundingClientRect();
    return {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
      label: button.textContent ?? '',
    };
  });
}

export async function readArrived(page: Page): Promise<ArrivedEvent[]> {
  return page.evaluate(
    () => (globalThis as unknown as { __tbArrived: ArrivedEvent[] }).__tbArrived ?? []
  );
}

/**
 * ⚠️ `length = 0`, NEVER a fresh array. Reassigning `__tbArrived = []` leaves every listener pushing
 * into the array it closed over, so the probe records faithfully into an object nobody reads and
 * then reports that nothing arrived. The first run of this probe did exactly that and printed a
 * confident PASS off zero observations.
 */
export async function clearArrived(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as unknown as { __tbArrived: unknown[] }).__tbArrived.length = 0;
  });
}
