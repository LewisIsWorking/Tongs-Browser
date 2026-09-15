import type { AutomationRole } from '../automation/automationRole.js';
import type { BandCause } from './bandCause.js';
import type { BandSubject } from './bandSubject.js';
import type { BandPost, PostOutcome } from './CooClient.js';
import { campaignProblem } from './partyCampaign.js';
import type { CampaignChoice } from './partyCampaign.js';

/**
 * Telling the table how enemies are faring, from the active full GM's browser. Added 2026-09-14.
 *
 * ⛔ DECIDED WITH LEWIS: the band goes to the campaign's combat topic ONLY WHEN IT CHANGES, so a hit from
 * 85% to 83% posts nothing publicly; the GM gets the exact HP by DM on EVERY change. Only the active full
 * GM's browser reports, so one change is told once however many browsers are open.
 *
 * ⚠️ A CHANGE NEEDS A BEFORE. The bands last told are remembered per token, seeded from the combat when
 * this browser starts or the scene changes, so the first hit of a session compares against the real
 * previous band instead of announcing every token. A token never seen before announces.
 *
 * ⚠️ THE CAUSE IS WATCHED FOR AT ONCE. PF2e creates its damage-taken card after the update that fires
 * this hook, so the watch starts here, before any await, and each post waits for its cause in the queue.
 *
 * ⛔ THE CAMPAIGN COMES FROM THE COMBAT (decided with Lewis 2026-09-15; several campaigns share a world):
 * the parties of the player characters fighting. None, or two, and nothing is posted; the GM is told
 * once per distinct problem. The bands are still remembered, so fixing a party's campaign mid-fight
 * compares the next hit against the real previous band.
 *
 * ⚠️ One post at a time, in order. A burst of hits must not reach the topic shuffled, and COO's rotating
 * refresh token must not be spent by two requests at once.
 */
export interface BandPorts {
  readonly role: () => AutomationRole;
  /** The campaign of the encounter this token is fighting in; see `combatCampaign.ts`. */
  readonly campaign: (tokenUuid: string) => CampaignChoice;
  /** Every token whose actor this is, read as players would be told about it; null entries are skipped. */
  readonly subjectsFor: (actor: unknown) => readonly (BandSubject | null)[];
  /** Every token in every encounter in the world. */
  readonly combatSubjects: () => readonly (BandSubject | null)[];
  readonly post: (campaign: string, post: BandPost) => Promise<PostOutcome>;
  /** Why this actor's HP changed, for the GM's DM; see `causeWatch.ts`. Called at once, awaited later. */
  readonly causeFor: (actor: unknown) => Promise<BandCause>;
  readonly warn: (message: string) => void;
}

interface Told {
  readonly segments: number;
  readonly hp: number;
}

export class BandReporter {
  private readonly ports: BandPorts;
  private readonly told = new Map<string, Told>();
  private queue: Promise<void> = Promise.resolve();
  private warnedSignedOut = false;
  private lastProblem: string | null = null;

  public constructor(ports: BandPorts) {
    this.ports = ports;
  }

  /** Remembers the current bands without posting, so later changes compare against them. */
  public seed(): void {
    for (const subject of this.ports.combatSubjects()) {
      if (subject !== null && !this.told.has(subject.tokenUuid)) {
        this.told.set(subject.tokenUuid, { segments: subject.segments, hp: subject.hp });
      }
    }
  }

  /** Foundry's `updateActor`: `changes` is what changed, and only a change to HP is reported. */
  public async onActorUpdated(actor: unknown, changes: unknown): Promise<void> {
    const hp = (changes as { system?: { attributes?: { hp?: { value?: unknown } } } } | null)
      ?.system?.attributes?.hp;
    if (this.ports.role() !== 'act' || hp?.value === undefined) {
      return;
    }
    const cause = this.ports.causeFor(actor);
    for (const subject of this.ports.subjectsFor(actor)) {
      if (subject === null) {
        continue;
      }
      const before = this.told.get(subject.tokenUuid);
      if (before?.hp === subject.hp) {
        continue;
      }
      this.told.set(subject.tokenUuid, { segments: subject.segments, hp: subject.hp });
      const choice = this.ports.campaign(subject.tokenUuid);
      if (choice.kind !== 'one') {
        this.warnProblem(choice);
        continue;
      }
      const post: Omit<BandPost, 'cause'> = {
        name: subject.name,
        segments: subject.segments,
        word: subject.word,
        hp: subject.hp,
        maxHp: subject.maxHp,
        announce: before?.segments !== subject.segments,
        ...(subject.image === null ? {} : { targetImage: subject.image }),
      };
      await this.enqueue(choice.code, post, cause);
    }
  }

  /** Once per distinct problem, so a long fight in a mixed combat does not repeat itself every hit. */
  private warnProblem(choice: CampaignChoice): void {
    const problem = campaignProblem(choice);
    if (problem !== null && problem !== this.lastProblem) {
      this.lastProblem = problem;
      this.ports.warn(problem);
    }
  }

  private async enqueue(
    campaign: string,
    post: Omit<BandPost, 'cause'>,
    cause: Promise<BandCause>
  ): Promise<void> {
    this.queue = this.queue.then(async () => {
      const { gm, shown } = await cause;
      const outcome = await this.ports
        .post(campaign, {
          ...post,
          cause: gm,
          ...(shown === null ? {} : { publicCause: shown.text }),
          ...(shown?.attacker.image ? { attackerImage: shown.attacker.image } : {}),
        })
        .catch((): PostOutcome => 'failed');
      if (outcome === 'signed-out' && !this.warnedSignedOut) {
        this.warnedSignedOut = true;
        this.ports.warn(
          'Tongs Browser is not signed in to ComeOnOverUno, so health bands are not being posted.'
        );
      } else if (outcome === 'failed') {
        this.ports.warn(`Tongs Browser could not post ${post.name}'s health band.`);
      } else if (outcome === 'sent') {
        this.warnedSignedOut = false;
        this.lastProblem = null;
      }
    });
    return this.queue;
  }
}
