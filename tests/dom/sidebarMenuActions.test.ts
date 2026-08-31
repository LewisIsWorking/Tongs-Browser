import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FoundryActions } from '../../src/foundry/FoundryActions.js';

/**
 * Tapping a row in the sidebar picker, and the tray actions that reach the same code. Written
 * 2026-09-01.
 *
 * ⚠️ The row handler does TWO things, and only one of them is visible in the code that builds the
 * menu: it closes the picker and then pops the tab out. Losing the close leaves our own menu sitting
 * on top of the thing it was asked to open, on a screen where the menu covers most of the width.
 * Nothing would throw, and the tab really would have opened underneath.
 *
 * The picker exists because Foundry's own tab strip is unusable at phone width; see SidebarMenu.ts.
 * That makes these rows the only route to chat, actors and the rest.
 *
 * COVERS: the row callback, the pop-out call, and the two tray actions that share them.
 * MISSES: whether Foundry's `renderPopout` puts a usable window on screen. Only the live harness can
 *   answer that, and `probe:play` does.
 */
interface PopoutSpy {
  renderPopout: () => void;
}

const globals = globalThis as unknown as Record<string, unknown>;

function stubUi(tabs: string[]): Record<string, PopoutSpy> {
  const apps: Record<string, PopoutSpy> = {};
  for (const tab of tabs) {
    apps[tab] = { renderPopout: vi.fn() };
  }
  globals['ui'] = { ...apps, sidebar: { popouts: {} } };
  globals['game'] = { user: { isGM: true } };
  return apps;
}

function actions(): FoundryActions {
  return new FoundryActions({ document, requestPauseFromGm: () => undefined });
}

const rows = (): HTMLButtonElement[] => [
  ...document.querySelectorAll<HTMLButtonElement>('button[data-tab]'),
];

beforeEach(() => {
  document.body.innerHTML = '';
  Reflect.deleteProperty(globals, 'ui');
  Reflect.deleteProperty(globals, 'game');
});

describe('tapping a row in the sidebar picker', () => {
  it('offers a row for every tab it was given', () => {
    stubUi(['chat', 'combat']);

    actions().openSidebarMenu(['chat', 'combat']);

    expect(rows().map((row) => row.dataset['tab'])).toEqual(['chat', 'combat']);
  });

  it('pops out the tab whose row was tapped', () => {
    const apps = stubUi(['chat', 'combat']);
    const subject = actions();
    subject.openSidebarMenu(['chat', 'combat']);

    rows()
      .find((row) => row.dataset['tab'] === 'combat')
      ?.click();

    expect(apps['combat']?.renderPopout).toHaveBeenCalled();
    expect(apps['chat']?.renderPopout).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ THE HALF THAT IS EASY TO LOSE. The picker covers most of a phone's width, so leaving it open
   * puts our own menu on top of the tab it just opened. The tab would be there, underneath, which is
   * worse than not opening it: it looks like the tap did nothing.
   */
  it('closes the picker, rather than leaving it over what it just opened', () => {
    stubUi(['chat', 'combat']);
    const subject = actions();
    subject.openSidebarMenu(['chat', 'combat']);
    expect(rows()).toHaveLength(2);

    rows()[0]?.click();

    expect(rows()).toHaveLength(0);
  });
});

describe('the tray actions that reach the same code', () => {
  it('pops a named tab out directly', () => {
    const apps = stubUi(['chat']);

    actions().popOutSidebarTab('chat');

    expect(apps['chat']?.renderPopout).toHaveBeenCalled();
  });

  /** ⚠️ A second call CLOSES the popout rather than opening a second one. */
  it('closes an already open popout instead of opening another', () => {
    const apps = stubUi(['chat']);
    const close = vi.fn();
    globals['ui'] = { ...apps, sidebar: { popouts: { chat: { close } } } };

    actions().popOutSidebarTab('chat');

    expect(close).toHaveBeenCalled();
    expect(apps['chat']?.renderPopout).not.toHaveBeenCalled();
  });

  it('does nothing rather than throwing when the tab has no application', () => {
    stubUi([]);

    expect(() => {
      actions().popOutSidebarTab('nosuchtab');
    }).not.toThrow();
  });
});
