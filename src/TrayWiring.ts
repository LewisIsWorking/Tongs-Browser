import type { CanvasController } from './gesture/CanvasController.js';
import type { DragDiagnostics } from './debug/DragDiagnostics.js';
import type { FoundryActions } from './foundry/FoundryActions.js';
import type { VirtualPointer } from './pointer/VirtualPointer.js';
import { buildTrayActions } from './ui/TrayActions.js';
import type { TrayAction } from './modifiers/TrayAction.js';
import { beginCreateSheet } from './ui/CreateSheetFlow.js';
import type { CreateSheetPorts } from './ui/CreateSheetFlow.js';
import { readParties, readUsers, readViewer } from './foundry/PartyAccess.js';
import type { FoundryGame } from './foundry/PartyAccess.js';
import { createSheetWithFoundry } from './foundry/CreateSheetDeps.js';
import { beginPartyAccess } from './ui/PartyAccessFlow.js';
import { setPlayerCreation } from './foundry/PartyFlag.js';
import type { FlaggableParty } from './foundry/PartyFlag.js';
import { readChatTargets } from './debug/ChatTargets.js';
import type { ChatGlobals } from './debug/ChatTargets.js';
import { logger } from './core/Logger.js';

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
  /** Where the create flow's pickers are attached. The bar's own document, not a captured one. */
  readonly document: Document;
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
    createSheet: () => {
      beginCreateSheet(createSheetPorts(parts.document));
    },
    /*
     * ⚠️ GM only until the relay lands. A player cannot create an actor without Foundry's
     * `ACTOR_CREATE` and cannot be handed ownership by anyone but a GM, so the button could only ever
     * fail for them. Absent beats present and broken.
     */
    canCreateSheets: () => readViewer(GAME_ACCESS).isGm,
    managePartyAccess: () => {
      beginPartyAccess({
        document: parts.document,
        host: () => parts.document.body,
        readParties: () => readParties(GAME_ACCESS),
        readViewer: () => readViewer(GAME_ACCESS),
        setAccess: async (uuid, enabled) =>
          setPlayerCreation(uuid, enabled, {
            resolveParty: async (target) => {
              const resolve = (globalThis as { fromUuid?: (id: string) => Promise<unknown> })
                .fromUuid;
              if (resolve === undefined) {
                throw new Error('Foundry has no fromUuid on this client.');
              }
              return (await resolve(target)) as FlaggableParty | null;
            },
          }),
        report,
      });
    },
    /* ⚠️ Its own gate, because create opens to players with the relay and this never does. */
    canManagePartyAccess: () => readViewer(GAME_ACCESS).isGm,
  });
}

/**
 * ⚠️ The banner FIRST, the console second, and both. A phone user has no devtools, so a message only
 * in the console is a message nobody reads; and a banner alone loses the text the moment it fades.
 */
function report(message: string): void {
  readChatTargets(globalThis as ChatGlobals).notify?.(message);
  logger.warn(message);
}

/** Foundry's `game`, read live: a reconnect or a scene change replaces the collections on it. */
const GAME_ACCESS = { getGame: () => (globalThis as { game?: FoundryGame }).game };

/**
 * ⚠️ Built fresh on every tap rather than once. The party list, the user list and who is asking can
 * all change between one press and the next, and a picker built from a captured list would offer a
 * party that has since been deleted.
 */
function createSheetPorts(doc: Document): CreateSheetPorts {
  return {
    document: doc,
    host: () => doc.body,
    readParties: () => readParties(GAME_ACCESS),
    readUsers: () => readUsers(GAME_ACCESS),
    readViewer: () => readViewer(GAME_ACCESS),
    create: createSheetWithFoundry,
    report,
  };
}
