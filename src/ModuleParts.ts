import { CanvasController } from './gesture/CanvasController.js';
import { DebugOverlay } from './debug/DebugOverlay.js';
import { DragDiagnostics } from './debug/DragDiagnostics.js';
import { ExclusionZones } from './gesture/ExclusionZones.js';
import { FoundryAccess } from './foundry/FoundryAccess.js';
import { FoundryActions } from './foundry/FoundryActions.js';
import { GestureController } from './gesture/GestureController.js';
import { KeyboardSynthesizer } from './modifiers/KeyboardSynthesizer.js';
import { ModifierBar } from './modifiers/ModifierBar.js';
import { PauseRelay, type SocketLike } from './relay/PauseRelay.js';
import { TouchBinder } from './gesture/TouchBinder.js';
import { UiScaler } from './scaling/UiScaler.js';
import { WindowClampBinder } from './scaling/WindowClampBinder.js';
import { createPointerStack } from './PointerStack.js';
import { buildModifierBar } from './BuildModifierBar.js';
import { logger } from './core/Logger.js';
import { vibrate } from './core/Vibrate.js';
import { MODULE_ID } from './constants.js';
import type { CursorOverlay } from './pointer/CursorOverlay.js';
import type { VirtualPointer } from './pointer/VirtualPointer.js';
import type { TongsBrowserOptions } from './TongsBrowserOptions.js';

/**
 * Building every part the module is made of. Extracted from TongsBrowser 2026-08-12.
 *
 * ⚠️ Every reference a part takes BACK to the module is a thunk, and that is what makes one builder
 * possible at all. The parts are built in an order, and several need a sibling that does not exist
 * yet: the tray needs the pointer while the bar is still being constructed, the relay needs the
 * actions, the binder needs the gestures. Taken eagerly, each captures `undefined` and fails at the
 * first tap, long after the code that caused it has finished running.
 */
export interface ModuleSelf {
  /**
   * Whether the module is switched on, which only the module itself knows.
   *
   * ⚠️ This is the ONLY thing the factory asks back for, and that is deliberate. Everything else it
   * builds it holds as a local and uses directly. Reaching back through the module for a part the
   * factory has not returned yet is exactly how a bar came to refresh a button against a pointer
   * that did not exist: `new ModifierBar` calls `refreshActions` at the end of its constructor, the
   * grab button asks whether a drag is in progress, and the field it read was still undefined.
   */
  readonly isEnabled: () => boolean;
}

export interface ModuleParts {
  readonly access: FoundryAccess;
  readonly debug: DebugOverlay;
  readonly pointer: VirtualPointer;
  readonly cursor: CursorOverlay;
  readonly gestures: GestureController;
  readonly synthesizer: KeyboardSynthesizer;
  readonly modifierBar: ModifierBar;
  readonly scaler: UiScaler;
  readonly clampBinder: WindowClampBinder;
  readonly pauseRelay: PauseRelay;
  readonly binder: TouchBinder;
  readonly diagnostics: DragDiagnostics;
  readonly actions: FoundryActions;
}

export function buildModuleParts(options: TongsBrowserOptions, self: ModuleSelf): ModuleParts {
  const access = new FoundryAccess();
  const doc = options.document;
  const win = options.window;

  const actions = new FoundryActions({
    document: doc,
    requestPauseFromGm: () => {
      pauseRelay.request();
    },
  });

  const diagnostics = new DragDiagnostics({
    document: doc,
    window: win,
    isDragging: () => stack.pointer.isDragging(),
    pointerPosition: () => stack.pointer.getPosition(),
    keyboardStrategy: () => synthesizer.getStrategy(),
    isEnabled: () => self.isEnabled(),
  });

  const debug = new DebugOverlay({ document: doc, logger });

  const stack = createPointerStack({
    document: doc,
    window: win,
    ...(options.eventView === undefined ? {} : { eventView: options.eventView }),
    ...(options.cursorSize === undefined ? {} : { cursorSize: options.cursorSize }),
    onDispatch: (descriptor, target) => {
      debug.onDispatch(descriptor, target);
      diagnostics.recordDispatch(descriptor, target);
    },
  });

  const canvasController = new CanvasController({
    getCanvas: () => access.resolveCanvas(),
    getScale: () => access.resolveCanvasScale(),
    getPivot: () => access.resolveCanvasPivot(),
    getZoomLimits: () => access.resolveZoomLimits(),
    logger,
  });

  const gestures = new GestureController({
    pointer: stack.pointer,
    canvas: canvasController,
    ...(options.gestureConfig === undefined ? {} : { config: options.gestureConfig }),
    logger,
    vibrate: (durationMs) => {
      vibrate(options.window, durationMs);
    },
  });

  const synthesizer = new KeyboardSynthesizer({
    document: doc,
    getKeyboardManager: () => access.resolveKeyboardManager(),
    logger,
  });

  const modifierBar = buildModifierBar({
    document: doc,
    options,
    synthesizer,
    access,
    actions,
    diagnostics,
    canvasController,
    // A thunk, because the pointer field is not assigned until after the bar is built.
    pointer: () => stack.pointer,
  });

  const scaler = new UiScaler({
    document: doc,
    ...(options.uiScale === undefined ? {} : { initialScale: options.uiScale }),
  });

  const clampBinder = new WindowClampBinder({ document: doc, window: win, logger });

  /*
   * Resolved lazily on every call rather than captured now. The socket, the user list and who
   * counts as the designated GM all change during a session, and a GM disconnecting mid game is
   * exactly when the relay has to still pick the right client.
   */
  const pauseRelay = new PauseRelay({
    get socket(): SocketLike | null {
      return (globalThis as { game?: { socket?: SocketLike } }).game?.socket ?? null;
    },
    channel: `module.${MODULE_ID}`,
    isDesignatedGm: () => actions.isDesignatedGm(),
    applyPause: (pause: boolean) => {
      actions.applyPause(pause);
    },
    getPaused: () => (globalThis as { game?: { paused?: boolean } }).game?.paused === true,
    logger,
  });

  const binder = new TouchBinder({
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
      diagnostics.countGestureInput(input.type);
      gestures.handleInput(input);
    },
    suppressNativeTouch: options.suppressNativeTouch ?? ((): boolean => true),
    now: () => Date.now(),
  });

  return {
    access,
    debug,
    pointer: stack.pointer,
    cursor: stack.cursor,
    gestures,
    synthesizer,
    modifierBar,
    scaler,
    clampBinder,
    pauseRelay,
    binder,
    diagnostics,
    actions,
  };
}
