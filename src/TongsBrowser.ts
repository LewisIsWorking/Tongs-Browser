import { logger } from './core/Logger.js';
import { DispatchTrace } from './debug/DispatchTrace.js';
import { DragCaptureWindow } from './debug/DragCaptureWindow.js';
import { DragSampler } from './debug/DragSampler.js';
import { readFoundryFacts, type FoundryGlobals } from './debug/FoundryFacts.js';
import { availableWidthBesideSidebar } from './foundry/AvailableWidth.js';
import { readCanvasPivot, readCanvasScale, readZoomLimits } from './foundry/CanvasReaders.js';
import {
  describeControlledToken,
  describeScenePoint,
  isPointerInsideToken,
} from './debug/TokenHitTest.js';
import { PixiMoveProbe } from './debug/PixiMoveProbe.js';
import { deliverDiagnostics } from './debug/DiagnosticsDelivery.js';
import { buildDiagnosticsReport } from './debug/DiagnosticsReport.js';
import { installFoundryDragHooks } from './debug/FoundryDragHooks.js';
import { DebugOverlay } from './debug/DebugOverlay.js';
import {
  describeGrabTarget,
  describeInteractionState,
  describePointers,
} from './debug/FoundryProbes.js';
import { CanvasController, type CanvasLike } from './gesture/CanvasController.js';
import { ExclusionZones } from './gesture/ExclusionZones.js';
import { GestureController } from './gesture/GestureController.js';
import { TouchBinder } from './gesture/TouchBinder.js';
import type { GestureConfig } from './gesture/GestureTypes.js';
import { KeyboardSynthesizer, type KeyboardManagerLike } from './modifiers/KeyboardSynthesizer.js';
import { ModifierBar, type BarPosition, type TrayAction } from './modifiers/ModifierBar.js';
import { MODULE_ID } from './constants.js';
import {
  decideSidebarAction,
  popOutSidebarTab,
  toggleFoundrySidebar,
  type FoundryUi,
  type SidebarAccessOptions,
} from './foundry/SidebarAccess.js';
import { openCharacterSheet, type SheetOwner } from './foundry/CharacterSheet.js';
import {
  applyPause,
  decidePauseAction,
  isDesignatedGm,
  type FoundryGame,
  type GameAccess,
} from './foundry/PauseControl.js';
import { PauseRelay, type SocketLike } from './relay/PauseRelay.js';
import { CursorOverlay } from './pointer/CursorOverlay.js';
import { EventDispatcher } from './pointer/EventDispatcher.js';
import { HitTester } from './pointer/HitTester.js';
import { VirtualPointer } from './pointer/VirtualPointer.js';
import { UiScaler } from './scaling/UiScaler.js';
import { WindowClampBinder } from './scaling/WindowClampBinder.js';
import { buildTrayActions } from './ui/TrayActions.js';

/**
 * The macro the pause button looks for before falling back to Foundry's own toggle.
 *
 * A GM can create it and grant every player ownership, which is what was asked for. See togglePause
 * for why macro ownership alone still cannot let a player pause the whole world.
 */
const PAUSE_MACRO_NAME = 'Tongs Pause';

/** Stamped in at build time by Vite. See vite.config.ts for why the manifest version is not enough. */
declare const __TB_BUILD_VERSION__: string;

export interface TongsBrowserOptions {
  readonly document: Document;
  readonly window: Window;
  readonly gestureConfig?: Partial<GestureConfig>;
  readonly suppressNativeTouch?: () => boolean;
  readonly modifierBarEnabled?: boolean;
  readonly initialBarPosition?: BarPosition;
  readonly onBarPositionChanged?: (position: BarPosition) => void;
  readonly uiScale?: number;
  readonly cursorSize?: number;
  readonly debugOverlay?: boolean;
}

/**
 * Composition root.
 *
 * Everything else in the module is built to be constructed with its dependencies handed to it, so
 * this is the one place that knows how the pieces fit together and the one place that reads
 * Foundry's globals. That keeps the Foundry coupling to a single file, which is what makes the rest
 * of the codebase testable and what will make a Foundry version bump a small change.
 */
export class TongsBrowser {
  private readonly cursor: CursorOverlay;
  private readonly pointer: VirtualPointer;
  private readonly gestures: GestureController;
  private readonly binder: TouchBinder;
  private readonly synthesizer: KeyboardSynthesizer;
  private readonly modifierBar: ModifierBar;
  private readonly scaler: UiScaler;
  private readonly clampBinder: WindowClampBinder;
  private readonly debug: DebugOverlay;
  private readonly pauseRelay: PauseRelay;
  private sidebarMenu: HTMLDivElement | null = null;
  private enabled = false;

  /**
   * The last few events actually put on the wire, for the diagnostics report.
   *
   * Every STATIC check can be healthy while a drag still does nothing, which is exactly what a real
   * device reported: select tool, _canDrag true, pointer inside the token, canvas ready, and no
   * movement. At that point the only thing left to look at is the event stream itself, and on a
   * phone there is no console to look at it in.
   *
   * A ring buffer rather than a growing list, because this records every single dispatch for the
   * whole session and a leak in a diagnostic is a poor trade for information nobody has asked for
   * yet.
   */
  private readonly trace = new DispatchTrace();

  /** Every peak in the report, each paired with the count of samples behind it. */
  private readonly sampler = new DragSampler();

  /** When the drag record is open, frozen or retired. See debug/DragCaptureWindow.ts. */
  private readonly captureWindow = new DragCaptureWindow();

  /** Highest Foundry interaction state seen during the current gesture. See recordDispatch. */

  /** Most drag preview objects seen during the current gesture. Non zero means a drag really began. */

  /**
   * How many pointermove events PIXI delivered to the token LAYER during this gesture.
   *
   * This is the measurement that separates the two remaining possibilities, and it exists because
   * Foundry's MouseInteractionManager binds the drag's move handler on `this.layer`, not on the
   * object and not on the DOM:
   *
   *     this.layer.on("pointermove", this.#handlers.pointermove)
   *
   * A device reported peaking at GRABBED, which proves pointerdown DID reach the token through PIXI,
   * so PIXI delivery works for the press. GRABBED advances to DRAG only when moves reach the layer.
   * Counting them says whether PIXI is delivering them at all, which is a completely different fix
   * from the layer receiving them and declining to act.
   */
  private readonly pixiProbe = new PixiMoveProbe(() => (globalThis as { canvas?: never }).canvas);

  /**
   * Moves delivered to the controlled TOKEN itself, which is the count that decides the drag.
   *
   * ⚠️ Foundry evaluates its 10px drag gate inside a handler bound on the OBJECT, and PIXI delivers
   * to an object only while the pointer is over it. So the gate is checked only while the pointer is
   * still standing on the token: if it has not opened by the time the pointer leaves, it never will.
   *
   * Every PIXI count in this report so far has been of the LAYER, which is a different object, and
   * it was read three times as though it answered this. A layer count stays perfectly healthy while
   * the token receives nothing at all.
   */

  /**
   * Which of Foundry's two drag endings actually ran: the DROP, or the CANCEL.
   *
   * ⚠️ The drag now reaches DRAG with a preview clone and the token still does not move, so the
   * failure has moved from the gate to the ending. Those are two different handlers on Foundry's
   * Token, and every number in this report is silent about which one fired:
   *
   *   _onDragLeftDrop   -> reads interactionData.clones and writes the new position
   *   _onDragLeftCancel -> destroys the preview and writes nothing
   *
   * They are indistinguishable from outside. Both leave the state reset, both leave no preview, and
   * both leave the token where it was if the drop refuses. Wrapping them is the only way to see it,
   * and it is done once and left in place because a diagnostic that has to be installed during the
   * bug is a diagnostic nobody has when the bug happens.
   */
  private dragEndings: string[] = [];
  private hooksInstalled = { token: false, manager: false };

  /**
   * Viewport resizes during the drag, and the size at the grab.
   *
   * The suspected cause of the redraws that cancel the interaction. On Android the URL bar slides in
   * and out as you gesture, and that resizes the viewport; Foundry redraws the canvas on resize, and
   * a redraw of a token cancels its interaction outright. A desktop window simply does not change
   * size mid drag, which would explain why every desktop run passes.
   *
   * Counted rather than argued about. If this is zero while the redraws are not, the hypothesis is
   * dead and the cause is something else entirely.
   */
  private resizesDuringDrag = 0;
  private viewportAtGrab = '';

  /**
   * The distance Foundry itself gates the drag on. Must reach 10 or no drag ever starts.
   *
   * ⚠️ `peakDragDistance` starts at 0 and is only ever written when BOTH Foundry's `screenOrigin`
   * and PIXI's pointer are readable. When they are not, it keeps its initial 0 and the report
   * printed "peak distance 0.0px, needs >= 10" beside it, which reads as a measurement saying the
   * pointer never travelled. It measured nothing at all. `sampledDragDistance` records whether the
   * computation ever ran, so the report can say "not measurable" rather than invent a zero.
   */

  /**
   * How many times each peak was actually sampled, reported beside it. Added 2026-08-11.
   *
   * ⚠️ A peak is not a measurement over a gesture, it is a measurement over however many samples it
   * happened to get, and those are only the same thing when the sampling covers the gesture. This
   * has now been the same mistake three times in one investigation: a bare `0.0` that had sampled
   * nothing at all, then a `0.0` peak that may have sampled only the first move, when the pointer was
   * still on top of its own origin and a distance of zero was the correct answer to a question
   * nobody wanted asked.
   *
   * Both readings look exactly like "the pointer never moved", and one of them was used to conclude
   * that Foundry's drag origin follows the pointer, which is a strong claim to build on a number
   * that might have one sample behind it.
   *
   * The count makes the difference visible without anyone having to suspect it: `0.0px over 47
   * samples` is evidence, `0.0px over 1 sample` is noise wearing the same clothes.
   */

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

  /** Raw touch input reaching the gesture layer, counted by type. Never reset, so it is cumulative. */
  private readonly gestureInputCounts: Record<string, number> = {};

  /** Where the token was when the grab began. Whether it was released lives in the capture window. */
  private tokenAtGrab: { x: number; y: number } | null = null;

  /**
   * Was the pointer actually ON the controlled token at the moment of the grab?
   *
   * ⚠️ The question every unsuccessful drag turns out to hinge on, and the report has never answered
   * it. Foundry starts an interaction from a pointerdown that HITS a placeable; a press on empty
   * canvas starts a selection rectangle instead, records no drag origin, and produces a report full
   * of measurements that are all individually correct and collectively describe nothing.
   *
   * Measured on a device 2026-08-11: token at (2900, 2200), pointer at canvas (3083, 2152), peak
   * interaction state HOVER, no origin ever recorded. The drag was fine; the grab simply began next
   * to the token rather than on it. Nothing in the report said so, and the previous line for it,
   * `insideSelectedToken`, is read at REPORT time, long after the pointer has moved on and been used
   * to tap the diagnose button.
   */
  private grabbedOnToken: string | null = null;

  public constructor(private readonly options: TongsBrowserOptions) {
    const { document: doc, window: win } = options;

    this.debug = new DebugOverlay({ document: doc, logger });
    this.bindResizeCounter();

    this.cursor = new CursorOverlay({
      document: doc,
      ...(options.cursorSize === undefined ? {} : { size: options.cursorSize }),
    });

    /*
     * No getTransform here, deliberately, even though the interface is scaled.
     *
     * Browser hit testing is transform aware: elementFromPoint takes viewport coordinates and
     * accounts for CSS transforms itself, so the cursor and the hit test already agree at any
     * scale. Verified against Chromium rather than assumed. Feeding the UI scale in here would
     * convert coordinates that are already correct and break a case that currently works.
     */
    const hitTester = new HitTester({
      // Bound to the document rather than passed as a reference, because elementFromPoint throws
      // if it loses its receiver.
      elementFromPoint: (x, y) => doc.elementFromPoint(x, y),
      getViewport: () => ({ width: win.innerWidth, height: win.innerHeight }),
    });

    this.pointer = new VirtualPointer({
      hitTester,
      dispatcher: new EventDispatcher({
        view: win,
        onDispatch: (descriptor, target) => {
          this.debug.onDispatch(descriptor, target);
          this.recordDispatch(descriptor, target);
        },
      }),
      cursor: this.cursor,
      initialPosition: { clientX: win.innerWidth / 2, clientY: win.innerHeight / 2 },
    });

    const canvasController = new CanvasController({
      getCanvas: () => this.resolveCanvas(),
      getScale: () => this.resolveCanvasScale(),
      getPivot: () => this.resolveCanvasPivot(),
      getZoomLimits: () => this.resolveZoomLimits(),
      logger,
    });

    this.gestures = new GestureController({
      pointer: this.pointer,
      canvas: canvasController,
      ...(options.gestureConfig === undefined ? {} : { config: options.gestureConfig }),
      logger,
      vibrate: (durationMs) => {
        this.vibrate(durationMs);
      },
    });

    this.synthesizer = new KeyboardSynthesizer({
      document: doc,
      getKeyboardManager: () => this.resolveKeyboardManager(),
      logger,
    });

    this.modifierBar = new ModifierBar({
      document: doc,
      synthesizer: this.synthesizer,
      // Held modifiers must reach the pointer too. Foundry reads its own keyboard state for some
      // decisions and the event flags for others, so both paths have to agree.
      onFlagsChanged: (flags) => {
        this.pointer.setModifiers(flags);
      },
      ...(options.initialBarPosition === undefined
        ? {}
        : { initialPosition: options.initialBarPosition }),
      ...(options.onBarPositionChanged === undefined
        ? {}
        : { onPositionChanged: options.onBarPositionChanged }),
      getAvailableWidth: () => this.resolveAvailableWidth(),
      trayActions: this.buildTrayActions(canvasController),
    });

    this.scaler = new UiScaler({
      document: doc,
      ...(options.uiScale === undefined ? {} : { initialScale: options.uiScale }),
    });

    this.clampBinder = new WindowClampBinder({ document: doc, window: win, logger });

    /*
     * Resolved lazily on every call rather than captured now. The socket, the user list and who
     * counts as the designated GM all change during a session, and a GM disconnecting mid game is
     * exactly when the relay has to still pick the right client.
     */
    this.pauseRelay = new PauseRelay({
      get socket(): SocketLike | null {
        return (globalThis as { game?: { socket?: SocketLike } }).game?.socket ?? null;
      },
      channel: `module.${MODULE_ID}`,
      isDesignatedGm: () => this.isDesignatedGm(),
      applyPause: (pause) => {
        this.applyPause(pause);
      },
      getPaused: () => (globalThis as { game?: { paused?: boolean } }).game?.paused === true,
      logger,
    });

    this.binder = new TouchBinder({
      target: doc,
      exclusions: new ExclusionZones(),
      onInput: (input) => {
        /*
         * Count the raw touch input as well as the events we emit from it.
         *
         * A trace showing no pointermove has two completely different causes: the finger produced no
         * gesture input, or it did and the gesture layer chose not to move the pointer. Counting
         * touchmoves separates them, and nothing else in the report can.
         */
        this.gestureInputCounts[input.type] = (this.gestureInputCounts[input.type] ?? 0) + 1;
        this.gestures.handleInput(input);
      },
      suppressNativeTouch: options.suppressNativeTouch ?? ((): boolean => true),
      now: () => Date.now(),
    });
  }

  /**
   * Count viewport resizes, always, so the count is already running when a drag starts.
   *
   * Bound once for the module's lifetime rather than per drag: a listener added at the grab would
   * miss a resize triggered by the grab itself, which is precisely the case under suspicion.
   */
  private bindResizeCounter(): void {
    this.options.window.addEventListener('resize', () => {
      if (this.captureWindow.isCapturing()) {
        this.resizesDuringDrag += 1;
      }
    });
  }

  public enable(): void {
    if (this.enabled) {
      return;
    }
    this.enabled = true;
    this.cursor.attach();
    this.binder.bind();
    this.scaler.apply();
    this.clampBinder.bind();
    // Bound even for a GM: this client may be the one that has to answer a player's request.
    this.pauseRelay.bind();
    this.debug.setEnabled(this.options.debugOverlay ?? false);

    if (this.options.modifierBarEnabled ?? true) {
      this.modifierBar.attach();
      // Probed after attaching, and only once, because the answer decides whether the bar can work
      // at all. A warning at this point is the earliest honest signal available.
      this.synthesizer.probe();
    }

    logger.info('Enabled.');
  }

  public disable(): void {
    if (!this.enabled) {
      return;
    }
    this.enabled = false;
    // Reset before unbinding, so an in progress drag is abandoned rather than left hanging with
    // Foundry still believing a button is held.
    this.gestures.reset();
    this.binder.unbind();
    // Detaching releases anything held, so Foundry is not left believing a modifier is down with no
    // visible control left to clear it.
    this.modifierBar.detach();
    this.cursor.detach();
    this.clampBinder.unbind();
    this.pauseRelay.unbind();
    this.closeSidebarMenu();
    this.debug.setEnabled(false);
    // Removes the property rather than setting it back to 1, so Foundry's own layout is restored
    // exactly and nothing is left behind.
    this.scaler.remove();
    logger.info('Disabled.');
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Bring the tray buttons in line with what they control.
   *
   * Public because the state changes without anyone touching this bar: another user pausing the
   * game, or a drag ending on its own. main.ts hooks Foundry's pauseGame and calls this.
   */
  public refreshTray(): void {
    this.modifierBar.refreshActions();
  }

  public updateGestureConfig(config: Partial<GestureConfig>): void {
    this.gestures.updateConfig(config);
  }

  public getPointer(): VirtualPointer {
    return this.pointer;
  }

  public getCursor(): CursorOverlay {
    return this.cursor;
  }

  public getModifierBar(): ModifierBar {
    return this.modifierBar;
  }

  public getScaler(): UiScaler {
    return this.scaler;
  }

  /** Rescales and re-clamps, since a scale change moves where every window sits. */
  public setUiScale(scale: number): void {
    this.scaler.setScale(scale);
    this.clampBinder.clampAll();
  }

  public setCursorSize(size: number): void {
    this.cursor.setSize(size);
  }

  public setDebugOverlay(enabled: boolean): void {
    this.debug.setEnabled(enabled);
  }

  /**
   * Shows or hides the modifier bar without tearing the whole module down.
   *
   * Hiding releases whatever was held, so Foundry is never left believing a modifier is down with
   * no visible control left to clear it.
   */
  public setModifierBarVisible(visible: boolean): void {
    if (visible) {
      this.modifierBar.attach();
      this.synthesizer.probe();
    } else {
      this.modifierBar.detach();
    }
  }

  /** Which strategy the keyboard probe settled on. Surfaced for diagnostics and the settings UI. */
  public getKeyboardStrategy(): string {
    return this.synthesizer.getStrategy();
  }

  private resolveKeyboardManager(): KeyboardManagerLike | null {
    if (typeof game === 'undefined') {
      return null;
    }
    return game.keyboard ?? null;
  }

  /**
   * The typeof guard is not redundant with the declared type. A global that Foundry has not defined
   * at all throws a ReferenceError on plain access, which typeof is the only way to survive.
   */
  private resolveCanvas(): CanvasLike | null {
    if (typeof canvas === 'undefined') {
      return null;
    }
    return canvas;
  }

  /**
   * How far the canvas is actually zoomed, straight from PIXI's root container.
   *
   * Read fresh on every pinch rather than cached. Foundry fits a scene to the viewport on load, and
   * the user can also zoom with the wheel or Foundry's own controls, so any remembered value is
   * wrong the moment something else touches it. Returning null when it cannot be read lets the
   * controller fall back rather than build a pinch on NaN.
   */
  private resolveCanvasScale(): number | null {
    return readCanvasScale(typeof canvas === 'undefined' ? undefined : canvas);
  }

  /**
   * The buttons on the bar, beyond the modifier keys.
   *
   * Asked for after testing on a real phone, and every one of them exists because a touch only
   * gesture proved unreliable or unreachable there. Arrows and zoom buttons give a way to navigate
   * that does not depend on getting a two finger gesture recognised at all, which matters because a
   * gesture that half works is worse than a button: you cannot tell whether you did it wrong.
   *
   * The pan step is in screen pixels and CanvasController converts it, so the map moves the same
   * visible distance at every zoom level. A step in scene units would crawl when zoomed out and
   * leap when zoomed in.
   */
  private buildTrayActions(canvasController: CanvasController): readonly TrayAction[] {
    return buildTrayActions({
      toggleSidebar: () => {
        this.toggleFoundrySidebar();
      },
      openCharacterSheet: () => {
        this.openCharacterSheet();
      },
      togglePause: () => {
        this.togglePause();
      },
      isPaused: () => (globalThis as { game?: { paused?: boolean } }).game?.paused === true,
      isDragging: () => this.pointer.isDragging(),
      beginDrag: () => {
        this.pointer.beginDrag();
      },
      endDrag: () => {
        this.pointer.endDrag();
      },
      whisperDiagnostics: () => {
        this.whisperDiagnostics();
      },
      zoomBy: (factor) => {
        canvasController.zoomBy(factor);
      },
      panBy: (deltaX, deltaY) => {
        canvasController.panBy(deltaX, deltaY);
      },
    });
  }

  /**
   * Keep the last few dispatched events, with the one field that decides whether a drag is a drag.
   *
   * `buttons` is the whole story for dragging: it has to stay non zero on every move between the
   * down and the up, or Foundry reads the stream as a hover and nothing follows the pointer. Seeing
   * `pointermove buttons=0` in this list while a grab is held would name the bug outright.
   */
  /**
   * Attach counters to PIXI's own layer and stage, once, lazily.
   *
   * Lazily because the canvas does not exist when the module is constructed, and once because these
   * are diagnostic listeners on objects Foundry owns: adding a set per gesture would leak them into
   * a scene change.
   */
  /**
   * Attach the PIXI move counters, retrying until the canvas and a controlled token exist.
   *
   * The counting lives in debug/PixiMoveProbe.ts, which was written and covered days before this
   * call site existed: the class was extracted and then never wired in, so the composition root
   * kept its own duplicate of the same logic. Two copies of a counter is two things to get subtly
   * wrong, and only one of them had tests.
   */
  private attachPixiProbe(): void {
    this.pixiProbe.attach();
    this.pixiProbe.attachToControlledToken();
  }

  /**
   * Install the Foundry observers, retrying until the canvas exists.
   *
   * The logic lives in debug/FoundryDragHooks.ts; this only supplies the prototypes and collects the
   * observations, which is all a composition root should be doing.
   */
  private hookDragEndings(): void {
    if (this.hooksInstalled.token && this.hooksInstalled.manager) {
      return;
    }
    const global = globalThis as {
      CONFIG?: { Token?: { objectClass?: { prototype?: Record<string, unknown> } } };
      canvas?: {
        tokens?: {
          controlled?: {
            mouseInteractionManager?: { constructor?: { prototype?: Record<string, unknown> } };
          }[];
        };
      };
    };

    this.hooksInstalled = installFoundryDragHooks({
      getTokenPrototype: () => global.CONFIG?.Token?.objectClass?.prototype,
      getManagerPrototype: () =>
        global.canvas?.tokens?.controlled?.[0]?.mouseInteractionManager?.constructor?.prototype,
      isRecording: () => this.captureWindow.isCapturing(),
      onObservation: (note) => this.dragEndings.push(note),
    });
  }

  private recordDispatch(
    descriptor: { type: string; buttons?: number; position?: { clientX: number; clientY: number } },
    target: Element
  ): void {
    this.attachPixiProbe();
    this.hookDragEndings();

    /*
     * When the record opens, freezes and retires now lives in debug/DragCaptureWindow.ts, where the
     * ordering rules can be fed sequences and asserted on. Every one of them was learned from a
     * device report that described the wrong moment.
     */
    const verdict = this.captureWindow.observe(this.pointer.isDragging(), descriptor.type);

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

    const controlled = (
      globalThis as {
        canvas?: { tokens?: { controlled?: unknown[]; preview?: { children?: unknown[] } } };
      }
    ).canvas?.tokens;
    const state = (
      controlled?.controlled?.[0] as { mouseInteractionManager?: { state?: number } } | undefined
    )?.mouseInteractionManager?.state;
    const previews = controlled?.preview?.children?.length ?? 0;

    /*
     * Foundry's recorded drag origin, and PIXI's own pointer, which is what Foundry measures its
     * drag gate against. Reading PIXI's rather than ours because `event.global` is what Foundry
     * actually uses, and the two disagreeing was itself a candidate for a long time.
     */
    const manager = (
      controlled?.controlled?.[0] as
        | {
            mouseInteractionManager?: {
              interactionData?: { screenOrigin?: { x: number; y: number } };
            };
          }
        | undefined
    )?.mouseInteractionManager;
    const pixiPointer = (
      globalThis as {
        canvas?: {
          app?: { renderer?: { events?: { pointer?: { global?: { x: number; y: number } } } } };
        };
      }
    ).canvas?.app?.renderer?.events?.pointer?.global;

    // All the arithmetic lives in DragSampler, which pairs every peak with its sample count.
    this.sampler.sample({
      interactionState: state,
      previewCount: previews,
      foundryOrigin: manager?.interactionData?.screenOrigin,
      pixiPointer,
      ourPointer: descriptor.position,
    });

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
    this.pixiProbe.resetCounts();
    this.dragEndings = [];
    this.resizesDuringDrag = 0;
    this.viewportAtGrab = `${String(window.innerWidth)}x${String(window.innerHeight)}`;
    const grabPosition = this.pointer.getPosition();
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

  /** Where the token was when the grab began, against where it is now. */
  private describeTokenMovement(): string {
    if (this.tokenAtGrab === null) {
      return 'no grab recorded yet';
    }
    const now = (
      globalThis as {
        canvas?: { tokens?: { controlled?: { document?: { x?: number; y?: number } }[] } };
      }
    ).canvas?.tokens?.controlled?.[0]?.document;
    if (now?.x === undefined || now.y === undefined) {
      return 'no token selected now';
    }
    const moved = now.x !== this.tokenAtGrab.x || now.y !== this.tokenAtGrab.y;
    return `${moved ? 'YES' : 'NO'} (${String(this.tokenAtGrab.x)},${String(this.tokenAtGrab.y)} -> ${String(now.x)},${String(now.y)})`;
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
  private whisperDiagnostics(): void {
    const facts = readFoundryFacts(globalThis as FoundryGlobals, MODULE_ID);
    if (facts === null) {
      return;
    }

    const position = this.pointer.getPosition();
    const under = this.options.document.elementFromPoint(position.clientX, position.clientY);

    const sampled = this.sampler.snapshot();

    const lines = buildDiagnosticsReport({
      build: __TB_BUILD_VERSION__,
      tokenMovement: this.describeTokenMovement(),
      releasedDuringDrag: this.captureWindow.hasSeenDrop(),
      grabbedOnToken: this.grabbedOnToken,
      pointerTravel: sampled.travel,
      movesDispatched: sampled.movesDispatched,
      originDrift: sampled.originDrift,
      dragGate: sampled.dragGate,
      divergence: sampled.divergence,
      peakInteractionState: sampled.peakInteractionState,
      peakPreviewCount: sampled.peakPreviewCount,
      viewport: {
        atGrab: this.viewportAtGrab,
        now: `${String(window.innerWidth)}x${String(window.innerHeight)}`,
        resizes: this.resizesDuringDrag,
      },
      dragEndings: this.dragEndings,
      hooksInstalled: this.hooksInstalled,
      moves: {
        token: this.pixiProbe.getCounts().token,
        layer: this.pixiProbe.getCounts().layer,
        stage: this.pixiProbe.getCounts().stage,
      },
      lastGateDistance: sampled.lastGateDistance,
      pointerComparison: describePointers(),
      touchCounts: this.gestureInputCounts,
      manifestVersion: facts.manifestVersion,
      enabled: this.enabled,
      isGm: facts.isGm,
      paused: facts.paused,
      activeTool: facts.activeTool,
      controlledToken: describeControlledToken(facts.selected),
      canDrag: facts.canDrag,
      pointer: {
        x: position.clientX,
        y: position.clientY,
        dragging: this.pointer.isDragging(),
      },
      elementUnderPointer:
        under === null ? 'nothing' : `${under.tagName.toLowerCase()}#${under.id}`,
      pixiMousePosition: describeScenePoint(facts.mouse),
      insideSelectedToken: isPointerInsideToken(facts.mouse, facts.selected),
      canvasReady: facts.canvasReady,
      keyboardStrategy: this.synthesizer.getStrategy(),
      interactionStateNow: describeInteractionState(facts.selected),
      probeAttached: this.pixiProbe.getCounts().attached,
      userAgent: navigator.userAgent,
      recentDispatches: this.trace.getLines(),
    });

    deliverDiagnostics(lines, {
      document: this.options.document,
      createChatMessage: (globalThis as { ChatMessage?: { create?: (data: unknown) => unknown } })
        .ChatMessage?.create,
      userId: facts.userId,
      notify: (globalThis as { ui?: { notifications?: { info?: (message: string) => void } } }).ui
        ?.notifications?.info,
      fallback: (text) => {
        logger.warn(text);
      },
    });
  }

  /**
   * Pause or unpause the game.
   *
   * A macro is tried FIRST, by name, exactly as asked for: a GM can write "Tongs Pause", give every
   * player ownership of it, and this button will run it. That keeps the behaviour in the world's
   * hands rather than hard coded here.
   *
   * ⚠️ Being straight about the limit, because it is not obvious and macro ownership looks like it
   * should solve it: a macro cannot give a player the ability to pause the WORLD. Foundry's
   * Game#togglePause only emits the socket message `if (options.broadcast && game.user.isGM)`, so a
   * player running any macro toggles their own client and nobody else's. The check is on the emit
   * path, not on macro permissions. Genuinely letting players pause needs a GM side relay, which is
   * a separate piece of work.
   *
   * So: macro if there is one, otherwise Foundry's own toggle, which broadcasts for a GM and is
   * local for everyone else.
   */
  private togglePause(): void {
    const action = decidePauseAction(this.gameAccess(), PAUSE_MACRO_NAME);
    if (action.kind === 'runMacro') {
      void action.execute();
      return;
    }
    if (action.kind === 'relay') {
      this.pauseRelay.request();
    }
  }

  /** Foundry's game object, injected rather than reached for, so the decisions stay testable. */
  private gameAccess(): GameAccess {
    return { getGame: () => (globalThis as { game?: FoundryGame }).game };
  }

  /**
   * A picker listing every sidebar tab, built from our own DOM.
   *
   * Foundry's own tab strip is 27px wide on a phone, which is what made the sidebar unreachable in
   * the first place, so reusing it to choose a tab would inherit exactly the problem being solved.
   * These are 44px rows in an element this module controls, marked with the ignore attribute so the
   * gesture layer routes taps straight to them rather than through the virtual pointer.
   */
  private openSidebarMenu(tabNames: readonly string[]): void {
    const doc = this.options.document;
    const menu = doc.createElement('div');
    menu.className = 'tb-sidebar-menu';
    menu.setAttribute('data-tongs-browser', 'ignore');

    for (const name of tabNames) {
      const item = doc.createElement('button');
      item.type = 'button';
      item.className = 'tb-sidebar-menu__item';
      item.dataset['tab'] = name;
      // Foundry's tab names are already lower case single words, so this is all the label needed.
      item.textContent = name.charAt(0).toUpperCase() + name.slice(1);
      item.addEventListener('click', () => {
        this.closeSidebarMenu();
        this.popOutSidebarTab(name);
      });
      menu.append(item);
    }

    doc.body.append(menu);
    this.sidebarMenu = menu;
  }

  private closeSidebarMenu(): void {
    this.sidebarMenu?.remove();
    this.sidebarMenu = null;
  }

  /** The tabs this user can open, and popping one out. Both live in foundry/SidebarAccess.ts. */
  private sidebarAccess(): SidebarAccessOptions {
    return {
      getUi: () => (globalThis as { ui?: FoundryUi }).ui,
      isGm: () =>
        (globalThis as { game?: { user?: { isGM?: boolean } } }).game?.user?.isGM === true,
    };
  }

  private popOutSidebarTab(name: string): void {
    popOutSidebarTab(this.sidebarAccess(), name);
  }

  /**
   * Whether this client is the ONE GM that should act on a relayed request.
   *
   * `game.users.activeGM` is Foundry's own designated user: it picks the same single GM on every
   * client, deterministically. Using "am I a GM" instead would have every connected GM answer the
   * same request, flipping the pause state once per GM and landing wherever the race ended.
   */
  private isDesignatedGm(): boolean {
    return isDesignatedGm(this.gameAccess());
  }

  private applyPause(pause: boolean): void {
    applyPause(this.gameAccess(), pause);
  }

  /**
   * Open the sheet for whichever actor this user is playing.
   *
   * Three sources, in the order that matches what someone means by "my character". The assigned
   * character first, since that is what the user explicitly nominated. Then a controlled token,
   * because on a phone selecting a token then asking for its sheet is the natural flow and double
   * tapping a token is fiddly. Then the only actor they own, which covers the common case of a
   * player with exactly one character and no assignment set.
   *
   * Deliberately system agnostic. PF2e and SF2e were the worlds this was asked for, but every system
   * renders sheets through the same Actor#sheet, so naming one would only make it break on the next.
   */
  private openCharacterSheet(): void {
    const opened = openCharacterSheet({
      assigned: () =>
        (globalThis as { game?: { user?: { character?: SheetOwner | null } } }).game?.user
          ?.character,
      controlled: () =>
        (globalThis as { canvas?: { tokens?: { controlled?: { actor?: SheetOwner }[] } } }).canvas
          ?.tokens?.controlled?.[0]?.actor,
      allActors: () => [
        ...((globalThis as { game?: { actors?: Iterable<SheetOwner> } }).game?.actors ?? []),
      ],
    });

    if (!opened) {
      logger.warn(
        'No character to open. Assign one in your user configuration, or select a token.'
      );
    }
  }

  /**
   * Where the viewport is centred, in scene coordinates, straight from PIXI's root container.
   *
   * Read live for the same reason the scale is: anything that moves the view without going through
   * this module, which includes Foundry's own controls, the arrow keys and a scene change, would
   * leave a remembered value stale.
   */
  private resolveCanvasPivot(): { x: number; y: number } | null {
    return readCanvasPivot(typeof canvas === 'undefined' ? undefined : canvas);
  }

  /**
   * Act on what the sidebar button should do.
   *
   * The DECISION lives in foundry/SidebarAccess.ts, where it is testable without a DOM and where
   * the two measured lessons behind its ordering are recorded. This only carries it out.
   */
  private toggleFoundrySidebar(): void {
    const action = decideSidebarAction(this.sidebarAccess(), this.sidebarMenu !== null);

    switch (action.kind) {
      case 'closeMenu':
        this.closeSidebarMenu();
        return;
      case 'openMenu':
        this.openSidebarMenu(action.tabNames);
        return;
      case 'togglePopout':
        this.popOutSidebarTab(action.tabName);
        return;
      case 'toggleDocked':
        toggleFoundrySidebar(this.sidebarAccess());
        return;
      case 'nothing':
        return;
    }
  }

  /**
   * How much horizontal room the modifier bar may use, which is the window minus Foundry's sidebar.
   *
   * Measured 2026-08-11 on a 412px phone viewport: the sidebar sits hard against the right edge and
   * runs the full height, so once the bar wraps to the full width it lands on top of the sidebar's
   * icon column. That column is the only route to chat, actors and everything else, so covering it
   * costs far more than covering a single button.
   *
   * Read live rather than remembered. The sidebar expands, collapses and moves as the window
   * changes, and a width captured once would be wrong immediately afterwards. Returns the whole
   * window whenever the sidebar is absent, hidden, or already off screen, so nothing here can make
   * the bar narrower than it needs to be.
   */
  private resolveAvailableWidth(): number {
    // The arithmetic, and the three ways a sidebar can be present and not in the way, live in
    // foundry/AvailableWidth.ts where they can be tested without a layout engine.
    const sidebar = document.querySelector('#sidebar');
    return availableWidthBesideSidebar(
      window.innerWidth,
      sidebar === null ? null : sidebar.getBoundingClientRect()
    );
  }

  /**
   * Reads Foundry's zoom bounds when it exposes them, falling back otherwise. Written defensively
   * because these have moved between versions and a missing value here would produce NaN scales.
   */
  private resolveZoomLimits(): { minimum: number; maximum: number } {
    return readZoomLimits(typeof CONFIG === 'undefined' ? undefined : CONFIG.Canvas);
  }

  /**
   * Feature detected at the call site rather than trusted from the type. lib.dom declares vibrate
   * as always present, but it is absent on iOS entirely and ignored on Android until the page has
   * been interacted with.
   */
  private vibrate(durationMs: number): void {
    const target = this.options.window.navigator;
    if (typeof target.vibrate === 'function') {
      target.vibrate(durationMs);
    }
  }
}
