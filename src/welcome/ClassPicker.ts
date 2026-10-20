import { SAME_CLASS } from '../dualclass/DualClassWindow.js';
import type { ClassChoice } from '../dualclass/DualClassWindow.js';

/**
 * The welcome's "one class or two" choice, shown only in a world with Dual Class on. Added 2026-10-20.
 *
 * Lewis, 2026-10-20: "We should build more of the dual class macro into the player onboarding experience".
 * Two classes are asked for here and sent, once the sheet exists, as the Dual class window's own request
 * (`startWelcomeDualClass.ts`), so the GM's browser checks them exactly as strictly as it always has.
 * ⚠️ The same class twice is caught here as the window catches it, by name, and again by the GM's side.
 */
export interface DualPick {
  readonly first: string;
  readonly second: string;
}

const ID = 'tongs-welcome';

/**
 * Draws the choice into the card, and returns what pressing Create reads: null for one class, the two for
 * Dual Class, or undefined (saying why) when they are the same class. With no classes it draws nothing.
 */
export function classPicker(
  doc: Document,
  card: HTMLElement,
  classes: readonly ClassChoice[] | undefined
): () => DualPick | null | undefined {
  if (classes === undefined) {
    return () => null;
  }
  const select = (parent: HTMLElement, key: string, text: string, options: [string, string][]) => {
    const label = doc.createElement('label');
    label.textContent = text;
    const field = doc.createElement('select');
    field.id = `${ID}-${key}`;
    label.htmlFor = field.id;
    for (const [value, name] of options) {
      const option = doc.createElement('option');
      option.value = value;
      option.textContent = name;
      field.append(option);
    }
    parent.append(label, field);
    return field;
  };
  const how = select(card, 'classes', 'How many classes? This world uses the Dual Class rule.', [
    ['one', 'One class: pick it on the sheet'],
    ['two', 'Two classes (Dual Class)'],
  ]);
  const two = doc.createElement('div');
  two.hidden = true;
  card.append(two);
  const options = classes.map((each): [string, string] => [each.uuid, each.name]);
  const names = new Map(options);
  const first = select(
    two,
    'first',
    '1st class (Kineticist must go here, and probably Inventor and Thaumaturge too)',
    options
  );
  const second = select(two, 'second', '2nd class', options);
  second.selectedIndex = 1;
  const error = doc.createElement('p');
  error.className = 'tw-import-status';
  two.append(error);
  how.addEventListener('change', () => {
    two.hidden = how.value !== 'two';
  });
  return () => {
    if (how.value !== 'two') {
      return null;
    }
    if (names.get(first.value) === names.get(second.value)) {
      error.textContent = SAME_CLASS;
      return undefined;
    }
    return { first: first.value, second: second.value };
  };
}
