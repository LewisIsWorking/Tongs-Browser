import { afterEach, describe, expect, it, vi } from 'vitest';

import { WelcomeWindow } from '../../src/welcome/WelcomeWindow.js';
import { GuidePanel } from '../../src/welcome/GuidePanel.js';
import type { GuideStep } from '../../src/welcome/buildGuide.js';

/** The welcome window and the checklist panel, drawn. 2026-10-05. */
afterEach(() => {
  document.body.replaceChildren();
});

const actions = () => ({ create: vi.fn(), later: vi.fn(), retry: vi.fn() });
const card = () => document.querySelector('#tongs-welcome .tw-card');
const click = (text: string, root = '#tongs-welcome') => {
  const button = [...document.querySelectorAll<HTMLButtonElement>(`${root} button`)].find(
    (each) => each.textContent === text
  );
  button?.click();
  return button;
};

describe('the welcome window', () => {
  const party = { uuid: 'Actor.A', name: 'The Party', code: 'C06' };

  it('asks for a name, and creating sends it with no party when there is only one', () => {
    const act = actions();
    new WelcomeWindow(document, act).show({ kind: 'ask', world: 'Riddleport', parties: [party] });
    expect(card()?.textContent).toContain('Welcome to Riddleport!');
    expect(document.querySelector('#tongs-welcome select')).toBeNull();
    document.querySelector<HTMLInputElement>('#tongs-welcome input')!.value = 'Theo';
    click('Create my character');
    expect(act.create).toHaveBeenCalledWith('Theo', null);
  });

  it('creates on Enter in the name box', () => {
    const act = actions();
    new WelcomeWindow(document, act).show({ kind: 'ask', world: 'W', parties: [party] });
    const input = document.querySelector<HTMLInputElement>('#tongs-welcome input')!;
    input.value = 'Vex';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(act.create).toHaveBeenCalledWith('Vex', null);
  });

  it('offers a choice of campaign when there are several, and sends the one chosen', () => {
    const act = actions();
    const other = { uuid: 'Actor.B', name: 'Second', code: 'C07' };
    new WelcomeWindow(document, act).show({ kind: 'ask', world: 'W', parties: [party, other] });
    const select = document.querySelector<HTMLSelectElement>('#tongs-welcome select')!;
    expect([...select.options].map((option) => option.textContent)).toEqual([
      'C06: The Party',
      'C07: Second',
    ]);
    select.value = 'Actor.B';
    click('Create my character');
    expect(act.create).toHaveBeenCalledWith('', 'Actor.B');
  });

  it('says a GM will make it later when none is online, and OK closes it', () => {
    const window = new WelcomeWindow(document, actions());
    window.show({ kind: 'waiting', gmOnline: false });
    expect(card()?.textContent).toContain('the next time they are online');
    click('OK');
    expect(window.isShowing).toBe(false);
    expect(document.querySelector('#tongs-welcome')).toBeNull();
  });

  it('says it is being made when a GM is online', () => {
    new WelcomeWindow(document, actions()).show({ kind: 'waiting', gmOnline: true });
    expect(card()?.textContent).toContain('Making your character');
  });

  it('shows why a request was turned down, with try again and not now', () => {
    const act = actions();
    new WelcomeWindow(document, act).show({ kind: 'refused', reason: 'Foundry said no.' });
    expect(card()?.textContent).toContain('Foundry said no.');
    click('Try again');
    click('Not now');
    expect(act.retry).toHaveBeenCalledOnce();
    expect(act.later).toHaveBeenCalledOnce();
  });

  /** ⚠️ A name is drawn as text, never as markup. */
  it('draws the world title as text', () => {
    new WelcomeWindow(document, actions()).show({ kind: 'ask', world: '<b>x</b>', parties: [] });
    expect(document.querySelector('#tongs-welcome b')).toBeNull();
  });

  it('replaces one face with the next rather than stacking windows', () => {
    const window = new WelcomeWindow(document, actions());
    window.show({ kind: 'ask', world: 'W', parties: [] });
    window.show({ kind: 'waiting', gmOnline: false });
    expect(document.querySelectorAll('#tongs-welcome')).toHaveLength(1);
  });
});

describe('the checklist panel', () => {
  const step = (key: string, isDone: boolean, detail: string | null = null): GuideStep => ({
    key,
    label: key,
    done: isDone,
    detail,
  });
  const guideActions = () => ({ openSheet: vi.fn(), hide: vi.fn(), finish: vi.fn() });
  const panel = () => document.querySelector('#tongs-build-guide');

  it('lists each step with a tick or a circle, and opens the sheet', () => {
    const act = guideActions();
    new GuidePanel(document, act).show('Theo', [
      step('Ancestry', true, 'Dwarf'),
      step('Class', false),
    ]);
    expect(panel()?.textContent).toContain('Building Theo');
    expect(
      [...document.querySelectorAll('#tongs-build-guide li')].map((li) => li.textContent)
    ).toEqual(['✓AncestryDwarf', '○Class']);
    click('Open sheet', '#tongs-build-guide');
    click('Hide', '#tongs-build-guide');
    expect(act.openSheet).toHaveBeenCalledOnce();
    expect(act.hide).toHaveBeenCalledOnce();
  });

  it('says the character is ready when every step is done, and Done finishes it', () => {
    const act = guideActions();
    new GuidePanel(document, act).show('Theo', [step('Ancestry', true)]);
    expect(panel()?.textContent).toContain('Theo is ready!');
    click('Done', '#tongs-build-guide');
    expect(act.finish).toHaveBeenCalledOnce();
  });

  it('redraws in place, and close removes it', () => {
    const guide = new GuidePanel(document, guideActions());
    guide.show('Theo', [step('Ancestry', false)]);
    guide.show('Theo', [step('Ancestry', true)]);
    expect(document.querySelectorAll('#tongs-build-guide')).toHaveLength(1);
    guide.close();
    expect(guide.isShowing).toBe(false);
    expect(panel()).toBeNull();
  });
});

describe('keys in the name box', () => {
  it('ignores every key but Enter', () => {
    const act = actions();
    new WelcomeWindow(document, act).show({ kind: 'ask', world: 'W', parties: [] });
    document
      .querySelector<HTMLInputElement>('#tongs-welcome input')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(act.create).not.toHaveBeenCalled();
  });
});
