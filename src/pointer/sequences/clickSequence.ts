import type { EventDescriptor } from '../EventDescriptor.js';
import type { PointerState } from '../PointerState.js';
import {
  ButtonsMask,
  MouseButton,
  maskForButton,
  withButtonReleased,
  type MouseButtonValue,
} from '../buttons.js';
import { mouseDescriptor, pointerDescriptor } from './descriptorFactory.js';

/**
 * Press and release of a single button, ending in the activation event for that button.
 *
 * The buttons bitmask is deliberately different on the down and the up. On the down the button is
 * held, so its bit is set. On the up it has just been released, so the bit is clear. Foundry and
 * PIXI both read that mask, and getting the up wrong leaves the interface believing a button is
 * still down.
 */

function pressAndRelease(
  state: PointerState,
  button: MouseButtonValue,
  detail: number
): EventDescriptor[] {
  const heldButtons = state.buttons | maskForButton(button);
  const releasedButtons = withButtonReleased(heldButtons, button);

  return [
    pointerDescriptor('pointerdown', state, { button, buttons: heldButtons }),
    mouseDescriptor('mousedown', state, { button, buttons: heldButtons, detail }),
    pointerDescriptor('pointerup', state, { button, buttons: releasedButtons }),
    mouseDescriptor('mouseup', state, { button, buttons: releasedButtons, detail }),
  ];
}

/** Left click. Selects tokens, activates buttons, opens sheets. */
export function buildLeftClickSequence(state: PointerState): EventDescriptor[] {
  return [
    ...pressAndRelease(state, MouseButton.LEFT, 1),
    mouseDescriptor('click', state, {
      button: MouseButton.LEFT,
      buttons: ButtonsMask.NONE,
      detail: 1,
    }),
  ];
}

/**
 * Right click, ending in contextmenu rather than click.
 *
 * contextmenu has to bubble and has to be cancelable: Foundry's token HUD and most context menus
 * bind it on a container and call preventDefault to stop the browser's own menu appearing. A
 * non cancelable one would open the browser menu over the top of Foundry's.
 */
export function buildRightClickSequence(state: PointerState): EventDescriptor[] {
  return [
    ...pressAndRelease(state, MouseButton.RIGHT, 1),
    mouseDescriptor('contextmenu', state, {
      button: MouseButton.RIGHT,
      buttons: ButtonsMask.NONE,
      detail: 0,
    }),
  ];
}

/**
 * Double click: two complete click sequences followed by dblclick.
 *
 * The detail counter increments across the pair, matching what a browser produces. Code that
 * distinguishes a single click from the first half of a double click reads detail, so a second
 * click still reporting 1 would be indistinguishable from an unrelated click.
 */
export function buildDoubleClickSequence(state: PointerState): EventDescriptor[] {
  return [
    ...pressAndRelease(state, MouseButton.LEFT, 1),
    mouseDescriptor('click', state, {
      button: MouseButton.LEFT,
      buttons: ButtonsMask.NONE,
      detail: 1,
    }),
    ...pressAndRelease(state, MouseButton.LEFT, 2),
    mouseDescriptor('click', state, {
      button: MouseButton.LEFT,
      buttons: ButtonsMask.NONE,
      detail: 2,
    }),
    mouseDescriptor('dblclick', state, {
      button: MouseButton.LEFT,
      buttons: ButtonsMask.NONE,
      detail: 2,
    }),
  ];
}
