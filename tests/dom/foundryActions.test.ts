import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FoundryActions } from '../../src/foundry/FoundryActions.js';

/**
 * Carrying out what the tray buttons decided.
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

/**
 * The sidebar button has five outcomes and picks between them from live state. Getting two of them
 * crossed is the kind of bug that reads as "the button is flaky" rather than as a mapping error.
 */
describe('the sidebar button', () => {
  /**
   * ⚠️ Two separate things make a tab count, and the first version of this fixture supplied only one.
   * `SidebarAccess` reads the DECLARED tabs from `ui.sidebar.constructor.TABS`, then keeps only those
   * whose app on `ui` actually exposes `renderPopout`. A tab that is declared but cannot pop out is
   * correctly ignored, which is why a stub with declarations alone produced no picker at all.
   */
  const uiWith = (tabs: string[]) => {
    const ui: Record<string, unknown> = {
      sidebar: {
        constructor: { TABS: Object.fromEntries(tabs.map((tab) => [tab, {}])) },
        toggleExpanded: () => undefined,
      },
    };
    for (const tab of tabs) {
      ui[tab] = { renderPopout: () => undefined };
    }
    return ui;
  };

  it('opens the picker when there is more than one tab to choose from', () => {
    globals['ui'] = uiWith(['chat', 'combat', 'actors']);
    globals['game'] = { user: { isGM: true } };
    const { actions } = build();

    actions.toggleFoundrySidebar();

    expect(document.body.querySelectorAll('div').length).toBeGreaterThan(0);
  });

  /**
   * ⚠️ An open picker CLOSES, so the button is never a one way trip. On a phone there is no click
   * elsewhere to dismiss it, so a picker that only opens is a picker you cannot get rid of.
   */
  it('closes the picker when it is already open, rather than opening a second one', () => {
    globals['ui'] = uiWith(['chat', 'combat', 'actors']);
    globals['game'] = { user: { isGM: true } };
    const { actions } = build();

    actions.toggleFoundrySidebar();
    const opened = document.body.innerHTML;
    actions.toggleFoundrySidebar();

    expect(opened).not.toBe('');
    expect(document.body.innerHTML).toBe('');
  });

  it('does nothing at all when Foundry exposes no sidebar', () => {
    globals['ui'] = {};
    const { actions } = build();

    expect(() => {
      actions.toggleFoundrySidebar();
    }).not.toThrow();
    expect(document.body.innerHTML).toBe('');
  });
});

/**
 * ⚠️ `game.users.activeGM` is Foundry's own designated user: every client picks the SAME single GM,
 * deterministically. Asking "am I a GM" instead would have every connected GM act on one relayed
 * request, flipping the pause once per GM and landing wherever the race ended.
 */
describe('deciding which GM acts on a relayed request', () => {
  it('is true only for the one GM Foundry designated', () => {
    globals['game'] = { user: { id: 'gm1' }, users: { activeGM: { id: 'gm1' } } };

    expect(build().actions.isDesignatedGm()).toBe(true);
  });

  it('is false for a second GM, so the pause is not toggled twice', () => {
    globals['game'] = { user: { id: 'gm2' }, users: { activeGM: { id: 'gm1' } } };

    expect(build().actions.isDesignatedGm()).toBe(false);
  });
});

/**
 * Three sources, in the order that matches what somebody means by "my character": the assigned
 * character first, then a controlled token, then the only actor they own.
 */
describe('opening a character sheet', () => {
  it('prefers the assigned character', () => {
    const assigned = { sheet: { render: vi.fn() } };
    const selected = { sheet: { render: vi.fn() } };
    globals['game'] = { user: { character: assigned }, actors: [] };
    globals['canvas'] = { tokens: { controlled: [{ actor: selected }] } };

    build().actions.openCharacterSheet();

    expect(assigned.sheet.render).toHaveBeenCalled();
    expect(selected.sheet.render).not.toHaveBeenCalled();
  });

  /** On a phone, selecting a token then asking for its sheet is the natural flow. */
  it('falls back to the selected token when nothing is assigned', () => {
    const selected = { sheet: { render: vi.fn() } };
    globals['game'] = { user: {}, actors: [] };
    globals['canvas'] = { tokens: { controlled: [{ actor: selected }] } };

    build().actions.openCharacterSheet();

    expect(selected.sheet.render).toHaveBeenCalled();
  });

  it('says so rather than failing silently when there is nothing to open', () => {
    globals['game'] = { user: {}, actors: [] };
    const { actions } = build();

    expect(() => {
      actions.openCharacterSheet();
    }).not.toThrow();
  });
});
