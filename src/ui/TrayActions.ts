import type { TrayAction } from '../modifiers/ModifierBar.js';
import { everyTrayAction } from './TrayActionList.js';

/**
 * The buttons on the action tray. Extracted from TongsBrowser 2026-08-12.
 *
 * Taken as a set of handlers rather than the module itself, so the list can be built and asserted on
 * without a canvas, a pointer, or a Foundry. What is worth protecting here is not the wiring, which
 * a build catches, but the CONTENT: which buttons exist, what each says, and which ones report a
 * state. A button whose label is wrong ships perfectly happily.
 */
export interface TrayActionHandlers {
  readonly toggleSidebar: () => void;
  readonly openCharacterSheet: () => void;
  readonly togglePause: () => void;
  readonly isPaused: () => boolean;
  readonly isDragging: () => boolean;
  readonly beginDrag: () => void;
  readonly endDrag: () => void;
  readonly whisperDiagnostics: () => void;
  /** Sends Ctrl+Z as one action. See modifiers/Chord.ts for why it is not two controls. */
  readonly undo: () => void;
  readonly zoomBy: (factor: number) => void;
  readonly panBy: (deltaX: number, deltaY: number) => void;
  readonly createSheet: () => void;
  /**
   * Whether to offer the create button at all.
   *
   * ⚠️ GM only until the relay lands. A player cannot create an actor without Foundry's
   * `ACTOR_CREATE`, and cannot be given ownership of one by anybody but a GM, so a button offered to
   * them now could only ever fail. A control that is present and cannot work is worse than one that
   * is absent: it invites a tap, and the failure reads as a broken module rather than an unfinished
   * feature.
   */
  readonly canCreateSheets: () => boolean;
  readonly managePartyAccess: () => void;
  /**
   * ⚠️ A SEPARATE gate from `canCreateSheets`, not a reuse of it, even though both are GM only today.
   * They diverge the moment the relay lands: creating opens to players in a party their GM has
   * allowed, while deciding WHICH parties those are stays a GM's alone, permanently. One flag serving
   * both would have to be split at exactly the moment it mattered most.
   */
  readonly canManagePartyAccess: () => boolean;

  /**
   * The GM map-building commands. Added 2026-09-09; see `modifiers/MapBuilding.ts`.
   *
   * ⚠️ Spread in from ONE object built where the synthesizer lives, rather than six commands wired
   * separately, for the same reason `undo` is: the tray needs commands, not a keyboard.
   */
  readonly selectAll: () => void;
  readonly cut: () => void;
  readonly copy: () => void;
  readonly paste: () => void;
  readonly sendToBack: () => void;
  readonly bringToFront: () => void;
  /**
   * ⚠️ A THIRD gate, not a reuse of `canManagePartyAccess`, though both are GM only. They answer
   * different questions, "may I restack tiles" and "who may add characters", and the cost of
   * sharing one flag is that it has to be split at exactly the moment it starts mattering. That
   * argument is written out at `canManagePartyAccess` above, and it has already paid off once, when
   * creating opened up to players and managing access did not.
   *
   * ⛔ Unlike create, there is no player version of this to grow into. Foundry refuses the underlying
   * operations to anyone who is not a GM, so a button offered to a player could only ever be silence.
   */
  readonly canBuildMaps: () => boolean;
}

/** Buttons that are only offered when their own gate says so. */
const GATED: readonly { readonly id: string; readonly allowed: keyof TrayActionHandlers }[] = [
  { id: 'create-sheet', allowed: 'canCreateSheets' },
  { id: 'party-access', allowed: 'canManagePartyAccess' },
  /* ⚠️ All six on one gate: they are one capability, and offering half of it would be worse. */
  { id: 'select-all', allowed: 'canBuildMaps' },
  { id: 'cut', allowed: 'canBuildMaps' },
  { id: 'copy', allowed: 'canBuildMaps' },
  { id: 'paste', allowed: 'canBuildMaps' },
  { id: 'send-to-back', allowed: 'canBuildMaps' },
  { id: 'bring-to-front', allowed: 'canBuildMaps' },
];

/** How far one press of a pan arrow moves the view, in screen pixels. */
export const PAN_STEP = 160;

/** The zoom factor one press applies, multiplied in or divided out. */
export const ZOOM_STEP = 1.25;

export function buildTrayActions(handlers: TrayActionHandlers): readonly TrayAction[] {
  /*
   * ⚠️ Filtered at the END rather than conditionally pushed, so `TrayActionList` stays a flat
   * description of every button that exists. A list assembled with branches in it stops being
   * readable as "these are the buttons" and becomes a thing to trace.
   */
  return everyTrayAction(handlers).filter((action) => {
    const gate = GATED.find((entry) => entry.id === action.id);
    return gate === undefined || (handlers[gate.allowed] as () => boolean)();
  });
}
