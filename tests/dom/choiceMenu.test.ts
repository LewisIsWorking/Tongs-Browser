import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildChoiceMenu, buildNotice } from '../../src/ui/ChoiceMenu.js';

/**
 * The picker the create button puts on screen. Written 2026-09-02.
 *
 * ⚠️ Two of these assertions are about failures that are INVISIBLE rather than noisy, which is why
 * they are here rather than left to a hand test:
 *
 * - the `data-tongs-browser="ignore"` marker. Without it the gesture layer routes a tap through the
 *   virtual pointer, so the tap lands wherever the pointer happens to be rather than on the row under
 *   the finger. The rows still look perfect.
 * - the menu closing itself. #304 lost exactly this half elsewhere: the picker sits on top of what it
 *   just opened, the tap reads as having done nothing, and nothing throws.
 */
const rows = (): HTMLButtonElement[] => [
  ...document.querySelectorAll<HTMLButtonElement>('button[data-choice]'),
];

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('choosing from a list', () => {
  it('offers a row for every choice, labelled', () => {
    const menu = buildChoiceMenu(document, {
      title: 'Which party?',
      choices: [
        { id: 'Actor.a', label: 'The Firebrands' },
        { id: 'Actor.b', label: 'Second Party' },
      ],
      onChosen: () => undefined,
    });
    document.body.append(menu);

    expect(rows().map((row) => row.textContent)).toEqual(['The Firebrands', 'Second Party']);
  });

  it('says what is being chosen, so two pickers are not mistaken for each other', () => {
    const menu = buildChoiceMenu(document, {
      title: 'Which party?',
      choices: [],
      onChosen: () => undefined,
    });

    expect(menu.textContent).toContain('Which party?');
  });

  /** ⚠️ The ID, not the label. A picker of parties must not act on a name that two parties share. */
  it('reports the id of the row tapped, not its label', () => {
    const onChosen = vi.fn();
    const menu = buildChoiceMenu(document, {
      title: 'Which party?',
      choices: [
        { id: 'Actor.a', label: 'Same Name' },
        { id: 'Actor.b', label: 'Same Name' },
      ],
      onChosen,
    });
    document.body.append(menu);

    rows()[1]?.click();

    expect(onChosen).toHaveBeenCalledWith('Actor.b');
  });

  /**
   * ⚠️ THE HALF #304 LOST. A picker still on screen while a sheet opens behind it reads as the tap
   * having missed, which invites a second tap and a second sheet. Closing here rather than in the
   * caller means no caller can forget.
   */
  it('closes itself when a row is tapped', () => {
    const menu = buildChoiceMenu(document, {
      title: 'Which party?',
      choices: [{ id: 'Actor.a', label: 'The Firebrands' }],
      onChosen: () => undefined,
    });
    document.body.append(menu);
    expect(rows()).toHaveLength(1);

    rows()[0]?.click();

    expect(rows()).toHaveLength(0);
  });

  /** ⚠️ Closed BEFORE the callback runs, since a create takes a moment and the menu must not linger. */
  it('is already gone by the time the callback runs', () => {
    let attachedDuringCallback = true;
    const menu = buildChoiceMenu(document, {
      title: 'Which party?',
      choices: [{ id: 'Actor.a', label: 'The Firebrands' }],
      onChosen: () => {
        attachedDuringCallback = menu.isConnected;
      },
    });
    document.body.append(menu);

    rows()[0]?.click();

    expect(attachedDuringCallback).toBe(false);
  });

  /**
   * ⚠️ Without this the gesture layer turns a tap into a pointer event delivered wherever the pointer
   * is, and the rows look completely correct while being untappable.
   */
  it('tells the gesture layer to keep off it', () => {
    const menu = buildChoiceMenu(document, {
      title: 'Which party?',
      choices: [{ id: 'Actor.a', label: 'A' }],
      onChosen: () => undefined,
    });

    expect(menu.getAttribute('data-tongs-browser')).toBe('ignore');
  });
});

describe('saying why there is nothing to choose', () => {
  it('shows the message and a way out', () => {
    const menu = buildNotice(document, {
      title: 'No parties',
      message: 'Ask your GM to make one.',
    });
    document.body.append(menu);

    expect(menu.textContent).toContain('Ask your GM to make one.');
    expect(rows()).toHaveLength(1);
  });

  it('closes when dismissed', () => {
    const menu = buildNotice(document, { title: 'No parties', message: 'Ask your GM.' });
    document.body.append(menu);

    rows()[0]?.click();

    expect(menu.isConnected).toBe(false);
  });

  it('tells the gesture layer to keep off it too', () => {
    const menu = buildNotice(document, { title: 'No parties', message: 'Ask your GM.' });

    expect(menu.getAttribute('data-tongs-browser')).toBe('ignore');
  });
});
