import type { EventDescriptor } from '../EventDescriptor.js';
import type { PointerState } from '../PointerState.js';
import {
  MouseButton,
  maskForButton,
  withButtonReleased,
  type MouseButtonValue,
} from '../buttons.js';
import { mouseDescriptor, pointerDescriptor } from './descriptorFactory.js';

/**
 * A drag is three separate calls rather than one, because the move stream is open ended: the caller
 * keeps feeding moves for as long as the finger is down.
 *
 * The invariant that makes dragging work at all is that the buttons bitmask stays set on every
 * event in the middle stream. If it drops to zero on the moves, Foundry sees a hover rather than a
 * drag, and token movement, ruler waypoints and template placement all silently stop working. That
 * is the single most important behaviour in this file and it is tested directly.
 */

/** Press the button and begin the drag. */
export function buildDragStartSequence(
  state: PointerState,
  button: MouseButtonValue = MouseButton.LEFT
): EventDescriptor[] {
  const heldButtons = state.buttons | maskForButton(button);

  return [
    pointerDescriptor('pointerdown', state, { button, buttons: heldButtons }),
    mouseDescriptor('mousedown', state, { button, buttons: heldButtons, detail: 1 }),
  ];
}

/**
 * One step of the drag.
 *
 * `button` is -1 here, not the button being dragged with, because no button changed state on a
 * move. `buttons` carries the held button, which is the part that matters.
 */
export function buildDragMoveSequence(
  state: PointerState,
  button: MouseButtonValue = MouseButton.LEFT
): EventDescriptor[] {
  const heldButtons = state.buttons | maskForButton(button);

  return [
    pointerDescriptor('pointermove', state, { buttons: heldButtons }),
    mouseDescriptor('mousemove', state, { buttons: heldButtons }),
  ];
}

/**
 * Release the button and end the drag.
 *
 * No click event follows. A click after a drag would be actively harmful: dropping a token on a new
 * square would also register as a click on whatever is underneath, reselecting or reopening things
 * the user did not ask for.
 */
export function buildDragEndSequence(
  state: PointerState,
  button: MouseButtonValue = MouseButton.LEFT
): EventDescriptor[] {
  const heldButtons = state.buttons | maskForButton(button);
  const releasedButtons = withButtonReleased(heldButtons, button);

  return [
    pointerDescriptor('pointerup', state, { button, buttons: releasedButtons }),
    mouseDescriptor('mouseup', state, { button, buttons: releasedButtons, detail: 1 }),
  ];
}

/**
 * Abandon a drag without completing it, for use when a touch is cancelled by the system, for
 * example an incoming call or the Android gesture bar taking over.
 *
 * pointercancel tells listeners the interaction is over and no pointerup is coming. Foundry cleans
 * up its drag state on it, which prevents a token being left stuck to the pointer.
 */
export function buildDragCancelSequence(state: PointerState): EventDescriptor[] {
  return [pointerDescriptor('pointercancel', state, { buttons: 0 })];
}
