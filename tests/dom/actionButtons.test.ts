import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActionButtons } from '../../src/modifiers/ActionButtons.js';
import type { TrayAction } from '../../src/modifiers/TrayAction.js';

/**
 * The bar's utility buttons: building them, grouping them, and keeping them truthful.
 */
const action = (overrides: Partial<TrayAction> & { id: string }): TrayAction => ({
  label: 'X',
  title: 'Does a thing',
  activate: () => undefined,
  ...overrides,
});

let root: HTMLDivElement;

beforeEach(() => {
  document.body.innerHTML = '';
  root = document.createElement('div');
  document.body.append(root);
});

const build = (actions: readonly TrayAction[], onActivated = () => undefined) => {
  const buttons = new ActionButtons();
  buttons.build(document, root, actions, onActivated);
  return buttons;
};

describe('ActionButtons.build', () => {
  it('gives every button its label, title and accessible name', () => {
    build([action({ id: 'sidebar', label: '☰', title: 'Show the sidebar' })]);

    const button = root.querySelector('[data-action="sidebar"]');
    expect(button?.textContent).toBe('☰');
    expect(button?.getAttribute('title')).toBe('Show the sidebar');
    expect(button?.getAttribute('aria-label')).toBe('Show the sidebar');
  });

  it('is a real button, so it is reachable by keyboard and not a submit', () => {
    build([action({ id: 'a' })]);

    const button = root.querySelector<HTMLButtonElement>('[data-action="a"]');
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.type).toBe('button');
  });

  it('runs the action when tapped', () => {
    const activate = vi.fn();
    build([action({ id: 'a', activate })]);

    root.querySelector<HTMLButtonElement>('[data-action="a"]')?.click();

    expect(activate).toHaveBeenCalledOnce();
  });

  /** A button that reports state must never be a tap behind the truth. */
  it('refreshes immediately after an action runs', () => {
    const onActivated = vi.fn();
    build([action({ id: 'a' })], onActivated);

    root.querySelector<HTMLButtonElement>('[data-action="a"]')?.click();

    expect(onActivated).toHaveBeenCalledOnce();
  });

  /**
   * ⚠️ Grouped buttons share a container so related controls cluster rather than wrap apart. Four pan
   * arrows split across a line break stop reading as a d-pad and become four unrelated arrows.
   */
  it('puts grouped buttons in one shared container', () => {
    build([
      action({ id: 'pan-left', group: 'pan' }),
      action({ id: 'pan-right', group: 'pan' }),
      action({ id: 'loose' }),
    ]);

    const groups = root.querySelectorAll('.tb-modifier-bar__group--pan');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.querySelectorAll('button')).toHaveLength(2);
    expect(root.querySelector('[data-action="loose"]')?.parentElement).toBe(root);
  });

  it('keeps separate groups apart', () => {
    build([action({ id: 'a', group: 'pan' }), action({ id: 'b', group: 'zoom' })]);

    expect(root.querySelectorAll('.tb-modifier-bar__group')).toHaveLength(2);
  });

  it('builds nothing at all for no actions', () => {
    build([]);

    expect(root.children).toHaveLength(0);
  });
});

describe('ActionButtons.refresh', () => {
  /**
   * ⚠️ The LABEL is refreshed as well as the latch, and that is not decoration. A latched button whose
   * label never changes cost a whole round of device diagnostics: the gold styling says "on", but
   * "on" does not tell you the next thing to do is tap it OFF. The grab button showed the same open
   * hand whether it held a token or not, and a report came back mid drag with the token quite
   * correctly sitting where it started, because Foundry only commits on the drop.
   */
  it('relabels a button whose label depends on state', () => {
    let held = true;
    const buttons = build([
      action({ id: 'grab', label: '✋', getLabel: () => (held ? 'DROP' : '✋') }),
    ]);

    buttons.refresh();
    expect(root.querySelector('[data-action="grab"]')?.textContent).toBe('DROP');

    held = false;
    buttons.refresh();
    expect(root.querySelector('[data-action="grab"]')?.textContent).toBe('✋');
  });

  /**
   * ⚠️ `aria-pressed` as well as the class, because a latch that is only a colour is invisible to a
   * screen reader and to anyone who cannot tell this gold from this grey.
   */
  it('marks a latched button both visually and for a screen reader', () => {
    let on = true;
    const buttons = build([action({ id: 'pause', isActive: () => on })]);

    buttons.refresh();
    const button = root.querySelector('[data-action="pause"]');
    expect(button?.classList.contains('tb-modifier-bar__action--on')).toBe(true);
    expect(button?.getAttribute('aria-pressed')).toBe('true');

    on = false;
    buttons.refresh();
    expect(button?.classList.contains('tb-modifier-bar__action--on')).toBe(false);
    expect(button?.getAttribute('aria-pressed')).toBe('false');
  });

  it('leaves a button alone when it reports no state and no dynamic label', () => {
    const buttons = build([action({ id: 'plain', label: 'P' })]);

    buttons.refresh();

    const button = root.querySelector('[data-action="plain"]');
    expect(button?.textContent).toBe('P');
    expect(button?.hasAttribute('aria-pressed')).toBe(false);
  });

  /*
   * A button can go missing when something else re-renders over the bar. These two are separate
   * passes over separate maps, so covering one says nothing about the other, and the grab button is
   * the one with a dynamic label: a refresh that threw here would take the whole tray with it.
   */
  const forget = (buttons: ActionButtons, id: string): void => {
    (buttons as unknown as { buttons: Map<string, HTMLButtonElement> }).buttons.delete(id);
  };

  it('skips relabelling a button that is no longer there, and still does the rest', () => {
    const buttons = build([
      action({ id: 'grab', getLabel: () => 'DROP' }),
      action({ id: 'sidebar', getLabel: () => 'S' }),
    ]);
    forget(buttons, 'grab');

    expect(() => {
      buttons.refresh();
    }).not.toThrow();
    expect(root.querySelector('[data-action="sidebar"]')?.textContent).toBe('S');
  });

  it('skips latching a button that is no longer there, and still does the rest', () => {
    const buttons = build([
      action({ id: 'pause', isActive: () => true }),
      action({ id: 'grab', isActive: () => true }),
    ]);
    forget(buttons, 'pause');

    expect(() => {
      buttons.refresh();
    }).not.toThrow();
    expect(root.querySelector('[data-action="grab"]')?.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('ActionButtons.get', () => {
  it('hands back a built button, and nothing for an unknown id', () => {
    const buttons = build([action({ id: 'a' })]);

    expect(buttons.get('a')).toBe(root.querySelector('[data-action="a"]'));
    expect(buttons.get('nope')).toBeUndefined();
  });
});
