import type { ApplyOutcome } from '../deck/applyThroughSystem.js';
import { CLAIMED_FLAG, DECLINED_FLAG, PENDING_FLAG } from './AutoApply.js';
import type { AutoApplyPorts } from './AutoApply.js';
import { readSaveResult, readSpellDamage } from './spellDamageFacts.js';
import type { SpellMessage } from './spellDamageFacts.js';
import { readRecordedTargets, readSpellCast } from './spellFacts.js';
import { checkTarget } from './targetCheck.js';
import { validateSpellDamage } from './validateSpellDamage.js';
import type { DamageGroup, SpellDamageHistory, SpellDamageRule } from './validateSpellDamage.js';

/**
 * Applying players' basic-save spell damage to enemies by each one's degree of success. Added 2026-09-14.
 *
 * Phase 2 step 2, the second half of `SpellSaves`, and the same rules as `AutoApply`: only a full GM's
 * browser acts; with none connected the author's browser queues the card; a card is claimed before
 * anything is clicked and a claim is never retried; every target must be an enemy standing in the combat
 * on the scene being viewed, or the card waits in the roll deck with the reason.
 *
 * ⚠️ THE SAVES MAY COME AFTER THE DAMAGE. A player can roll damage before the GM's browser has rolled
 * the saves, and a queued cast and its queued damage are caught up together. A card still missing saves
 * stays pending with a note, and every new saving-throw card makes this browser look at pending cards
 * again.
 */
export type SpellDamagePorts = Pick<
  AutoApplyPorts,
  | 'role'
  | 'myUserId'
  | 'systemId'
  | 'flag'
  | 'isHandled'
  | 'authorIsPlayer'
  | 'attackerIsPlayers'
  | 'targetState'
  | 'setFlag'
  | 'unsetFlag'
> & {
  readonly moduleId: string;
  readonly recentMessages: () => readonly SpellMessage[];
  readonly spellRule: (
    spellUuid: string,
    castRank: number | null
  ) => Promise<SpellDamageRule | null>;
  readonly applyGroups: (
    messageId: string,
    groups: readonly DamageGroup[]
  ) => Promise<ApplyOutcome>;
};

const UNCONFIRMED =
  'an automatic apply was started earlier and never confirmed; check the targets before applying';

export class SpellDamage {
  private readonly ports: SpellDamagePorts;
  private readonly working = new Set<string>();
  /** Cards asked about again while being worked on, so a save arriving mid-decision is not missed. */
  private readonly again = new Set<string>();

  public constructor(ports: SpellDamagePorts) {
    this.ports = ports;
  }

  public async onMessageCreated(message: SpellMessage): Promise<void> {
    const role = this.ports.role();
    const systemId = this.ports.systemId();
    if (role === 'act') {
      await (readSaveResult(message, systemId) === null ? this.process(message) : this.catchUp());
    } else if (role === 'queue') {
      const damage = readSpellDamage(message, systemId);
      if (
        damage !== null &&
        damage.authorId !== null &&
        damage.authorId === this.ports.myUserId()
      ) {
        await this.ports.setFlag(message.id, PENDING_FLAG, true);
      }
    }
  }

  public async catchUp(): Promise<void> {
    if (this.ports.role() !== 'act') {
      return;
    }
    for (const message of this.ports.recentMessages()) {
      if (this.ports.flag(message, PENDING_FLAG) === true) {
        await this.process(message);
      }
    }
  }

  private async process(message: SpellMessage): Promise<void> {
    if (this.working.has(message.id)) {
      this.again.add(message.id);
      return;
    }
    this.working.add(message.id);
    try {
      do {
        this.again.delete(message.id);
        await this.decide(message);
      } while (this.again.has(message.id));
    } finally {
      this.working.delete(message.id);
    }
  }

  private async decide(message: SpellMessage): Promise<void> {
    const damage = readSpellDamage(message, this.ports.systemId());
    if (
      damage === null ||
      this.ports.isHandled(message) ||
      !this.ports.authorIsPlayer(message) ||
      !this.ports.attackerIsPlayers(damage.actorId)
    ) {
      return;
    }
    if (this.ports.flag(message, CLAIMED_FLAG) === true) {
      await this.decline(message, UNCONFIRMED);
      return;
    }

    const rule = await this.ports.spellRule(damage.spellUuid, damage.castRank);
    const verdict = validateSpellDamage(damage, this.history(), rule);
    if (verdict.kind === 'deck') {
      await this.decline(message, verdict.reason);
      return;
    }
    const checks = verdict.targets.map((token) => checkTarget(this.ports.targetState(token)));
    if (checks.some((each) => each.kind === 'later')) {
      await this.ports.setFlag(message.id, PENDING_FLAG, true);
      return;
    }
    const refused = checks.find((each) => each.kind === 'deck');
    if (refused !== undefined) {
      await this.decline(message, refused.reason);
      return;
    }
    if (verdict.kind === 'wait') {
      await this.ports.setFlag(message.id, DECLINED_FLAG, verdict.reason);
      await this.ports.setFlag(message.id, PENDING_FLAG, true);
      return;
    }

    /* ⛔ CLAIMED BEFORE THE CLICK, and a claim is never retried; see `AutoApply`. */
    await this.ports.setFlag(message.id, CLAIMED_FLAG, true);
    const outcome = await this.ports.applyGroups(message.id, verdict.groups);
    if (outcome.kind === 'applied') {
      await this.ports.unsetFlag(message.id, PENDING_FLAG);
      return;
    }
    if (outcome.kind === 'refused') {
      await this.ports.unsetFlag(message.id, CLAIMED_FLAG);
    }
    await this.decline(message, outcome.reason);
  }

  private history(): SpellDamageHistory {
    const systemId = this.ports.systemId();
    const recent = this.ports.recentMessages();
    return {
      casts: recent.flatMap((m) => {
        const cast = readSpellCast(m, systemId);
        return cast === null
          ? []
          : [{ ...cast, targets: readRecordedTargets(m, this.ports.moduleId) }];
      }),
      damages: recent.flatMap((m) => readSpellDamage(m, systemId) ?? []),
      saves: recent.flatMap((m) => readSaveResult(m, systemId) ?? []),
    };
  }

  /** ⚠️ Not on a card handled meanwhile; see `AutoApply.decline`. */
  private async decline(message: SpellMessage, reason: string): Promise<void> {
    if (this.ports.isHandled(message)) {
      return;
    }
    await this.ports.setFlag(message.id, DECLINED_FLAG, reason);
    await this.ports.unsetFlag(message.id, PENDING_FLAG);
  }
}
