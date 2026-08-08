import { describe, expect, it, vi } from 'vitest';

import { createScaleTransform } from '../../src/pointer/CoordinateTransform.js';
import { HitTester } from '../../src/pointer/HitTester.js';

/**
 * Runs in the node project with no DOM. That is possible only because HitTester takes its
 * elementFromPoint by injection, which is itself forced by jsdom having no layout engine.
 */

const FAKE_ELEMENT = { tagName: 'DIV' } as unknown as Element;

function createTester(options: {
  elementFromPoint?: (x: number, y: number) => Element | null;
  width?: number;
  height?: number;
  scale?: number;
  originX?: number;
  originY?: number;
}) {
  const elementFromPoint = vi.fn(options.elementFromPoint ?? (() => FAKE_ELEMENT));
  const tester = new HitTester({
    elementFromPoint,
    getViewport: () => ({ width: options.width ?? 800, height: options.height ?? 600 }),
    ...(options.scale === undefined
      ? {}
      : {
          getTransform: () =>
            createScaleTransform(options.scale ?? 1, options.originX ?? 0, options.originY ?? 0),
        }),
  });

  return { tester, elementFromPoint };
}

describe('HitTester viewport clamping', () => {
  it('leaves a position inside the viewport alone', () => {
    const { tester } = createTester({});
    expect(tester.clampToViewport({ clientX: 400, clientY: 300 })).toEqual({
      clientX: 400,
      clientY: 300,
    });
  });

  it.each([
    [
      { clientX: -50, clientY: 300 },
      { clientX: 0, clientY: 300 },
    ],
    [
      { clientX: 400, clientY: -1 },
      { clientX: 400, clientY: 0 },
    ],
    [
      { clientX: 9999, clientY: 300 },
      { clientX: 799, clientY: 300 },
    ],
    [
      { clientX: 400, clientY: 9999 },
      { clientX: 400, clientY: 599 },
    ],
    [
      { clientX: -10, clientY: -10 },
      { clientX: 0, clientY: 0 },
    ],
  ])('pulls %o back inside the viewport', (input, expected) => {
    const { tester } = createTester({});
    expect(tester.clampToViewport(input)).toEqual(expected);
  });

  /**
   * Clamping to width rather than width minus one would put the pointer one pixel outside, where
   * elementFromPoint returns null, so the pointer would silently stop producing events at the edge.
   */
  it('clamps to the last addressable pixel, not to the viewport dimension itself', () => {
    const { tester } = createTester({ width: 100, height: 100 });
    expect(tester.clampToViewport({ clientX: 100, clientY: 100 })).toEqual({
      clientX: 99,
      clientY: 99,
    });
  });

  it('reports whether a position was inside the viewport', () => {
    const { tester } = createTester({ width: 100, height: 100 });

    expect(tester.isWithinViewport({ clientX: 0, clientY: 0 })).toBe(true);
    expect(tester.isWithinViewport({ clientX: 99, clientY: 99 })).toBe(true);
    expect(tester.isWithinViewport({ clientX: 100, clientY: 50 })).toBe(false);
    expect(tester.isWithinViewport({ clientX: -1, clientY: 50 })).toBe(false);
  });
});

describe('HitTester resolution', () => {
  it('tests at the requested position when no transform is configured', () => {
    const { tester, elementFromPoint } = createTester({});
    const result = tester.resolve({ clientX: 400, clientY: 300 });

    expect(elementFromPoint).toHaveBeenCalledWith(400, 300);
    expect(result.element).toBe(FAKE_ELEMENT);
    expect(result.clamped).toBe(false);
  });

  /**
   * The bug this guards against is the whole reason CoordinateTransform exists: with the interface
   * scaled to 75 percent, a cursor drawn at 300,150 sits visually over the element that occupies
   * 400,200 in the scaled layout. Testing at the raw viewport point would resolve the wrong element
   * and every click would land somewhere other than where the user aimed.
   */
  it('converts into scaled space before testing when the interface is scaled', () => {
    const { tester, elementFromPoint } = createTester({ scale: 0.75 });
    tester.resolve({ clientX: 300, clientY: 150 });

    expect(elementFromPoint).toHaveBeenCalledWith(400, 200);
  });

  it('accounts for the transform origin as well as the scale', () => {
    const { tester, elementFromPoint } = createTester({ scale: 0.5, originX: 100, originY: 40 });
    tester.resolve({ clientX: 300, clientY: 140 });

    expect(elementFromPoint).toHaveBeenCalledWith(400, 200);
  });

  it('clamps before testing and reports both the clamp and the adjusted position', () => {
    const { tester, elementFromPoint } = createTester({ width: 800, height: 600 });
    const result = tester.resolve({ clientX: 5000, clientY: 300 });

    expect(elementFromPoint).toHaveBeenCalledWith(799, 300);
    expect(result.clamped).toBe(true);
    expect(result.position).toEqual({ clientX: 799, clientY: 300 });
  });

  it('returns a null element rather than throwing when nothing is under the pointer', () => {
    const { tester } = createTester({ elementFromPoint: () => null });
    expect(tester.resolve({ clientX: 10, clientY: 10 }).element).toBeNull();
  });

  it('resolves afresh on every call, never caching across a drag', () => {
    const elements = [FAKE_ELEMENT, null, FAKE_ELEMENT];
    let index = 0;
    const { tester, elementFromPoint } = createTester({
      elementFromPoint: () => elements[index++] ?? null,
    });

    expect(tester.resolve({ clientX: 1, clientY: 1 }).element).toBe(FAKE_ELEMENT);
    expect(tester.resolve({ clientX: 2, clientY: 2 }).element).toBeNull();
    expect(tester.resolve({ clientX: 3, clientY: 3 }).element).toBe(FAKE_ELEMENT);
    expect(elementFromPoint).toHaveBeenCalledTimes(3);
  });
});
