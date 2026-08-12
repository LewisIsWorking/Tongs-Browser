import { Peak } from './Peak.js';
import type { DragSample, DragSnapshot, Point } from './DragMeasurements.js';

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

// Re-exported so every existing importer of DragSampler keeps working unchanged.
export type { DragSample, DragSnapshot, Point };

export class DragSampler {
  /** Highest Foundry interaction state seen during the current gesture. */
  private peakInteractionState = 0;

  /** Most drag preview objects seen during the current gesture. Non zero means a drag really began. */
  private peakPreviewCount = 0;
  private movesDispatched = 0;
  private lastGateDistance = Number.NaN;

  /**
   * The distance Foundry itself gates the drag on. Must reach 10 or no drag ever starts.
   *
   * ⚠️ `peakDragDistance` starts at 0 and is only ever written when BOTH Foundry's `screenOrigin`
   * and PIXI's pointer are readable. When they are not, it keeps its initial 0 and the report
   * printed "peak distance 0.0px, needs >= 10" beside it, which reads as a measurement saying the
   * pointer never travelled. It measured nothing at all. `sampledDragDistance` records whether the
   * computation ever ran, so the report can say "not measurable" rather than invent a zero.
   */
  private readonly gate = new Peak();
  /**
   * How far OUR pointer got from PIXI's, at their furthest apart during the drag.
   *
   * This is the measurement that splits the remaining problem, and a device forced it. Foundry gates
   * the drag on PIXI's pointer, never on ours, and `canvas.mousePosition` is derived from PIXI's too.
   * So if PIXI is not tracking the events we dispatch, every position in this report except our own
   * describes something else entirely, and it does so silently: a report saying the pointer is not
   * inside the token is perfectly true about PIXI's pointer and says nothing about ours.
   *
   * Measured on desktop Chrome the two agree, which is why every check passes there. A device
   * reported Foundry's gate distance as exactly 0.0 across a whole gesture while our own trace showed
   * the pointer moving, and those two facts can only both be true if PIXI never saw the moves.
   *
   * Sampled during the drag rather than at report time, because by report time the user has tapped a
   * button and PIXI's pointer is on that button.
   */
  private readonly divergence = new Peak();
  /**
   * How far Foundry's OWN recorded drag origin moved during the drag. It is supposed to move zero.
   *
   * A device's three numbers say this already by arithmetic: our pointer travelled 139px, PIXI's
   * pointer was 0px from ours, and Foundry's gate `|pixi - screenOrigin|` was 0px, so screenOrigin
   * must have travelled 139px too. An origin that follows the pointer can never be 10px away from
   * it, which is why that device sits at GRABBED forever and no drag ever begins.
   *
   * Measured directly rather than inferred, because a three step inference is exactly the kind of
   * reasoning that has been wrong twice already in this investigation, and because a direct number
   * is what would be worth reporting upstream. Measured on desktop and under emulated touch, a
   * mobile user agent and dpr 3, screenOrigin is PINNED: 800 across twelve steps, 683 across twelve
   * more. So this is not something the module does to it in the ordinary case.
   */
  private readonly originDrift = new Peak();
  /**
   * How far OUR pointer got from where the grab started, measured only against ourselves.
   *
   * ⚠️ This is the measurement three device reports needed and none of them had, and its absence is
   * why they were unreadable. Every distance in the report was computed against something Foundry
   * owns, so when Foundry's numbers came back as zeros there was no way to tell which of two
   * completely different bugs was in front of us:
   *
   *   1. the pointer travelled 200px and Foundry's drag origin FOLLOWED it, so its gate can never
   *      open, or
   *   2. the pointer only ever travelled 8px, Foundry is entirely correct to refuse, and the
   *      complaint is about how far a finger has to travel to move the pointer.
   *
   * Both produce `gate distance 0.0` and both produce a token that does not move. They have nothing
   * else in common and the fixes share no code. Measuring our own travel against our own grab point
   * touches no Foundry state at all, so it cannot be confounded by whatever Foundry is doing.
   */
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
