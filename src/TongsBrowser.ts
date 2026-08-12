import { logger } from './core/Logger.js';
import { FoundryActions } from './foundry/FoundryActions.js';
import { DebugOverlay } from './debug/DebugOverlay.js';
import { GestureController } from './gesture/GestureController.js';
import { TouchBinder } from './gesture/TouchBinder.js';
import type { GestureConfig } from './gesture/GestureTypes.js';
import { KeyboardSynthesizer } from './modifiers/KeyboardSynthesizer.js';
import { ModifierBar } from './modifiers/ModifierBar.js';
import { PauseRelay } from './relay/PauseRelay.js';
import { CursorOverlay } from './pointer/CursorOverlay.js';
import { VirtualPointer } from './pointer/VirtualPointer.js';
import { UiScaler } from './scaling/UiScaler.js';
import { WindowClampBinder } from './scaling/WindowClampBinder.js';
import { buildModuleParts } from './ModuleParts.js';
import type { TongsBrowserOptions } from './TongsBrowserOptions.js';

// Re-exported so every existing importer keeps working unchanged.
export type { TongsBrowserOptions };

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

  private enabled = false;

  public constructor(private readonly options: TongsBrowserOptions) {
    /*
     * ⚠️ Every reference the parts take back to this module is a THUNK, and that is what makes a
     * single builder possible at all. The parts are built in an order, and several need a sibling
     * that does not exist yet: the tray needs the pointer while the bar is still being constructed,
     * the relay needs the actions, the binder needs the gestures. Taken eagerly, each captures
     * `undefined` and fails at the first tap, long after the code that caused it has finished.
     */
    const parts = buildModuleParts(options, { isEnabled: () => this.enabled });

    this.actions = parts.actions;
    this.debug = parts.debug;
    this.pointer = parts.pointer;
    this.cursor = parts.cursor;
    this.gestures = parts.gestures;
    this.synthesizer = parts.synthesizer;
    this.modifierBar = parts.modifierBar;
    this.scaler = parts.scaler;
    this.clampBinder = parts.clampBinder;
    this.pauseRelay = parts.pauseRelay;
    this.binder = parts.binder;
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
}
