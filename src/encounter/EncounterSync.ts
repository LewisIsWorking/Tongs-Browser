import type { AutomationRole } from '../automation/automationRole.js';
import type { CampaignChoice } from '../bands/partyCampaign.js';
import type { CombatLike, EncounterSnapshot } from './encounterSnapshot.js';

/**
 * Keeping each Foundry encounter's tracker in the campaign's combat topic in step. Added 2026-09-16.
 *
 * ⛔ DECIDED WITH LEWIS: FOUNDRY DRIVES THE BOT. The active full GM's browser posts the encounter to
 * ComeOnOverUno on every change; COO edits one tracker message per encounter and keeps the encounter for the
 * Nudge bot, which pings. Only the active full GM's browser posts, so one change is told once.
 *
 * ⚠️ BURSTS ARE COALESCED. Advancing a turn in Foundry is several updates in a row (turn, then round, then
 * effects), and each would otherwise edit the Telegram message. A change waits `quietMs` for the next; the last
 * one wins. An ENDED encounter is sent at once: the combat document is being deleted.
 *
 * ⛔ THE TRACKER ID LIVES ON THE COMBAT. COO keeps encounters in memory only, so the message id it returns is
 * saved as a flag on the Foundry combat and sent back every time; a server restart still edits the same
 * message. Writing that flag is itself a combat update, which the hook filter in `startEncounterSync` ignores.
 */
export interface EncounterSyncPorts {
  readonly role: () => AutomationRole;
  readonly campaign: (combat: CombatLike) => CampaignChoice;
  readonly read: (combat: CombatLike, ended: boolean) => EncounterSnapshot | null;
  readonly trackerId: (combat: CombatLike) => number | undefined;
  readonly saveTrackerId: (combat: CombatLike, id: number) => Promise<void>;
  /** The tracker message id COO answered, null when it refused, or signed-out. */
  readonly post: (
    code: string,
    snapshot: EncounterSnapshot
  ) => Promise<number | null | 'signed-out'>;
  readonly later: (run: () => void, ms: number) => unknown;
  readonly cancel: (handle: unknown) => void;
}

export class EncounterSync {
  private readonly ports: EncounterSyncPorts;
  private readonly quietMs: number;
  private readonly waiting = new Map<string, unknown>();

  public constructor(ports: EncounterSyncPorts, quietMs = 1500) {
    this.ports = ports;
    this.quietMs = quietMs;
  }

  /** A change to an encounter: sent once things go quiet, or at once when it ended. */
  public changed(combat: CombatLike, ended = false): Promise<void> | undefined {
    const id = combat.id;
    if (id === undefined || this.ports.role() !== 'act') {
      return undefined;
    }
    const pending = this.waiting.get(id);
    if (pending !== undefined) {
      this.ports.cancel(pending);
      this.waiting.delete(id);
    }
    if (ended) {
      return this.send(combat, true);
    }
    this.waiting.set(
      id,
      this.ports.later(() => {
        this.waiting.delete(id);
        void this.send(combat, false);
      }, this.quietMs)
    );
    return undefined;
  }

  /** Posts now. Exposed for the catch-up on load, which has nothing to coalesce. */
  public async send(combat: CombatLike, ended: boolean): Promise<void> {
    const choice = this.ports.campaign(combat);
    const read = this.ports.read(combat, ended);
    if (choice.kind !== 'one' || read === null || (read.round < 1 && !ended)) {
      return;
    }
    const known = this.ports.trackerId(combat);
    const snapshot = known === undefined ? read : { ...read, trackerMessageId: known };
    const answer = await this.ports.post(choice.code, snapshot);
    if (typeof answer === 'number' && answer !== known && !ended) {
      await this.ports.saveTrackerId(combat, answer);
    }
  }
}
