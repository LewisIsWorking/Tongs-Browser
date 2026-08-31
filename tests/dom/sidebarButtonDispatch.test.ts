import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FoundryActions } from '../../src/foundry/FoundryActions.js';

/**
 * What the one sidebar button actually does, across the four situations it has to cover. Written
 * 2026-09-01.
 *
 * ⚠️ The DECISION is tested in `sidebarAccess`; this is the CARRYING OUT, and the two had drifted
 * apart in coverage: `decideSidebarAction` returns five kinds and only three of them were ever
 * dispatched by a test.
 *
 * One button has to serve every shape of Foundry, because a phone has room for one:
 *
 *   several tabs   open our picker, since Foundry's own strip is unusable at this width
 *   exactly one    skip the picker and pop that tab straight out
 *   none, docked   fall back to Foundry's own expand and collapse
 *   no sidebar     do nothing, rather than throw under the user's finger
 *
 * A kind dispatched to the wrong branch is a button that does nothing in one configuration and
 * nobody notices until somebody plays with that configuration.
 *
 * COVERS: each decision kind reaching its own action.
 * MISSES: whether the decision itself is right, which `sidebarAccess` owns.
 */
const globals = globalThis as unknown as Record<string, unknown>;

function actions(): FoundryActions {
  return new FoundryActions({ document, requestPauseFromGm: () => undefined });
}

/** A sidebar declaring `tabs`, with an application behind each so they count as available. */
function stubSidebar(tabs: string[], extra: Record<string, unknown> = {}): Record<string, unknown> {
  const apps: Record<string, unknown> = {};
  for (const tab of tabs) {
    apps[tab] = { renderPopout: vi.fn() };
  }
  const declared: Record<string, Record<string, never>> = {};
  for (const tab of tabs) {
    declared[tab] = {};
  }

  const ui = {
    ...apps,
    sidebar: { constructor: { TABS: declared }, popouts: {}, ...extra },
  };
  globals['ui'] = ui;
  globals['game'] = { user: { isGM: true } };
  return apps;
}

const rows = (): HTMLButtonElement[] => [
  ...document.querySelectorAll<HTMLButtonElement>('button[data-tab]'),
];

beforeEach(() => {
  document.body.innerHTML = '';
  Reflect.deleteProperty(globals, 'ui');
  Reflect.deleteProperty(globals, 'game');
});

describe('the one sidebar button', () => {
  it('opens the picker when there are several tabs to choose between', () => {
    stubSidebar(['chat', 'combat', 'actors']);

    actions().toggleFoundrySidebar();

    expect(rows()).toHaveLength(3);
  });

  /**
   * ⚠️ A picker offering ONE row would be a tap to reach a tap. Skipping straight to the tab is the
   * whole reason the decision distinguishes this case.
   */
  it('pops the tab straight out when there is only one, rather than offering a picker of one', () => {
    const apps = stubSidebar(['chat']);

    actions().toggleFoundrySidebar();

    expect(apps['chat']).toHaveProperty('renderPopout');
    expect(
      (apps['chat'] as { renderPopout: ReturnType<typeof vi.fn> }).renderPopout
    ).toHaveBeenCalled();
    expect(rows()).toHaveLength(0);
  });

  /**
   * ⚠️ With no poppable tabs at all, the button falls back to Foundry's own docked sidebar toggle.
   * Doing nothing here would leave the button dead on builds that expose no popouts, which is not a
   * configuration this module gets to assume away.
   */
  it('falls back to Foundry’s own expand and collapse when nothing can pop out', () => {
    const toggleExpanded = vi.fn();
    stubSidebar([], { toggleExpanded });

    actions().toggleFoundrySidebar();

    expect(toggleExpanded).toHaveBeenCalled();
  });

  it('does nothing, rather than throwing, when there is no sidebar at all', () => {
    globals['ui'] = {};
    globals['game'] = { user: { isGM: true } };

    expect(() => {
      actions().toggleFoundrySidebar();
    }).not.toThrow();
  });

  /** ⚠️ The button is never a one way trip: pressed again with the picker open, it closes it. */
  it('closes the picker it opened when pressed a second time', () => {
    stubSidebar(['chat', 'combat', 'actors']);
    const subject = actions();
    subject.toggleFoundrySidebar();
    expect(rows()).toHaveLength(3);

    subject.toggleFoundrySidebar();

    expect(rows()).toHaveLength(0);
  });
});
