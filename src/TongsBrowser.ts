import { logger } from './core/Logger.js';
import { DebugOverlay } from './debug/DebugOverlay.js';
import { CanvasController, type CanvasLike } from './gesture/CanvasController.js';
import { ExclusionZones } from './gesture/ExclusionZones.js';
import { GestureController } from './gesture/GestureController.js';
import { TouchBinder } from './gesture/TouchBinder.js';
import type { GestureConfig } from './gesture/GestureTypes.js';
import { KeyboardSynthesizer, type KeyboardManagerLike } from './modifiers/KeyboardSynthesizer.js';
import { ModifierBar, type BarPosition } from './modifiers/ModifierBar.js';
import { CursorOverlay } from './pointer/CursorOverlay.js';
import { EventDispatcher } from './pointer/EventDispatcher.js';
import { HitTester } from './pointer/HitTester.js';
import { VirtualPointer } from './pointer/VirtualPointer.js';
import { UiScaler } from './scaling/UiScaler.js';
import { WindowClampBinder } from './scaling/WindowClampBinder.js';

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
  private enabled = false;

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
        },
      }),
      cursor: this.cursor,
      initialPosition: { clientX: win.innerWidth / 2, clientY: win.innerHeight / 2 },
    });

    const canvasController = new CanvasController({
      getCanvas: () => this.resolveCanvas(),
      getScale: () => this.resolveCanvasScale(),
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
      trayActions: [
        {
          id: 'sidebar',
          label: '☰',
          title: 'Show or hide the Foundry sidebar',
          activate: () => {
            this.toggleFoundrySidebar();
          },
        },
      ],
    });

    this.scaler = new UiScaler({
      document: doc,
      ...(options.uiScale === undefined ? {} : { initialScale: options.uiScale }),
    });

    this.clampBinder = new WindowClampBinder({ document: doc, window: win, logger });

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
    this.debug.setEnabled(false);
    // Removes the property rather than setting it back to 1, so Foundry's own layout is restored
    // exactly and nothing is left behind.
    this.scaler.remove();
    logger.info('Disabled.');
  }

  public isEnabled(): boolean {
    return this.enabled;
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
    const sidebar = (globalThis as { ui?: { sidebar?: unknown } }).ui?.sidebar as
      | {
          expanded?: boolean;
          toggleExpanded?: (expanded?: boolean) => void;
          expand?: () => void;
          collapse?: () => void;
        }
      | undefined;

    if (sidebar === undefined) {
      return;
    }

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
