import { GestureController } from '../../../src/gesture/GestureController.js';
import type { CanvasController } from '../../../src/gesture/CanvasController.js';
import type { GestureAction } from '../../../src/gesture/GestureTypes.js';
import type { VirtualPointer } from '../../../src/pointer/VirtualPointer.js';

/**
 * A controller wired to fakes that record what they were asked to do. Extracted from
 * gestureControllerDrag 2026-08-12, when that file reached 339 lines against a hard 200 limit.
 *
 * ⚠️ A FACTORY, not a shared instance, and it has to stay one. Every caller gets its own `calls`
 * array, so a test that moves into another file cannot start seeing another file's calls. Sharing
 * one instance across files is the version of this that passes locally and fails on a different
 * test order.
 */
export function build(dragging: boolean) {
  const calls: string[] = [];
  const pointer = {
    isDragging: () => dragging,
    leftClick: () => calls.push('leftClick'),
    rightClick: () => calls.push('rightClick'),
    doubleClick: () => calls.push('doubleClick'),
    moveBy: () => calls.push('moveBy'),
    moveTo: () => calls.push('moveTo'),
    beginDrag: () => calls.push('beginDrag'),
    dragBy: () => calls.push('dragBy'),
    endDrag: () => calls.push('endDrag'),
    cancelDrag: () => calls.push('cancelDrag'),
  } as unknown as VirtualPointer;

  const canvas = {
    panBy: () => true,
    zoomBy: () => true,
  } as unknown as CanvasController;

  const controller = new GestureController({ pointer, canvas });
  // perform is private because nothing outside should choose the actions. Reaching it directly
  // keeps this test about the guard rather than about reproducing a five step touch sequence,
  // which the state machine's own tests already cover.
  const perform = (action: GestureAction): void => {
    (controller as unknown as { perform: (a: GestureAction) => void }).perform(action);
  };

  return { calls, perform };
}

export const CLICKS: GestureAction[] = [
  { type: 'leftClick' },
  { type: 'rightClick' },
  { type: 'doubleClick' },
];
