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
import { wireTrayActions } from './TrayWiring.js';
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
  readonly pointer: () => VirtualPointer;
  readonly gestures: () => GestureController;
  readonly synthesizer: () => KeyboardSynthesizer;
  readonly debug: () => DebugOverlay;
  readonly diagnostics: () => DragDiagnostics;
  readonly actions: () => FoundryActions;
  readonly access: () => FoundryAccess;
  readonly isEnabled: () => boolean;
}

export interface ModuleParts {
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
    isDragging: () => self.pointer().isDragging(),
    pointerPosition: () => self.pointer().getPosition(),
    keyboardStrategy: () => self.synthesizer().getStrategy(),
    isEnabled: () => self.isEnabled(),
  });

  const debug = new DebugOverlay({ document: doc, logger });

  const stack = createPointerStack({
    document: doc,
    window: win,
    eventView: win,
    ...(options.cursorSize === undefined ? {} : { cursorSize: options.cursorSize }),
    onDispatch: (descriptor, target) => {
      self.debug().onDispatch(descriptor, target);
      self.diagnostics().recordDispatch(descriptor, target);
    },
  });

  const canvasController = new CanvasController({
    getCanvas: () => self.access().resolveCanvas(),
    getScale: () => self.access().resolveCanvasScale(),
    getPivot: () => self.access().resolveCanvasPivot(),
    getZoomLimits: () => self.access().resolveZoomLimits(),
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
    getKeyboardManager: () => self.access().resolveKeyboardManager(),
    logger,
  });

  const modifierBar = new ModifierBar({
    document: doc,
    synthesizer,
    // Held modifiers must reach the pointer too. Foundry reads its own keyboard state for some
    // decisions and the event flags for others, so both paths have to agree.
    onFlagsChanged: (flags) => {
      self.pointer().setModifiers(flags);
    },
    ...(options.initialBarPosition === undefined
      ? {}
      : { initialPosition: options.initialBarPosition }),
    ...(options.onBarPositionChanged === undefined
      ? {}
      : { onPositionChanged: options.onBarPositionChanged }),
    getAvailableWidth: () => self.access().resolveAvailableWidth(),
    trayActions: wireTrayActions(canvasController, {
      actions: self.actions(),
      // A thunk, because the pointer field is not assigned until after the bar is built.
      pointer: () => self.pointer(),
      diagnostics: self.diagnostics(),
    }),
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
    isDesignatedGm: () => self.actions().isDesignatedGm(),
    applyPause: (pause: boolean) => {
      self.actions().applyPause(pause);
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
      self.diagnostics().countGestureInput(input.type);
      self.gestures().handleInput(input);
    },
    suppressNativeTouch: options.suppressNativeTouch ?? ((): boolean => true),
    now: () => Date.now(),
  });

  return {
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
