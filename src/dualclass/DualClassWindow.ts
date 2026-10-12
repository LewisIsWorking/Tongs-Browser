/**
 * The "Dual class…" window a player opens from the Tongs tray. Added 2026-10-12.
 *
 * It only draws: which sheet, the 1st class and the 2nd, then "asked", "done" or why not. Picking the
 * same class twice is refused here, before anything is sent, and again by the GM's browser.
 */
const ROOT_ID = 'tongs-dual-class';

const CSS = `
#${ROOT_ID} { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center;
  background: rgb(0 0 0 / .55); font-family: system-ui, sans-serif; }
#${ROOT_ID} .td-card { width: min(30rem, calc(100vw - 32px)); box-sizing: border-box; padding: 1.4rem;
  border-radius: 10px; background: #1b1b20; color: #e6e6ea; box-shadow: 0 10px 40px rgb(0 0 0 / .5); }
#${ROOT_ID} h2 { margin: 0 0 .6rem; font-size: 1.3rem; border: 0; color: #f0d27a; }
#${ROOT_ID} p { margin: 0 0 .9rem; line-height: 1.45; color: #cfcfd6; }
#${ROOT_ID} p.td-note { color: #f0d27a; }
#${ROOT_ID} label { display: block; margin: 0 0 .3rem; font-size: .9rem; color: #a8a8b3; }
#${ROOT_ID} select { width: 100%; box-sizing: border-box; margin: 0 0 1rem; padding: .55rem;
  border-radius: 6px; border: 1px solid #3a3a44; background: #111114; color: #e6e6ea; font-size: 1rem; }
#${ROOT_ID} .td-buttons { display: flex; gap: .6rem; justify-content: flex-end; flex-wrap: wrap; }
#${ROOT_ID} button { padding: .55rem 1rem; border-radius: 6px; border: 1px solid #3a3a44; background: #26262c;
  color: #e6e6ea; font-size: .95rem; cursor: pointer; width: auto; }
#${ROOT_ID} button.td-primary { background: #c9a227; border-color: #c9a227; color: #111; font-weight: 600; }
`;

export interface ClassChoice {
  readonly uuid: string;
  readonly name: string;
}

export type DualClassFace =
  | {
      readonly kind: 'ask';
      readonly sheets: readonly { readonly id: string; readonly name: string }[];
      readonly classes: readonly ClassChoice[];
      /** The world's Dual Class variant rule is registered and switched off. */
      readonly variantOff: boolean;
    }
  | { readonly kind: 'waiting'; readonly gmOnline: boolean }
  | { readonly kind: 'message'; readonly title: string; readonly text: string };

export const SAME_CLASS = 'Pick two different classes: the same class twice is not a dual class.';

export class DualClassWindow {
  private root: HTMLElement | null = null;

  public constructor(
    private readonly doc: Document,
    private readonly ask: (actorId: string, first: string, second: string) => void
  ) {}

  public show(face: DualClassFace): void {
    this.close();
    const root = this.doc.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = `<style>${CSS}</style>`;
    const card = this.add(root, 'div', '');
    card.className = 'td-card';
    this.fill(card, face);
    this.doc.body.append(root);
    this.root = root;
    root.querySelector<HTMLElement>('button.td-primary')?.focus();
  }

  public close(): void {
    this.root?.remove();
    this.root = null;
  }

  private fill(card: HTMLElement, face: DualClassFace): void {
    const ok: [string, () => void, boolean] = [
      'OK',
      () => {
        this.close();
      },
      true,
    ];
    if (face.kind === 'message') {
      this.add(card, 'h2', face.title);
      this.add(card, 'p', face.text);
      this.buttons(card, [ok]);
      return;
    }
    if (face.kind === 'waiting') {
      this.add(card, 'h2', 'Your dual class is on its way');
      this.add(
        card,
        'p',
        face.gmOnline
          ? "A GM is online, so it lands on your sheet in a few seconds. PF2e may ask you to pick your classes' features."
          : 'A GM builds it the next time one is online, and it lands on your sheet then. You can close Foundry in the meantime.'
      );
      this.buttons(card, [ok]);
      return;
    }
    this.add(card, 'h2', 'Dual class');
    this.add(
      card,
      'p',
      'Pick one of your characters and two classes. Their current class is replaced by the two together, as PF2e does when a class is dropped on a sheet.'
    );
    if (face.variantOff) {
      this.add(
        card,
        'p',
        "This world has PF2e's Dual Class variant rule switched off. You may want to ask your GM to turn it on."
      ).className = 'td-note';
    }
    const sheet = this.select(
      card,
      'Character',
      'sheet',
      face.sheets.map((each) => [each.id, each.name])
    );
    const choices = face.classes.map((each): [string, string] => [each.uuid, each.name]);
    const first = this.select(
      card,
      '1st class (Kineticist must go here, and probably Inventor and Thaumaturge too)',
      'first',
      choices
    );
    const second = this.select(card, '2nd class', 'second', choices);
    const error = this.add(card, 'p', '');
    error.className = 'td-note';
    /* By name as well as UUID: a playtest Fighter beside PF2e's is still the same class twice. */
    const names = new Map(choices);
    const go = (): void => {
      if (names.get(first.value) === names.get(second.value)) {
        error.textContent = SAME_CLASS;
        return;
      }
      this.ask(sheet.value, first.value, second.value);
    };
    this.buttons(card, [
      [
        'Cancel',
        () => {
          this.close();
        },
        false,
      ],
      ['Ask for this dual class', go, true],
    ]);
  }

  private select(
    card: HTMLElement,
    text: string,
    key: string,
    options: readonly [string, string][]
  ): HTMLSelectElement {
    const label = this.add(card, 'label', text);
    const select = this.add(card, 'select', '');
    select.id = `${ROOT_ID}-${key}`;
    label.htmlFor = select.id;
    for (const [value, name] of options) {
      this.add(select, 'option', name).value = value;
    }
    return select;
  }

  private buttons(card: HTMLElement, list: readonly [string, () => void, boolean][]): void {
    const row = this.add(card, 'div', '');
    row.className = 'td-buttons';
    for (const [text, run, primary] of list) {
      const button = this.add(row, 'button', text);
      button.type = 'button';
      if (primary) button.className = 'td-primary';
      button.addEventListener('click', run);
    }
  }

  private add<K extends keyof HTMLElementTagNameMap>(
    parent: HTMLElement,
    tag: K,
    text: string
  ): HTMLElementTagNameMap[K] {
    const element = this.doc.createElement(tag);
    element.textContent = text;
    parent.append(element);
    return element;
  }
}
