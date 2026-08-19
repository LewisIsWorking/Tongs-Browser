import { buildMoveSequence } from './sequences/moveSequence.js';
import type { EventDescriptor } from './EventDescriptor.js';
import type { PointerState } from './PointerState.js';
import type { DispatchTargets } from './EventDispatcher.js';

/**
 * What to send for a move that is NOT part of a drag. Extracted from VirtualPointer 2026-08-13.
 *
 * ⚠️ The enter and leave events are the whole reason this is not just a mousemove. Foundry highlights
 * a token on `pointerover` and clears it on `pointerout`, so a pointer that moves between elements
 * without announcing the change leaves the previous element believing it is still hovered. Which of
 * those to include depends on THREE facts, not one: whether the target changed, and whether there is
 * a previous and a current target at all.
 */
export interface HoverInputs {
  readonly targetChanged: boolean;
  readonly hasPreviousTarget: boolean;
  readonly hasCurrentTarget: boolean;
}

function buildHoverSequence(
  state: PointerState,
  previous: Element | null,
  current: Element | null
): readonly EventDescriptor[] {
  return buildMoveSequence(state, {
    targetChanged: current !== previous,
    hasPreviousTarget: previous !== null,
    hasCurrentTarget: current !== null,
  });
}

/** Build and send it, so the caller never holds a half applied move. */
export function dispatchHover(
  dispatcher: { dispatchAll: (s: readonly EventDescriptor[], t: DispatchTargets) => void },
  state: PointerState,
  previous: Element | null,
  current: Element | null
): void {
  dispatcher.dispatchAll(buildHoverSequence(state, previous, current), { current, previous });
}
