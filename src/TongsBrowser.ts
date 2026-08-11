import { logger } from './core/Logger.js';
import { DebugOverlay } from './debug/DebugOverlay.js';
import { CanvasController, type CanvasLike } from './gesture/CanvasController.js';
import { ExclusionZones } from './gesture/ExclusionZones.js';
import { GestureController } from './gesture/GestureController.js';
import { TouchBinder } from './gesture/TouchBinder.js';
import type { GestureConfig } from './gesture/GestureTypes.js';
import { KeyboardSynthesizer, type KeyboardManagerLike } from './modifiers/KeyboardSynthesizer.js';
import { ModifierBar, type BarPosition, type TrayAction } from './modifiers/ModifierBar.js';
import { MODULE_ID } from './constants.js';
import { PauseRelay, type SocketLike } from './relay/PauseRelay.js';
import { CursorOverlay } from './pointer/CursorOverlay.js';
import { EventDispatcher } from './pointer/EventDispatcher.js';
import { HitTester } from './pointer/HitTester.js';
import { VirtualPointer } from './pointer/VirtualPointer.js';
import { UiScaler } from './scaling/UiScaler.js';
import { WindowClampBinder } from './scaling/WindowClampBinder.js';

/**
 * The macro the pause button looks for before falling back to Foundry's own toggle.
 *
 * A GM can create it and grant every player ownership, which is what was asked for. See togglePause
 * for why macro ownership alone still cannot let a player pause the whole world.
 */
const PAUSE_MACRO_NAME = 'Tongs Pause';

/** How many recent dispatches the diagnostics report carries. Enough for a whole short drag. */
const DISPATCH_TRACE_LENGTH = 18;

/** Stamped in at build time by Vite. See vite.config.ts for why the manifest version is not enough. */
declare const __TB_BUILD_VERSION__: string;

/** Matches MouseInteractionManager.INTERACTION_STATES in Foundry 14. */
const INTERACTION_STATE_NAMES = ['NONE', 'HOVER', 'CLICKED', 'GRABBED', 'DRAG', 'DROP'];

/** Foundry's own view of where an interaction got to, named rather than left as a bare number. */
function describeInteractionState(target: unknown): string {
  const manager = (target as { mouseInteractionManager?: { state?: number } } | undefined)
    ?.mouseInteractionManager;
  if (manager?.state === undefined) {
    return 'no interaction manager';
  }
  return `${INTERACTION_STATE_NAMES[manager.state] ?? 'UNKNOWN'} (${String(manager.state)})`;
}

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
  private readonly recentDispatches: string[] = [];

  /** Highest Foundry interaction state seen during the current gesture. See recordDispatch. */
  private peakInteractionState = 0;

  /** Most drag preview objects seen during the current gesture. Non zero means a drag really began. */
  private peakPreviewCount = 0;

  public constructor(private readonly options: TongsBrowserOptions) {
    const { document: doc, window: win } = options;

    this.debug = new DebugOverlay({ document: doc, logger });

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
    if (typeof canvas === 'undefined') {
      return null;
    }
    return canvas.stage?.scale?.x ?? null;
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
    const PAN_STEP = 160;
    const ZOOM_STEP = 1.25;

    return [
      {
        id: 'sidebar',
        label: '☰',
        title: 'Show or hide the Foundry sidebar',
        activate: () => {
          this.toggleFoundrySidebar();
        },
      },
      {
        id: 'character',
        label: 'C',
        title: 'Open your character sheet',
        activate: () => {
          this.openCharacterSheet();
        },
      },
      {
        id: 'pause',
        label: '⏸',
        title: 'Pause or unpause the game',
        activate: () => {
          this.togglePause();
        },
        isActive: () => (globalThis as { game?: { paused?: boolean } }).game?.paused === true,
      },
      /*
       * Grab. The reason dragging a token was so hard.
       *
       * The touch gesture for a drag is tap, lift, press again inside the double tap window, hold
       * past the long press timer without moving more than the tap slop, and only then move. That is
       * five things in a row, and every one of them is a chance to get it wrong while looking at the
       * map rather than at your thumb. It works, which is why the harness passes it, but working and
       * usable are different claims.
       *
       * This holds the button down at the pointer until it is tapped again, so dragging becomes:
       * grab, move the pointer the ordinary way, drop. It is also how a window gets dragged, which is
       * the same complaint from the other end.
       */
      {
        id: 'grab',
        label: '✋',
        title: 'Grab and hold, then move the pointer to drag. Tap again to drop.',
        activate: () => {
          if (this.pointer.isDragging()) {
            this.pointer.endDrag();
          } else {
            this.pointer.beginDrag();
          }
        },
        isActive: () => this.pointer.isDragging(),
      },
      {
        id: 'diagnose',
        label: '🔍',
        title: 'Whisper a diagnostic report to yourself in chat',
        activate: () => {
          this.whisperDiagnostics();
        },
      },
      {
        id: 'zoom-in',
        label: '+',
        title: 'Zoom in',
        activate: () => {
          canvasController.zoomBy(ZOOM_STEP);
        },
      },
      {
        id: 'zoom-out',
        label: '−',
        title: 'Zoom out',
        activate: () => {
          canvasController.zoomBy(1 / ZOOM_STEP);
        },
      },
      // The signs match panBy's finger metaphor: pressing right moves the VIEW right, which is the
      // same as dragging the map left.
      {
        id: 'pan-left',
        label: '←',
        title: 'Pan left',
        group: 'pan',
        activate: () => {
          canvasController.panBy(PAN_STEP, 0);
        },
      },
      {
        id: 'pan-right',
        label: '→',
        title: 'Pan right',
        group: 'pan',
        activate: () => {
          canvasController.panBy(-PAN_STEP, 0);
        },
      },
      {
        id: 'pan-up',
        label: '↑',
        title: 'Pan up',
        group: 'pan',
        activate: () => {
          canvasController.panBy(0, PAN_STEP);
        },
      },
      {
        id: 'pan-down',
        label: '↓',
        title: 'Pan down',
        group: 'pan',
        activate: () => {
          canvasController.panBy(0, -PAN_STEP);
        },
      },
    ];
  }

  /**
   * Keep the last few dispatched events, with the one field that decides whether a drag is a drag.
   *
   * `buttons` is the whole story for dragging: it has to stay non zero on every move between the
   * down and the up, or Foundry reads the stream as a hover and nothing follows the pointer. Seeing
   * `pointermove buttons=0` in this list while a grab is held would name the bug outright.
   */
  private recordDispatch(descriptor: { type: string; buttons?: number }, target: Element): void {
    /*
     * A gesture starts at a pointerdown, so the buffer restarts there.
     *
     * A fixed length window was not good enough: a drag emits a move per step, so by the time the
     * report is read the pointerdown that began it has already scrolled out, and whether the press
     * and the release reached the same element is precisely the question. Middle moves are the least
     * informative part, so they are the ones that get collapsed.
     */
    if (descriptor.type === 'pointerdown') {
      this.recentDispatches.length = 0;
      this.peakInteractionState = 0;
      this.peakPreviewCount = 0;
    }

    /*
     * Sample Foundry's interaction state AS IT HAPPENS, and keep the peak.
     *
     * Reading it when the report is written measures the aftermath rather than the event: Foundry
     * resets the manager to NONE once the interaction ends, so a report taken afterwards says NONE
     * whether the drag never started or ran perfectly and committed. The peak survives the gesture,
     * which is the only reason it can answer the question.
     */
    const controlled = (
      globalThis as {
        canvas?: { tokens?: { controlled?: unknown[]; preview?: { children?: unknown[] } } };
      }
    ).canvas?.tokens;
    const state = (
      controlled?.controlled?.[0] as { mouseInteractionManager?: { state?: number } } | undefined
    )?.mouseInteractionManager?.state;
    if (typeof state === 'number' && state > this.peakInteractionState) {
      this.peakInteractionState = state;
    }
    const previews = controlled?.preview?.children?.length ?? 0;
    if (previews > this.peakPreviewCount) {
      this.peakPreviewCount = previews;
    }

    const buttons = descriptor.buttons ?? 0;
    const line = `${descriptor.type} buttons=${String(buttons)} -> ${target.tagName.toLowerCase()}#${target.id}`;

    // Collapse a run of identical move lines rather than filling the report with them.
    const last = this.recentDispatches[this.recentDispatches.length - 1];
    if (last?.startsWith(line) === true) {
      const repeats = /\bx(\d+)$/.exec(last);
      const count = repeats === null ? 2 : Number(repeats[1]) + 1;
      this.recentDispatches[this.recentDispatches.length - 1] = `${line} x${String(count)}`;
      return;
    }

    this.recentDispatches.push(line);
    if (this.recentDispatches.length > DISPATCH_TRACE_LENGTH) {
      this.recentDispatches.shift();
    }
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
    const game = (globalThis as { game?: Record<string, unknown> }).game;
    if (game === undefined) {
      return;
    }

    const user = game['user'] as { id?: string; isGM?: boolean } | undefined;
    const canvasGlobal = (globalThis as { canvas?: Record<string, unknown> }).canvas;
    const tokens = canvasGlobal?.['tokens'] as
      | {
          controlled?: {
            name?: string;
            id?: string;
            document?: { x?: number; y?: number };
            w?: number;
            h?: number;
            _canDrag?: (u: unknown) => boolean;
          }[];
        }
      | undefined;
    const selected = tokens?.controlled?.[0];

    const position = this.pointer.getPosition();
    const under = this.options.document.elementFromPoint(position.clientX, position.clientY);
    const mouse = canvasGlobal?.['mousePosition'] as { x?: number; y?: number } | undefined;

    const insideToken =
      selected?.document?.x !== undefined &&
      mouse?.x !== undefined &&
      mouse.x >= selected.document.x &&
      mouse.x <= selected.document.x + (selected.w ?? 0) &&
      (mouse.y ?? 0) >= (selected.document.y ?? 0) &&
      (mouse.y ?? 0) <= (selected.document.y ?? 0) + (selected.h ?? 0);

    const lines = [
      `<strong>Tongs Browser diagnostics</strong>`,
      // The BUILD stamp first, because the manifest one is read once at server start and goes stale
      // the moment module files are replaced under a running server.
      `build: ${__TB_BUILD_VERSION__} (manifest says ${(game['modules'] as { get: (id: string) => { version?: string } | undefined }).get(MODULE_ID)?.version ?? 'unknown'}, stale if they differ)`,
      `enabled: ${String(this.enabled)} | isGM: ${String(user?.isGM)} | paused: ${String(game['paused'])}`,
      `activeTool: ${String(game['activeTool'])} <em>(dragging a token needs "select")</em>`,
      `controlled token: ${selected === undefined ? 'NONE, tap a token first' : `${String(selected.name)} at (${String(selected.document?.x)}, ${String(selected.document?.y)})`}`,
      `token._canDrag: ${selected?._canDrag === undefined ? 'n/a' : String(selected._canDrag(user))}`,
      `pointer: (${String(Math.round(position.clientX))}, ${String(Math.round(position.clientY))}) dragging: ${String(this.pointer.isDragging())}`,
      `element under pointer: ${under === null ? 'nothing' : `${under.tagName.toLowerCase()}#${under.id}`}`,
      `canvas.mousePosition: ${mouse === undefined ? 'n/a' : `(${String(Math.round(mouse.x ?? 0))}, ${String(Math.round(mouse.y ?? 0))})`} insideSelectedToken: ${String(insideToken)}`,
      `canvas ready: ${String(canvasGlobal?.['ready'])} | keyboard: ${this.synthesizer.getStrategy()}`,
      /*
       * Foundry's own view of the interaction, which splits the remaining problem in half.
       *
       * MouseInteractionManager runs NONE, HOVER, CLICKED, GRABBED, DRAG, DROP with a 10px drag
       * resistance. If it never leaves CLICKED or GRABBED, the moves are not reaching the manager at
       * all. If it reaches DRAG and a preview exists, the drag is running and the DROP is what fails.
       * Those are completely different bugs and nothing else visible distinguishes them.
       */
      `interaction state now: ${describeInteractionState(selected)}`,
      `<strong>PEAK during last gesture: ${INTERACTION_STATE_NAMES[this.peakInteractionState] ?? 'UNKNOWN'} (${String(this.peakInteractionState)})</strong>`,
      `peak drag previews during last gesture: ${String(this.peakPreviewCount)}`,
      `agent: ${navigator.userAgent}`,
      `<strong>last ${String(this.recentDispatches.length)} events dispatched</strong> <em>(grab, drag, drop, THEN tap this)</em>`,
      this.recentDispatches.length === 0
        ? 'none yet'
        : this.recentDispatches.map((line) => `<code>${line}</code>`).join('<br>'),
    ];

    const chat = (globalThis as { ChatMessage?: { create?: (data: unknown) => unknown } })
      .ChatMessage;
    if (chat?.create === undefined) {
      logger.warn(lines.join(' | '));
      return;
    }

    void chat.create({
      content: lines.join('<br>'),
      whisper: user?.id === undefined ? [] : [user.id],
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
    const game = (globalThis as { game?: Record<string, unknown> }).game;
    if (game === undefined) {
      return;
    }

    const macros = game['macros'] as
      | { getName?: (name: string) => { canExecute?: boolean; execute?: () => unknown } | null }
      | undefined;
    const macro = macros?.getName?.(PAUSE_MACRO_NAME) ?? null;

    /*
     * An explicitly authored macro wins, because a GM who wrote one meant it to be used.
     *
     * ⚠️ It only helps a PLAYER if the macro itself reaches a GM somehow. Core Foundry has no
     * execute-as-GM: verified against the installed 14.365, where executeAsGM, execute-as and asGM
     * appear nowhere in client or common. That feature comes from modules such as Advanced Macros.
     * An ordinary script macro run by a player touches that player's client alone. The relay is what
     * actually makes this work for everyone.
     */
    if (macro?.execute !== undefined && macro.canExecute !== false) {
      void macro.execute();
      return;
    }

    this.pauseRelay.request();
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

  /**
   * Which sidebar tabs this user can actually open.
   *
   * Read from the Sidebar class's static TABS, because that is where Foundry defines them; the tab
   * applications themselves are separate objects hanging off `ui`. A tab is only offered if its
   * application exists and can pop out, so a build that renames or removes one degrades to a shorter
   * list rather than to a row of buttons that do nothing.
   */
  private resolveSidebarTabNames(): string[] {
    const ui = (globalThis as { ui?: Record<string, unknown> }).ui;
    const sidebar = ui?.['sidebar'] as
      { constructor?: { TABS?: Record<string, { gmOnly?: boolean }> } } | undefined;
    const tabs = sidebar?.constructor?.TABS;
    if (tabs === undefined) {
      return [];
    }

    const isGm = (globalThis as { game?: { user?: { isGM?: boolean } } }).game?.user?.isGM === true;

    return Object.entries(tabs)
      .filter(([, definition]) => definition.gmOnly !== true || isGm)
      .map(([name]) => name)
      .filter((name) => {
        const app = ui?.[name] as { renderPopout?: () => unknown } | undefined;
        return app?.renderPopout !== undefined;
      });
  }

  /** Pop a named sidebar tab out as a window, closing it again if it is already open. */
  private popOutSidebarTab(name: string): void {
    const ui = (globalThis as { ui?: Record<string, unknown> }).ui;
    const sidebar = ui?.['sidebar'] as
      { popouts?: Record<string, { close?: () => unknown }> } | undefined;

    const open = sidebar?.popouts?.[name];
    if (open?.close !== undefined) {
      void open.close();
      return;
    }

    const app = ui?.[name] as { renderPopout?: () => unknown } | undefined;
    void app?.renderPopout?.();
  }

  /**
   * Whether this client is the ONE GM that should act on a relayed request.
   *
   * `game.users.activeGM` is Foundry's own designated user: it picks the same single GM on every
   * client, deterministically. Using "am I a GM" instead would have every connected GM answer the
   * same request, flipping the pause state once per GM and landing wherever the race ended.
   */
  private isDesignatedGm(): boolean {
    const game = (
      globalThis as {
        game?: {
          users?: { activeGM?: { id?: string } | null };
          user?: { id?: string; isGM?: boolean };
        };
      }
    ).game;
    if (game === undefined) {
      return false;
    }

    const designated = game.users?.activeGM ?? null;
    if (designated?.id !== undefined && game.user?.id !== undefined) {
      return designated.id === game.user.id;
    }

    // Older builds without activeGM: fall back to plain GM, which is still correct for a solo GM.
    return game.user?.isGM === true;
  }

  /** The authoritative toggle. Only ever reached on the designated GM's client. */
  private applyPause(pause: boolean): void {
    const game = (globalThis as { game?: Record<string, unknown> }).game;
    const toggle = game?.['togglePause'] as
      ((pause?: boolean, options?: { broadcast?: boolean }) => boolean) | undefined;
    // broadcast is what tells every other client, and Foundry only honours it from a GM.
    toggle?.call(game, pause, { broadcast: true });
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
    const game = (globalThis as { game?: Record<string, unknown> }).game;
    if (game === undefined) {
      return;
    }

    const user = game['user'] as
      | { character?: { sheet?: { render?: (force: boolean) => void } } | null; id?: string }
      | undefined;

    const assigned = user?.character ?? null;
    if (assigned?.sheet?.render !== undefined) {
      assigned.sheet.render(true);
      return;
    }

    const controlled = (
      globalThis as { canvas?: { tokens?: { controlled?: { actor?: unknown }[] } } }
    ).canvas?.tokens?.controlled?.[0]?.actor as
      { sheet?: { render?: (force: boolean) => void } } | undefined;
    if (controlled?.sheet?.render !== undefined) {
      controlled.sheet.render(true);
      return;
    }

    const actors = game['actors'] as
      { filter?: (fn: (a: unknown) => boolean) => unknown[] } | undefined;
    const owned =
      actors?.filter?.((actor) => (actor as { isOwner?: boolean }).isOwner === true) ?? [];
    const only =
      owned.length === 1 ? (owned[0] as { sheet?: { render?: (f: boolean) => void } }) : null;
    if (only?.sheet?.render !== undefined) {
      only.sheet.render(true);
      return;
    }

    logger.warn('No character to open. Assign one in your user configuration, or select a token.');
  }

  /**
   * Where the viewport is centred, in scene coordinates, straight from PIXI's root container.
   *
   * Read live for the same reason the scale is: anything that moves the view without going through
   * this module, which includes Foundry's own controls, the arrow keys and a scene change, would
   * leave a remembered value stale.
   */
  private resolveCanvasPivot(): { x: number; y: number } | null {
    if (typeof canvas === 'undefined') {
      return null;
    }
    const pivot = canvas.stage?.pivot;
    if (pivot === undefined) {
      return null;
    }
    return { x: pivot.x, y: pivot.y };
  }

  /**
   * Show or hide Foundry's sidebar, from a button on the bar.
   *
   * Asked for after testing on a real phone, where the sidebar was unreachable: Foundry auto
   * collapses it below roughly 1024px, leaving a narrow strip of icons hard against the right edge
   * whose expander is a few pixels wide. On a touch screen that is not a realistic target, and the
   * sidebar is the only route to chat, actors, journals and settings.
   *
   * Uses Foundry's own toggleExpanded so the caret, tooltip, aria label and the collapseSidebar hook
   * all stay correct. Driving the CSS class directly would leave the interface disagreeing with
   * itself and would break any module listening for that hook.
   *
   * Falls back to the older collapse and expand pair, and does nothing at all if neither exists,
   * because a button that throws is worse than a button that is merely inert.
   */
  private toggleFoundrySidebar(): void {
    const ui = (globalThis as { ui?: Record<string, unknown> }).ui;
    const sidebar = ui?.['sidebar'] as
      | {
          expanded?: boolean;
          toggleExpanded?: (expanded?: boolean) => void;
          expand?: () => void;
          collapse?: () => void;
          tabGroups?: { primary?: string };
          tabs?: Record<string, { renderPopout?: () => unknown; popout?: unknown }>;
          popouts?: Record<string, { close?: () => unknown }>;
        }
      | undefined;

    if (sidebar === undefined) {
      return;
    }

    /*
     * Pop the active tab out as a window rather than relying on the docked sidebar.
     *
     * Expanding the docked sidebar is the obvious thing and it is not good enough. Measured on a
     * real device: toggling `expanded` genuinely flips, and nothing appears, because the docked
     * sidebar is a 48px column pinned to the right edge of a layout that a phone browser does not
     * put where the maths says it should be. A popped out tab is an ordinary application window,
     * which WindowClampBinder already keeps inside the viewport, so it is visible by construction
     * rather than by luck.
     *
     * It also toggles honestly: a second tap closes the window it opened.
     */
    /*
     * Offer EVERY tab, not just the active one.
     *
     * Popping out the active tab gave chat and nothing else, because the only way to change tabs is
     * the docked tab strip, which is the 27px column that started all of this. So the button opens a
     * small picker of its own instead: our DOM, our sizing, guaranteed tappable.
     */
    if (this.sidebarMenu !== null) {
      this.closeSidebarMenu();
      return;
    }

    /*
     * The tab NAMES come from Sidebar.TABS, a static definition map, and the tab APPLICATIONS live
     * on `ui` directly as ui.chat, ui.actors and so on. There is no instance collection joining the
     * two, which is what the first attempt assumed: it read `sidebar.tabs`, found nothing, offered
     * no tabs, and silently fell through to popping out chat again.
     *
     * gmOnly entries are dropped for players, matching what Foundry's own tab strip renders, so a
     * player is never offered a Scenes tab that would refuse to open.
     */
    const tabNames = this.resolveSidebarTabNames();
    if (tabNames.length > 1) {
      this.openSidebarMenu(tabNames);
      return;
    }

    const tabName = sidebar.tabGroups?.primary ?? 'chat';
    const existingPopout = sidebar.popouts?.[tabName];
    if (existingPopout?.close !== undefined) {
      void existingPopout.close();
      return;
    }

    const tab =
      sidebar.tabs?.[tabName] ?? (ui?.[tabName] as { renderPopout?: () => unknown } | undefined);
    if (tab?.renderPopout !== undefined) {
      void tab.renderPopout();
      return;
    }

    // Nothing to pop out on this build, so fall back to the docked sidebar.
    if (typeof sidebar.toggleExpanded === 'function') {
      sidebar.toggleExpanded();
      return;
    }
    if (sidebar.expanded === true) {
      sidebar.collapse?.();
    } else {
      sidebar.expand?.();
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
    const width = window.innerWidth;
    const sidebar = document.querySelector('#sidebar');
    if (sidebar === null) {
      return width;
    }

    const box = sidebar.getBoundingClientRect();
    if (box.width === 0 || box.left >= width || box.right <= 0) {
      return width;
    }

    // A small gap so the bar does not sit flush against the sidebar edge.
    return Math.max(0, box.left - 4);
  }

  /**
   * Reads Foundry's zoom bounds when it exposes them, falling back otherwise. Written defensively
   * because these have moved between versions and a missing value here would produce NaN scales.
   */
  private resolveZoomLimits(): { minimum: number; maximum: number } {
    const configured = typeof CONFIG === 'undefined' ? undefined : CONFIG.Canvas;
    return {
      minimum: configured?.minZoom ?? 0.1,
      maximum: configured?.maxZoom ?? 10,
    };
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
