/**
 * Every keybinding core Foundry registers, re-measured 2026-09-10 from 14.367's own source.
 *
 * Read out of `client/helpers/interaction/client-keybindings.mjs` rather than from the settings UI or
 * from memory, because that file IS the registration and cannot disagree with itself.
 *
 * ⚠️ A SNAPSHOT, deliberately, rather than reading the installed Foundry at check time. The guard has
 * to run in CI, where there is no Foundry, and a check that silently skips is not a check. The cost
 * is that this list goes stale when Foundry changes, which is why it carries the version it was taken
 * from.
 *
 * ⛔ THAT COST WENT UNPAID FOR A DAY, and the fix is now a command rather than a habit. Freshness
 * used to be enforced by a line in `docs/MANUAL-TESTING.md` asking a human to re-take this on a
 * version bump. Nothing checked, so on 14.367 the coverage guard reported "all 37 accounted for"
 * while four bindings were unrouted and `KeyE` had moved from `moveDownRight` to a new `ascend`.
 * Run `npm run check:keybindings:live` against a live Foundry and it compares this file to what that
 * Foundry actually registered. A check whose inputs are all ours can only prove we agree with
 * ourselves.
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

export const FOUNDRY_VERSION = '14.367';

export const CORE_BINDINGS: readonly FoundryBinding[] = Object.freeze([
  { name: 'dismiss', keys: ['Escape'] },
  { name: 'cycleView', keys: ['Tab'] },
  { name: 'pause', keys: ['Space'] },
  /*
   * ⚠️ TWO keys, and the second was missing until the live freshness check found it on 2026-09-10.
   * Foundry registers `Delete` as UNEDITABLE and `Backspace` as EDITABLE; whoever took this snapshot
   * by hand read the first list and not the second. It changes no routing decision here, because the
   * bar offers Delete, but it is exactly the kind of quiet incompleteness a hand-copied snapshot
   * accumulates and nothing had ever been in a position to notice.
   */
  { name: 'delete', keys: ['Delete', 'Backspace'] },
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
  /*
   * ⛔ RE-TAKEN AT 14.367, 2026-09-10, and KeyE CHANGED HANDS. At 14.366 this snapshot recorded
   * `moveDownRight: ['KeyE']`. In 14.367 moveDownRight is registered with no `editable` array at
   * all, and KeyE belongs to the new `ascend`. A key that changes meaning between versions is worse
   * than one that disappears: every routing decision made about it stays compiling and stays green
   * while pointing at a different capability.
   *
   * ⚠️ An EMPTY keys array means Foundry registers the binding and ships it UNBOUND, so it is
   * reachable from no keyboard either until a user assigns one. That is a different fact from "this
   * phone cannot press it", and the coverage table says so rather than lumping them together.
   */
  { name: 'moveUpLeft', keys: [] },
  { name: 'moveUpRight', keys: [] },
  { name: 'moveDownLeft', keys: [] },
  { name: 'moveDownRight', keys: [] },
  { name: 'ascend', keys: ['KeyE'] },
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
