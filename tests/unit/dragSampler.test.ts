import { describe, expect, it } from 'vitest';

import { DragSampler } from '../../src/debug/DragSampler.js';

/**
 * Every measurement the diagnostics report makes about a drag.
 *
 * The design point being asserted here is that **nothing leaves without its sample count**. A peak
 * alone is not a measurement over a gesture, it is a measurement over however many samples it
 * happened to get, and this report stated a peak of `0.0px` as fact three separate times when it had
 * two samples out of two hundred. Each time it sent the investigation somewhere it did not need to
 * go, so the pairing is the thing worth protecting.
 */
const grab = { clientX: 100, clientY: 100 };

describe('DragSampler', () => {
  it('reports nothing as sampled before anything has been looked at', () => {
    const sampler = new DragSampler();
    sampler.beginDrag(grab);

    const snapshot = sampler.snapshot();

    expect(snapshot.dragGate.sampled).toBe(false);
    expect(snapshot.originDrift.sampled).toBe(false);
    expect(snapshot.divergence.sampled).toBe(false);
    expect(snapshot.movesDispatched).toBe(0);
  });

  /** Exactly Foundry's own gate: hypot(PIXI pointer - screenOrigin), which must reach 10. */
  it('measures the drag gate between PIXI and Foundry, not our own pointer', () => {
    const sampler = new DragSampler();
    sampler.beginDrag(grab);

    sampler.sample({ foundryOrigin: { x: 0, y: 0 }, pixiPointer: { x: 30, y: 40 } });

    expect(sampler.snapshot().dragGate).toEqual({ sampled: true, peak: 50, samples: 1 });
    expect(sampler.snapshot().lastGateDistance).toBe(50);
  });

  it('keeps the peak gate rather than the last one, and counts every sample', () => {
    const sampler = new DragSampler();
    sampler.beginDrag(grab);

    sampler.sample({ foundryOrigin: { x: 0, y: 0 }, pixiPointer: { x: 100, y: 0 } });
    sampler.sample({ foundryOrigin: { x: 0, y: 0 }, pixiPointer: { x: 5, y: 0 } });

    expect(sampler.snapshot().dragGate).toEqual({ sampled: true, peak: 100, samples: 2 });
    // The LAST distance is not the peak, and both are worth having: a drag that travels then returns
    // reads very differently from one that never moved.
    expect(sampler.snapshot().lastGateDistance).toBe(5);
  });

  /**
   * The origin is supposed to be a fixed point recorded at the press. Drift means it is following
   * the pointer, and Foundry's 10px gate can then never open however far you drag.
   */
  it('measures origin drift against the FIRST origin it saw, not the previous one', () => {
    const sampler = new DragSampler();
    sampler.beginDrag(grab);

    sampler.sample({ foundryOrigin: { x: 0, y: 0 } });
    sampler.sample({ foundryOrigin: { x: 3, y: 4 } });
    sampler.sample({ foundryOrigin: { x: 6, y: 8 } });

    // 10 from the first, not 5 from the second. Cumulative drift is the question.
    expect(sampler.snapshot().originDrift).toEqual({ sampled: true, peak: 10, samples: 3 });
  });

  it('reports a pinned origin as zero drift, sampled', () => {
    const sampler = new DragSampler();
    sampler.beginDrag(grab);

    sampler.sample({ foundryOrigin: { x: 50, y: 50 } });
    sampler.sample({ foundryOrigin: { x: 50, y: 50 } });

    expect(sampler.snapshot().originDrift).toEqual({ sampled: true, peak: 0, samples: 2 });
  });

  /**
   * ⚠️ The distinction that matters most. A drag origin that is never readable and one that is
   * readable and pinned both produce a peak of zero, and they mean opposite things.
   */
  it('tells an unmeasured zero apart from a measured one', () => {
    const never = new DragSampler();
    never.beginDrag(grab);
    never.sample({ pixiPointer: { x: 1, y: 1 } });

    const pinned = new DragSampler();
    pinned.beginDrag(grab);
    pinned.sample({ foundryOrigin: { x: 0, y: 0 }, pixiPointer: { x: 0, y: 0 } });

    expect(never.snapshot().dragGate.peak).toBe(0);
    expect(never.snapshot().dragGate.sampled).toBe(false);

    expect(pinned.snapshot().dragGate.peak).toBe(0);
    expect(pinned.snapshot().dragGate.sampled).toBe(true);
  });

  it('measures how far PIXI is from our own pointer', () => {
    const sampler = new DragSampler();
    sampler.beginDrag(grab);

    sampler.sample({ pixiPointer: { x: 10, y: 0 }, ourPointer: { clientX: 0, clientY: 0 } });

    expect(sampler.snapshot().divergence).toEqual({ sampled: true, peak: 10, samples: 1 });
  });

  /** Our travel from our own grab point, the one distance Foundry cannot confound. */
  it('measures our travel from the grab point', () => {
    const sampler = new DragSampler();
    sampler.beginDrag(grab);

    sampler.sample({ ourPointer: { clientX: 130, clientY: 140 } });

    expect(sampler.snapshot().travel).toEqual({ recorded: true, peak: 50 });
  });

  it('reports travel as unrecorded when no drag has begun', () => {
    expect(new DragSampler().snapshot().travel.recorded).toBe(false);
  });

  it('keeps the peak state and preview count, not the latest', () => {
    const sampler = new DragSampler();
    sampler.beginDrag(grab);

    sampler.sample({ interactionState: 4, previewCount: 1 });
    sampler.sample({ interactionState: 0, previewCount: 0 });

    expect(sampler.snapshot().peakInteractionState).toBe(4);
    expect(sampler.snapshot().peakPreviewCount).toBe(1);
  });

  it('counts dispatched moves as the denominator for every sample count', () => {
    const sampler = new DragSampler();
    sampler.beginDrag(grab);

    sampler.countMove();
    sampler.countMove();
    sampler.sample({ foundryOrigin: { x: 0, y: 0 }, pixiPointer: { x: 1, y: 0 } });

    const snapshot = sampler.snapshot();
    // 1 sample against 2 moves is what tells a reader the gate reading covers almost nothing.
    expect(snapshot.movesDispatched).toBe(2);
    expect(snapshot.dragGate.samples).toBe(1);
  });

  /**
   * A new grab must not inherit the last one's peaks, which is how a report came to describe a tap
   * it was never asked about.
   */
  it('forgets everything when a new drag begins', () => {
    const sampler = new DragSampler();
    sampler.beginDrag(grab);
    sampler.countMove();
    sampler.sample({
      interactionState: 4,
      foundryOrigin: { x: 0, y: 0 },
      pixiPointer: { x: 99, y: 0 },
    });

    sampler.beginDrag({ clientX: 0, clientY: 0 });

    const snapshot = sampler.snapshot();
    expect(snapshot.peakInteractionState).toBe(0);
    expect(snapshot.movesDispatched).toBe(0);
    expect(snapshot.dragGate.sampled).toBe(false);
    expect(Number.isNaN(snapshot.lastGateDistance)).toBe(true);
  });

  it('ignores a non finite reading rather than letting it become the peak', () => {
    const sampler = new DragSampler();
    sampler.beginDrag(grab);

    sampler.sample({ foundryOrigin: { x: 0, y: 0 }, pixiPointer: { x: 10, y: 0 } });
    sampler.sample({ foundryOrigin: { x: Number.NaN, y: 0 }, pixiPointer: { x: 0, y: 0 } });

    // Still counted as a sample, because it was looked at, but NaN never displaces a real peak.
    expect(sampler.snapshot().dragGate.peak).toBe(10);
    expect(sampler.snapshot().dragGate.samples).toBe(2);
  });
});
