import type { SampledPeak } from './DiagnosticsReport.js';

/**
 * The measurements taken during one drag. Extracted from TongsBrowser 2026-08-12.
 *
 * Every field here is a peak with a sample count beside it, and that pairing is the whole design.
 * A peak alone is not a measurement over a gesture, it is a measurement over however many samples it
 * happened to get, and those are the same thing only when the sampling covers the gesture. This
 * report stated a peak of `0.0px` as fact three separate times when it had two samples out of two
 * hundred, and each time it sent the investigation somewhere it did not need to go.
 *
 * So nothing here exposes a bare number. Every reading leaves with its count attached.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface DragSample {
  readonly interactionState?: number | undefined;
  readonly previewCount?: number | undefined;
  /** Foundry's recorded drag origin, in screen space, or undefined when it is not readable. */
  readonly foundryOrigin?: Point | undefined;
  /** PIXI's own pointer, which is what Foundry measures its drag gate against. */
  readonly pixiPointer?: Point | undefined;
  /** Where our virtual pointer is, which is the only position Foundry cannot confound. */
  readonly ourPointer?: { readonly clientX: number; readonly clientY: number } | undefined;
}

export interface DragSnapshot {
  readonly peakInteractionState: number;
  readonly peakPreviewCount: number;
  readonly movesDispatched: number;
  readonly originDrift: SampledPeak;
  readonly dragGate: SampledPeak;
  readonly divergence: SampledPeak;
  readonly lastGateDistance: number;
  readonly travel: { readonly recorded: boolean; readonly peak: number };
}

/** A peak that also remembers how often it was looked at. */
class Peak {
  private value = 0;
  private count = 0;

  public add(reading: number): void {
    this.count += 1;
    if (Number.isFinite(reading) && reading > this.value) {
      this.value = reading;
    }
  }

  public reset(): void {
    this.value = 0;
    this.count = 0;
  }

  public read(): SampledPeak {
    return { sampled: this.count > 0, peak: this.value, samples: this.count };
  }
}

export class DragSampler {
  private peakInteractionState = 0;
  private peakPreviewCount = 0;
  private movesDispatched = 0;
  private lastGateDistance = Number.NaN;

  private readonly gate = new Peak();
  private readonly divergence = new Peak();
  private readonly originDrift = new Peak();
  private readonly travel = new Peak();

  private originAtStart: Point | null = null;
  private pointerAtGrab: { clientX: number; clientY: number } | null = null;

  /**
   * Start a fresh window, which happens when a drag BEGINS rather than on every press.
   *
   * ⚠️ Resetting on every pointerdown looked obviously right and destroyed the evidence every time:
   * a single tap after a drag wiped the whole drag out, so a report came back describing the tap it
   * was not asked about. The window opens at the grab and stays open until the next one.
   */
  public beginDrag(pointerAtGrab: { clientX: number; clientY: number }): void {
    this.peakInteractionState = 0;
    this.peakPreviewCount = 0;
    this.movesDispatched = 0;
    this.lastGateDistance = Number.NaN;
    this.gate.reset();
    this.divergence.reset();
    this.originDrift.reset();
    this.travel.reset();
    this.originAtStart = null;
    this.pointerAtGrab = pointerAtGrab;
  }

  /** One dispatched move, which is the denominator every sample count is judged against. */
  public countMove(): void {
    this.movesDispatched += 1;
  }

  public sample(reading: DragSample): void {
    if (typeof reading.interactionState === 'number') {
      this.peakInteractionState = Math.max(this.peakInteractionState, reading.interactionState);
    }
    if (typeof reading.previewCount === 'number') {
      this.peakPreviewCount = Math.max(this.peakPreviewCount, reading.previewCount);
    }

    /*
     * Foundry's drag origin against its own first recorded value. Anything but zero means the origin
     * is following the pointer, and Foundry's 10px gate can then never open however far you drag.
     */
    if (reading.foundryOrigin !== undefined) {
      this.originAtStart ??= reading.foundryOrigin;
      this.originDrift.add(
        Math.hypot(
          reading.foundryOrigin.x - this.originAtStart.x,
          reading.foundryOrigin.y - this.originAtStart.y
        )
      );
    }

    /*
     * Exactly the number Foundry gates the drag on: `hypot(event.global - screenOrigin) >= 10`,
     * measured against PIXI's pointer because that is what Foundry reads, not ours.
     */
    if (reading.foundryOrigin !== undefined && reading.pixiPointer !== undefined) {
      const distance = Math.hypot(
        reading.pixiPointer.x - reading.foundryOrigin.x,
        reading.pixiPointer.y - reading.foundryOrigin.y
      );
      this.lastGateDistance = distance;
      this.gate.add(distance);
    }

    /*
     * Ours against PIXI's. Foundry gates on PIXI's pointer and derives canvas.mousePosition from it,
     * so if these disagree then every Foundry position in the report describes a different pointer
     * while reading as though it described ours.
     */
    if (reading.pixiPointer !== undefined && reading.ourPointer !== undefined) {
      this.divergence.add(
        Math.hypot(
          reading.pixiPointer.x - reading.ourPointer.clientX,
          reading.pixiPointer.y - reading.ourPointer.clientY
        )
      );
    }

    /*
     * Our own travel, against our own grab point. No Foundry state involved, on purpose: this is the
     * one distance that cannot be confounded by whatever Foundry is doing with its origin, and it is
     * what separates "the pointer barely moved" from "Foundry ignored a pointer that moved plenty".
     */
    if (this.pointerAtGrab !== null && reading.ourPointer !== undefined) {
      this.travel.add(
        Math.hypot(
          reading.ourPointer.clientX - this.pointerAtGrab.clientX,
          reading.ourPointer.clientY - this.pointerAtGrab.clientY
        )
      );
    }
  }

  public snapshot(): DragSnapshot {
    return {
      peakInteractionState: this.peakInteractionState,
      peakPreviewCount: this.peakPreviewCount,
      movesDispatched: this.movesDispatched,
      originDrift: this.originDrift.read(),
      dragGate: this.gate.read(),
      divergence: this.divergence.read(),
      lastGateDistance: this.lastGateDistance,
      travel: { recorded: this.pointerAtGrab !== null, peak: this.travel.read().peak },
    };
  }
}
