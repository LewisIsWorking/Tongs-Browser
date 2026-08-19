import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DragObservers } from '../../src/debug/DragObservers.js';

/**
 * The listeners that watch a drag happen.
 *
 * ⚠️ All of these are installed ONCE and left in place, never per gesture, and both halves of that
 * were learned the hard way: listeners added per gesture leak across a scene change, and a diagnostic
 * that has to be installed during the bug is a diagnostic nobody has when the bug happens.
 *
 * The uncovered half here was the counting rules rather than the wiring, and those decide whether the
 * numbers in a report describe the drag being investigated or the one before it.
 */
type MutableGlobal = Record<string, unknown>;
const globals = globalThis as unknown as MutableGlobal;

function build(isCapturing: () => boolean) {
  const listeners = new Map<string, () => void>();
  const window = {
    addEventListener: (type: string, handler: () => void) => listeners.set(type, handler),
  } as unknown as Window;
  const onObservation = vi.fn();
  const observers = new DragObservers({ window, isCapturing, onObservation });
  return { observers, onObservation, resize: () => listeners.get('resize')?.() };
}

beforeEach(() => {
  Reflect.deleteProperty(globals, 'canvas');
  Reflect.deleteProperty(globals, 'CONFIG');
});

/**
 * ⚠️ Bound at CONSTRUCTION, not at the grab. A listener added when the drag starts would miss a
 * resize triggered BY the grab, which is precisely the case under suspicion: on Android the URL bar
 * slides as you gesture, that resizes the viewport, Foundry redraws the canvas on resize, and a
 * redraw of a token cancels its interaction outright.
 */
describe('counting viewport resizes', () => {
  it('is already listening before any drag begins', () => {
    let capturing = false;
    const { observers, resize } = build(() => capturing);

    capturing = true;
    resize();

    expect(observers.snapshot().resizes).toBe(1);
  });

  /** A count that included resizes outside the drag would describe the session, not the gesture. */
  it('ignores resizes while no drag is open', () => {
    const { observers, resize } = build(() => false);

    resize();
    resize();

    expect(observers.snapshot().resizes).toBe(0);
  });
});

/**
 * ⚠️ One drag at a time. A probe that carries numbers across gestures measures history rather than
 * behaviour, which is the mistake this whole diagnostics suite has made before and corrected.
 */
describe('opening a fresh drag', () => {
  it('clears the resize count from the previous one', () => {
    const { observers, resize } = build(() => true);
    resize();
    resize();

    observers.beginDrag('412x915');

    expect(observers.snapshot().resizes).toBe(0);
  });

  it('records the viewport the grab happened at', () => {
    const { observers } = build(() => true);

    observers.beginDrag('412x915');

    expect(observers.snapshot().viewportAtGrab).toBe('412x915');
  });

  /**
   * ⚠️ This test PRODUCES an ending before clearing it, and the first version did not. That version
   * asserted an empty list on a fresh observer, which is empty whether or not `beginDrag` clears
   * anything, so it passed with the reset deleted. Mutation checking caught it.
   *
   * Installing the hooks against a stand-in Foundry costs a few lines and buys a test that can
   * actually fail, plus proof that the wrapping reaches `onObservation` at all.
   */
  it('clears the endings recorded during the previous drag', () => {
    const prototype: Record<string, unknown> = { draw: () => undefined, destroy: () => undefined };
    globals['CONFIG'] = { Token: { objectClass: { prototype } } };
    const { observers } = build(() => true);
    observers.attach();

    (prototype['draw'] as () => void).call({});
    expect(observers.snapshot().dragEndings.length).toBeGreaterThan(0);

    observers.beginDrag('412x915');

    expect(observers.snapshot().dragEndings).toEqual([]);
  });
});

/**
 * ⚠️ Attaching is retried until Foundry exists, so it runs repeatedly and MUST be idempotent.
 *
 * The hooks here are monkey patches, and `proto.method = wrap(proto.method)` is a read-modify-write:
 * running it twice composes rather than replaces. Diagnostics were once about 150 layers deep, so one
 * call announced itself 150 times and cost real time in the live game.
 */
describe('attaching before Foundry exists', () => {
  it('does not throw when there is no canvas and no CONFIG', () => {
    const { observers } = build(() => true);

    expect(() => {
      observers.attach();
    }).not.toThrow();
  });

  it('reports the hooks as not installed, rather than claiming success', () => {
    const { observers } = build(() => true);

    observers.attach();

    expect(observers.snapshot().hooksInstalled).toEqual({ token: false, manager: false });
  });

  /** Retried attachment is the normal case, so repeating it must stay harmless. */
  it('can be attempted repeatedly while Foundry is still starting', () => {
    const { observers } = build(() => true);

    expect(() => {
      observers.attach();
      observers.attach();
      observers.attach();
    }).not.toThrow();
    expect(observers.snapshot().hooksInstalled.token).toBe(false);
  });
});

describe('what the report is given', () => {
  /**
   * ⚠️ The counts are read ONCE per snapshot. `getCounts` returns a fresh object each call and the
   * listeners behind it fire continuously while the pointer moves, so two calls would put two fields
   * at two different moments and the report could disagree with itself about a single gesture.
   */
  it('carries a counts object, read as one reading', () => {
    const { observers } = build(() => true);

    const snapshot = observers.snapshot();

    expect(snapshot.counts).toBeDefined();
    expect(observers.snapshot().counts).not.toBe(snapshot.counts);
  });
});
