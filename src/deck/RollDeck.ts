import { APPLY_OPTIONS } from './applyOptions.js';
import type { ApplyOption } from './applyOptions.js';
import { applyThroughSystem } from './applyThroughSystem.js';
import type { ApplyOutcome } from './applyThroughSystem.js';
import { buildApplyPorts } from './buildApplyPorts.js';
import type { DeckGlobals } from './buildApplyPorts.js';
import { buildDeck } from './buildDeck.js';
import { buildSavePorts } from './buildSavePorts.js';
import type { MessageFacts } from './deckFacts.js';
import { listDeckMessages } from './listDeckMessages.js';
import { HANDLED_FLAG, MODULE_ID } from './readMessageFacts.js';
import { readSaveControlsFromHtml } from './readSaveControls.js';
import { rollSaveThroughSystem } from './rollSaveThroughSystem.js';
import type { SaveOutcome } from './rollSaveThroughSystem.js';
import type { DeckListGlobals } from './listDeckMessages.js';

/** Everything the deck reads from Foundry: what applying needs and what listing needs. */
export type RollDeckGlobals = DeckGlobals & DeckListGlobals;

/**
 * The GM roll deck as one service the module exposes. Added 2026-09-13.
 *
 * ⚠️ Reached as `game.modules.get('tongs-browser').api.getDeck()`, the same way the live harnesses
 * already reach `getPointer()`. `api` IS the module instance and several harnesses call its methods
 * directly, so the deck is a member of it rather than a replacement for it.
 *
 * ⛔ GM ONLY, checked here before anything is sent. Foundry would refuse a player's damage to an enemy
 * anyway, but the brief is explicit that players must never be able to reach this view, and a refusal
 * that names the reason is better than PF2e's own error arriving on a player's phone.
 */
export class RollDeck {
  private readonly globals: RollDeckGlobals;
  private readonly doc: Document;
  /**
   * ⛔ Cards being applied or rolled in THIS browser right now. Added 2026-09-14 with phase 2, whose
   * automation and the GM's own taps both come through this one service: the handled marker is only
   * written once PF2e confirms, so without this a tap and the automation could both start on one hit
   * in the moment before either finishes. Measured: one GM user cannot be joined from two browsers
   * (the second never becomes ready), so this browser is the only place both can meet.
   */
  private readonly inFlight = new Set<string>();

  public constructor(globals: RollDeckGlobals, doc: Document) {
    this.globals = globals;
    this.doc = doc;
  }

  /**
   * The cards to show, oldest unhandled first. Read fresh on every call, since the chat log keeps
   * growing while the deck is open. Empty for anyone who is not a GM; see `listDeckMessages`.
   */
  public cards(): MessageFacts[] {
    return buildDeck(
      listDeckMessages(this.globals, (content) => readSaveControlsFromHtml(this.doc, content))
    );
  }

  public async apply(
    messageId: string,
    optionId: ApplyOption['id'],
    targetTokenUuid: string
  ): Promise<ApplyOutcome> {
    if (this.globals.game?.user?.isGM !== true) {
      return { kind: 'refused', reason: 'only a GM can apply damage from the roll deck' };
    }

    const option = APPLY_OPTIONS.find((each) => each.id === optionId);
    if (option === undefined) {
      return { kind: 'refused', reason: `there is no way to apply damage called "${optionId}"` };
    }

    return this.once(messageId, async () =>
      applyThroughSystem(buildApplyPorts(this.globals, this.doc), {
        messageId,
        option,
        targetTokenUuid,
      })
    );
  }

  /**
   * Rolls one of a card's saves for the tokens the GM chose.
   *
   * ⚠️ The save is looked up from the CURRENT cards, not taken from the caller, so a card handled since
   * it was shown, or a message deleted meanwhile, is refused rather than rolled a second time.
   */
  public async rollSave(
    messageId: string,
    saveIndex: number,
    tokenUuids: readonly string[]
  ): Promise<SaveOutcome> {
    if (this.globals.game?.user?.isGM !== true) {
      return { kind: 'refused', reason: 'only a GM can roll saves from the roll deck' };
    }
    const save = this.cards().find((card) => card.id === messageId)?.saves[saveIndex];
    if (save === undefined) {
      return { kind: 'refused', reason: 'that card has been handled or no longer asks for a save' };
    }
    return this.once(messageId, async () =>
      rollSaveThroughSystem(buildSavePorts(this.globals, this.doc), { messageId, save, tokenUuids })
    );
  }

  /** ⛔ First one wins: a card already handled, or already under way here, is refused and not sent. */
  private async once<T>(
    messageId: string,
    work: () => Promise<T>
  ): Promise<T | { readonly kind: 'refused'; readonly reason: string }> {
    const message = this.globals.game?.messages?.get?.(messageId);
    if (message?.getFlag?.(MODULE_ID, HANDLED_FLAG) === true) {
      return { kind: 'refused', reason: 'that card has already been handled' };
    }
    if (this.inFlight.has(messageId)) {
      return { kind: 'refused', reason: 'that card is already being handled' };
    }
    this.inFlight.add(messageId);
    try {
      return await work();
    } finally {
      this.inFlight.delete(messageId);
    }
  }
}
