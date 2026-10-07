import type { AutomationRole } from './automationRole.js';
import { summaryHtml, summaryOf, summaryText } from './saveSummaryCard.js';
import type { SummaryCard, SummaryFlags, SummaryTarget, Taken } from './saveSummaryCard.js';
import { readSaveResult } from './spellDamageFacts.js';
import type { SpellMessage } from './spellDamageFacts.js';
import { readRecordedTargets, readSpellCast } from './spellFacts.js';
import type { DamageGroup } from './validateSpellDamage.js';

/**
 * Posting, then completing, the card for one cast's saves; see `saveSummaryCard.ts`. Added 2026-10-07.
 *
 * The GM's browser posts it once every recorded target has a save Tongs rolled for that cast (each save
 * names its cast, see `SAVE_FOR_CAST_FLAG`), and rewrites the same card when the spell's damage lands.
 *
 * ⛔ ONE WRITE AT A TIME. A spell at three targets lands three saves in a second, and two of them reading
 * "no card yet" would post two cards.
 */
export interface SaveSummaryPorts {
  readonly role: () => AutomationRole;
  readonly systemId: () => string;
  readonly moduleId: string;
  readonly recentMessages: () => readonly SpellMessage[];
  readonly castMessage: (messageId: string) => SpellMessage | null;
  readonly spellName: (spellUuid: string) => string;
  readonly target: (tokenUuid: string) => Pick<SummaryTarget, 'name' | 'band'>;
  readonly post: (content: string, flags: SummaryFlags) => Promise<void>;
  readonly edit: (messageId: string, content: string, flags: SummaryFlags) => Promise<void>;
}

export class SaveSummary {
  private readonly ports: SaveSummaryPorts;
  private queue: Promise<void> = Promise.resolve();

  public constructor(ports: SaveSummaryPorts) {
    this.ports = ports;
  }

  public async onSaveCreated(message: SpellMessage): Promise<void> {
    const save = readSaveResult(message, this.ports.systemId());
    if (this.ports.role() !== 'act' || save?.castId === undefined) {
      return;
    }
    await this.write(save.castId, null);
  }

  /** The damage for the cast whose saves were rolled; `groups` leave out a target that took none. */
  public readonly onDamageApplied = async (
    castId: string,
    targets: readonly string[],
    groups: readonly DamageGroup[]
  ): Promise<void> => {
    const taken = Object.fromEntries(
      targets.map((token): [string, Taken] => [
        token,
        groups.find((group) => group.targetTokenUuids.includes(token))?.optionId ?? 'none',
      ])
    );
    await this.write(castId, taken);
  };

  private async write(castId: string, taken: Record<string, Taken> | null): Promise<void> {
    const turn = this.queue.then(async () => this.render(castId, taken));
    this.queue = turn.catch(() => undefined);
    await turn;
  }

  private async render(castId: string, newTaken: Record<string, Taken> | null): Promise<void> {
    const systemId = this.ports.systemId();
    const cast = this.ports.castMessage(castId);
    const facts = cast === null ? null : readSpellCast(cast, systemId);
    if (cast === null || facts === null) {
      return;
    }
    const recent = this.ports.recentMessages();
    const outcomes = new Map(
      recent.flatMap((message): [string, string][] => {
        const save = readSaveResult(message, systemId);
        return save?.castId === castId ? [[save.tokenUuid, save.outcome]] : [];
      })
    );
    const tokens = readRecordedTargets(cast, this.ports.moduleId);
    if (tokens.length === 0 || tokens.some((token) => !outcomes.has(token))) {
      return;
    }
    const existing = recent.find(
      (message) => summaryOf(message, this.ports.moduleId)?.castId === castId
    );
    const before = existing === undefined ? null : summaryOf(existing, this.ports.moduleId);
    const taken = newTaken ?? before?.taken ?? null;
    const card: SummaryCard = {
      spellName: this.ports.spellName(facts.spellUuid),
      targets: tokens.map((token) => ({
        ...this.ports.target(token),
        outcome: String(outcomes.get(token)),
        taken: taken?.[token] ?? null,
      })),
    };
    const flags: SummaryFlags = {
      castId,
      casterUserId: cast.author?.id ?? null,
      text: summaryText(card),
      taken,
    };
    await (existing === undefined
      ? this.ports.post(summaryHtml(card), flags)
      : this.ports.edit(existing.id, summaryHtml(card), flags));
  }
}
