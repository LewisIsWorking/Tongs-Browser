import { guideFinished } from './buildGuide.js';
import type { GuideStep } from './buildGuide.js';

/**
 * The checklist beside a new player's sheet: what is done and what is left. Added 2026-10-05.
 *
 * It only draws; `startWelcome` reads the sheet into steps and redraws on every change.
 */
const ROOT_ID = 'tongs-build-guide';

const CSS = `
#${ROOT_ID} { position: fixed; right: 16px; bottom: 16px; z-index: 9000; width: min(17rem, calc(100vw - 32px));
  box-sizing: border-box; padding: .9rem 1rem; border-radius: 10px; background: #1b1b20; color: #e6e6ea;
  font-family: system-ui, sans-serif; box-shadow: 0 6px 24px rgb(0 0 0 / .45); }
#${ROOT_ID} h3 { margin: 0 0 .5rem; font-size: 1rem; border: 0; color: #f0d27a; }
#${ROOT_ID} ol { list-style: none; margin: 0 0 .7rem; padding: 0; }
#${ROOT_ID} li { display: flex; gap: .5rem; padding: .2rem 0; color: #a8a8b3; }
#${ROOT_ID} li.tg-done { color: #e6e6ea; }
#${ROOT_ID} li .tg-mark { width: 1.1rem; flex: none; }
#${ROOT_ID} li .tg-detail { margin-left: auto; color: #8d8d98; font-size: .85rem; }
#${ROOT_ID} p { margin: 0 0 .7rem; font-size: .9rem; color: #cfcfd6; }
#${ROOT_ID} .tg-buttons { display: flex; gap: .5rem; justify-content: flex-end; }
#${ROOT_ID} button { padding: .35rem .7rem; border-radius: 6px; border: 1px solid #3a3a44; background: #26262c;
  color: #e6e6ea; cursor: pointer; width: auto; font-size: .85rem; }
`;

export interface GuideActions {
  readonly openSheet: () => void;
  /** Hides it until the next visit. */
  readonly hide: () => void;
  /** Every step is done and the player said so: it does not come back. */
  readonly finish: () => void;
}

export class GuidePanel {
  private root: HTMLElement | null = null;

  public constructor(
    private readonly doc: Document,
    private readonly actions: GuideActions
  ) {}

  public get isShowing(): boolean {
    return this.root !== null;
  }

  public show(name: string, steps: readonly GuideStep[]): void {
    const root = this.root ?? this.doc.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('role', 'complementary');
    root.setAttribute('aria-label', 'Character checklist');
    root.innerHTML = `<style>${CSS}</style>`;
    const finished = guideFinished(steps);
    this.add(root, 'h3', finished ? `${name} is ready!` : `Building ${name}`);
    const list = this.add(root, 'ol', '');
    for (const step of steps) {
      const item = this.add(list, 'li', '');
      if (step.done) item.className = 'tg-done';
      this.add(item, 'span', step.done ? '✓' : '○').className = 'tg-mark';
      this.add(item, 'span', step.label);
      if (step.detail !== null) this.add(item, 'span', step.detail).className = 'tg-detail';
    }
    if (finished) {
      this.add(root, 'p', 'All the basics are done. Post in your campaign topic to say hello!');
    }
    const row = this.add(root, 'div', '');
    row.className = 'tg-buttons';
    this.button(row, 'Open sheet', this.actions.openSheet);
    this.button(
      row,
      finished ? 'Done' : 'Hide',
      finished ? this.actions.finish : this.actions.hide
    );
    if (this.root === null) {
      this.doc.body.append(root);
      this.root = root;
    }
  }

  public close(): void {
    this.root?.remove();
    this.root = null;
  }

  private button(row: HTMLElement, text: string, run: () => void): void {
    const button = this.add(row, 'button', text);
    button.type = 'button';
    button.addEventListener('click', run);
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
