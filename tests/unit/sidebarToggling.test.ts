import { describe, expect, it } from 'vitest';

import {
  decideSidebarAction,
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
describe('decideSidebarAction', () => {
  const withTabs = (tabs: Record<string, { gmOnly?: boolean }>, extra: Partial<FoundryUi> = {}) =>
    ({
      sidebar: sidebarDeclaring(tabs),
      ...Object.fromEntries(Object.keys(tabs).map((name) => [name, tab(() => undefined)])),
      ...extra,
    }) as FoundryUi;

  it('closes an open picker, so the button is never a one way trip', () => {
    expect(decideSidebarAction(access(withTabs({ chat: {} })), true)).toEqual({
      kind: 'closeMenu',
    });
  });

  /** Every tab, not just the active one. Popping out the active tab gave chat and nothing else. */
  it('offers a picker when there is more than one tab', () => {
    const action = decideSidebarAction(access(withTabs({ chat: {}, actors: {} })), false);

    expect(action).toEqual({ kind: 'openMenu', tabNames: ['chat', 'actors'] });
  });

  it('pops the only tab straight out rather than showing a picker of one', () => {
    expect(decideSidebarAction(access(withTabs({ chat: {} })), false)).toEqual({
      kind: 'togglePopout',
      tabName: 'chat',
    });
  });

  /**
   * Expanding the docked sidebar is the LAST resort, not the first. On a phone it flips `expanded`
   * and nothing appears, so it only makes sense when there is genuinely nothing to pop out.
   */
  it('falls back to the docked sidebar only when no tab can pop out', () => {
    const ui = {
      sidebar: Object.assign(sidebarDeclaring({ chat: {} }), {
        toggleExpanded: () => undefined,
      }),
      chat: tab(undefined),
    } as FoundryUi;

    expect(decideSidebarAction(access(ui), false)).toEqual({ kind: 'toggleDocked' });
  });

  it('does nothing when there is no sidebar at all', () => {
    expect(decideSidebarAction(access(undefined), false)).toEqual({ kind: 'nothing' });
  });

  it('does nothing when there is neither a tab to pop out nor a way to expand', () => {
    const ui = { sidebar: sidebarDeclaring({ chat: {} }), chat: tab(undefined) } as FoundryUi;

    expect(decideSidebarAction(access(ui), false)).toEqual({ kind: 'nothing' });
  });
});
