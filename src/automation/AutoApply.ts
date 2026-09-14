import type { ApplyOutcome } from '../deck/applyThroughSystem.js';
import type { AutomationRole } from './automationRole.js';
import { readStrikeAttack, readStrikeDamage } from './strikeFacts.js';
import type { StrikeDamageFacts, StrikeMessage } from './strikeFacts.js';
import { checkTarget } from './targetCheck.js';
import type { TargetState } from './targetCheck.js';
import { validateStrike } from './validateStrike.js';
import type { StrikeHistory } from './validateStrike.js';

/**
 * Applying players' strike damage to enemies without waiting for the GM. Added 2026-09-14.
 *
 * Act if a full GM is connected, queue if not (see `automationRole`):
 *
 * - **act**: this browser is the active full GM. Validate the hit, check the target, apply through the
 *   roll deck's own path, which marks the card handled. Anything that fails stays in the roll deck, with
 *   the reason recorded on the card.
 * - **queue**: no full GM is connected. The author's own browser marks their damage card pending; a
 *   player may set flags on messages they authored (measured). Nothing else happens.
 * - When a full GM connects, their browser works through every pending card, oldest first.
 *
 * ⛔ APPLIED ONCE. Applying goes through `RollDeck.apply`, which refuses a card already handled or
 * already under way in this browser, so the automation and the GM's own tap can never both land a hit.
 *
 * ⛔ PLAYERS' HITS ONLY. A card the GM authored, or damage from a creature no player owns, is none of
 * the automation's business and is left exactly as it was.
 */
export const PENDING_FLAG = 'pending';
export const DECLINED_FLAG = 'autoDeclined';

export interface AutoApplyPorts {
  readonly role: () => AutomationRole;
  readonly myUserId: () => string | null;
  readonly systemId: () => string;
  /** Recent chat messages, oldest first, read behind the document boundary (GM only). */
  readonly recentMessages: () => readonly StrikeMessage[];
  readonly flag: (message: StrikeMessage, key: string) => unknown;
  readonly isHandled: (message: StrikeMessage) => boolean;
  readonly authorIsPlayer: (message: StrikeMessage) => boolean;
  readonly attackerIsPlayers: (actorId: string) => boolean;
  /** PF2e's own formula for this strike against this target, given the attack's context. */
  readonly recomputeFormula: (
    damage: StrikeDamageFacts,
    attackId: string
  ) => Promise<string | null>;
  readonly targetState: (tokenUuid: string) => TargetState;
  readonly apply: (messageId: string, tokenUuid: string) => Promise<ApplyOutcome>;
  readonly setFlag: (messageId: string, key: string, value: unknown) => Promise<void>;
  readonly unsetFlag: (messageId: string, key: string) => Promise<void>;
}

export class AutoApply {
  private readonly ports: AutoApplyPorts;
  /** Cards this browser's automation is working on, so a live message and a catch-up never overlap. */
  private readonly working = new Set<string>();

  public constructor(ports: AutoApplyPorts) {
    this.ports = ports;
  }

  /** Every new chat message, in every browser. */
  public async onMessageCreated(message: StrikeMessage): Promise<void> {
    const role = this.ports.role();
    if (role === 'act') {
      await this.process(message);
    } else if (role === 'queue' && this.isMyStrikeDamage(message)) {
      await this.ports.setFlag(message.id, PENDING_FLAG, true);
    }
  }

  /** When a full GM connects: every pending card, oldest first, one at a time. */
  public async catchUp(): Promise<void> {
    if (this.ports.role() !== 'act') {
      return;
    }
    const pending = this.ports
      .recentMessages()
      .filter((message) => this.ports.flag(message, PENDING_FLAG) === true);
    for (const message of pending) {
      await this.process(message);
    }
  }

  private isMyStrikeDamage(message: StrikeMessage): boolean {
    const damage = readStrikeDamage(message, this.ports.systemId());
    return damage !== null && damage.authorId !== null && damage.authorId === this.ports.myUserId();
  }

  private async process(message: StrikeMessage): Promise<void> {
    if (this.working.has(message.id)) {
      return;
    }
    this.working.add(message.id);
    try {
      await this.decide(message);
    } finally {
      this.working.delete(message.id);
    }
  }

  private async decide(message: StrikeMessage): Promise<void> {
    const damage = readStrikeDamage(message, this.ports.systemId());
    if (
      damage === null ||
      this.ports.isHandled(message) ||
      !this.ports.authorIsPlayer(message) ||
      !this.ports.attackerIsPlayers(damage.actorId)
    ) {
      return;
    }

    const history = this.history(damage);
    /*
     * ⚠️ Two passes. The first finds the attack, with the card's own formula standing in so the formula
     * rule cannot fail yet; PF2e's formula needs that attack's context, so it is only worked out once
     * the attack is known. The second pass is the real verdict.
     */
    const paired = validateStrike(damage, history, damage.formula);
    const verdict =
      paired.kind === 'deck'
        ? paired
        : validateStrike(
            damage,
            history,
            await this.ports.recomputeFormula(damage, paired.attackId)
          );
    if (verdict.kind === 'deck') {
      await this.decline(message, verdict.reason);
      return;
    }

    const token = damage.targetToken ?? '';
    const target = checkTarget(this.ports.targetState(token));
    if (target.kind === 'later') {
      await this.ports.setFlag(message.id, PENDING_FLAG, true);
      return;
    }
    if (target.kind === 'deck') {
      await this.decline(message, target.reason);
      return;
    }

    const outcome = await this.ports.apply(message.id, token);
    if (outcome.kind === 'applied') {
      await this.ports.unsetFlag(message.id, PENDING_FLAG);
    } else {
      await this.decline(message, outcome.reason);
    }
  }

  private history(damage: StrikeDamageFacts): StrikeHistory {
    const systemId = this.ports.systemId();
    const earlier = this.ports.recentMessages().filter((m) => m.id !== damage.id);
    return {
      attacks: earlier.flatMap((m) => readStrikeAttack(m, systemId) ?? []),
      damages: earlier.flatMap((m) => readStrikeDamage(m, systemId) ?? []),
    };
  }

  /**
   * The card stays unhandled, so it waits in the roll deck, and says why it was not applied.
   *
   * ⚠️ Not on a card that was handled meanwhile. If the GM tapped Apply while this was deciding, the
   * deck refused the automation's request because the GM's was already landing; stamping "declined"
   * on that card would describe something that did not happen.
   */
  private async decline(message: StrikeMessage, reason: string): Promise<void> {
    if (this.ports.isHandled(message)) {
      return;
    }
    await this.ports.setFlag(message.id, DECLINED_FLAG, reason);
    await this.ports.unsetFlag(message.id, PENDING_FLAG);
  }
}
