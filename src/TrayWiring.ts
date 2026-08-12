import type { CanvasController } from './gesture/CanvasController.js';
import type { DragDiagnostics } from './debug/DragDiagnostics.js';
import type { FoundryActions } from './foundry/FoundryActions.js';
import type { VirtualPointer } from './pointer/VirtualPointer.js';
import { buildTrayActions } from './ui/TrayActions.js';
import type { TrayAction } from './modifiers/TrayAction.js';

/**
 * Wiring the tray buttons to the things they drive. Extracted from TongsBrowser 2026-08-12.
 *
 * ⚠️ The pointer arrives as a THUNK rather than a reference, and that is not ceremony. The tray is
 * built while the modifier bar is being constructed, which happens before the pointer field has been
 * assigned; taking the pointer eagerly here captures `undefined` and every tray button that touches
 * it fails at the first tap, long after the code that caused it has finished running.
 */
export interface TrayWiring {
  readonly actions: FoundryActions;
  readonly pointer: () => VirtualPointer;
  readonly diagnostics: DragDiagnostics;
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
export function wireTrayActions(
  canvasController: CanvasController,
  parts: TrayWiring
): readonly TrayAction[] {
  return buildTrayActions({
    toggleSidebar: () => {
      parts.actions.toggleFoundrySidebar();
    },
    openCharacterSheet: () => {
      parts.actions.openCharacterSheet();
    },
    togglePause: () => {
      parts.actions.togglePause();
    },
    isPaused: () => (globalThis as { game?: { paused?: boolean } }).game?.paused === true,
    isDragging: () => parts.pointer().isDragging(),
    beginDrag: () => {
      parts.pointer().beginDrag();
    },
    endDrag: () => {
      parts.pointer().endDrag();
    },
    whisperDiagnostics: () => {
      parts.diagnostics.whisperDiagnostics();
    },
    zoomBy: (factor) => {
      canvasController.zoomBy(factor);
    },
    panBy: (deltaX, deltaY) => {
      canvasController.panBy(deltaX, deltaY);
    },
  });
}
