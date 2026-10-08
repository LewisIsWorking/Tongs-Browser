import { signed } from './padModel.js';
import type { PadCheck, PadModel, PadStrike } from './padModel.js';
import { bindPress } from './padPress.js';
import type { PadRoll } from './padRolls.js';

/**
 * The buttons on each Roll Pad tab. Added 2026-10-08; the panel around them is `RollPad.ts`.
 *
 * Each button names the roll and its modifier, never a target or a DC: the pad rolls, PF2e's card in
 * chat says how it went, and the GM's tools take it from there as they do for a sheet roll.
 */
export type PadTab = 'strikes' | 'checks' | 'skills';

export const TAB_LABELS: Readonly<Record<PadTab, string>> = {
  strikes: 'Strikes',
  checks: 'Checks',
  skills: 'Skills',
};

/** What a press does: roll, through PF2e's dialog when `ask`. */
export type PadPress = (roll: PadRoll, ask: boolean) => void;

export function element<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className: string,
  text = ''
): HTMLElementTagNameMap[K] {
  const made = doc.createElement(tag);
  made.className = className;
  made.textContent = text;
  return made;
}

function rollButton(doc: Document, text: string, roll: PadRoll, press: PadPress) {
  const button = element(doc, 'button', 'tb-roll-pad__roll', text);
  button.type = 'button';
  bindPress(button, {
    tap: () => {
      press(roll, false);
    },
    hold: () => {
      press(roll, true);
    },
  });
  return button;
}

function strikeCard(doc: Document, strike: PadStrike, press: PadPress): HTMLElement {
  const card = element(doc, 'section', 'tb-roll-pad__group');
  const title = strike.ready ? strike.label : `${strike.label} (not in hand)`;
  card.append(element(doc, 'h3', 'tb-roll-pad__title', title));
  const row = element(doc, 'div', 'tb-roll-pad__row');
  strike.attacks.forEach((label, variant) => {
    row.append(rollButton(doc, label, { kind: 'attack', strike: strike.index, variant }, press));
  });
  if (strike.canDamage) {
    row.append(rollButton(doc, 'Damage', { kind: 'damage', strike: strike.index }, press));
  }
  if (strike.canCritical) {
    row.append(rollButton(doc, 'Crit', { kind: 'critical', strike: strike.index }, press));
  }
  card.append(row);
  return card;
}

function checkButton(doc: Document, check: PadCheck, press: PadPress): HTMLButtonElement {
  const modifier = check.modifier === null ? '' : ` ${signed(check.modifier)}`;
  const roll: PadRoll = { kind: 'check', group: check.group, key: check.key };
  const button = rollButton(doc, `${check.label}${modifier}`, roll, press);
  if (!check.trained) {
    button.classList.add('tb-roll-pad__roll--untrained');
  }
  return button;
}

/** The body of one tab, or a line saying why it is empty. */
export function tabBody(doc: Document, model: PadModel, tab: PadTab, press: PadPress): HTMLElement {
  const body = element(doc, 'div', 'tb-roll-pad__body');
  const empty = (text: string) => {
    body.append(element(doc, 'p', 'tb-roll-pad__note', text));
  };
  if (tab === 'strikes') {
    model.strikes.forEach((strike) => {
      body.append(strikeCard(doc, strike, press));
    });
    if (model.strikes.length === 0) empty(`${model.name} has no strikes.`);
    return body;
  }
  const checks = tab === 'checks' ? model.checks : model.skills;
  const grid = element(doc, 'div', 'tb-roll-pad__grid');
  checks.forEach((check) => {
    grid.append(checkButton(doc, check, press));
  });
  body.append(grid);
  if (checks.length === 0) empty(`${model.name} has nothing to roll here.`);
  return body;
}
