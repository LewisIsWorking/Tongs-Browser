import { logger } from './core/Logger.js';
import { DragDiagnostics } from './debug/DragDiagnostics.js';
import { FoundryAccess } from './foundry/FoundryAccess.js';
import { wireTrayActions } from './TrayWiring.js';
import { FoundryActions } from './foundry/FoundryActions.js';
import { DebugOverlay } from './debug/DebugOverlay.js';
import { CanvasController } from './gesture/CanvasController.js';
import { ExclusionZones } from './gesture/ExclusionZones.js';
import { GestureController } from './gesture/GestureController.js';
import { TouchBinder } from './gesture/TouchBinder.js';
import type { GestureConfig } from './gesture/GestureTypes.js';
import { KeyboardSynthesizer } from './modifiers/KeyboardSynthesizer.js';
import { ModifierBar, type BarPosition } from './modifiers/ModifierBar.js';
import { MODULE_ID } from './constants.js';
import { PauseRelay, type SocketLike } from './relay/PauseRelay.js';
import { CursorOverlay } from './pointer/CursorOverlay.js';
import { VirtualPointer } from './pointer/VirtualPointer.js';
import { UiScaler } from './scaling/UiScaler.js';
import { WindowClampBinder } from './scaling/WindowClampBinder.js';
import { createPointerStack } from './PointerStack.js';

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
  /** What the tray buttons do to Foundry. See foundry/FoundryActions.ts. */
  private readonly actions: FoundryActions;

  /** Reaching for Foundry's globals, in one place. See foundry/FoundryAccess.ts. */
  private readonly access = new FoundryAccess();

  /** Everything measured about a drag, and the report it whispers. See debug/DragDiagnostics.ts. */
  private readonly diagnostics: DragDiagnostics;
  private enabled = false;

  public constructor(private readonly options: TongsBrowserOptions) {
    const { document: doc, window: win } = options;

    this.actions = new FoundryActions({
      document: doc,
      requestPauseFromGm: () => {
        this.pauseRelay.request();
      },
    });

    this.diagnostics = new DragDiagnostics({
      document: doc,
      window: win,
      isDragging: () => this.pointer.isDragging(),
      pointerPosition: () => this.pointer.getPosition(),
      keyboardStrategy: () => this.synthesizer.getStrategy(),
      isEnabled: () => this.enabled,
    });

    this.debug = new DebugOverlay({ document: doc, logger });

    const stack = createPointerStack({
      document: doc,
      window: win,
      eventView: win,
      ...(options.cursorSize === undefined ? {} : { cursorSize: options.cursorSize }),
      onDispatch: (descriptor, target) => {
        this.debug.onDispatch(descriptor, target);
        this.diagnostics.recordDispatch(descriptor, target);
      },
    });
    this.pointer = stack.pointer;
    this.cursor = stack.cursor;

    const canvasController = new CanvasController({
      getCanvas: () => this.access.resolveCanvas(),
      getScale: () => this.access.resolveCanvasScale(),
      getPivot: () => this.access.resolveCanvasPivot(),
      getZoomLimits: () => this.access.resolveZoomLimits(),
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
      getKeyboardManager: () => this.access.resolveKeyboardManager(),
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
      getAvailableWidth: () => this.access.resolveAvailableWidth(),
      trayActions: wireTrayActions(canvasController, {
        actions: this.actions,
        // A thunk, because the pointer field is not assigned until after the bar is built.
        pointer: () => this.pointer,
        diagnostics: this.diagnostics,
      }),
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
      isDesignatedGm: () => this.actions.isDesignatedGm(),
      applyPause: (pause) => {
        this.actions.applyPause(pause);
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
        this.diagnostics.countGestureInput(input.type);
        this.gestures.handleInput(input);
      },
      suppressNativeTouch: options.suppressNativeTouch ?? ((): boolean => true),
      now: () => Date.now(),
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
    this.actions.closeSidebarMenu();
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
