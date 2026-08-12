/**
 * A picker listing every sidebar tab, built from our own DOM. Extracted from FoundryActions
 * 2026-08-12.
 *
 * ⚠️ Our own rows rather than Foundry's tab strip, and that is the entire point. Foundry's strip is
 * 27px wide on a phone, which is what made the sidebar unreachable in the first place, so reusing it
 * to CHOOSE a tab would inherit exactly the problem being solved.
 */
export function buildSidebarMenu(
  doc: Document,
  tabNames: readonly string[],
  onChosen: (name: string) => void
): HTMLDivElement {
  const menu = doc.createElement('div');
  menu.className = 'tb-sidebar-menu';
  /*
   * ⚠️ Marked so the gesture layer keeps away, which is what lets these be tapped at all. Without it
   * a tap here is routed through the virtual pointer, landing wherever the pointer happens to be
   * rather than on the row under the finger.
   */
  menu.setAttribute('data-tongs-browser', 'ignore');

  for (const name of tabNames) {
    const item = doc.createElement('button');
    item.type = 'button';
    item.className = 'tb-sidebar-menu__item';
    item.dataset['tab'] = name;
    // Foundry's tab names are already lower case single words, so this is all the label needed.
    item.textContent = name.charAt(0).toUpperCase() + name.slice(1);
    item.addEventListener('click', () => {
      onChosen(name);
    });
    menu.append(item);
  }

  return menu;
}
