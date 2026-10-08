import { IGNORE_ATTRIBUTE, IGNORE_ATTRIBUTE_VALUE } from '../constants.js';
import { readPad } from './padModel.js';
import type { PadModel } from './padModel.js';
import type { PadRoll } from './padRolls.js';
import { element, TAB_LABELS, tabBody } from './padViews.js';
import type { PadTab } from './padViews.js';

/**
 * The Roll Pad: a player's rolls as big buttons, opened from the tray. Added 2026-10-08.
 *
 * ⛔ OUR OWN INTERFACE, marked `data-tongs-browser="ignore"` as the GM roll deck is, so the gesture
 * layer keeps away and PIXI never sees a tap here (`deck/panel/DeckPanel.ts` says why one attribute
 * answers both).
 *
 * ⚠️ The pad CLOSES once a roll is made, so the player sees PF2e's card land in chat. Reopening it is
 * one tap, and it comes back on the same tab, so an attack then its damage is two taps apart.
 *
 * ⚠️ Read afresh on every open: a weapon drawn or a skill raised since the last open is there.
 */
export interface RollPadPorts {
  readonly document: Document;
  /** The player's character: assigned, else the selected token's, else the only one they own. */
  readonly character: () => unknown;
  /** Rolls it; false when the actor has no such roll any more. */
  readonly roll: (actor: unknown, roll: PadRoll, ask: boolean) => Promise<boolean>;
}

const NO_CHARACTER =
  'No character to roll for. Assign one in your user configuration, or select your token.';

export class RollPad {
  private root: HTMLElement | null = null;
  private tab: PadTab | null = null;

  public constructor(private readonly ports: RollPadPorts) {}

  public isOpen(): boolean {
    return this.root !== null;
  }

  public open(): void {
    const doc = this.ports.document;
    const root = this.root ?? element(doc, 'div', 'tb-roll-pad');
    root.setAttribute(IGNORE_ATTRIBUTE, IGNORE_ATTRIBUTE_VALUE);
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Roll Pad');
    if (this.root === null) {
      doc.body.append(root);
      this.root = root;
    }
    const actor = this.ports.character();
    this.draw(actor, readPad(actor));
  }

  public close(): void {
    this.root?.remove();
    this.root = null;
  }

  private draw(actor: unknown, model: PadModel | null, status = ''): void {
    const root = this.root;
    if (root === null) {
      return;
    }
    const doc = this.ports.document;
    root.replaceChildren();
    const header = element(doc, 'div', 'tb-roll-pad__header');
    header.append(element(doc, 'p', 'tb-roll-pad__name', model?.name ?? 'Roll Pad'));
    const close = element(doc, 'button', 'tb-roll-pad__close', 'Close');
    close.type = 'button';
    close.addEventListener('click', () => {
      this.close();
    });
    header.append(close);
    root.append(header);
    if (model === null) {
      root.append(element(doc, 'p', 'tb-roll-pad__note', NO_CHARACTER));
      return;
    }
    const tab = this.tab ?? (model.strikes.length > 0 ? 'strikes' : 'checks');
    root.append(this.tabs(model, tab, actor));
    const line = element(doc, 'p', 'tb-roll-pad__status', status);
    line.setAttribute('role', 'status');
    root.append(line);
    root.append(
      tabBody(doc, model, tab, (roll, ask) => {
        void this.roll(actor, model, roll, ask);
      })
    );
  }

  private tabs(model: PadModel, current: PadTab, actor: unknown): HTMLElement {
    const doc = this.ports.document;
    const row = element(doc, 'div', 'tb-roll-pad__tabs');
    row.setAttribute('role', 'tablist');
    for (const tab of Object.keys(TAB_LABELS) as PadTab[]) {
      const button = element(doc, 'button', 'tb-roll-pad__tab', TAB_LABELS[tab]);
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(tab === current));
      button.addEventListener('click', () => {
        this.tab = tab;
        this.draw(actor, model);
      });
      row.append(button);
    }
    return row;
  }

  private async roll(actor: unknown, model: PadModel, roll: PadRoll, ask: boolean): Promise<void> {
    try {
      if (await this.ports.roll(actor, roll, ask)) {
        this.close();
        return;
      }
      this.draw(actor, readPad(actor), 'That roll is not on the sheet any more.');
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.draw(actor, model, `The roll failed: ${reason}`);
    }
  }
}
