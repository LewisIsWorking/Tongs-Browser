/**
 * Swiping between cards in the roll deck. Added 2026-09-14.
 *
 * ⚠️ The panel's OWN listener, not the gesture layer. The panel is marked `data-tongs-browser="ignore"`,
 * so `TouchBinder` leaves every touch on it alone; that is what lets its buttons and native scrolling
 * work. A swipe therefore has to be read here, where the gesture layer has deliberately stepped back.
 *
 * ⚠️ PASSIVE, and never `preventDefault`. A card can be taller than the screen, and the browser must
 * keep scrolling it. A swipe is decided only when the finger lifts, from where it started and ended,
 * so it can never fight a scroll that is already under way.
 *
 * ⚠️ No time limit. A slow, deliberate drag sideways across a card is as clear an intent as a flick,
 * and on a busy phone a flick can be measured slow.
 */
export interface TouchSample {
  readonly x: number;
  readonly y: number;
}

/** How far sideways a finger must travel, in CSS pixels, before it counts. */
export const SWIPE_DISTANCE = 60;

/** How many times further sideways than up or down, so scrolling a card never turns it. */
export const SWIPE_RATIO = 2;

/** `1` for the next card (finger moved left), `-1` for the previous one, `null` for neither. */
export function readSwipe(start: TouchSample, end: TouchSample): -1 | 1 | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < SWIPE_RATIO * Math.abs(dy)) {
    return null;
  }
  return dx < 0 ? 1 : -1;
}

interface TouchLike {
  readonly clientX: number;
  readonly clientY: number;
}

interface TouchEventLike extends Event {
  readonly touches: ArrayLike<TouchLike>;
  readonly changedTouches: ArrayLike<TouchLike>;
}

/**
 * ⚠️ One finger only. A second finger landing cancels the swipe, because two fingers on a phone are a
 * pinch or a mistake, never "next card".
 */
export function bindSwipe(element: HTMLElement, onSwipe: (delta: -1 | 1) => void): void {
  let start: TouchSample | null = null;
  const options = { passive: true };

  element.addEventListener(
    'touchstart',
    (event) => {
      const touches = (event as TouchEventLike).touches;
      const only = touches.length === 1 ? touches[0] : undefined;
      start = only === undefined ? null : { x: only.clientX, y: only.clientY };
    },
    options
  );
  element.addEventListener(
    'touchend',
    (event) => {
      const touch = (event as TouchEventLike).changedTouches[0];
      const began = start;
      start = null;
      if (began === null || touch === undefined || (event as TouchEventLike).touches.length > 0) {
        return;
      }
      const delta = readSwipe(began, { x: touch.clientX, y: touch.clientY });
      if (delta !== null) {
        onSwipe(delta);
      }
    },
    options
  );
  element.addEventListener(
    'touchcancel',
    () => {
      start = null;
    },
    options
  );
}
