import { ModifierBar } from './modifiers/ModifierBar.js';
import { wireTrayActions } from './TrayWiring.js';
import type { CanvasController } from './gesture/CanvasController.js';
import type { DragDiagnostics } from './debug/DragDiagnostics.js';
import type { FoundryAccess } from './foundry/FoundryAccess.js';
import type { FoundryActions } from './foundry/FoundryActions.js';
import type { KeyboardSynthesizer } from './modifiers/KeyboardSynthesizer.js';
import type { TongsBrowserOptions } from './TongsBrowserOptions.js';
import type { VirtualPointer } from './pointer/VirtualPointer.js';

/**
 * Building the modifier bar and everything it drives. Extracted from ModuleParts 2026-08-12.
 *
 * Extracted because the composition factory reached the 200 line limit and this was its largest
 * single block. It is also the one construction with real ordering in it: the bar is built BEFORE
 * the pointer field is assigned, so anything reaching for the pointer here has to be a thunk rather
 * than a value. Taking it eagerly captures `undefined` and fails on the first tap, which is exactly
 * the regression that shipped a module with no bar and no cursor.
 */
export interface ModifierBarDeps {
  readonly document: Document;
  readonly options: TongsBrowserOptions;
  readonly synthesizer: KeyboardSynthesizer;
  readonly access: FoundryAccess;
  readonly actions: FoundryActions;
  readonly diagnostics: DragDiagnostics;
  readonly canvasController: CanvasController;
  /** ⚠️ A THUNK. See the note above: the pointer does not exist yet when this runs. */
  readonly pointer: () => VirtualPointer;
}

export function buildModifierBar(deps: ModifierBarDeps): ModifierBar {
  return new ModifierBar({
    document: deps.document,
    synthesizer: deps.synthesizer,
    // Held modifiers must reach the pointer too. Foundry reads its own keyboard state for some
    // decisions and the event flags for others, so both paths have to agree.
    onFlagsChanged: (flags) => {
      deps.pointer().setModifiers(flags);
    },
    ...(deps.options.initialBarPosition === undefined
      ? {}
      : { initialPosition: deps.options.initialBarPosition }),
    ...(deps.options.onBarPositionChanged === undefined
      ? {}
      : { onPositionChanged: deps.options.onBarPositionChanged }),
    getAvailableWidth: () => deps.access.resolveAvailableWidth(),
    /*
     * ⚠️ The single most useful line in a device report, and it took four rounds to add. The user
     * discovered "dragging works with the hand off, and breaks with it on" by experiment; the report
     * could not have said it, because nothing recorded that a button had been pressed at all.
     */
    onTrayActivated: (actionId) => {
      deps.diagnostics.recordUi(`tray '${actionId}' pressed`);
    },
    trayActions: wireTrayActions(deps.canvasController, {
      actions: deps.actions,
      // A thunk, because the pointer field is not assigned until after the bar is built.
      pointer: deps.pointer,
      diagnostics: deps.diagnostics,
    }),
  });
}
