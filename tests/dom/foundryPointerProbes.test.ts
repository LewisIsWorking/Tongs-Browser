import { afterEach, describe, expect, it } from 'vitest';

import { describeInteractionState, describePointers } from '../../src/debug/FoundryProbes.js';

/**
 * The read only probes behind the diagnostics report.
 *
 * These were methods on the composition root until 2026-08-11 and therefore untestable, which is a
 * large part of why the report went through several rounds of confidently reporting numbers it had
 * never measured. A probe is a claim about the world, and a claim nothing checks is a rumour.
 */
const original = Object.getOwnPropertyDescriptor(globalThis, 'canvas');

afterEach(() => {
  if (original === undefined) {
    delete (globalThis as { canvas?: unknown }).canvas;
  } else {
    Object.defineProperty(globalThis, 'canvas', original);
  }
});

function setCanvas(value: unknown): void {
  Object.defineProperty(globalThis, 'canvas', { value, configurable: true, writable: true });
}

describe('describePointers', () => {
  it('prints our pointer, Foundry origin, the view rect and the resolution', () => {
    setCanvas({
      app: {
        view: { getBoundingClientRect: () => ({ x: 0, y: 0, width: 360, height: 607 }) },
        renderer: { events: { pointer: { global: { x: 12.4, y: 34.6 } } }, resolution: 3 },
      },
      tokens: {
        controlled: [
          { mouseInteractionManager: { interactionData: { screenOrigin: { x: 5, y: 6 } } } },
        ],
      },
    });

    const line = describePointers();

    expect(line).toContain('pixi=12,35');
    expect(line).toContain('origin=5,6');
    expect(line).toContain('viewRect=0,0 360x607');
    expect(line).toContain('res=3');
  });

  /**
   * `origin=n/a` is a real and important reading, not an error: Foundry clears interactionData once
   * a gesture ends, so a report written afterwards has no origin to show. Saying `n/a` is what stops
   * a reader taking a missing value for a zero.
   */
  it('says n/a for each part it cannot read, rather than inventing a value', () => {
    setCanvas({});

    const line = describePointers();

    expect(line).toContain('pixi=n/a');
    expect(line).toContain('origin=n/a');
    expect(line).toContain('viewRect=n/a');
    expect(line).toContain('res=n/a');
  });
});
describe('describeInteractionState', () => {
  it('names the state as well as printing its number', () => {
    expect(describeInteractionState({ mouseInteractionManager: { state: 3 } })).toBe('GRABBED (3)');
    expect(describeInteractionState({ mouseInteractionManager: { state: 0 } })).toBe('NONE (0)');
  });

  it('says so when there is no interaction manager to ask', () => {
    expect(describeInteractionState(undefined)).toBe('no interaction manager');
    expect(describeInteractionState({})).toBe('no interaction manager');
  });

  /** A future Foundry adding a state must read as UNKNOWN rather than silently as undefined. */
  it('reports a state it does not recognise as UNKNOWN', () => {
    expect(describeInteractionState({ mouseInteractionManager: { state: 99 } })).toBe(
      'UNKNOWN (99)'
    );
  });
});
