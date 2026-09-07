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
  /**
   * Hover and long-press text, for a key whose label does not say what it does.
   *
   * ⚠️ Optional because most of these ARE their own explanation: a button reading `Ctrl` or `Esc`
   * needs nothing added, and a title restating the obvious for the other eight would be noise to
   * keep correct. A key labelled with a symbol is the case this exists for.
   */
  readonly title?: string;
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
  /**
   * Target. Added 2026-09-07, and it is a capability rather than a convenience: without a keyboard
   * there was NO way to target a token at all, and most systems resolve an attack against a target.
   *
   * ✅ Measured from Foundry 14.366's own source, not assumed.
   * `client/helpers/interaction/client-keybindings.mjs`:
   *
   *     game.keybindings.register("core", "target", {
   *       editable: [{key: "KeyT"}],
   *       onDown: ClientKeybindings.#onTarget,
   *       reservedModifiers: [SHIFT]
   *     });
   *
   * ⭐ AND IT ACTS ON THE HOVERED TOKEN, which is why a synthesised key is enough here. `#onTarget`
   * reads `canvas.activeLayer.hover` rather than any real cursor position, and this module's virtual
   * pointer already sets that. It also TOGGLES, so tapping a targeted token clears it:
   *
   *     const hovered = layer.hover;
   *     if ( !hovered ) return false;
   *     hovered.setTarget(!hovered.isTargeted, {releaseOthers: !context.isShift});
   *
   * ⭐ SHIFT COMES FREE, and correctly. `releaseOthers: !context.isShift` makes Shift+T add to the
   * targets instead of replacing them, and Foundry reads that from its own `downKeys`, which the
   * sticky Shift latch is already in (ADR 0004). So "latch Shift, tap 🎯 twice" multi-targets, with
   * no code here knowing anything about it.
   *
   * ⚠️ Returns false unless the TOKEN layer is active, so this does nothing while the user is on
   * tiles or walls. That is Foundry's rule, not ours, and the key simply having no effect there is
   * the same as on desktop.
   */
  {
    code: 'KeyT',
    key: 't',
    keyCode: 84,
    label: '🎯',
    title: 'Target the token under the pointer. Latch Shift first to add to your targets.',
    sticky: false,
  },
]);
