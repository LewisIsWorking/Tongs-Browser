import type { ExclusionZones } from './ExclusionZones.js';
import type { TouchPoint } from './GestureTypes.js';

/**
 * Which fingers on the screen are the gesture layer's to act on.
 * Extracted from TouchBinder 2026-08-17, when adding the filter took that file to 206 lines.
 *
 * ⚠️ THE BUG THIS EXISTS FOR. `TouchEvent.touches` holds every touch on the SURFACE, not the touches
 * on the event's target, and each `Touch` carries the element it landed on. TouchBinder correctly
 * ignores an event whose target is excluded, so a finger landing in the sidebar reports nothing - and
 * then the next canvas touchmove carries that finger in its own `touches` list, where
 * `SingleFingerStates` counts it, because two-fingerness is decided by `input.touches.length >= 2`.
 *
 * The machine never hears the finger arrive and counts it regardless. One finger dragging a token
 * becomes a pan or a pinch because the other hand is holding the tablet with a thumb over the
 * sidebar, which is how a tablet is held.
 *
 * Filtering HERE, at the single boundary where events become gesture input, rather than at the four
 * `>= 2` checks downstream. Those live in three files and every one of them would have had to learn
 * about exclusion zones to ask the same question.
 *
 * ⚠️ A touch whose target cannot be read is KEPT. `Touch.target` is standard, but this runs against
 * whatever engine the tablet ships, and "drop what I cannot attribute" would silently disable pan and
 * zoom rather than fail loudly. Keeping matches the behaviour before the filter existed, so an
 * unreadable target changes nothing instead of breaking something.
 */
export function actionableTouches(touchList: TouchList, exclusions: ExclusionZones): TouchPoint[] {
  const points: TouchPoint[] = [];
  for (let index = 0; index < touchList.length; index += 1) {
    const touch = touchList.item(index);
    if (touch === null) {
      continue;
    }
    /*
     * Passed straight through, with `isExcluded` widened to accept `undefined`, rather than coerced
     * here. The DOM lib types `Touch.target` as always present; that is a promise TypeScript cannot
     * keep, since an erased type does not make a field exist. Every local workaround was something
     * the linter correctly called unnecessary against the declared type, which is the tell that the
     * declared type was the thing to fix.
     */
    if (exclusions.isExcluded(touch.target)) {
      continue;
    }
    points.push({ id: touch.identifier, clientX: touch.clientX, clientY: touch.clientY });
  }
  return points;
}
