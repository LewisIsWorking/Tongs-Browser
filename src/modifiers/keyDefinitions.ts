/**
 * The keys the bar offers, described by the fields a KeyboardEvent needs.
 *
 * `code` is the field that matters. Foundry's keybinding system is code based throughout, so a
 * synthesised event carrying only `key` is invisible to it. `key`, `keyCode` and `which` are set
 * as well because older third party listeners still read them, and keyCode in particular is
 * deprecated but far from dead in the module ecosystem.
 */
export interface KeyDefinition {
  /** KeyboardEvent.code. The one Foundry's keybindings match on. */
  readonly code: string;
  /** KeyboardEvent.key. */
  readonly key: string;
  /** Legacy KeyboardEvent.keyCode and which. */
  readonly keyCode: number;
  readonly label: string;
  /** Sticky modifiers latch. Everything else fires once and releases. */
  readonly sticky: boolean;
}

export const MODIFIER_KEYS: readonly KeyDefinition[] = Object.freeze([
  { code: 'ControlLeft', key: 'Control', keyCode: 17, label: 'Ctrl', sticky: true },
  { code: 'ShiftLeft', key: 'Shift', keyCode: 16, label: 'Shift', sticky: true },
  { code: 'AltLeft', key: 'Alt', keyCode: 18, label: 'Alt', sticky: true },
]);

export const MOMENTARY_KEYS: readonly KeyDefinition[] = Object.freeze([
  { code: 'Space', key: ' ', keyCode: 32, label: 'Space', sticky: false },
  { code: 'Delete', key: 'Delete', keyCode: 46, label: 'Del', sticky: false },
  { code: 'Escape', key: 'Escape', keyCode: 27, label: 'Esc', sticky: false },
  { code: 'Enter', key: 'Enter', keyCode: 13, label: 'Enter', sticky: false },
  { code: 'Tab', key: 'Tab', keyCode: 9, label: 'Tab', sticky: false },
]);
