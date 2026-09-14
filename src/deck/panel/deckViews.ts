import { APPLY_OPTIONS, applyLabel } from '../applyOptions.js';
import type { ApplyOption } from '../applyOptions.js';
import type { MessageFacts, SaveFacts } from '../deckFacts.js';
import { chooseRollersLabel } from './deckLabels.js';

/**
 * The card on screen, as elements. Added 2026-09-14.
 *
 * ⛔ TEXT ONLY, never HTML. A card shows a speaker and an item name, and a player can name a character
 * anything; `textContent` means nothing a player types is ever parsed in the GM's browser.
 *
 * ⚠️ Only roll 0's damage gets buttons. PF2e's context menu entries, which applying runs, always apply
 * `rollIndex` 0 (its default, read in 8.5.0), so a button for a later roll would apply the first one.
 */
export interface CardHandlers {
  /** The option, what it sends, and the sentence its button showed. */
  readonly apply: (
    option: ApplyOption,
    amount: number,
    types: readonly string[],
    label: string
  ) => void;
  readonly chooseRollers: (saveIndex: number, save: SaveFacts) => void;
}

export function button(doc: Document, label: string, action: string, onTap: () => void) {
  const element = doc.createElement('button');
  element.type = 'button';
  element.className = 'tb-roll-deck__button';
  element.dataset['deckAction'] = action;
  element.textContent = label;
  element.addEventListener('click', onTap);
  return element;
}

function heading(doc: Document, card: MessageFacts): HTMLElement {
  const title = doc.createElement('p');
  title.className = 'tb-roll-deck__title';
  const who = card.speaker === '' ? 'Unknown speaker' : card.speaker;
  title.textContent = card.title === null ? who : `${who}: ${card.title}`;
  return title;
}

function note(doc: Document, text: string): HTMLElement {
  const element = doc.createElement('p');
  element.className = 'tb-roll-deck__note';
  element.textContent = text;
  return element;
}

export function buildCardView(
  doc: Document,
  card: MessageFacts,
  handlers: CardHandlers,
  offersTriple: boolean
): HTMLElement {
  const view = doc.createElement('section');
  view.className = 'tb-roll-deck__card';
  view.append(heading(doc, card));
  if (card.note !== undefined) {
    view.append(note(doc, `Not applied automatically: ${card.note}.`));
  }

  const roll = card.damage.find((each) => each.rollIndex === 0);
  if (roll !== undefined) {
    for (const option of APPLY_OPTIONS) {
      const amount = roll.amounts[option.id];
      /* ⚠️ Triple follows PF2e's own crit and fumble setting, which is what shows it on the card. */
      if (amount === undefined || (option.id === 'triple' && !offersTriple)) {
        continue;
      }
      const label = applyLabel(option, amount, roll.types, card.target?.name ?? null);
      view.append(
        button(doc, label, `apply-${option.id}`, () => {
          handlers.apply(option, amount, roll.types, label);
        })
      );
    }
  } else if (card.damage.length > 0) {
    view.append(note(doc, "PF2e can only apply this message's first roll, which has no damage."));
  }

  card.saves.forEach((save, saveIndex) => {
    view.append(
      button(doc, chooseRollersLabel(save), `save-${String(saveIndex)}`, () => {
        handlers.chooseRollers(saveIndex, save);
      })
    );
  });

  return view;
}

export interface PickerRow {
  readonly id: string;
  readonly label: string;
  /** Present on a multi-select row: whether it is chosen now. */
  readonly pressed?: boolean;
}

export interface PickerOptions {
  readonly title: string;
  readonly rows: readonly PickerRow[];
  readonly onRow: (row: PickerRow) => void;
  readonly empty: string;
  /** A confirm button, for a choice of several. Absent when one tap on a row decides. */
  readonly confirm?: {
    readonly label: string;
    readonly enabled: boolean;
    readonly onTap: () => void;
  };
  readonly onCancel: () => void;
}

export function buildPicker(doc: Document, options: PickerOptions): HTMLElement {
  const view = doc.createElement('section');
  view.className = 'tb-roll-deck__card tb-roll-deck__card--picker';
  const title = doc.createElement('p');
  title.className = 'tb-roll-deck__title';
  title.textContent = options.title;
  view.append(title);

  if (options.rows.length === 0) {
    view.append(note(doc, options.empty));
  }
  for (const row of options.rows) {
    const element = button(doc, row.label, 'pick', () => {
      options.onRow(row);
    });
    element.dataset['tokenUuid'] = row.id;
    if (row.pressed !== undefined) {
      element.setAttribute('aria-pressed', String(row.pressed));
    }
    view.append(element);
  }
  if (options.confirm !== undefined) {
    const confirm = button(doc, options.confirm.label, 'confirm', options.confirm.onTap);
    confirm.disabled = !options.confirm.enabled;
    view.append(confirm);
  }
  view.append(button(doc, 'Back to the card', 'cancel', options.onCancel));
  return view;
}
