import type { AutomationRole } from '../automation/automationRole.js';
import type { BandCause } from './bandCause.js';
import type { TokenView } from './bandSubject.js';
import type { PostOutcome } from './CooClient.js';
import { campaignProblem } from './partyCampaign.js';
import type { CampaignChoice } from './partyCampaign.js';
import { healthOf, readPlayerHit, withCause } from './playerHit.js';
import type { Health, PlayerHitPost } from './playerHit.js';

/**
 * Telling the combat topic when a player character is hurt. Added 2026-09-28, beside `BandReporter`, which
 * tells it about enemies; see `playerHit.ts` for what counts.
 *
 * ⛔ ONE BROWSER POSTS: the active full GM's (`automationRole`), as for bands. Every browser sees the update.
 *
 * ⚠️ The HP before a change is remembered, from the fight's start (`seed`) and every change since, because
 * Foundry's `updateActor` carries only the new value. A character first seen mid-change is remembered and not
 * posted: a guessed amount would be a wrong one.
 *
 * ⚠️ STAMINA (2026-10-07): with PF2e's Stamina variant a hit can change only `hp.sp.value`. Kibwe lost six of
 * seven hits to that before this looked at Stamina Points too; see `playerHit.ts`.
 *
 * ⚠️ One post at a time, in order, so a burst of hits reaches the topic in the order they landed.
 */
export interface PlayerHitPorts {
  readonly role: () => AutomationRole;
  /** The world setting; read on every change, so turning it off takes effect at once. */
  readonly enabled: () => boolean;
  readonly campaign: (tokenUuid: string) => CampaignChoice;
  /** Every token whose actor this is, read as it is now; null entries are skipped. */
  readonly viewsFor: (actor: unknown) => readonly (TokenView | null)[];
  /** Every token in every encounter. */
  readonly combatViews: () => readonly (TokenView | null)[];
  readonly post: (campaign: string, hit: PlayerHitPost) => Promise<PostOutcome>;
  /** Called at once, awaited later; see `causeWatch.ts`. */
  readonly causeFor: (actor: unknown) => Promise<BandCause>;
  readonly warn: (message: string) => void;
}

export class PlayerHitReporter {
  private readonly ports: PlayerHitPorts;
  private readonly health = new Map<string, Health>();
  private queue: Promise<void> = Promise.resolve();
  private lastProblem: string | null = null;

  public constructor(ports: PlayerHitPorts) {
    this.ports = ports;
  }

  /** Remembers every character's HP without posting, so the first hit has something to compare against. */
  public seed(): void {
    for (const view of this.ports.combatViews()) {
      if (view?.character === true && !this.health.has(view.tokenUuid)) {
        this.health.set(view.tokenUuid, healthOf(view));
      }
    }
  }

  /** Foundry's `updateActor`: only a change to HP or Stamina Points is looked at. */
  public async onActorUpdated(actor: unknown, changes: unknown): Promise<void> {
    const hp = (
      changes as {
        system?: { attributes?: { hp?: { value?: unknown; sp?: { value?: unknown } } } };
      } | null
    )?.system?.attributes?.hp;
    const changed = hp?.value !== undefined || hp?.sp?.value !== undefined;
    if (this.ports.role() !== 'act' || !changed || !this.ports.enabled()) {
      return;
    }
    const views = this.ports.viewsFor(actor).filter((view) => view?.character === true);
    if (views.length === 0) {
      return;
    }
    const cause = this.ports.causeFor(actor);
    for (const view of views) {
      if (view === null) {
        continue;
      }
      const hit = readPlayerHit(view, this.health.get(view.tokenUuid));
      this.health.set(view.tokenUuid, healthOf(view));
      if (hit === null) {
        continue;
      }
      const choice = this.ports.campaign(view.tokenUuid);
      if (choice.kind !== 'one') {
        this.warnProblem(choice);
        continue;
      }
      await this.enqueue(choice.code, hit, cause);
    }
  }

  private warnProblem(choice: CampaignChoice): void {
    const problem = campaignProblem(choice);
    if (problem !== null && problem !== this.lastProblem) {
      this.lastProblem = problem;
      this.ports.warn(problem);
    }
  }

  private async enqueue(
    campaign: string,
    hit: Parameters<typeof withCause>[0],
    cause: Promise<BandCause>
  ): Promise<void> {
    this.queue = this.queue.then(async () => {
      const { shown } = await cause;
      const outcome = await this.ports
        .post(campaign, withCause(hit, shown))
        .catch((): PostOutcome => 'failed');
      /* Signed out is the band reporter's to say: one sign-in serves both, and one warning is enough. */
      if (outcome === 'failed') {
        this.ports.warn(`Tongs Browser could not post the hit on ${hit.name}.`);
      } else if (outcome === 'sent') {
        this.lastProblem = null;
      }
    });
    return this.queue;
  }
}
