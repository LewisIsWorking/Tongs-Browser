import { availableWidthBesideSidebar } from './AvailableWidth.js';
import { readCanvasPivot, readCanvasScale, readZoomLimits } from './CanvasReaders.js';
import type { CanvasLike } from '../gesture/CanvasController.js';
import type { KeyboardManagerLike } from '../modifiers/KeyboardSynthesizer.js';

/**
 * Reaching for Foundry's globals, in one place. Extracted from TongsBrowser 2026-08-12.
 *
 * ⚠️ Every method here opens with a `typeof` guard, and that is NOT redundant with the declared
 * type. A global Foundry has never defined at all throws a `ReferenceError` on plain access, and
 * `typeof` is the only way to survive it: an optional chain does not help, because the reference
 * itself is what throws.
 *
 * The arithmetic behind these answers lives in `CanvasReaders` and `AvailableWidth`, where it is
 * tested without a browser. This is the impure half, collected so the rest can be pure.
 */
export class FoundryAccess {
  public resolveKeyboardManager(): KeyboardManagerLike | null {
    if (typeof game === 'undefined') {
      return null;
    }
    return game.keyboard ?? null;
  }

  /**
   * The typeof guard is not redundant with the declared type. A global that Foundry has not defined
   * at all throws a ReferenceError on plain access, which typeof is the only way to survive.
   */
  public resolveCanvas(): CanvasLike | null {
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
  public resolveCanvasScale(): number | null {
    return readCanvasScale(typeof canvas === 'undefined' ? undefined : canvas);
  }

  /**
   * Where the viewport is centred, in scene coordinates, straight from PIXI's root container.
   *
   * Read live for the same reason the scale is: anything that moves the view without going through
   * this module, which includes Foundry's own controls, the arrow keys and a scene change, would
   * leave a remembered value stale.
   */
  public resolveCanvasPivot(): { x: number; y: number } | null {
    return readCanvasPivot(typeof canvas === 'undefined' ? undefined : canvas);
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
  public resolveAvailableWidth(): number {
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
  public resolveZoomLimits(): { minimum: number; maximum: number } {
    return readZoomLimits(typeof CONFIG === 'undefined' ? undefined : CONFIG.Canvas);
  }
}
