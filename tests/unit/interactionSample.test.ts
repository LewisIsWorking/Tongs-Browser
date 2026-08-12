import { describe, expect, it } from 'vitest';

import {
  readInteractionSample,
  type InteractionGlobals,
} from '../../src/debug/InteractionSample.js';

/**
 * Foundry's interaction state, sampled AS IT HAPPENS.
 *
 * ⚠️ Foundry resets the manager to NONE the moment an interaction ends, so a reading taken when the
 * report is written says NONE whether the drag never started or ran perfectly and committed. Only a
 * peak kept across the gesture can tell those apart, and only if each sample describes one moment.
 */
const globals = (overrides: Partial<InteractionGlobals['canvas']> = {}): InteractionGlobals => ({
  canvas: {
    tokens: {
      controlled: [
        {
          mouseInteractionManager: {
            state: 4,
            interactionData: { screenOrigin: { x: 800, y: 600 } },
          },
        },
      ],
      preview: { children: [{}] },
    },
    app: { renderer: { events: { pointer: { global: { x: 810, y: 620 } } } } },
    ...overrides,
  },
});

describe('readInteractionSample', () => {
  it('reads the whole interaction in one pass', () => {
    expect(readInteractionSample(globals())).toEqual({
      interactionState: 4,
      previewCount: 1,
      foundryOrigin: { x: 800, y: 600 },
      pixiPointer: { x: 810, y: 620 },
    });
  });

  /**
   * ⚠️ The controlled token is resolved ONCE and every field read off that one reference.
   *
   * It used to be reached twice, once for the state and once for the manager, which is two reads of
   * a live array a few lines apart. Between them a selection can change, and the sample would pair
   * one token's interaction state with another token's drag origin: a reading that describes no
   * moment that ever existed, and which looks entirely ordinary in the report.
   */
  it('takes every field from the SAME token', () => {
    let reads = 0;
    const first = {
      mouseInteractionManager: {
        state: 3,
        interactionData: { screenOrigin: { x: 1, y: 1 } },
      },
    };
    const second = {
      mouseInteractionManager: {
        state: 0,
        interactionData: { screenOrigin: { x: 999, y: 999 } },
      },
    };
    // A selection that changes underneath the reader, which is what a released token looks like.
    const controlled = {
      get 0() {
        reads += 1;
        return reads === 1 ? first : second;
      },
      length: 1,
    } as unknown as readonly { mouseInteractionManager?: { state?: number } }[];

    const sample = readInteractionSample({ canvas: { tokens: { controlled } } });

    expect(reads).toBe(1);
    expect(sample.interactionState).toBe(3);
    expect(sample.foundryOrigin).toEqual({ x: 1, y: 1 });
  });

  /** A drag that reached DRAG has a preview clone; a stalled one has none. Zero is a real answer. */
  it('reports no previews as zero rather than as unknown', () => {
    expect(readInteractionSample({ canvas: { tokens: {} } }).previewCount).toBe(0);
    expect(
      readInteractionSample({ canvas: { tokens: { preview: { children: [] } } } }).previewCount
    ).toBe(0);
  });

  it.each([
    ['no canvas at all', {}],
    ['a canvas with no tokens', { canvas: {} }],
    ['tokens with nothing selected', { canvas: { tokens: { controlled: [] } } }],
    ['a token with no interaction manager', { canvas: { tokens: { controlled: [{}] } } }],
  ])('reports nothing rather than throwing for %s', (_case, input) => {
    const sample = readInteractionSample(input);

    expect(sample.interactionState).toBeUndefined();
    expect(sample.foundryOrigin).toBeUndefined();
    expect(sample.previewCount).toBe(0);
  });

  /**
   * PIXI's pointer, not ours. `event.global` is what Foundry actually measures its drag gate
   * against, and the two disagreeing was a live candidate for a long time.
   */
  it("reads PIXI's own pointer independently of the token", () => {
    const sample = readInteractionSample({
      canvas: { app: { renderer: { events: { pointer: { global: { x: 5, y: 6 } } } } } },
    });

    expect(sample.pixiPointer).toEqual({ x: 5, y: 6 });
    expect(sample.interactionState).toBeUndefined();
  });

  it('reports no PIXI pointer rather than a zero one', () => {
    expect(readInteractionSample({ canvas: { app: {} } }).pixiPointer).toBeUndefined();
  });
});
