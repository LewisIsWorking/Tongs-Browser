import { logger } from './core/Logger.js';
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

export interface TongsBrowserOptions {
  readonly document: Document;
  readonly window: Window;
  readonly gestureConfig?: Partial<GestureConfig>;
  readonly suppressNativeTouch?: () => boolean;
  readonly modifierBarEnabled?: boolean;
  readonly initialBarPosition?: BarPosition;
  readonly onBarPositionChanged?: (position: BarPosition) => void;
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
  private enabled = false;

  public constructor(private readonly options: TongsBrowserOptions) {
    const { document: doc, window: win } = options;

    this.cursor = new CursorOverlay({ document: doc });

    const hitTester = new HitTester({
      // Bound to the document rather than passed as a reference, because elementFromPoint throws
      // if it loses its receiver.
      elementFromPoint: (x, y) => doc.elementFromPoint(x, y),
      getViewport: () => ({ width: win.innerWidth, height: win.innerHeight }),
    });

    this.pointer = new VirtualPointer({
      hitTester,
      dispatcher: new EventDispatcher({ view: win }),
      cursor: this.cursor,
      initialPosition: { clientX: win.innerWidth / 2, clientY: win.innerHeight / 2 },
    });

    const canvasController = new CanvasController({
      getCanvas: () => this.resolveCanvas(),
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
