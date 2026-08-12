import { buildDiagnosticsReport } from './DiagnosticsReport.js';
import { deliverDiagnostics } from './DiagnosticsDelivery.js';
import { DragRecorder } from './DragRecorder.js';
import { readChatTargets, type ChatGlobals } from './ChatTargets.js';
import { readFoundryFacts, type FoundryGlobals } from './FoundryFacts.js';
import { DebugJournal } from './DebugJournal.js';
import { DragObservers } from './DragObservers.js';
import {
  describeControlledToken,
  describeScenePoint,
  isPointerInsideToken,
} from './TokenHitTest.js';
import {
  describeDragPermissions,
  describeInteractionState,
  describePointers,
} from './FoundryProbes.js';
import { logger } from '../core/Logger.js';
import { MODULE_ID } from '../constants.js';

/** Stamped in by the bundler, so a device report can say which build produced it. */
declare const __TB_BUILD_VERSION__: string;

/**
 * Everything the module measures about a drag, and the report it whispers. Extracted from
 * TongsBrowser 2026-08-12.
 *
 * ⚠️ Gathered here rather than spread through the composition root because a diagnostic is only worth
 * anything if it describes ONE moment. Five separate defects this session came from fields read at
 * different times, and keeping the readings in one class is what makes that rule checkable at a
 * glance rather than remembered at each call site.
 */
export interface DragDiagnosticsPort {
  readonly document: Document;
  readonly window: Window;
  readonly isDragging: () => boolean;
  readonly pointerPosition: () => { clientX: number; clientY: number };
  readonly keyboardStrategy: () => string;
  readonly isEnabled: () => boolean;
}

export class DragDiagnostics {
  /** The listeners that watch a drag happen. See debug/DragObservers.ts. */
  private readonly observers: DragObservers;

  /** Watching one drag as it happens. See debug/DragRecorder.ts. */
  private readonly record: DragRecorder;

  /**
   * The timeline of causes and effects. See debug/DebugJournal.ts.
   *
   * ⚠️ Public, because the things worth recording are mostly NOT in this class. A tray button press
   * is the single most useful entry in the whole report and it happens in the UI layer, which is
   * exactly why four rounds of self contained diagnostics never captured one.
   */
  public readonly journal = new DebugJournal({ now: () => Date.now() });

  /** A control the user touched. The one class of entry a snapshot can never reconstruct. */
  public recordUi(detail: string): void {
    this.journal.record('ui', detail);
  }

  /** Every dispatched event goes through the recorder, which decides what is worth keeping. */
  public recordDispatch(
    descriptor: { type: string; buttons?: number; position?: { clientX: number; clientY: number } },
    target: Element
  ): void {
    this.record.recordDispatch(descriptor, target);
    this.journal.record('dispatch', descriptor.type);
  }

  public countGestureInput(type: string): void {
    this.record.countGestureInput(type);
    this.journal.record('gesture', type);
  }

  public constructor(private readonly options: DragDiagnosticsPort) {
    this.observers = new DragObservers({
      window: options.window,
      isCapturing: () => this.record.captureWindow.isCapturing(),
      onObservation: (note) => {
        this.journal.record('foundry', note);
      },
    });
    this.record = new DragRecorder({
      window: options.window,
      isDragging: options.isDragging,
      pointerPosition: options.pointerPosition,
      observers: this.observers,
    });
  }

  /**
   * Whisper a diagnostic report into chat.
   *
   * Written 2026-08-11 because a drag failure on a real phone could not be reproduced on any surface
   * available here: it works on desktop through the full gesture layer, and the emulator's Chromium
   * 133 cannot hit test canvas objects from synthetic events at all, so it can neither confirm nor
   * deny anything. Three rounds of plausible hypotheses were each disproven by measurement, which is
   * the point at which guessing should stop and the device should be asked directly.
   *
   * Chat rather than the console, deliberately. It is the one output surface a phone user already
   * has open and can screenshot, and getting at devtools on Android needs a cable and a laptop.
   *
   * Whispered to self so it never lands in front of players mid session.
   */
  public whisperDiagnostics(): void {
    const facts = readFoundryFacts(globalThis as FoundryGlobals, MODULE_ID);
    if (facts === null) {
      return;
    }

    const position = this.options.pointerPosition();
    const under = this.options.document.elementFromPoint(position.clientX, position.clientY);

    const sampled = this.record.sampler.snapshot();
    /*
     * ⚠️ Read ONCE, as one object. The listeners behind these numbers fire continuously while the
     * pointer moves, which it may well still be doing as the report is assembled, so separate reads
     * put separate fields at separate moments and the report can disagree with itself about a single
     * gesture. `DragObservers.snapshot` is the single read.
     */
    const observed = this.observers.snapshot();

    const lines = buildDiagnosticsReport({
      build: __TB_BUILD_VERSION__,
      tokenMovement: this.record.describeTokenMovement(),
      releasedDuringDrag: this.record.captureWindow.hasSeenDrop(),
      grabbedOnToken: this.record.grabbedOnToken,
      pointerTravel: sampled.travel,
      movesDispatched: sampled.movesDispatched,
      originDrift: sampled.originDrift,
      dragGate: sampled.dragGate,
      divergence: sampled.divergence,
      peakInteractionState: sampled.peakInteractionState,
      peakPreviewCount: sampled.peakPreviewCount,
      viewport: {
        atGrab: observed.viewportAtGrab,
        now: `${String(window.innerWidth)}x${String(window.innerHeight)}`,
        resizes: observed.resizes,
      },
      dragEndings: observed.dragEndings,
      journal: this.journal.getEntries(),
      hooksInstalled: observed.hooksInstalled,
      moves: {
        token: observed.counts.token,
        layer: observed.counts.layer,
        stage: observed.counts.stage,
      },
      lastGateDistance: sampled.lastGateDistance,
      pointerComparison: describePointers(),
      touchCounts: this.record.gestureInputCounts,
      manifestVersion: facts.manifestVersion,
      enabled: this.options.isEnabled(),
      isGm: facts.isGm,
      paused: facts.paused,
      activeTool: facts.activeTool,
      controlledToken: describeControlledToken(facts.selected),
      canDrag: facts.canDrag,
      pointer: {
        x: position.clientX,
        y: position.clientY,
        dragging: this.options.isDragging(),
      },
      elementUnderPointer:
        under === null ? 'nothing' : `${under.tagName.toLowerCase()}#${under.id}`,
      pixiMousePosition: describeScenePoint(facts.mouse),
      insideSelectedToken: isPointerInsideToken(facts.mouse, facts.selected),
      canvasReady: facts.canvasReady,
      keyboardStrategy: this.options.keyboardStrategy(),
      interactionStateNow: `${describeInteractionState(facts.selected)} | ${describeDragPermissions(facts.selected)}`,
      probeAttached: observed.counts.attached,
      userAgent: navigator.userAgent,
      recentDispatches: this.record.trace.getLines(),
    });

    const targets = readChatTargets(globalThis as ChatGlobals);
    deliverDiagnostics(lines, {
      document: this.options.document,
      createChatMessage: targets.createChatMessage,
      userId: facts.userId,
      notify: targets.notify,
      fallback: (text) => {
        logger.warn(text);
      },
    });
  }
}
