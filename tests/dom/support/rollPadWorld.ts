import { vi } from 'vitest';

import { RollPad } from '../../../src/rollpad/RollPad.js';
import { padActor } from '../../unit/support/rollPadActor.js';

/** The Roll Pad on screen, opened on a character, with its buttons found by their text. 2026-10-08. */
export const root = () => document.querySelector<HTMLElement>('.tb-roll-pad');
export const buttons = (selector = '.tb-roll-pad__roll') => [
  ...document.querySelectorAll<HTMLButtonElement>(selector),
];
export const named = (text: string) => {
  const found = buttons('button').find((button) => button.textContent === text);
  if (found === undefined) throw new Error(`No button '${text}'.`);
  return found;
};
export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
export const press = (button: HTMLButtonElement, ...types: string[]) => {
  for (const type of types) button.dispatchEvent(new PointerEvent(type));
};

export const padWith = (actor: unknown = padActor()) => {
  const roll = vi.fn(() => Promise.resolve(true));
  const pad = new RollPad({ document, character: () => actor, roll });
  pad.open();
  return { pad, roll, actor };
};
