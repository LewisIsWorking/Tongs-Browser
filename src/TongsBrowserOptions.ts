import type { BarPosition } from './modifiers/BarPosition.js';
import type { GestureConfig } from './gesture/GestureTypes.js';

/**
 * What the module is built with. Its own file 2026-08-12, so the module stays the behaviour and this
 * stays the contract, and so `ModuleParts` can name it without importing the class it builds.
 */
export interface TongsBrowserOptions {
  readonly document: Document;
  readonly window: Window;
  /**
   * The window events are attributed to, as `UIEvent.view`. Defaults to `window`.
   *
   * ⚠️ Separate from `window` for the same reason `PointerStack` separates them: vitest's jsdom
   * window is not a BRANDED Window, so `new PointerEvent({ view })` rejects it with "member view is
   * not of type Window". A suite that constructs the whole module has to be able to omit it. The
   * viewport still has to be read from somewhere, hence two fields.
   */
  readonly eventView?: Window;
  readonly gestureConfig?: Partial<GestureConfig>;
  readonly suppressNativeTouch?: () => boolean;
  readonly modifierBarEnabled?: boolean;
  readonly initialBarPosition?: BarPosition;
  readonly onBarPositionChanged?: (position: BarPosition) => void;
  readonly uiScale?: number;
  readonly cursorSize?: number;
  readonly debugOverlay?: boolean;
}
