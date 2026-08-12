/**
 * Building touch events jsdom will accept. Extracted from gestureLayer.test 2026-08-12.
 *
 * ⚠️ A plain `Event` with `touches` defined ON it, not a `TouchEvent`. jsdom does not implement
 * `TouchEvent` or `TouchList` at all, so constructing one throws, and the binder only ever reads
 * `touches`, which is the part that can be supplied.
 */
/**
 * jsdom does not construct real TouchEvents with a populated TouchList, so touches are supplied as
 * a plain array shaped like one. The binder only ever reads length and item, which is exactly the
 * surface being stood in for.
 */
export function touchList(
  points: { identifier: number; clientX: number; clientY: number }[]
): TouchList {
  return {
    length: points.length,
    item: (index: number) => points[index] ?? null,
  } as unknown as TouchList;
}

export function makeTouchEvent(
  type: string,
  points: { identifier: number; clientX: number; clientY: number }[]
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: touchList(points) });
  return event;
}
