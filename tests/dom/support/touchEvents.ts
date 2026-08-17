/**
 * Building touch events jsdom will accept. Extracted from gestureLayer.test 2026-08-12.
 *
 * ⚠️ A plain `Event` with `touches` defined ON it, not a `TouchEvent`. jsdom does not implement
 * `TouchEvent` or `TouchList` at all, so constructing one throws, and the binder only ever reads
 * `touches`, which is the part that can be supplied.
 */

/**
 * A finger, optionally carrying the element it landed on.
 *
 * ⚠️ `target` added 2026-08-17, because its absence hid a bug. `TouchEvent.touches` holds every
 * finger on the SURFACE, not the fingers on the event's target, and each `Touch` carries its own
 * `target` - the element it started on. A helper that could not express a second finger somewhere
 * else could not express a second finger in an EXCLUDED place, which is the case the gesture layer
 * gets wrong. Optional, so every existing test reads the same.
 */
export interface TouchPointSpec {
  identifier: number;
  clientX: number;
  clientY: number;
  target?: EventTarget;
}

/**
 * jsdom does not construct real TouchEvents with a populated TouchList, so touches are supplied as
 * a plain array shaped like one. The binder only ever reads length and item, which is exactly the
 * surface being stood in for.
 */
export function touchList(points: TouchPointSpec[]): TouchList {
  return {
    length: points.length,
    item: (index: number) => points[index] ?? null,
  } as unknown as TouchList;
}

export function makeTouchEvent(type: string, points: TouchPointSpec[]): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: touchList(points) });
  return event;
}
