/**
 * The shared harness for every VirtualPointer suite. Extracted from virtualPointer.test 2026-08-12,
 * when that file reached 512 lines.
 *
 * ⚠️ `elementFromPoint` is INJECTED rather than reached for, because jsdom does not implement it at
 * all. That injection is also what lets a test place elements by coordinate instead of by layout,
 * which is the only way to test hit testing without a layout engine.
 */
import { beforeEach } from 'vitest';

import { VIRTUAL_POINTER_ID } from '../../../src/constants.js';
import { CursorOverlay } from '../../../src/pointer/CursorOverlay.js';
import { EventDispatcher } from '../../../src/pointer/EventDispatcher.js';
import { HitTester } from '../../../src/pointer/HitTester.js';
import { VirtualPointer } from '../../../src/pointer/VirtualPointer.js';
import { ButtonsMask } from '../../../src/pointer/buttons.js';

// Re-exported so a suite needs one import rather than two: the harness and the thing it harnesses.
export {
  ButtonsMask,
  CursorOverlay,
  EventDispatcher,
  HitTester,
  VirtualPointer,
  VIRTUAL_POINTER_ID,
};

/**
 * End to end tests for the pointer core against a real DOM.
 *
 * jsdom has no layout engine, so element positions are simulated with an explicit region map rather
 * than by measuring anything. That is exactly why HitTester takes elementFromPoint by injection.
 */

export interface Recorded {
  readonly type: string;
  readonly target: string;
  readonly buttons: number;
  readonly button: number;
  readonly clientX: number;
  readonly clientY: number;
}

export let regions: { element: Element; x: number; y: number; width: number; height: number }[] =
  [];
/**
 * ⚠️ A const array emptied IN PLACE, never reassigned. Several tests clear it MID TEST to isolate a
 * phase, and a reassignment cannot cross a module boundary: the importing suite would keep the old
 * array and assert on events it meant to discard.
 */
export const recorded: Recorded[] = [];

export function elementAt(x: number, y: number): Element | null {
  // Later regions win, mimicking a higher stacking order.
  for (let index = regions.length - 1; index >= 0; index -= 1) {
    const region = regions[index];
    if (
      region !== undefined &&
      x >= region.x &&
      x < region.x + region.width &&
      y >= region.y &&
      y < region.y + region.height
    ) {
      return region.element;
    }
  }
  return null;
}

export function record(event: Event): void {
  const target = event.currentTarget as Element;
  const mouse = event as MouseEvent;
  recorded.push({
    type: event.type,
    target: target.id,
    buttons: mouse.buttons,
    button: mouse.button,
    clientX: mouse.clientX,
    clientY: mouse.clientY,
  });
}

export const ALL_TYPES = [
  'pointerover',
  'pointerenter',
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointerout',
  'pointerleave',
  'pointercancel',
  'mouseover',
  'mouseenter',
  'mousedown',
  'mousemove',
  'mouseup',
  'mouseout',
  'mouseleave',
  'click',
  'dblclick',
  'contextmenu',
  'wheel',
];

// Returns HTMLElement rather than Element so addEventListener resolves the typed event map.
// Element's own map covers only a handful of types and would widen these listeners to Event.
export function makeRegion(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number
): HTMLDivElement {
  const element = document.createElement('div');
  element.id = id;
  document.body.append(element);
  for (const type of ALL_TYPES) {
    element.addEventListener(type, record);
  }
  regions.push({ element, x, y, width, height });
  return element;
}

export function createPointer(
  initial = { clientX: 0, clientY: 0 },
  /**
   * ⚠️ Injectable so the ORDER can be asserted. The disarm has to happen after the pointerdown,
   * because the pointerdown is what arms Foundry's long press timer; disarming first clears a timer
   * Foundry immediately replaces, which is a change that runs on every drag and fixes nothing.
   */
  onDragBegun: () => void = () => undefined
): VirtualPointer {
  const hitTester = new HitTester({
    elementFromPoint: elementAt,
    getViewport: () => ({ width: 1000, height: 800 }),
  });
  // No view: Vitest's jsdom window is not a branded Window and UIEvent would reject it.
  return new VirtualPointer({
    onDragBegun,
    hitTester,
    dispatcher: new EventDispatcher(),
    initialPosition: initial,
  });
}

beforeEach(() => {
  document.body.innerHTML = '';
  regions = [];
  recorded.length = 0;
});
