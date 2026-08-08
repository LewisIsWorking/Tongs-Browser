import type { EventDescriptor } from '../EventDescriptor.js';
import type { PointerState } from '../PointerState.js';
import { wheelDescriptor } from './descriptorFactory.js';

/**
 * Wheel events, used for zoom where a synthesised wheel is preferable to calling canvas.pan
 * directly, for example over a scrollable sidebar list rather than the board.
 *
 * Sign convention follows the DOM: positive deltaY scrolls the content downward, which in Foundry's
 * canvas handling zooms out. Callers pass the sign they want rather than having it flipped here,
 * because inverting it in two places is how scroll direction bugs happen.
 */
export function buildWheelSequence(
  state: PointerState,
  deltaY: number,
  deltaX = 0
): EventDescriptor[] {
  return [wheelDescriptor(state, deltaX, deltaY)];
}
