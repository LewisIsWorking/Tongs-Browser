import { describe, expect, it, vi } from 'vitest';

import type { CooClient } from '../../src/bands/CooClient.js';
import {
  relabelSignInButtons,
  SIGNED_IN_LABEL,
  watchSignInLabel,
} from '../../src/bands/signInLabel.js';
import { registerBandMenus } from '../../src/bands/startBands.js';

/** Lewis, 2026-11-08: signed in, and the settings button still said "Sign in". */
const settingsWindow = () => {
  const root = document.createElement('section');
  root.innerHTML = [
    '<button data-action="openSubmenu" data-key="tongs-browser.cooSignIn"><i></i><span>Sign in</span></button>',
    '<button data-action="openSubmenu" data-key="tongs-browser.cooTelegramSignIn"><i></i><span>Sign in with Telegram</span></button>',
    '<button data-action="openSubmenu" data-key="tongs-browser.tongsActivity"><i></i><span>Show activity</span></button>',
  ].join('');
  return root;
};
const labels = (root: HTMLElement) =>
  [...root.querySelectorAll('button span')].map((s) => s.textContent);

describe('the sign-in buttons', () => {
  it('say signed in, on both sign-in buttons and nothing else', () => {
    const root = settingsWindow();
    expect(relabelSignInButtons(root, true)).toBe(2);
    expect(labels(root)).toEqual([SIGNED_IN_LABEL, SIGNED_IN_LABEL, 'Show activity']);
  });

  it('keep "Sign in" when this browser is not signed in', () => {
    const root = settingsWindow();
    expect(relabelSignInButtons(root, false)).toBe(0);
    expect(labels(root)).toEqual(['Sign in', 'Sign in with Telegram', 'Show activity']);
  });

  it('are relabelled each time the settings window renders, reading the state then', () => {
    let render: (app: unknown, element: unknown) => unknown = () => undefined;
    const hooks = { on: vi.fn((_name: string, fn: typeof render) => (render = fn)) };
    let signedIn = false;
    watchSignInLabel(hooks, () => signedIn);
    expect(hooks.on).toHaveBeenCalledWith('renderSettingsConfig', expect.any(Function));

    const before = settingsWindow();
    render({}, before);
    expect(labels(before)[0]).toBe('Sign in');

    signedIn = true;
    const after = settingsWindow();
    render({}, after);
    expect(labels(after)[0]).toBe(SIGNED_IN_LABEL);
  });

  it('are wired up when the menus register, and need Foundry's hooks only if it has them', () => {
    const on = vi.fn();
    registerBandMenus({}, {} as CooClient, { Hooks: { on } });
    expect(on).toHaveBeenCalledWith('renderSettingsConfig', expect.any(Function));
    expect(() => {
      registerBandMenus({}, {} as CooClient, {});
    }).not.toThrow();
  });

  it('never break the settings window: no element, or a state that throws', () => {
    let render: (app: unknown, element: unknown) => unknown = () => undefined;
    watchSignInLabel({ on: (_n, fn) => (render = fn) }, () => {
      throw new Error('settings not ready');
    });
    expect(() => render({}, undefined)).not.toThrow();
    expect(() => render({}, settingsWindow())).not.toThrow();
  });
});
