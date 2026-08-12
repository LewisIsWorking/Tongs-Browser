import type { KeyboardSynthesizer } from './KeyboardSynthesizer.js';
import type { BarPosition } from './BarPosition.js';
import type { TrayAction } from './TrayAction.js';
import type { ModifierFlags } from '../pointer/ModifierFlags.js';

/**
 * What a modifier bar is built with. Its own file 2026-08-12, so the bar stays the behaviour and
 * this stays the contract. Callers read this without needing the implementation.
 */
export interface ModifierBarOptions {
  readonly document: Document;
  readonly synthesizer: KeyboardSynthesizer;
  /** Called whenever the held modifiers change, so the pointer can carry the new flags. */
  readonly onFlagsChanged: (flags: ModifierFlags) => void;
  readonly initialPosition?: BarPosition;
  readonly onPositionChanged?: (position: BarPosition) => void;
  readonly initialCollapsed?: boolean;
  readonly onCollapsedChanged?: (collapsed: boolean) => void;
  /**
   * The width the bar is allowed to occupy, which is not always the width of the window.
   *
   * Injected rather than read from the DOM here, so the clamp stays testable without a layout
   * engine and so this component keeps knowing nothing about Foundry's markup. Defaults to the
   * whole window, which is the right answer when nothing is in the way.
   */
  readonly getAvailableWidth?: () => number;
  /** Utility buttons shown on the bar itself, kept visible even when the keys are collapsed. */
  readonly trayActions?: readonly TrayAction[];
}
