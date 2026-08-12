import { logger } from './core/Logger.js';
import { DragDiagnostics } from './debug/DragDiagnostics.js';
import { availableWidthBesideSidebar } from './foundry/AvailableWidth.js';
import { readCanvasPivot, readCanvasScale, readZoomLimits } from './foundry/CanvasReaders.js';
import { DebugOverlay } from './debug/DebugOverlay.js';
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
import { VirtualPointer } from './pointer/VirtualPointer.js';
import { UiScaler } from './scaling/UiScaler.js';
import { WindowClampBinder } from './scaling/WindowClampBinder.js';
import { createPointerStack } from './PointerStack.js';
import { buildTrayActions } from './ui/TrayActions.js';

/**
 * The macro the pause button looks for before falling back to Foundry's own toggle.
 *
 * A GM can create it and grant every player ownership, which is what was asked for. See togglePause
 * for why macro ownership alone still cannot let a player pause the whole world.
 */
const PAUSE_MACRO_NAME = 'Tongs Pause';

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

  /** Everything measured about a drag, and the report it whispers. See debug/DragDiagnostics.ts. */
  private readonly diagnostics: DragDiagnostics;
  private enabled = false;

  public constructor(private readonly options: TongsBrowserOptions) {
    const { document: doc, window: win } = options;

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
        this.diagnostics.whisperDiagnostics();
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
