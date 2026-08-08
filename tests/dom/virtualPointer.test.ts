import { beforeEach, describe, expect, it } from 'vitest';

import { VIRTUAL_POINTER_ID } from '../../src/constants.js';
import { CursorOverlay } from '../../src/pointer/CursorOverlay.js';
import { EventDispatcher } from '../../src/pointer/EventDispatcher.js';
import { HitTester } from '../../src/pointer/HitTester.js';
import { VirtualPointer } from '../../src/pointer/VirtualPointer.js';
import { ButtonsMask } from '../../src/pointer/buttons.js';

/**
 * End to end tests for the pointer core against a real DOM.
 *
 * jsdom has no layout engine, so element positions are simulated with an explicit region map rather
 * than by measuring anything. That is exactly why HitTester takes elementFromPoint by injection.
 */

interface Recorded {
  readonly type: string;
  readonly target: string;
  readonly buttons: number;
  readonly button: number;
  readonly clientX: number;
  readonly clientY: number;
}

let regions: { element: Element; x: number; y: number; width: number; height: number }[] = [];
let recorded: Recorded[] = [];

function elementAt(x: number, y: number): Element | null {
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

function record(event: Event): void {
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

const ALL_TYPES = [
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
function makeRegion(
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

function createPointer(initial = { clientX: 0, clientY: 0 }): VirtualPointer {
  const hitTester = new HitTester({
    elementFromPoint: elementAt,
    getViewport: () => ({ width: 1000, height: 800 }),
  });
  // No view: Vitest's jsdom window is not a branded Window and UIEvent would reject it.
  return new VirtualPointer({
    hitTester,
    dispatcher: new EventDispatcher(),
    initialPosition: initial,
  });
}

beforeEach(() => {
  document.body.innerHTML = '';
  regions = [];
  recorded = [];
});

describe('VirtualPointer hover transitions', () => {
  it('fires enter on the first element the pointer reaches', () => {
    makeRegion('a', 0, 0, 100, 100);
    const pointer = createPointer({ clientX: 500, clientY: 500 });

    pointer.moveTo({ clientX: 50, clientY: 50 });

    expect(recorded.map((entry) => `${entry.target}:${entry.type}`)).toEqual([
      'a:pointerover',
      'a:pointerenter',
      'a:mouseover',
      'a:mouseenter',
      'a:pointermove',
      'a:mousemove',
    ]);
  });

  /**
   * This ordering is what makes tooltips, token nameplates and the PF2e HUD work. A move that only
   * emitted pointermove would look correct and silently kill every hover affordance in Foundry.
   */
  it('leaves the old element before entering the new one when crossing a boundary', () => {
    makeRegion('a', 0, 0, 100, 100);
    makeRegion('b', 100, 0, 100, 100);
    const pointer = createPointer({ clientX: 50, clientY: 50 });

    pointer.moveTo({ clientX: 50, clientY: 50 });
    recorded = [];
    pointer.moveTo({ clientX: 150, clientY: 50 });

    expect(recorded.map((entry) => `${entry.target}:${entry.type}`)).toEqual([
      'a:pointerout',
      'a:pointerleave',
      'a:mouseout',
      'a:mouseleave',
      'b:pointerover',
      'b:pointerenter',
      'b:mouseover',
      'b:mouseenter',
      'b:pointermove',
      'b:mousemove',
    ]);
  });

  it('emits only a move when staying within the same element', () => {
    makeRegion('a', 0, 0, 100, 100);
    const pointer = createPointer({ clientX: 10, clientY: 10 });

    pointer.moveTo({ clientX: 10, clientY: 10 });
    recorded = [];
    pointer.moveTo({ clientX: 20, clientY: 20 });

    expect(recorded.map((entry) => entry.type)).toEqual(['pointermove', 'mousemove']);
  });

  it('leaves the old element and enters nothing when moving onto empty space', () => {
    makeRegion('a', 0, 0, 100, 100);
    const pointer = createPointer({ clientX: 10, clientY: 10 });

    pointer.moveTo({ clientX: 10, clientY: 10 });
    recorded = [];
    pointer.moveTo({ clientX: 500, clientY: 500 });

    expect(recorded.map((entry) => `${entry.target}:${entry.type}`)).toEqual([
      'a:pointerout',
      'a:pointerleave',
      'a:mouseout',
      'a:mouseleave',
    ]);
  });
});

describe('VirtualPointer clicks', () => {
  it('dispatches a full left click sequence at the pointer position', () => {
    makeRegion('a', 0, 0, 100, 100);
    const pointer = createPointer({ clientX: 40, clientY: 40 });

    pointer.leftClick();

    expect(recorded.map((entry) => entry.type)).toEqual([
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click',
    ]);
    expect(recorded.every((entry) => entry.clientX === 40 && entry.clientY === 40)).toBe(true);
  });

  it('ends a right click in a cancelable contextmenu that Foundry can suppress', () => {
    const region = makeRegion('a', 0, 0, 100, 100);
    let prevented = false;
    region.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      prevented = event.cancelable;
    });
    const pointer = createPointer({ clientX: 40, clientY: 40 });

    pointer.rightClick();

    expect(recorded.map((entry) => entry.type)).toContain('contextmenu');
    expect(prevented).toBe(true);
  });

  it('reaches a listener bound on an ancestor, so delegated handlers work', () => {
    const parent = document.createElement('div');
    parent.id = 'parent';
    document.body.append(parent);
    const child = document.createElement('button');
    child.id = 'child';
    parent.append(child);
    regions.push({ element: child, x: 0, y: 0, width: 100, height: 100 });

    const seen: string[] = [];
    parent.addEventListener('click', (event) => {
      seen.push((event.target as Element).id);
    });

    createPointer({ clientX: 10, clientY: 10 }).leftClick();

    expect(seen).toEqual(['child']);
  });
});

describe('VirtualPointer dragging', () => {
  /**
   * The single most important behaviour in the module. If buttons drops to zero during the move
   * stream, Foundry reads a hover rather than a drag, and token movement, ruler waypoints and
   * template placement all stop working with no error raised anywhere.
   */
  it('keeps the buttons bitmask set through every move of a drag', () => {
    makeRegion('board', 0, 0, 500, 500);
    const pointer = createPointer({ clientX: 10, clientY: 10 });

    pointer.beginDrag();
    pointer.dragBy(20, 0);
    pointer.dragBy(20, 0);
    pointer.dragBy(20, 0);
    pointer.endDrag();

    const moves = recorded.filter((entry) => entry.type === 'pointermove');
    expect(moves).toHaveLength(3);
    expect(moves.every((entry) => entry.buttons === ButtonsMask.LEFT)).toBe(true);

    const down = recorded.find((entry) => entry.type === 'pointerdown');
    const up = recorded.find((entry) => entry.type === 'pointerup');
    expect(down?.buttons).toBe(ButtonsMask.LEFT);
    expect(up?.buttons).toBe(ButtonsMask.NONE);
  });

  it('advances the pointer position across the drag', () => {
    makeRegion('board', 0, 0, 500, 500);
    const pointer = createPointer({ clientX: 10, clientY: 10 });

    pointer.beginDrag();
    pointer.dragBy(20, 5);
    pointer.dragBy(20, 5);

    const moves = recorded.filter((entry) => entry.type === 'pointermove');
    expect(moves.map((entry) => `${String(entry.clientX)},${String(entry.clientY)}`)).toEqual([
      '30,15',
      '50,20',
    ]);
    expect(pointer.getPosition()).toEqual({ clientX: 50, clientY: 20 });
  });

  it('does not emit a click on release, which would reselect whatever is under the drop', () => {
    makeRegion('board', 0, 0, 500, 500);
    const pointer = createPointer({ clientX: 10, clientY: 10 });

    pointer.beginDrag();
    pointer.dragBy(50, 50);
    pointer.endDrag();

    expect(recorded.map((entry) => entry.type)).not.toContain('click');
  });

  it('ignores drag moves when no drag is in progress', () => {
    makeRegion('board', 0, 0, 500, 500);
    const pointer = createPointer({ clientX: 10, clientY: 10 });

    pointer.dragBy(50, 50);

    expect(recorded).toHaveLength(0);
    expect(pointer.isDragging()).toBe(false);
  });

  it('emits pointercancel when a drag is abandoned, so Foundry releases its drag state', () => {
    makeRegion('board', 0, 0, 500, 500);
    const pointer = createPointer({ clientX: 10, clientY: 10 });

    pointer.beginDrag();
    recorded = [];
    pointer.cancelDrag();

    expect(recorded.map((entry) => entry.type)).toEqual(['pointercancel']);
    expect(pointer.isDragging()).toBe(false);
  });

  it('resolves the target afresh on each drag step rather than caching it', () => {
    makeRegion('a', 0, 0, 100, 100);
    makeRegion('b', 100, 0, 100, 100);
    const pointer = createPointer({ clientX: 50, clientY: 50 });

    pointer.beginDrag();
    pointer.dragBy(100, 0);

    const moves = recorded.filter((entry) => entry.type === 'pointermove');
    expect(moves.map((entry) => entry.target)).toEqual(['b']);
  });
});

describe('VirtualPointer event fields', () => {
  it('stamps the reserved pointer id and a mouse pointer type on every pointer event', () => {
    const region = makeRegion('a', 0, 0, 100, 100);
    const seen: { id: number; type: string; primary: boolean }[] = [];
    region.addEventListener('pointerdown', (event) => {
      seen.push({ id: event.pointerId, type: event.pointerType, primary: event.isPrimary });
    });

    createPointer({ clientX: 10, clientY: 10 }).leftClick();

    expect(seen).toEqual([{ id: VIRTUAL_POINTER_ID, type: 'mouse', primary: true }]);
  });

  it('carries modifier flags through to the dispatched event', () => {
    const region = makeRegion('a', 0, 0, 100, 100);
    const seen: boolean[] = [];
    region.addEventListener('pointerdown', (event) => {
      seen.push(event.shiftKey);
    });

    const pointer = createPointer({ clientX: 10, clientY: 10 });
    pointer.setModifiers({ ctrlKey: false, shiftKey: true, altKey: false, metaKey: false });
    pointer.leftClick();

    expect(seen).toEqual([true]);
  });

  it('dispatches a pixel mode wheel event carrying the delta sign', () => {
    const region = makeRegion('a', 0, 0, 100, 100);
    const seen: { deltaY: number; deltaMode: number }[] = [];
    region.addEventListener('wheel', (event) => {
      seen.push({ deltaY: event.deltaY, deltaMode: event.deltaMode });
    });

    createPointer({ clientX: 10, clientY: 10 }).wheel(-120);

    expect(seen).toEqual([{ deltaY: -120, deltaMode: 0 }]);
  });
});

describe('VirtualPointer viewport clamping', () => {
  it('clamps an off screen move rather than losing the pointer', () => {
    makeRegion('edge', 900, 0, 100, 800);
    const pointer = createPointer({ clientX: 500, clientY: 400 });

    pointer.moveTo({ clientX: 5000, clientY: 400 });

    expect(pointer.getPosition()).toEqual({ clientX: 999, clientY: 400 });
  });

  /**
   * Without recording the clamped position back into state, repeated off screen moves would
   * accumulate an invisible offset the user would have to swipe all the way back through before the
   * cursor appeared to move again.
   */
  it('does not accumulate an invisible offset across repeated off screen moves', () => {
    makeRegion('edge', 900, 0, 100, 800);
    const pointer = createPointer({ clientX: 500, clientY: 400 });

    pointer.moveBy(5000, 0);
    pointer.moveBy(5000, 0);
    pointer.moveBy(-100, 0);

    expect(pointer.getPosition()).toEqual({ clientX: 899, clientY: 400 });
  });
});

describe('CursorOverlay', () => {
  /**
   * Load bearing, not cosmetic. If the cursor were hit testable, elementFromPoint would resolve to
   * the cursor itself and nothing underneath it would ever receive an event.
   */
  it('is not hit testable, so it can never resolve as its own hit target', () => {
    const cursor = new CursorOverlay({ document });
    cursor.attach();

    expect(cursor.getElement().style.pointerEvents).toBe('none');
  });

  it('attaches outside Foundry interface subtree so it survives re-renders', () => {
    const cursor = new CursorOverlay({ document });
    cursor.attach();

    expect(cursor.getElement().parentElement).toBe(document.body);
    expect(cursor.isAttached()).toBe(true);
  });

  it('is idempotent on repeated attach and detach', () => {
    const cursor = new CursorOverlay({ document });
    cursor.attach();
    cursor.attach();

    expect(document.querySelectorAll('.tb-cursor')).toHaveLength(1);

    cursor.detach();
    cursor.detach();
    expect(document.querySelectorAll('.tb-cursor')).toHaveLength(0);
  });

  it('moves with a compositor friendly transform rather than layout properties', () => {
    const cursor = new CursorOverlay({ document });
    cursor.moveTo({ clientX: 120, clientY: 240 });

    expect(cursor.getElement().style.transform).toBe('translate3d(120px, 240px, 0)');
  });

  it('marks the held state so a drag is never ambiguous to the user', () => {
    const cursor = new CursorOverlay({ document });
    cursor.setButtonHeld(true);
    expect(cursor.getElement().classList.contains('tb-cursor--held')).toBe(true);

    cursor.setButtonHeld(false);
    expect(cursor.getElement().classList.contains('tb-cursor--held')).toBe(false);
  });
});
