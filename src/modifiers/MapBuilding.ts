import { sendChord, type ChordPorts } from './Chord.js';
import { CONTROL } from './keyDefinitions.js';
import {
  BRING_TO_FRONT_KEY,
  COPY_KEY,
  CUT_KEY,
  PASTE_KEY,
  SELECT_ALL_KEY,
  SEND_TO_BACK_KEY,
} from './mapBuildingKeys.js';

/**
 * The six GM map-building commands, as things a button can call. Added 2026-09-09.
 *
 * ⛔ WHY THESE SIX AND NOTHING ELSE. `scripts/keybindings/coverage.ts` records how a phone reaches
 * each of Foundry's 37 keybindings, and it listed nineteen it could not. Most of those are honest
 * non-gaps: the diagonal pans compose from the straight ones, token movement is what dragging is
 * for, push-to-talk is audio this module does not touch. These six were the residue that a real user
 * genuinely could not do at all, and they share a single description: a GM building a map on a phone
 * cannot select, cut, copy, paste, or restack anything.
 *
 * ⚠️ ONE OBJECT rather than six fields threaded through the wiring. `TrayWiring` is at 169 of the 200
 * line limit and takes `undo` as a single command for the same reason: the tray needs commands, not a
 * keyboard, and handing it the synthesizer is how a wiring module starts sending keys of its own.
 *
 * ⚠️ Takes `ChordPorts` rather than the synthesizer, so a test drives all six with three functions
 * and asserts the exact key sequence each one sends. That is the assertion with teeth here: a
 * command that sends the WRONG key compiles, renders, and fails silently on a GM's phone.
 */
export interface MapBuildingCommands {
  readonly selectAll: () => void;
  readonly cut: () => void;
  readonly copy: () => void;
  readonly paste: () => void;
  readonly sendToBack: () => void;
  readonly bringToFront: () => void;
}

export function buildMapBuildingCommands(ports: ChordPorts): MapBuildingCommands {
  return {
    selectAll: () => {
      sendChord(ports, [CONTROL], SELECT_ALL_KEY);
    },
    cut: () => {
      sendChord(ports, [CONTROL], CUT_KEY);
    },
    copy: () => {
      sendChord(ports, [CONTROL], COPY_KEY);
    },
    paste: () => {
      sendChord(ports, [CONTROL], PASTE_KEY);
    },
    /*
     * ⚠️ `tap`, NOT `sendChord`. Foundry binds sendToBack and bringToFront to the bare bracket keys,
     * so wrapping them in Ctrl to match the four above would send a chord nothing is listening for.
     * See mapBuildingKeys.ts.
     */
    sendToBack: () => {
      ports.tap(SEND_TO_BACK_KEY);
    },
    bringToFront: () => {
      ports.tap(BRING_TO_FRONT_KEY);
    },
  };
}
