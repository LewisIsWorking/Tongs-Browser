/**
 * How a phone reaches each of Foundry's keybindings, or why it does not. Extracted 2026-09-10.
 *
 * ⚠️ SPLIT OUT OF coverage.ts when routing the four bindings 14.367 added took that file to 223 of
 * the 200 line limit. The rule is extract rather than trim, and the seam is a real one: this file is
 * WHAT THE ROUTES ARE, and `coverage.ts` is HOW THEY ARE CHECKED. A table of decisions and the
 * machinery that validates them change for different reasons and are read for different reasons.
 *
 * ⛔ WHY THE TABLE EXISTS AT ALL. The target key was found by hand, by listing Foundry's bindings and
 * noticing that the one deciding who an attack is against was the one a phone could not press. That
 * worked, and it worked by luck: nothing said what was reachable, so nothing said what was missing
 * either.
 *
 * ⚠️ THREE ROUTES ARE ALL REAL, and lumping them together is what makes a coverage claim useless. A
 * binding on the bar and one reachable by tapping Foundry's own on-screen control are both
 * "reachable", but only the first is this module's doing, and only the second breaks if Foundry
 * rearranges its UI. A `gap` is neither, and has to say what it costs.
 */
export type Route =
  /** A key on the modifier bar. `via` is the KeyboardEvent.code it sends. */
  | { readonly kind: 'bar'; readonly via: string; readonly note?: string }
  /** A button on the control pad. `via` is the tray action id. */
  | { readonly kind: 'tray'; readonly via: string; readonly note?: string }
  /** Foundry's own on-screen UI, with no keyboard involved. `via` names where. */
  | { readonly kind: 'ui'; readonly via: string; readonly note: string }
  /** Not reachable. `note` says what a user cannot do, so the cost is written down. */
  | { readonly kind: 'gap'; readonly note: string };

/**
 * ⚠️ EVERY binding in the snapshot must appear here, and the check fails when one does not. That is
 * the whole mechanism: a Foundry upgrade that adds a keybinding forces somebody to decide which of
 * the four this is, rather than the new capability being quietly absent.
 */
export const ROUTES: Readonly<Record<string, Route>> = Object.freeze({
  dismiss: { kind: 'bar', via: 'Escape' },
  cycleView: { kind: 'bar', via: 'Tab' },
  pause: { kind: 'bar', via: 'Space', note: 'Also the ⏸ tray button, which shows the state.' },
  delete: { kind: 'bar', via: 'Delete' },
  highlight: { kind: 'bar', via: 'AltLeft', note: 'Latched rather than held, which is the point.' },
  target: { kind: 'bar', via: 'KeyT', note: 'Latch Shift first to add rather than replace.' },
  characterSheet: { kind: 'tray', via: 'character' },
  /* ⚠️ A CHORD behind one button, not a Ctrl latch plus a Z key. See src/modifiers/Chord.ts. */
  undo: { kind: 'tray', via: 'undo', note: 'Sends Ctrl+Z as a single action.' },
  zoomIn: { kind: 'tray', via: 'zoom-in' },
  zoomOut: { kind: 'tray', via: 'zoom-out' },
  panUp: { kind: 'tray', via: 'pan-up' },
  panDown: { kind: 'tray', via: 'pan-down' },
  panLeft: { kind: 'tray', via: 'pan-left' },
  panRight: { kind: 'tray', via: 'pan-right' },

  ruler: {
    kind: 'ui',
    via: 'the token scene controls',
    note: 'The handler only calls ui.controls.activate({tool: "ruler"}), so tapping the ruler tool does exactly what the key does. A convenience, not a capability.',
  },
  executeMacro: {
    kind: 'ui',
    via: 'the hotbar',
    note: 'The hotbar is on screen and its slots are tappable, so the number keys are a shortcut to something already reachable.',
  },
  swapMacroPage: {
    kind: 'ui',
    via: 'the hotbar page arrows',
    note: 'Same as executeMacro: the page controls are on screen.',
  },
  focusChat: {
    kind: 'ui',
    via: 'the chat input',
    note: 'Tapping the chat box focuses it, and that is also what raises the on-screen keyboard, which the key alone would not.',
  },

  /*
   * ⚠️ The diagonal pans and the numpad duplicates. Not a gap worth a button: the four straight pans
   * compose, and two taps reach every diagonal without four more controls on a 412px bar.
   */
  panUpLeft: { kind: 'gap', note: 'Compose pan-up and pan-left. Two taps, no new control.' },
  panUpRight: { kind: 'gap', note: 'Compose pan-up and pan-right.' },
  panDownLeft: { kind: 'gap', note: 'Compose pan-down and pan-left.' },
  panDownRight: { kind: 'gap', note: 'Compose pan-down and pan-right.' },

  /*
   * ⚠️ Token movement by key. Dragging is the mobile answer and it is measured working, so these are
   * a second route to something reachable rather than a missing capability. Worth revisiting only if
   * dragging on a phone proves worse than tapping a direction six times.
   */
  moveUp: { kind: 'gap', note: 'Drag the token instead; the grab button exists for this.' },
  moveDown: { kind: 'gap', note: 'Drag the token instead.' },
  moveLeft: { kind: 'gap', note: 'Drag the token instead.' },
  moveRight: { kind: 'gap', note: 'Drag the token instead.' },

  /*
   * ⚠️ THE DIAGONAL MOVES SHIP UNBOUND, all four of them, measured from 14.367 on 2026-09-10.
   * Foundry registers them with no `editable` array, so nobody can press them on any device until
   * they assign a key themselves. Adding buttons for them would give a phone something a DESKTOP
   * does not have by default, which is not what this module is for: the job is to reach what
   * Foundry offers, not to invent a control set.
   *
   * ⛔ moveDownRight was `KeyE` at 14.366 and is unbound at 14.367; KeyE now belongs to `ascend`.
   * The note here did not change, and that is exactly the danger: a routing decision stays green
   * and keeps reading sensibly while the key underneath it has moved to another capability.
   */
  moveUpLeft: { kind: 'gap', note: 'Unbound in core, and dragging is the mobile answer anyway.' },
  moveUpRight: { kind: 'gap', note: 'Unbound in core; drag the token instead.' },
  moveDownLeft: { kind: 'gap', note: 'Unbound in core; drag the token instead.' },
  moveDownRight: { kind: 'gap', note: 'Unbound in core since 14.367; drag the token instead.' },

  /*
   * ⭐ ASCEND IS NEW IN 14.367 and it is a real capability, not a convenience: elevation is how a
   * flying or climbing token is placed, and a phone has no way to send KeyE. It is a gap of the same
   * shape as `descend`, which is why both point at the same alternative rather than one being
   * treated as the important half of a pair.
   */
  ascend: {
    kind: 'gap',
    note: 'Added in 14.367 on KeyE. Elevation is editable on the sheet, which is the way in for now.',
  },
  descend: {
    kind: 'gap',
    note: 'Drag the token instead. Elevation is also editable on the sheet.',
  },

  /*
   * ✅ CLOSED 2026-09-09. These were the real gaps: GM map-building rather than play. A player at a
   * table does not copy tiles or send them to the back; a GM building a map on a phone would, and
   * could not. All six are now buttons in a gated `map` cluster on the control pad.
   *
   * ⛔ FOUR ARE CHORDS AND TWO ARE NOT. selectAll/cut/copy/paste send Ctrl+A/X/C/V, while sendToBack
   * and bringToFront send the BARE bracket keys, because that is what Foundry binds them to. Wrapping
   * the last two in Ctrl to match their neighbours would have shipped two buttons indistinguishable
   * from the four that work and doing nothing at all. See `src/modifiers/mapBuildingKeys.ts`.
   */
  selectAll: { kind: 'tray', via: 'select-all', note: 'Sends Ctrl+A. GM only.' },
  cut: { kind: 'tray', via: 'cut', note: 'Sends Ctrl+X. GM only.' },
  copy: { kind: 'tray', via: 'copy', note: 'Sends Ctrl+C. GM only.' },
  paste: { kind: 'tray', via: 'paste', note: 'Sends Ctrl+V. GM only.' },
  sendToBack: { kind: 'tray', via: 'send-to-back', note: 'Sends a bare [, not a chord. GM only.' },
  bringToFront: {
    kind: 'tray',
    via: 'bring-to-front',
    note: 'Sends a bare ], not a chord. GM only.',
  },

  unconstrainedMovement: {
    kind: 'gap',
    note: 'Held while dragging to ignore grid and wall constraints. A held key during a drag is awkward on a phone, and the sticky bar releases on the next action rather than on drop.',
  },
  rulerWaypoint: {
    kind: 'gap',
    note: 'Waypoints can already be placed by dragging the ruler out; the key is the keyboard route to the same thing.',
  },
  pushToTalk: { kind: 'gap', note: 'Audio/video, which this module does not touch.' },
});
