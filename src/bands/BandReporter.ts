import type { AutomationRole } from '../automation/automationRole.js';
import type { BandSubject } from './bandSubject.js';
import type { BandPost, PostOutcome } from './CooClient.js';

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
 * ⚠️ One post at a time, in order. A burst of hits must not reach the topic shuffled, and COO's rotating
 * refresh token must not be spent by two requests at once.
 */
export interface BandPorts {
  readonly role: () => AutomationRole;
  /** The Path Wars campaign this world is, such as "C06", or "" when bands are off. */
  readonly campaign: () => string;
  /** Every token whose actor this is, read as players would be told about it; null entries are skipped. */
  readonly subjectsFor: (actor: unknown) => readonly (BandSubject | null)[];
  /** Every token in the running combat on the viewed scene. */
  readonly combatSubjects: () => readonly (BandSubject | null)[];
  readonly post: (campaign: string, post: BandPost) => Promise<PostOutcome>;
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
    const campaign = this.ports.campaign();
    if (this.ports.role() !== 'act' || hp?.value === undefined || campaign === '') {
      return;
    }
    for (const subject of this.ports.subjectsFor(actor)) {
      if (subject === null) {
        continue;
      }
      const before = this.told.get(subject.tokenUuid);
      if (before?.hp === subject.hp) {
        continue;
      }
      this.told.set(subject.tokenUuid, { segments: subject.segments, hp: subject.hp });
      const post: BandPost = {
        name: subject.name,
        segments: subject.segments,
        word: subject.word,
        hp: subject.hp,
        maxHp: subject.maxHp,
        announce: before?.segments !== subject.segments,
      };
      await this.enqueue(campaign, post);
    }
  }

  private async enqueue(campaign: string, post: BandPost): Promise<void> {
    this.queue = this.queue.then(async () => {
      const outcome = await this.ports.post(campaign, post).catch((): PostOutcome => 'failed');
      if (outcome === 'signed-out' && !this.warnedSignedOut) {
        this.warnedSignedOut = true;
        this.ports.warn(
          'Tongs Browser is not signed in to ComeOnOverUno, so health bands are not being posted.'
        );
      } else if (outcome === 'failed') {
        this.ports.warn(`Tongs Browser could not post ${post.name}'s health band.`);
      } else if (outcome === 'sent') {
        this.warnedSignedOut = false;
      }
    });
    return this.queue;
  }
}
