import { DispatchTrace } from './DispatchTrace.js';
import { DragCaptureWindow } from './DragCaptureWindow.js';
import { DragSampler } from './DragSampler.js';
import { readInteractionSample, type InteractionGlobals } from './InteractionSample.js';
import { describeGrabTarget } from './FoundryProbes.js';
import { describeTokenMovement as describeMovement } from './TokenMovement.js';
import type { DragObservers } from './DragObservers.js';

/**
 * Watching one drag as it happens. Extracted from DragDiagnostics 2026-08-12.
 *
 * ⚠️ Recording and REPORTING are separate on purpose, and the separation is the lesson of this whole
 * investigation. Foundry resets its interaction state the moment a gesture ends, so anything read
 * when the report is written describes the aftermath: the manager says NONE whether the drag never
 * started or ran perfectly and committed. Everything worth knowing has to be captured DURING the
 * gesture, which is what this does, and the reporter only ever reads what this already caught.
 */
export interface DragRecorderPort {
  readonly window: Window;
  readonly isDragging: () => boolean;
  readonly pointerPosition: () => { clientX: number; clientY: number };
  readonly observers: DragObservers;
}

export class DragRecorder {
  public constructor(private readonly options: DragRecorderPort) {}

  /**
   * Every dispatched event, with the one field that decides whether a drag is a drag.
   *
   * `buttons` is the whole story: it has to stay non zero on every move between the down and the up,
   * or Foundry reads the stream as a hover and nothing follows the pointer. Seeing
   * `pointermove buttons=0` in this list while a grab is held would name the bug outright.
   *
   * A ring buffer rather than a growing list, because this records every single dispatch for the
   * whole session and a leak in a diagnostic is a poor trade for information nobody has asked for.
   */
  public readonly trace = new DispatchTrace();

  /** Every peak in the report, each paired with the count of samples behind it. */
  public readonly sampler = new DragSampler();

  /** When the drag record is open, frozen or retired. See debug/DragCaptureWindow.ts. */
  public readonly captureWindow = new DragCaptureWindow();

  /** Where the token was when the grab began. Whether it was released lives in the capture window. */
  public tokenAtGrab: { x: number; y: number } | null = null;

  /**
   * Was the pointer actually ON the controlled token at the moment of the grab?
   *
   * ⚠️ The question every unsuccessful drag turns out to hinge on. Foundry starts an interaction from
   * a pointerdown that HITS a placeable; a press on empty canvas starts a selection rectangle
   * instead, records no drag origin, and produces a report full of measurements that are all
   * individually correct and collectively describe nothing.
   *
   * Measured on a device 2026-08-11: token at (2900, 2200), pointer at canvas (3083, 2152), peak
   * interaction state HOVER, no origin ever recorded. The drag was fine; the grab simply began next
   * to the token rather than on it.
   */
  public grabbedOnToken: string | null = null;

  /** Raw touch input reaching the gesture layer, counted by type. Never reset, so it is cumulative. */
  public readonly gestureInputCounts: Record<string, number> = {};

  /**
   * Count the raw touch input as well as the events emitted from it.
   *
   * ⚠️ A trace showing no pointermove has two completely different causes: the finger produced no
   * gesture input, or it did and the gesture layer chose not to move the pointer. Counting
   * touchmoves separates them, and nothing else in the report can.
   */
  public countGestureInput(type: string): void {
    this.gestureInputCounts[type] = (this.gestureInputCounts[type] ?? 0) + 1;
  }

  public recordDispatch(
    descriptor: { type: string; buttons?: number; position?: { clientX: number; clientY: number } },
    target: Element
  ): void {
    this.options.observers.attach();

    /*
     * When the record opens, freezes and retires now lives in debug/DragCaptureWindow.ts, where the
     * ordering rules can be fed sequences and asserted on. Every one of them was learned from a
     * device report that described the wrong moment.
     */
    const verdict = this.captureWindow.observe(this.options.isDragging(), descriptor.type);

    if (verdict.kind === 'frozen') {
      return;
    }
    if (verdict.kind === 'retired' || verdict.kind === 'restart') {
      this.trace.clear();
      if (verdict.kind === 'retired') {
        return;
      }
    }
    if (verdict.kind === 'opened') {
      this.beginDragRecord();
    }

    /*
     * ⚠️ The move counter sits AFTER the freeze, and that position is a fix rather than a tidy-up.
     *
     * This is the denominator for every sample count in the report: moves we sent, against samples
     * each probe got, and `describeThinly` refuses to state a peak sampled under 10% of them. Below
     * the freeze it kept counting after the drop, and on a phone the pointer keeps moving for as long
     * as it takes to read the report, so the count ran away and every probe was declared thin.
     */
    if (this.captureWindow.isCapturing() && descriptor.type === 'pointermove') {
      this.sampler.countMove();
    }

    /*
     * Sampled AS IT HAPPENS rather than read when the report is written. Foundry resets the manager
     * to NONE the moment an interaction ends, so a reading taken afterwards says NONE whether the
     * drag never started or ran perfectly and committed. See debug/InteractionSample.ts.
     */
    const sample = readInteractionSample(globalThis as InteractionGlobals);

    // All the arithmetic lives in DragSampler, which pairs every peak with its sample count.
    this.sampler.sample({ ...sample, ourPointer: descriptor.position });

    /*
     * Coordinates are in the trace because they are now the question.
     *
     * Foundry measured a movement distance of exactly 0.0px across eleven moves, so from PIXI's point
     * of view the pointer never moved. Either every event we dispatch carries the same clientX and
     * clientY, which is our bug, or they change and PIXI is not mapping them, which is not. The trace
     * recorded type, buttons and target, which is everything except the field that decides it.
     */
    this.trace.record(descriptor, `${target.tagName.toLowerCase()}#${target.id}`);
  }

  /**
   * Everything a fresh drag record starts from.
   *
   * ⚠️ The token position is the point of this. Every other field answers a question about EVENTS;
   * comparing this against the position now says outright whether the gesture achieved anything,
   * which is the only thing anyone actually cares about.
   */
  private beginDragRecord(): void {
    this.trace.clear();
    this.options.observers.beginDrag(`${String(window.innerWidth)}x${String(window.innerHeight)}`);
    const grabPosition = this.options.pointerPosition();
    this.sampler.beginDrag({ clientX: grabPosition.clientX, clientY: grabPosition.clientY });

    const grabbed = (
      globalThis as {
        canvas?: { tokens?: { controlled?: { document?: { x?: number; y?: number } }[] } };
      }
    ).canvas?.tokens?.controlled?.[0]?.document;
    this.tokenAtGrab =
      grabbed?.x === undefined || grabbed.y === undefined ? null : { x: grabbed.x, y: grabbed.y };
    this.grabbedOnToken = describeGrabTarget();
  }

  /** Where the token was at the grab, against where it is now. See debug/TokenMovement.ts. */
  public describeTokenMovement(): string {
    const now = (
      globalThis as {
        canvas?: { tokens?: { controlled?: { document?: { x?: number; y?: number } }[] } };
      }
    ).canvas?.tokens?.controlled?.[0]?.document;
    return describeMovement(this.tokenAtGrab, now);
  }
}
