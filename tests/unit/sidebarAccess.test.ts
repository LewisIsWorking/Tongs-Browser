import { describe, expect, it } from 'vitest';

import {
  popOutSidebarTab,
  resolveSidebarTabNames,
  toggleFoundrySidebar,
  type FoundryUi,
} from '../../src/foundry/SidebarAccess.js';

/**
 * Reaching Foundry's sidebar on a phone.
 *
 * ⚠️ This exists because the sidebar is genuinely unreachable on a small screen. Foundry auto
 * collapses it below about 1024px into a strip of icons hard against the right edge, and its
 * expander is a few pixels wide. A device reported "no side bar" three separate times while the
 * module was otherwise working, which is why the answer is to pop tabs OUT as windows rather than to
 * fight the collapsed strip.
 */
function access(ui: FoundryUi | undefined, isGm = false) {
  return { getUi: () => ui, isGm: () => isGm };
}

/**
 * A sidebar whose TABS hang off its CLASS, which is where Foundry actually puts them.
 *
 * A plain object with a `constructor` property would not be the same thing: Foundry reads
 * `ui.sidebar.constructor.TABS`, so the fixture has to be an instance for that lookup to mean
 * anything. Faking it with a literal would test a shape Foundry never produces.
 */
function sidebarDeclaring(tabs: Record<string, { gmOnly?: boolean }>) {
  // A constructor function with a static, then an instance of it, which is the shape Foundry has.
  // Written this way rather than as a class because a class holding only statics is a lint error,
  // and the point here is the instance-to-constructor link rather than the class syntax.
  function FakeSidebar(this: unknown) {
    // Intentionally empty: the tabs live on the constructor, exactly as Foundry keeps them.
  }
  (FakeSidebar as unknown as { TABS: typeof tabs }).TABS = tabs;
  return new (FakeSidebar as unknown as new () => object)() as NonNullable<FoundryUi['sidebar']>;
}

const tab = (renderPopout: (() => unknown) | undefined) => ({ renderPopout });

describe('resolveSidebarTabNames', () => {
  it('offers the tabs Foundry declares', () => {
    const ui: FoundryUi = {
      sidebar: sidebarDeclaring({ chat: {}, combat: {} }),
      chat: tab(() => undefined),
      combat: tab(() => undefined),
    };

    expect(resolveSidebarTabNames(access(ui))).toEqual(['chat', 'combat']);
  });

  /**
   * A tab whose application cannot pop out would be a button that quietly does nothing, which is
   * worse than a shorter list: the user taps it, nothing happens, and they conclude the module is
   * broken rather than that the tab is unavailable.
   */
  it('drops a declared tab whose application cannot pop out', () => {
    const ui: FoundryUi = {
      sidebar: sidebarDeclaring({ chat: {}, gone: {} }),
      chat: tab(() => undefined),
      gone: tab(undefined),
    };

    expect(resolveSidebarTabNames(access(ui))).toEqual(['chat']);
  });

  it('hides a GM only tab from a player and shows it to a GM', () => {
    const ui: FoundryUi = {
      sidebar: sidebarDeclaring({ chat: {}, settings: { gmOnly: true } }),
      chat: tab(() => undefined),
      settings: tab(() => undefined),
    };

    expect(resolveSidebarTabNames(access(ui, false))).toEqual(['chat']);
    expect(resolveSidebarTabNames(access(ui, true))).toEqual(['chat', 'settings']);
  });

  /** A Foundry build that renames or removes TABS degrades to nothing rather than throwing. */
  it('returns nothing when Foundry declares no tabs at all', () => {
    expect(resolveSidebarTabNames(access({ sidebar: {} }))).toEqual([]);
    expect(resolveSidebarTabNames(access(undefined))).toEqual([]);
  });
});

describe('popOutSidebarTab', () => {
  it('pops a tab out when it is not already open', () => {
    let rendered = '';
    const ui: FoundryUi = {
      sidebar: { popouts: {} },
      chat: {
        renderPopout: () => {
          rendered = 'chat';
        },
      },
    };

    popOutSidebarTab(access(ui), 'chat');

    expect(rendered).toBe('chat');
  });

  /**
   * Toggling rather than always opening, because this button is the only way back. An open chat
   * window with no way to dismiss it would cover the map on a phone, which is the problem this
   * feature exists to solve rather than a new one to introduce.
   */
  it('closes the tab again when it is already open, rather than opening a second', () => {
    let closed = false;
    let rendered = false;
    const ui: FoundryUi = {
      sidebar: {
        popouts: {
          chat: {
            close: () => {
              closed = true;
            },
          },
        },
      },
      chat: {
        renderPopout: () => {
          rendered = true;
        },
      },
    };

    popOutSidebarTab(access(ui), 'chat');

    expect(closed).toBe(true);
    expect(rendered).toBe(false);
  });

  it('does nothing rather than throwing when the tab is unknown', () => {
    expect(() => {
      popOutSidebarTab(access({ sidebar: { popouts: {} } }), 'nope');
    }).not.toThrow();
  });
});

describe('toggleFoundrySidebar', () => {
  it('expands a collapsed sidebar and reports that it worked', () => {
    let asked: boolean | undefined;
    const ui: FoundryUi = {
      sidebar: {
        expanded: false,
        toggleExpanded: (expanded?: boolean) => {
          asked = expanded;
        },
      },
    };

    expect(toggleFoundrySidebar(access(ui))).toBe(true);
    expect(asked).toBe(true);
  });

  it('collapses an expanded one', () => {
    let asked: boolean | undefined;
    const ui: FoundryUi = {
      sidebar: {
        expanded: true,
        toggleExpanded: (expanded?: boolean) => {
          asked = expanded;
        },
      },
    };

    toggleFoundrySidebar(access(ui));

    expect(asked).toBe(false);
  });

  /**
   * Reporting failure is the point. A caller that cannot expand the sidebar falls back to the tab
   * picker, and a silent no op would leave the user tapping a button that does nothing, which is
   * exactly what a device reported before the picker existed.
   */
  it('reports failure when this Foundry build cannot toggle', () => {
    expect(toggleFoundrySidebar(access({ sidebar: {} }))).toBe(false);
    expect(toggleFoundrySidebar(access(undefined))).toBe(false);
  });
});
