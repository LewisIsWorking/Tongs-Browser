/**
 * The four modifier flags carried on every synthesised event.
 *
 * Setting these is necessary but not sufficient. Foundry's KeyboardManager tracks held modifiers in
 * its own set, and a great deal of core and PF2e code asks game.keyboard rather than reading the
 * event, so the modifier bar has to dispatch real KeyboardEvents as well. This type covers only the
 * event side of that pair.
 */
export interface ModifierFlags {
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
}

export const NO_MODIFIERS: ModifierFlags = Object.freeze({
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
});

export function createModifierFlags(overrides: Partial<ModifierFlags> = {}): ModifierFlags {
  return Object.freeze({ ...NO_MODIFIERS, ...overrides });
}
