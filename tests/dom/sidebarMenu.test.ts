import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildSidebarMenu } from '../../src/foundry/SidebarMenu.js';

/**
 * The sidebar picker.
 *
 * ⚠️ Our own rows rather than Foundry's tab strip, and that is the entire point: Foundry's strip is
 * 27px wide on a phone, which is what made the sidebar unreachable in the first place.
 */
beforeEach(() => {
  document.body.innerHTML = '';
});

describe('buildSidebarMenu', () => {
  it('builds a row per tab, labelled readably', () => {
    const menu = buildSidebarMenu(document, ['chat', 'combat'], vi.fn());

    const rows = [...menu.querySelectorAll('button')];
    expect(rows.map((row) => row.textContent)).toEqual(['Chat', 'Combat']);
    expect(rows.map((row) => row.dataset['tab'])).toEqual(['chat', 'combat']);
  });

  /**
   * ⚠️ Marked so the gesture layer keeps away, which is what lets these be tapped at all. Without it
   * a tap is routed through the virtual pointer, landing wherever the pointer happens to be rather
   * than on the row under the finger.
   */
  it('tells the gesture layer to leave it alone', () => {
    expect(buildSidebarMenu(document, ['chat'], vi.fn()).getAttribute('data-tongs-browser')).toBe(
      'ignore'
    );
  });

  it('reports which tab was chosen', () => {
    const onChosen = vi.fn();
    const menu = buildSidebarMenu(document, ['chat', 'combat'], onChosen);

    menu.querySelector<HTMLButtonElement>('[data-tab="combat"]')?.click();

    expect(onChosen).toHaveBeenCalledWith('combat');
  });

  it('builds real buttons, so they are reachable by keyboard', () => {
    const row = buildSidebarMenu(document, ['chat'], vi.fn()).querySelector<HTMLButtonElement>(
      'button'
    );

    expect(row?.tagName).toBe('BUTTON');
    expect(row?.type).toBe('button');
  });

  it('builds an empty menu rather than throwing when there are no tabs', () => {
    expect(buildSidebarMenu(document, [], vi.fn()).children).toHaveLength(0);
  });
});
