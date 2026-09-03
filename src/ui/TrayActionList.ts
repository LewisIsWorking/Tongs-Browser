import type { TrayAction } from '../modifiers/ModifierBar.js';
import { PAN_STEP, ZOOM_STEP, type TrayActionHandlers } from './TrayActions.js';

/**
 * Every button the tray can show, in the order they appear. Extracted 2026-09-03 when `TrayActions`
 * crossed the 200 line limit.
 *
 * ⚠️ A FLAT list with no branches in it, deliberately. Which buttons are actually offered is decided
 * by the gate in `TrayActions`, so this file can be read as "these are the buttons" rather than as a
 * thing to trace. A list assembled with conditions inside stops answering that question.
 */
export function everyTrayAction(handlers: TrayActionHandlers): readonly TrayAction[] {
  return [
    {
      id: 'sidebar',
      label: '☰',
      title: 'Show or hide the Foundry sidebar',
      activate: handlers.toggleSidebar,
    },
    {
      id: 'character',
      label: 'C',
      title: 'Open your character sheet',
      activate: handlers.openCharacterSheet,
    },
    /**
     * ⚠️ Beside the character button on purpose. "Open my character" and "make a character" are the
     * same errand from the user's side, and separating them across the bar would mean hunting.
     */
    {
      id: 'create-sheet',
      label: 'C+',
      title: 'Create a character sheet in a party',
      activate: handlers.createSheet,
    },
    /** ⚠️ Next to create, because "who may add characters" is a question about that button. */
    {
      id: 'party-access',
      label: 'C🔓',
      title: 'Choose which parties players may add characters to',
      activate: handlers.managePartyAccess,
    },
    {
      id: 'pause',
      label: '⏸',
      title: 'Pause or unpause the game',
      activate: handlers.togglePause,
      isActive: handlers.isPaused,
    },
    /*
     * Grab. The reason dragging a token was so hard.
     *
     * The touch gesture for a drag is tap, lift, press again inside the double tap window, hold past
     * the long press timer without moving more than the tap slop, and only then move. That is five
     * things in a row, and every one of them is a chance to get it wrong while looking at the map
     * rather than at your thumb. It works, which is why the harness passes it, but working and usable
     * are different claims.
     *
     * This holds the button down at the pointer until it is tapped again, so dragging becomes: grab,
     * move the pointer the ordinary way, drop. It is also how a window gets dragged, which is the
     * same complaint from the other end.
     *
     * ⚠️ The label CHANGES while a grab is held, and that is not decoration. Measured against a live
     * Foundry 14.365 on 2026-08-11: our pointer, Foundry's recorded drag destination and the drag
     * clone all tracked a 240px drag exactly, and the token committed to its new square. The drag was
     * never broken. What was broken was that nothing on screen said the held grab still had to be let
     * go, so a device report came back mid drag, with the token quite correctly sitting where it
     * started because Foundry only commits a move on the DROP.
     */
    {
      id: 'grab',
      label: '✋',
      getLabel: () => (handlers.isDragging() ? 'DROP' : '✋'),
      title: 'Grab and hold, then move the pointer to drag. Tap again to drop.',
      activate: () => {
        if (handlers.isDragging()) {
          handlers.endDrag();
        } else {
          handlers.beginDrag();
        }
      },
      isActive: handlers.isDragging,
    },
    {
      id: 'diagnose',
      label: '🔍',
      title: 'Whisper a diagnostic report to yourself in chat',
      activate: handlers.whisperDiagnostics,
    },
    {
      id: 'zoom-in',
      label: '+',
      title: 'Zoom in',
      activate: () => {
        handlers.zoomBy(ZOOM_STEP);
      },
    },
    {
      id: 'zoom-out',
      label: '−',
      title: 'Zoom out',
      activate: () => {
        handlers.zoomBy(1 / ZOOM_STEP);
      },
    },
    /*
     * ⚠️ The signs match panBy's finger metaphor, and they read backwards on purpose. Pressing right
     * moves the VIEW right, which is the same as dragging the map LEFT, so the delta is negated.
     * Getting this wrong produces buttons that work perfectly and go the wrong way, which no build
     * and no type can catch.
     */
    {
      id: 'pan-left',
      label: '←',
      title: 'Pan left',
      group: 'pan',
      activate: () => {
        handlers.panBy(PAN_STEP, 0);
      },
    },
    {
      id: 'pan-right',
      label: '→',
      title: 'Pan right',
      group: 'pan',
      activate: () => {
        handlers.panBy(-PAN_STEP, 0);
      },
    },
    {
      id: 'pan-up',
      label: '↑',
      title: 'Pan up',
      group: 'pan',
      activate: () => {
        handlers.panBy(0, PAN_STEP);
      },
    },
    {
      id: 'pan-down',
      label: '↓',
      title: 'Pan down',
      group: 'pan',
      activate: () => {
        handlers.panBy(0, -PAN_STEP);
      },
    },
  ];
}
