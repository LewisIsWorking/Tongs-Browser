import { afterEach, describe, expect, it, vi } from 'vitest';

import { DualClassWindow, SAME_CLASS } from '../../src/dualclass/DualClassWindow.js';
import type { DualClassFace } from '../../src/dualclass/DualClassWindow.js';

/** The "Dual class…" window: what each face says, and what its buttons do. 2026-10-12. */
afterEach(() => {
  document.body.innerHTML = '';
});

const ASK = {
  kind: 'ask',
  sheets: [
    { id: 'A1', name: 'Kibwe' },
    { id: 'A2', name: 'Theo' },
  ],
  classes: [
    { uuid: 'Compendium.pf2e.classes.Item.F', name: 'Fighter' },
    { uuid: 'Compendium.pf2e.classes.Item.K', name: 'Kineticist' },
    { uuid: 'Compendium.other.classes.Item.F', name: 'Fighter' },
  ],
  variantOff: false,
} satisfies DualClassFace;

const root = (): HTMLElement | null => document.getElementById('tongs-dual-class');
const text = (): string => root()?.textContent ?? '';
const select = (key: string): HTMLSelectElement =>
  document.getElementById(`tongs-dual-class-${key}`) as HTMLSelectElement;
const press = (label: string): void => {
  [...document.querySelectorAll('button')].find((button) => button.textContent === label)?.click();
};

function open(face: DualClassFace = ASK) {
  const ask = vi.fn();
  const window = new DualClassWindow(document, ask);
  window.show(face);
  return { ask, window };
}

describe('asking', () => {
  it('offers the player’s sheets and the classes, with the macro hint on the 1st class', () => {
    open();
    expect([...select('sheet').options].map((option) => option.textContent)).toEqual([
      'Kibwe',
      'Theo',
    ]);
    expect([...select('first').options].map((option) => option.value)).toEqual(
      ASK.classes.map((each) => each.uuid)
    );
    expect(select('second').options).toHaveLength(3);
    expect(text()).toContain(
      '1st class (Kineticist must go here, and probably Inventor and Thaumaturge too)'
    );
    expect(text()).toContain('2nd class');
    expect(root()?.getAttribute('role')).toBe('dialog');
  });

  it('sends the chosen sheet, 1st and 2nd class', () => {
    const { ask } = open();
    select('sheet').value = 'A2';
    select('first').value = 'Compendium.pf2e.classes.Item.K';
    press('Ask for this dual class');
    expect(ask).toHaveBeenCalledExactlyOnceWith(
      'A2',
      'Compendium.pf2e.classes.Item.K',
      'Compendium.pf2e.classes.Item.F'
    );
  });

  it('refuses the same class twice before sending anything', () => {
    const { ask } = open();
    press('Ask for this dual class');
    expect(ask).not.toHaveBeenCalled();
    expect(text()).toContain(SAME_CLASS);
  });

  it('refuses two classes of the same name from different compendiums', () => {
    const { ask } = open({
      ...ASK,
      classes: [
        { uuid: 'Compendium.a.classes.Item.F', name: 'Fighter' },
        { uuid: 'Compendium.b.classes.Item.F', name: 'Fighter' },
      ],
    });
    select('second').value = 'Compendium.b.classes.Item.F';
    press('Ask for this dual class');
    expect(ask).not.toHaveBeenCalled();
  });

  it('says politely when the Dual Class variant rule is off, and only then', () => {
    const { window } = open();
    expect(text()).not.toContain('variant rule');
    window.show({ ...ASK, variantOff: true });
    expect(text()).toContain("This world has PF2e's Dual Class variant rule switched off.");
  });

  it('closes on Cancel', () => {
    open();
    press('Cancel');
    expect(root()).toBeNull();
  });
});

describe('the other faces', () => {
  it('says it is on its way, sooner with a GM online', () => {
    const { window } = open({ kind: 'waiting', gmOnline: true });
    expect(text()).toContain('A GM is online');
    window.show({ kind: 'waiting', gmOnline: false });
    expect(text()).toContain('the next time one is online');
    expect(document.querySelectorAll('#tongs-dual-class')).toHaveLength(1);
  });

  it('shows a message and closes on OK', () => {
    open({ kind: 'message', title: 'Dual class done', text: 'Kibwe is now a Fighter - Wizard.' });
    expect(text()).toContain('Kibwe is now a Fighter - Wizard.');
    expect(document.activeElement?.textContent).toBe('OK');
    press('OK');
    expect(root()).toBeNull();
  });
});
