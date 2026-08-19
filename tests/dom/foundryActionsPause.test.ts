import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FoundryActions } from '../../src/foundry/FoundryActions.js';

/**
 * Carrying out what the PAUSE button decided.
 *
 * ⚠️ Every DECISION here lives in its own module and is already tested. What was not tested is the
 * WIRING: whether each decision reaches the effect it names. That is the half where a regression is
 * silent, because the decision modules stay green while the button does nothing or does the wrong
 * thing.
 *
 * These drive the real globals rather than stubbing the decision functions, so a change to either
 * side shows up here. Stubbing the decisions would test that this file calls functions, which is the
 * mechanism rather than the outcome.
 */
type MutableGlobal = Record<string, unknown>;

const globals = globalThis as unknown as MutableGlobal;
const saved: MutableGlobal = {};

beforeEach(() => {
  for (const key of ['game', 'ui', 'canvas']) {
    saved[key] = globals[key];
    Reflect.deleteProperty(globals, key);
  }
  document.body.innerHTML = '';
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) {
      Reflect.deleteProperty(globals, key);
    } else {
      globals[key] = value;
    }
  }
});

function build(requestPauseFromGm = vi.fn()) {
  return { actions: new FoundryActions({ document, requestPauseFromGm }), requestPauseFromGm };
}

describe('the pause button', () => {
  /**
   * A GM can write a macro called "Tongs Pause" and this button runs it, which keeps the behaviour in
   * the world's hands. Found by NAME so it can be created after the module is installed.
   */
  it('runs the world’s own macro when there is one', () => {
    const execute = vi.fn();
    globals['game'] = { macros: { getName: () => ({ execute, canExecute: true }) } };

    build().actions.togglePause();

    expect(execute).toHaveBeenCalledTimes(1);
  });

  /**
   * ⚠️ Without the relay a player's pause button does NOTHING, silently. Foundry's own
   * `Game#togglePause` only emits the socket message `if (options.broadcast && game.user.isGM)`, so a
   * player toggling locally changes nobody else's client. The check is on the emit path, not on macro
   * permissions, which is why macro ownership looks like it should solve this and does not.
   */
  it('asks the GM when there is no macro to run', () => {
    globals['game'] = { macros: { getName: () => null } };
    const { actions, requestPauseFromGm } = build();

    actions.togglePause();

    expect(requestPauseFromGm).toHaveBeenCalledTimes(1);
  });

  /** A macro the user may not execute is not a macro. Falling through to the relay is the point. */
  it('asks the GM when the macro exists but cannot be executed', () => {
    globals['game'] = { macros: { getName: () => ({ execute: vi.fn(), canExecute: false }) } };
    const { actions, requestPauseFromGm } = build();

    actions.togglePause();

    expect(requestPauseFromGm).toHaveBeenCalledTimes(1);
  });

  /** No game at all is not a reason to bother the GM. */
  it('does nothing when there is no game', () => {
    const { actions, requestPauseFromGm } = build();

    expect(() => {
      actions.togglePause();
    }).not.toThrow();
    expect(requestPauseFromGm).not.toHaveBeenCalled();
  });
});
