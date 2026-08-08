import type { EventDescriptor } from '../EventDescriptor.js';
import type { PointerState } from '../PointerState.js';
import { mouseDescriptor, pointerDescriptor } from './descriptorFactory.js';

export interface MoveSequenceOptions {
  /** True when the element under the pointer differs from the one under it on the previous frame. */
  readonly targetChanged: boolean;
  /** False on the first ever move, or when the pointer was previously over nothing. */
  readonly hasPreviousTarget: boolean;
  /** False when the pointer is over nothing at all, for example past the edge of the document. */
  readonly hasCurrentTarget: boolean;
}

/**
 * Builds the events for a pointer move.
 *
 * This is the sequence that makes hover work, and hover is most of the reason this module exists.
 * Tooltips, token nameplates, and the PF2e HUD panels all hang off enter and leave firing in the
 * right order on the right elements. A move that only emits pointermove looks fine and silently
 * kills every hover affordance in the interface.
 *
 * Order matches what a real browser produces when the pointer crosses from element A to element B:
 * A is told it is being left before B is told it is being entered, and the move itself lands last,
 * on B. Pointer events precede their legacy mouse counterparts at each phase.
 */
export function buildMoveSequence(
  state: PointerState,
  options: MoveSequenceOptions
): EventDescriptor[] {
  const descriptors: EventDescriptor[] = [];

  if (options.targetChanged && options.hasPreviousTarget) {
    descriptors.push(
      pointerDescriptor('pointerout', state, { target: 'previous' }),
      pointerDescriptor('pointerleave', state, { target: 'previous' }),
      mouseDescriptor('mouseout', state, { target: 'previous' }),
      mouseDescriptor('mouseleave', state, { target: 'previous' })
    );
  }

  if (options.targetChanged && options.hasCurrentTarget) {
    descriptors.push(
      pointerDescriptor('pointerover', state),
      pointerDescriptor('pointerenter', state),
      mouseDescriptor('mouseover', state),
      mouseDescriptor('mouseenter', state)
    );
  }

  if (options.hasCurrentTarget) {
    descriptors.push(pointerDescriptor('pointermove', state), mouseDescriptor('mousemove', state));
  }

  return descriptors;
}
