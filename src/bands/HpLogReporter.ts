import type { AutomationRole } from '../automation/automationRole.js';
import type { BandCause } from './bandCause.js';
import { hpChangeReason, poolsOf, readHpChange } from './hpChange.js';
import type { HpChangePost, Pools } from './hpChange.js';
import type { CampaignChoice } from './partyCampaign.js';

/**
 * Recording every HP and Stamina change on a player character in ComeOnOverUno. Added 2026-10-17, beside
 * `PlayerHitReporter`, which tells the combat topic about hits; see `hpChange.ts` for what is recorded.
 *
 * ⛔ ONE BROWSER RECORDS: the active full GM's (`automationRole`), as for bands and hits. But EVERY browser
 * remembers each character's pools on every update, so a GM who takes over mid-session compares against the
 * real "before", not one remembered at page load.
 *
 * ⚠️ IN OR OUT OF COMBAT, token or not: a sheet edited in the actors directory is a change too. Remembered
 * from every world character at start (`seed`), so the first change after a reload has a "before".
 *
 * ⚠️ One post at a time, in order, so the record reads in the order the changes happened.
 */
export type HpLogOutcome = 'sent' | 'signed-out' | 'failed' | 'not-deployed';

export interface HpLogPorts {
  readonly role: () => AutomationRole;
  /** Every world actor, read live; only characters are kept. */
  readonly actors: () => Iterable<unknown>;
  /** The campaign of the parties that list this character's world actor. */
  readonly campaignOf: (actor: unknown) => CampaignChoice;
  readonly post: (campaign: string, change: HpChangePost) => Promise<HpLogOutcome>;
  /** Called at once, awaited later; see `causeWatch.ts`. */
  readonly causeFor: (actor: unknown) => Promise<BandCause>;
  readonly warn: (message: string) => void;
  readonly now: () => number;
}

interface CharacterLike {
  readonly id?: unknown;
  readonly uuid?: unknown;
  readonly name?: unknown;
  readonly type?: unknown;
}

export const NOT_DEPLOYED =
  'ComeOnOverUno does not keep HP records yet (the server has not been updated), so Tongs Browser is not ' +
  'recording HP and Stamina changes. Nothing else is affected.';

/** Why a character's change could not be recorded, for the GM. */
function hpLogProblem(name: string, choice: CampaignChoice): string | null {
  if (choice.kind === 'one') {
    return null;
  }
  return choice.kind === 'mixed'
    ? `Tongs Browser did not record ${name}'s HP change: their parties are in ${choice.codes.join(' and ')}, so it cannot tell which campaign it belongs to.`
    : `Tongs Browser did not record ${name}'s HP change: no party with a Path Wars campaign lists them.`;
}

export class HpLogReporter {
  private readonly ports: HpLogPorts;
  private readonly pools = new Map<string, Pools>();
  private readonly warned = new Set<string>();
  private queue: Promise<void> = Promise.resolve();

  public constructor(ports: HpLogPorts) {
    this.ports = ports;
  }

  /** Remembers every world character's pools without recording, so the first change has a "before". */
  public seed(): void {
    for (const actor of this.ports.actors()) {
      const character = actor as CharacterLike | null;
      const pools = poolsOf(actor);
      if (character?.type === 'character' && typeof character.uuid === 'string' && pools !== null) {
        if (!this.pools.has(character.uuid)) {
          this.pools.set(character.uuid, pools);
        }
      }
    }
  }

  /** Foundry's `updateActor`: only a change to a character's HP or Stamina Points is looked at. */
  public async onActorUpdated(actor: unknown, changes: unknown): Promise<void> {
    const hp = (
      changes as {
        system?: { attributes?: { hp?: { value?: unknown; sp?: { value?: unknown } } } };
      } | null
    )?.system?.attributes?.hp;
    const character = actor as CharacterLike | null;
    const after = poolsOf(actor);
    if (
      (hp?.value === undefined && hp?.sp?.value === undefined) ||
      character?.type !== 'character' ||
      typeof character.uuid !== 'string' ||
      after === null
    ) {
      return;
    }
    const before = this.pools.get(character.uuid);
    this.pools.set(character.uuid, after);
    if (this.ports.role() !== 'act') {
      return;
    }
    const name = typeof character.name === 'string' ? character.name : 'An unnamed character';
    const actorId = typeof character.id === 'string' ? character.id : character.uuid;
    const change = readHpChange(
      actorId,
      name,
      before,
      after,
      new Date(this.ports.now()).toISOString()
    );
    if (change === null) {
      return;
    }
    const choice = this.ports.campaignOf(actor);
    if (choice.kind !== 'one') {
      this.warnOnce(`${character.uuid}:${choice.kind}`, hpLogProblem(name, choice));
      return;
    }
    await this.enqueue(choice.code, change, this.ports.causeFor(actor));
  }

  private warnOnce(key: string, message: string | null): void {
    if (message !== null && !this.warned.has(key)) {
      this.warned.add(key);
      this.ports.warn(message);
    }
  }

  private async enqueue(
    campaign: string,
    change: Omit<HpChangePost, 'reason'>,
    cause: Promise<BandCause>
  ): Promise<void> {
    this.queue = this.queue.then(async () => {
      const reason = hpChangeReason(await cause, change.name);
      const outcome = await this.ports
        .post(campaign, { ...change, reason })
        .catch((): HpLogOutcome => 'failed');
      /* Signed out is the band reporter's to say: one sign-in serves all three, and one warning is enough. */
      if (outcome === 'not-deployed') {
        this.warnOnce('not-deployed', NOT_DEPLOYED);
      } else if (outcome === 'failed') {
        this.ports.warn(`Tongs Browser could not record the HP change of ${change.name}.`);
      }
    });
    return this.queue;
  }
}
