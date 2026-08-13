import { TRAVEL_TOLERANCE } from './Options.ts';

/**
 * Turning one drag's measurements into the list of things that are wrong with it. Extracted from
 * foundry-drag-check 2026-08-13.
 *
 * Separated from the run because these are the only judgements in the check, and every one of them
 * was added after a run that PASSED against a broken drag.
 */
export interface DragOutcome {
  readonly moved: boolean;
  readonly before: { x: number; y: number };
  readonly after: { x: number; y: number };
  readonly peakState: number;
  readonly peakClones: number;
  readonly travelled: number;
  readonly expected: number;
  readonly scale: number;
  readonly pointerStillDragging: boolean;
}

const format = (point: { x: number; y: number }): string =>
  `(${String(Math.round(point.x))}, ${String(Math.round(point.y))})`;

export function findDragFailures(result: DragOutcome): string[] {
  const failures: string[] = [];

  if (!result.moved) {
    failures.push(
      `the token did not move: ${format(result.before)} -> ${format(result.after)}. ` +
        `Foundry peaked at interaction state ${String(result.peakState)} with ` +
        `${String(result.peakClones)} clone(s).`
    );
  } else if (Math.abs(result.travelled - result.expected) > TRAVEL_TOLERANCE) {
    /*
     * "It moved" is not the requirement. The requirement is that it FOLLOWED THE POINTER.
     *
     * Measured 2026-08-11 on the first passing run: a 240px drag moved the token 17.64px, and the
     * check said PASS. A token that lurches a fraction of the way is a bug a user would describe as
     * "dragging barely works", and a check that cannot tell it apart from a correct drag has the
     * same blind spot as the event stream tests, just further along.
     *
     * The tolerance is one grid square, which is what snapping is allowed to take.
     */
    failures.push(
      `the token moved ${result.travelled.toFixed(1)}px but the pointer travelled ` +
        `${result.expected.toFixed(1)}px at scale ${result.scale.toFixed(2)}. ` +
        `The drag is not following the pointer.`
    );
  }

  if (result.pointerStillDragging) {
    failures.push('the pointer still believes a button is held after endDrag.');
  }

  return failures;
}
