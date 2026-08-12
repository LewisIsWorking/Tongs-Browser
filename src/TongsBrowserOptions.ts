import type { BarPosition } from './modifiers/BarPosition.js';
import type { GestureConfig } from './gesture/GestureTypes.js';

/**
 * What the module is built with. Its own file 2026-08-12, so the module stays the behaviour and this
 * stays the contract, and so `ModuleParts` can name it without importing the class it builds.
 */
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
