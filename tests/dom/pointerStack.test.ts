import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createPointerStack } from '../../src/PointerStack.js';

/**
 * Wiring the cursor, hit tester, dispatcher and pointer together.
 *
 * These four are one unit: none is useful alone, and the couple of decisions in how they are joined
 * are the sort a build cannot check and that read as arbitrary until something breaks.
 */
/**
 * ⚠️ jsdom does not implement `elementFromPoint` AT ALL, which is why `HitTester` takes it by
 * injection elsewhere. Here it is stubbed on the document itself, because the thing under test is
 * precisely that `PointerStack` reaches it through the document rather than by a bare reference.
 */
let target: HTMLDivElement;

beforeEach(() => {
  document.body.innerHTML = '';
  target = document.createElement('div');
  target.id = 'board';
  document.body.append(target);
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: function elementFromPoint(this: Document, x: number, y: number): Element | null {
      // Reads `this`, so a reference that lost its receiver fails here exactly as in a real browser.
      return this === document && x >= 0 && y >= 0 ? target : null;
    },
  });
});

const make = (onDispatch = vi.fn()) =>
  createPointerStack({
    document,
    window,
    onDispatch,
    cursorSize: 24,
    onDragBegun: () => undefined,
  });

describe('createPointerStack', () => {
  /**
   * ⚠️ Starts in the MIDDLE of the viewport. Anywhere else and the first thing a user does is drag it
   * out of a corner, and a pointer at (0, 0) is easy to mistake for one that never appeared at all.
   */
  it('starts the pointer in the middle of the viewport', () => {
    const { pointer } = make();

    expect(pointer.getPosition()).toEqual({
      clientX: window.innerWidth / 2,
      clientY: window.innerHeight / 2,
    });
  });

  it('gives back a cursor that is attached to the document', () => {
    const { cursor } = make();

    expect(cursor).toBeDefined();
    expect(() => {
      cursor.moveTo({ clientX: 10, clientY: 20 });
    }).not.toThrow();
  });

  /**
   * ⚠️ The dispatch callback is the seam the debug overlay AND the drag record both hang off. A
   * pointer wired up without it looks completely normal and reports nothing, which is the exact
   * failure this module spent a week diagnosing from the wrong end.
   */
  it('reports every dispatched event to the caller', () => {
    const onDispatch = vi.fn();
    const { pointer } = make(onDispatch);

    pointer.moveTo({ clientX: 50, clientY: 60 });

    expect(onDispatch).toHaveBeenCalled();
    const [descriptor, target] = onDispatch.mock.calls[0] ?? [];
    expect(descriptor).toMatchObject({ type: expect.stringContaining('pointer') as unknown });
    expect(target).toBeInstanceOf(Element);
  });

  it('reports the drag stream too, not only ordinary movement', () => {
    const onDispatch = vi.fn();
    const { pointer } = make(onDispatch);
    onDispatch.mockClear();

    pointer.beginDrag();

    const types = onDispatch.mock.calls.map(
      ([descriptor]) => (descriptor as { type: string }).type
    );
    expect(types).toContain('pointerdown');
  });

  /**
   * ⚠️ `elementFromPoint` throws if it loses its receiver, and passing it as a bare reference is
   * exactly how that happens: it looks like a shorter way to say the same thing and is a TypeError at
   * the first hit test. A pointer that cannot hit test cannot click anything.
   */
  it('hit tests without losing the document as a receiver', () => {
    const { pointer } = make();

    expect(() => {
      pointer.moveTo({ clientX: 5, clientY: 5 });
    }).not.toThrow();
    expect(pointer.getCurrentTarget()).toBe(target);
  });

  it('clamps to the viewport, so the pointer cannot be driven off screen', () => {
    const { pointer } = make();

    pointer.moveTo({ clientX: 99999, clientY: 99999 });

    const position = pointer.getPosition();
    expect(position.clientX).toBeLessThanOrEqual(window.innerWidth);
    expect(position.clientY).toBeLessThanOrEqual(window.innerHeight);
  });

  /**
   * ⚠️ The production path, which the tests above deliberately avoid. Passing an event view is what
   * TongsBrowser does, and it is separated from `window` precisely because vitest's jsdom window is
   * not a BRANDED Window: `new PointerEvent({ view })` rejects it with "member view is not of type
   * Window". Building the stack is safe, since nothing is dispatched until the pointer moves.
   */
  it('accepts an event view, which is what the real composition root supplies', () => {
    const stack = createPointerStack({
      document,
      window,
      eventView: window,
      onDragBegun: () => undefined,
      onDispatch: vi.fn(),
    });

    expect(stack.pointer.getPosition().clientX).toBe(window.innerWidth / 2);
  });

  it('works without a cursor size, which is the ordinary case', () => {
    const stack = createPointerStack({
      document,
      window,
      onDispatch: vi.fn(),
      onDragBegun: () => undefined,
    });

    expect(stack.pointer.getPosition().clientX).toBe(window.innerWidth / 2);
  });
});
