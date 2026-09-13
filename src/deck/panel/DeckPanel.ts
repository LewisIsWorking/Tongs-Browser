import type { ApplyOption } from '../applyOptions.js';
import type { ApplyOutcome } from '../applyThroughSystem.js';
import type { MessageFacts } from '../deckFacts.js';
import type { SaveOutcome } from '../rollSaveThroughSystem.js';
import { buildDeckBody } from './deckBody.js';
import { positionLabel, rollLabel } from './deckLabels.js';
import * as state from './deckPanelState.js';
import type { DeckPanelState } from './deckPanelState.js';
import { button } from './deckViews.js';
import type { TokenCandidate } from './tokenCandidates.js';

/**
 * The GM roll deck on screen: one card at a time, big buttons, Previous and Next. Added 2026-09-14.
 *
 * ⛔ OUR OWN INTERFACE, marked `data-tongs-browser="ignore"`. That one attribute answers both questions
 * `src/gesture/README.md` warns are different: the gesture layer keeps away (`isExcluded`), and the
 * native pointer suppressor keeps PIXI from seeing taps here (`isOwnInterface`). The panel shows CHAT
 * CONTENT but is not Foundry's chat log, so it must not be matched as the chat log's exclusion.
 * Buttons act on `click`, as the tray's do.
 *
 * ⛔ GM ONLY, checked on open as well as by the tray button being hidden. A permission enforced only by
 * a control's visibility is not enforced, and `RollDeck` refuses a player again underneath.
 *
 * ⚠️ Swipe comes later. Big Previous and Next buttons first, because a gesture that half works on a
 * phone is worse than a button: you cannot tell whether you did it wrong.
 */
export interface DeckPanelPorts {
  readonly document: Document;
  readonly deck: {
    cards: () => MessageFacts[];
    apply: (id: string, option: ApplyOption['id'], target: string) => Promise<ApplyOutcome>;
    rollSave: (id: string, index: number, rollers: readonly string[]) => Promise<SaveOutcome>;
  };
  readonly candidates: () => readonly TokenCandidate[];
  readonly offersTriple: () => boolean;
  readonly isGM: () => boolean;
}

export class DeckPanel {
  private readonly ports: DeckPanelPorts;
  private root: HTMLElement | null = null;
  private current: DeckPanelState = state.initialState([]);

  public constructor(ports: DeckPanelPorts) {
    this.ports = ports;
  }

  public isOpen(): boolean {
    return this.root !== null;
  }

  public open(): void {
    if (!this.ports.isGM()) {
      return;
    }
    if (this.root === null) {
      const doc = this.ports.document;
      this.root = doc.createElement('div');
      this.root.className = 'tb-roll-deck';
      this.root.setAttribute('data-tongs-browser', 'ignore');
      this.root.setAttribute('role', 'dialog');
      this.root.setAttribute('aria-label', 'GM roll deck');
      doc.body.append(this.root);
    }
    this.current = state.initialState(this.ports.deck.cards());
    this.render();
  }

  public close(): void {
    this.root?.remove();
    this.root = null;
  }

  private update(next: DeckPanelState): void {
    this.current = next;
    this.render();
  }

  /** ⚠️ Busy for the whole wait, so a second tap while PF2e works cannot send the same thing twice. */
  private async run(done: string, send: () => Promise<ApplyOutcome | SaveOutcome>): Promise<void> {
    this.update({ ...this.current, busy: true, status: 'Waiting for PF2e...' });
    let status: string;
    try {
      const outcome = await send();
      status = outcome.kind === 'applied' || outcome.kind === 'rolled' ? done : outcome.reason;
    } catch (error) {
      /* ⛔ Never left busy: a throw from PF2e would otherwise lock every button until a reload. */
      status = `PF2e reported an error: ${error instanceof Error ? error.message : String(error)}`;
    }
    const refreshed = state.withCards(this.current, this.ports.deck.cards());
    this.update({ ...refreshed, busy: false, status, choosing: null });
  }

  private apply(card: MessageFacts, optionId: ApplyOption['id'], uuid: string, label: string) {
    void this.run(`Done: ${label}.`, async () => this.ports.deck.apply(card.id, optionId, uuid));
  }

  private render(): void {
    const root = this.root;
    if (root === null) {
      return;
    }
    const doc = this.ports.document;
    const view = this.current;
    const card = state.currentCard(view);

    const header = doc.createElement('header');
    header.className = 'tb-roll-deck__header';
    const position = doc.createElement('p');
    position.textContent = positionLabel(view.index, view.cards.length);
    header.append(
      position,
      button(doc, 'Check for new rolls', 'refresh', () => {
        this.update({ ...state.withCards(view, this.ports.deck.cards()), status: null });
      }),
      button(doc, 'Close the roll deck', 'close', () => {
        this.close();
      })
    );

    const status = doc.createElement('p');
    status.className = 'tb-roll-deck__status';
    status.setAttribute('role', 'status');
    status.textContent = view.status ?? '';

    const body =
      card === null
        ? doc.createElement('section')
        : buildDeckBody({
            doc,
            card,
            view,
            candidates: this.ports.candidates(),
            offersTriple: this.ports.offersTriple(),
            update: (next) => {
              this.update(next);
            },
            applyTo: (optionId, uuid, label) => {
              this.apply(card, optionId, uuid, label);
            },
            rollFor: (saveIndex, save, rollers) => {
              const done = `Done: ${rollLabel(save, rollers)}.`;
              void this.run(done, async () =>
                this.ports.deck.rollSave(
                  card.id,
                  saveIndex,
                  rollers.map((r) => r.tokenUuid)
                )
              );
            },
          });

    const footer = doc.createElement('footer');
    footer.className = 'tb-roll-deck__footer';
    const previous = button(doc, 'Previous card', 'previous', () => {
      this.update(state.step(view, -1));
    });
    const next = button(doc, 'Next card', 'next', () => {
      this.update(state.step(view, 1));
    });
    previous.disabled = view.index <= 0;
    next.disabled = view.index >= view.cards.length - 1;
    footer.append(previous, next);

    root.replaceChildren(header, status, body, footer);
    if (view.busy) {
      root.querySelectorAll('button').forEach((each) => (each.disabled = true));
    }
  }
}
