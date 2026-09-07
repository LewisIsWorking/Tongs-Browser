/**
 * Every keybinding core Foundry registers, measured 2026-09-07 from 14.366's own source.
 *
 * Read out of `client/helpers/interaction/client-keybindings.mjs` rather than from the settings UI or
 * from memory, because that file IS the registration and cannot disagree with itself.
 *
 * ⚠️ A SNAPSHOT, deliberately, rather than reading the installed Foundry at check time. The guard has
 * to run in CI, where there is no Foundry, and a check that silently skips is not a check. The cost
 * is that this list goes stale when Foundry changes, which is why it carries the version it was taken
 * from and why `docs/MANUAL-TESTING.md` says to re-take it on a version bump.
 *
 * ⚠️ `executeMacro<n>` and `swapMacroPage<n>` are registered in LOOPS with computed names. They are
 * recorded once each, under the name the loop builds from, because what matters here is that the
 * capability is accounted for and not how many numbered copies of it exist.
 */
export interface FoundryBinding {
  /** The name core registers it under, second argument to `game.keybindings.register`. */
  readonly name: string;
  /** The default keys, as `code` values, with a `CONTROL+`/`SHIFT+` prefix where one is required. */
  readonly keys: readonly string[];
}

export const FOUNDRY_VERSION = '14.366';

export const CORE_BINDINGS: readonly FoundryBinding[] = Object.freeze([
  { name: 'dismiss', keys: ['Escape'] },
  { name: 'cycleView', keys: ['Tab'] },
  { name: 'pause', keys: ['Space'] },
  { name: 'delete', keys: ['Delete'] },
  { name: 'highlight', keys: ['AltLeft', 'AltRight'] },
  { name: 'selectAll', keys: ['CONTROL+KeyA'] },
  { name: 'undo', keys: ['CONTROL+KeyZ'] },
  { name: 'cut', keys: ['CONTROL+KeyX'] },
  { name: 'copy', keys: ['CONTROL+KeyC'] },
  { name: 'paste', keys: ['CONTROL+KeyV'] },
  { name: 'sendToBack', keys: ['BracketLeft'] },
  { name: 'bringToFront', keys: ['BracketRight'] },
  { name: 'target', keys: ['KeyT'] },
  { name: 'ruler', keys: ['KeyR'] },
  { name: 'unconstrainedMovement', keys: ['KeyU'] },
  { name: 'characterSheet', keys: ['KeyC'] },
  { name: 'moveUp', keys: ['KeyW'] },
  { name: 'moveLeft', keys: ['KeyA'] },
  { name: 'moveDown', keys: ['KeyS'] },
  { name: 'moveRight', keys: ['KeyD'] },
  { name: 'moveDownRight', keys: ['KeyE'] },
  { name: 'descend', keys: ['KeyQ'] },
  { name: 'panUp', keys: ['ArrowUp', 'Numpad8'] },
  { name: 'panLeft', keys: ['ArrowLeft', 'Numpad4'] },
  { name: 'panDown', keys: ['ArrowDown', 'Numpad2'] },
  { name: 'panRight', keys: ['ArrowRight', 'Numpad6'] },
  { name: 'panUpLeft', keys: ['Numpad7'] },
  { name: 'panUpRight', keys: ['Numpad9'] },
  { name: 'panDownLeft', keys: ['Numpad1'] },
  { name: 'panDownRight', keys: ['Numpad3'] },
  { name: 'zoomIn', keys: ['PageUp', 'NumpadAdd'] },
  { name: 'zoomOut', keys: ['PageDown', 'NumpadSubtract'] },
  { name: 'rulerWaypoint', keys: ['KeyF'] },
  { name: 'executeMacro', keys: ['Digit1'] },
  { name: 'swapMacroPage', keys: ['CONTROL+Digit1'] },
  { name: 'pushToTalk', keys: ['Backquote'] },
  { name: 'focusChat', keys: ['SHIFT+KeyC'] },
]);
