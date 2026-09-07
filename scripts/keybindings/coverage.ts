import { CORE_BINDINGS, type FoundryBinding } from './snapshot.ts';

/**
 * How a phone reaches each of Foundry's keybindings, or why it does not. Added 2026-09-07.
 *
 * ⛔ WHY THIS EXISTS. The target key was found by hand, by listing Foundry's bindings and noticing
 * that the one deciding who an attack is against was the one a phone could not press. That worked,
 * and it worked by luck: nothing said what was reachable, so nothing said what was missing either.
 * The same fault this repo keeps meeting from different directions, that an answer exists and nobody
 * looks, applies to its own feature coverage.
 *
 * ⚠️ THREE ROUTES ARE ALL REAL, and lumping them together is what makes a coverage claim useless.
 * A binding on the bar and a binding reachable by tapping Foundry's own on-screen control are both
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
  moveDownRight: { kind: 'gap', note: 'Drag the token instead.' },
  descend: {
    kind: 'gap',
    note: 'Drag the token instead. Elevation is also editable on the sheet.',
  },

  /*
   * ⛔ THE REAL GAPS, and they are GM map-building rather than play. A player at a table does not
   * copy tiles or send them to the back; a GM building a map on a phone would, and cannot.
   */
  selectAll: { kind: 'gap', note: 'GM. Drag-select still works, so this is bulk convenience.' },
  undo: {
    kind: 'gap',
    note: 'GM. No on-screen equivalent: a mis-drag cannot be undone from a phone.',
  },
  cut: { kind: 'gap', note: 'GM map-building. No on-screen equivalent.' },
  copy: { kind: 'gap', note: 'GM map-building. No on-screen equivalent.' },
  paste: { kind: 'gap', note: 'GM map-building. No on-screen equivalent.' },
  sendToBack: { kind: 'gap', note: 'GM map-building. No on-screen equivalent.' },
  bringToFront: { kind: 'gap', note: 'GM map-building. No on-screen equivalent.' },

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

export interface CoverageProblem {
  readonly binding: string;
  readonly reason: string;
}

/**
 * Every binding must have a route, and every route must still point at something that exists.
 *
 * ⚠️ The second half is the part with teeth. A table saying "target is reached by the bar key KeyT"
 * is worth nothing if nobody notices when KeyT is removed, and that is exactly how a coverage
 * document rots into a lie while reading as authoritative.
 */
export function findProblems(
  barCodes: ReadonlySet<string>,
  trayIds: ReadonlySet<string>,
  bindings: readonly FoundryBinding[] = CORE_BINDINGS,
  routes: Readonly<Record<string, Route>> = ROUTES
): CoverageProblem[] {
  const problems: CoverageProblem[] = [];

  for (const binding of bindings) {
    const route = routes[binding.name];
    if (route === undefined) {
      problems.push({
        binding: binding.name,
        reason: `is not accounted for. Foundry binds it to ${binding.keys.join(' or ')}; say whether a phone can reach it`,
      });
      continue;
    }
    if (route.kind === 'bar' && !barCodes.has(route.via)) {
      problems.push({
        binding: binding.name,
        reason: `claims the bar key ${route.via}, which the bar no longer offers`,
      });
    }
    if (route.kind === 'tray' && !trayIds.has(route.via)) {
      problems.push({
        binding: binding.name,
        reason: `claims the tray button ${route.via}, which the control pad no longer offers`,
      });
    }
  }

  for (const name of Object.keys(routes)) {
    if (!bindings.some((binding) => binding.name === name)) {
      problems.push({ binding: name, reason: 'is routed here but Foundry no longer registers it' });
    }
  }

  return problems;
}

export function countByKind(
  routes: Readonly<Record<string, Route>> = ROUTES
): Record<string, number> {
  const counts: Record<string, number> = { bar: 0, tray: 0, ui: 0, gap: 0 };
  for (const route of Object.values(routes)) {
    counts[route.kind] = (counts[route.kind] ?? 0) + 1;
  }
  return counts;
}
