import { MODULE_ID } from '../constants.js';

/**
 * The sign-in buttons say whether this browser is signed in. Added 2026-11-08.
 *
 * Lewis, 2026-11-08: "I am signed in on the module and it still says sign in". Foundry draws a settings
 * menu's button from the label given at registration, once, so "Sign in" stayed on the button after a
 * successful sign-in and read as though it had failed. Foundry has no way to change a registered label,
 * so the button's text is rewritten each time the settings window renders. Pressing it still signs in
 * again, which is how a GM switches account or recovers a session COO has ended.
 *
 * Foundry 14's button: `<button data-action="openSubmenu" data-key="<module>.<key>"><i/><span>label</span>`
 * (templates/settings/config-category.hbs).
 */
export const SIGN_IN_KEYS = ['cooSignIn', 'cooTelegramSignIn'] as const;
export const SIGNED_IN_LABEL = 'Signed in (sign in again)';

interface ButtonRoot {
  querySelectorAll(selector: string): Iterable<{ textContent: string | null }>;
}

/** Relabels the sign-in buttons under `root` when signed in. Returns how many it changed. */
export function relabelSignInButtons(root: ButtonRoot, signedIn: boolean): number {
  if (!signedIn) {
    return 0;
  }
  let changed = 0;
  for (const key of SIGN_IN_KEYS) {
    for (const span of root.querySelectorAll(`button[data-key="${MODULE_ID}.${key}"] span`)) {
      span.textContent = SIGNED_IN_LABEL;
      changed += 1;
    }
  }
  return changed;
}

interface HooksOn {
  on(name: string, fn: (app: unknown, element: unknown) => unknown): unknown;
}

const isRoot = (value: unknown): value is ButtonRoot =>
  typeof (value as { querySelectorAll?: unknown } | null)?.querySelectorAll === 'function';

/** Relabels on every render of Foundry's settings window. Never throws into Foundry's render. */
export function watchSignInLabel(hooks: HooksOn, signedIn: () => boolean): void {
  hooks.on('renderSettingsConfig', (_app, element) => {
    try {
      if (isRoot(element)) {
        relabelSignInButtons(element, signedIn());
      }
    } catch {
      /* A label is not worth breaking the settings window over. */
    }
  });
}
