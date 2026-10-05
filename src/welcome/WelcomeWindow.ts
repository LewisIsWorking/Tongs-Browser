import type { CampaignParty } from './campaignParty.js';
import type { ImportBuild } from './importBuild.js';
import { ImportPicker } from './ImportPicker.js';

/**
 * The window a new player sees when they join a world with no character in it. Added 2026-10-05.
 *
 * Three faces: asking for a name, waiting for a GM, and saying why a request was turned down. It only
 * draws; `startWelcome` decides which face to show and what a button does.
 */
const ROOT_ID = 'tongs-welcome';

const CSS = `
#${ROOT_ID} { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center;
  background: rgb(0 0 0 / .55); font-family: system-ui, sans-serif; }
#${ROOT_ID} .tw-card { width: min(30rem, calc(100vw - 32px)); box-sizing: border-box; padding: 1.4rem;
  border-radius: 10px; background: #1b1b20; color: #e6e6ea; box-shadow: 0 10px 40px rgb(0 0 0 / .5); }
#${ROOT_ID} h2 { margin: 0 0 .6rem; font-size: 1.3rem; border: 0; color: #f0d27a; }
#${ROOT_ID} p { margin: 0 0 .9rem; line-height: 1.45; color: #cfcfd6; }
#${ROOT_ID} label { display: block; margin: 0 0 .3rem; font-size: .9rem; color: #a8a8b3; }
#${ROOT_ID} input, #${ROOT_ID} select { width: 100%; box-sizing: border-box; margin: 0 0 1rem; padding: .55rem;
  border-radius: 6px; border: 1px solid #3a3a44; background: #111114; color: #e6e6ea; font-size: 1rem; }
#${ROOT_ID} .tw-import-status { font-size: .85rem; color: #a8a8b3; }
#${ROOT_ID} .tw-buttons { display: flex; gap: .6rem; justify-content: flex-end; flex-wrap: wrap; }
#${ROOT_ID} button { padding: .55rem 1rem; border-radius: 6px; border: 1px solid #3a3a44; background: #26262c;
  color: #e6e6ea; font-size: .95rem; cursor: pointer; width: auto; }
#${ROOT_ID} button.tw-primary { background: #c9a227; border-color: #c9a227; color: #111; font-weight: 600; }
`;

export type WelcomeFace =
  | { readonly kind: 'ask'; readonly world: string; readonly parties: readonly CampaignParty[] }
  | { readonly kind: 'waiting'; readonly gmOnline: boolean }
  | { readonly kind: 'refused'; readonly reason: string };

export interface WelcomeActions {
  readonly create: (
    name: string,
    partyUuid: string | null,
    importBuild: ImportBuild | null
  ) => void;
  readonly later: () => void;
  readonly retry: () => void;
}

export class WelcomeWindow {
  private root: HTMLElement | null = null;

  public constructor(
    private readonly doc: Document,
    private readonly actions: WelcomeActions
  ) {}

  public get isShowing(): boolean {
    return this.root !== null;
  }

  public show(face: WelcomeFace): void {
    this.close();
    const root = this.doc.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    const card = this.doc.createElement('div');
    card.className = 'tw-card';
    root.innerHTML = `<style>${CSS}</style>`;
    root.append(card);
    this.fill(card, face);
    this.doc.body.append(root);
    this.root = root;
    root.querySelector<HTMLElement>('input, button.tw-primary')?.focus();
  }

  public close(): void {
    this.root?.remove();
    this.root = null;
  }

  private fill(card: HTMLElement, face: WelcomeFace): void {
    if (face.kind === 'ask') {
      this.add(card, 'h2', `Welcome to ${face.world}!`);
      this.add(card, 'p', "Let's make your character. Give them a name; you can change it later.");
      const name = this.field(card, 'input', 'Character name') as HTMLInputElement;
      name.maxLength = 60;
      const select = this.partyChoice(card, face.parties);
      const picker = new ImportPicker(this.doc, card, name);
      const go = (): void => {
        this.actions.create(name.value, select?.value ?? null, picker.chosen);
      };
      name.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') go();
      });
      this.buttons(card, [
        [
          'Not now',
          () => {
            this.actions.later();
          },
        ],
        ['Create my character', go, true],
      ]);
      return;
    }
    if (face.kind === 'waiting') {
      this.add(card, 'h2', face.gmOnline ? 'Making your character...' : 'Your request is in');
      this.add(
        card,
        'p',
        face.gmOnline
          ? 'A GM is online, so this takes a few seconds.'
          : 'A GM will make your character sheet the next time they are online. It will be waiting here for you, so you can close Foundry in the meantime.'
      );
      this.buttons(card, [
        [
          'OK',
          () => {
            this.close();
          },
          true,
        ],
      ]);
      return;
    }
    this.add(card, 'h2', 'That did not work');
    this.add(card, 'p', face.reason);
    this.buttons(card, [
      [
        'Not now',
        () => {
          this.actions.later();
        },
      ],
      [
        'Try again',
        () => {
          this.actions.retry();
        },
        true,
      ],
    ]);
  }

  /** Only shown when there is a real choice; with one campaign party the GM's browser picks it. */
  private partyChoice(
    card: HTMLElement,
    parties: readonly CampaignParty[]
  ): HTMLSelectElement | null {
    if (parties.length < 2) {
      return null;
    }
    const select = this.field(card, 'select', 'Which campaign?') as HTMLSelectElement;
    for (const party of parties) {
      const option = this.doc.createElement('option');
      option.value = party.uuid;
      option.textContent = `${party.code}: ${party.name}`;
      select.append(option);
    }
    return select;
  }

  private field(card: HTMLElement, tag: 'input' | 'select', text: string): HTMLElement {
    const label = this.add(card, 'label', text);
    const field = this.doc.createElement(tag);
    field.id = `${ROOT_ID}-${tag}`;
    label.htmlFor = field.id;
    card.append(field);
    return field;
  }

  private buttons(card: HTMLElement, list: readonly [string, () => void, boolean?][]): void {
    const row = this.add(card, 'div', '');
    row.className = 'tw-buttons';
    for (const [text, run, primary] of list) {
      const button = this.add(row, 'button', text);
      button.type = 'button';
      if (primary === true) button.className = 'tw-primary';
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
