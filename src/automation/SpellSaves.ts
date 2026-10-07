import type { SaveFacts } from '../deck/deckFacts.js';
import type { SaveOutcome } from '../deck/rollSaveThroughSystem.js';
import { CLAIMED_FLAG, DECLINED_FLAG, PENDING_FLAG } from './AutoApply.js';
import type { AutoApplyPorts } from './AutoApply.js';
import { recastRun } from './recasts.js';
import { readSpellDamage } from './spellDamageFacts.js';
import { readRecordedTargets, readSpellCast } from './spellFacts.js';
import type { CastMessage, SpellCastFacts } from './spellFacts.js';
import { checkPlayerTarget, checkTarget } from './targetCheck.js';

/**
 * Rolling enemies' saves against players' spells without waiting for the GM. Added 2026-09-14.
 *
 * Phase 2 step 2, decided with Lewis: the caster's browser records who the spell was cast at, and the
 * active full GM's browser rolls those creatures' saves through PF2e's own save button. A save is rolled
 * by the GM's browser, so it cannot be forged the way a damage total can.
 *
 * The same rules as strikes (`AutoApply`): only a full GM acts; with none connected the cast is queued;
 * a card is claimed before its saves are rolled and a claim is never retried; enemies only, standing, in
 * the combat on the scene being viewed. Allies and the fallen are skipped, not rolled for.
 *
 * ⚠️ Only the spell's OWN save button is rolled. An inline check in the spell's description is often a
 * secondary effect with its own trigger, and rolling it automatically would be guessing.
 */
export type SpellSavePorts = Pick<
  AutoApplyPorts,
  | 'role'
  | 'systemId'
  | 'recentMessages'
  | 'flag'
  | 'isHandled'
  | 'authorIsPlayer'
  | 'attackerIsPlayers'
  | 'attackerIsEnemy'
  | 'targetState'
  | 'setFlag'
  | 'unsetFlag'
> & {
  readonly moduleId: string;
  /** Each side has its own world setting, read on every card; see `startSpellDamage.ts`. */
  readonly playerSpellsOn: () => boolean;
  readonly enemySpellsOn: () => boolean;
  readonly saveControls: (message: CastMessage) => readonly SaveFacts[];
  readonly rollSave: (
    messageId: string,
    saveIndex: number,
    tokens: readonly string[]
  ) => Promise<SaveOutcome>;
};

const UNCONFIRMED = 'saves were started earlier and never confirmed; check before rolling them';
const RECAST =
  'the same spell at the same targets was posted again moments after an earlier card; that card holds the save';

export class SpellSaves {
  private readonly ports: SpellSavePorts;
  private readonly working = new Set<string>();
  /**
   * ⛔ ONE CARD AT A TIME (2026-10-07). Start-up, `canvasReady` and `userConnected` each catch up, and
   * overlapping catch-ups rolled three queued Dazes' saves within two seconds, so no save could be told
   * apart by when it landed. In turn, each save is tagged with the one cast being rolled.
   */
  private queue: Promise<void> = Promise.resolve();
  private rolling: { readonly castId: string; readonly tokens: readonly string[] } | null = null;

  public constructor(ports: SpellSavePorts) {
    this.ports = ports;
  }

  /** The cast whose save this browser is rolling for that token right now, for the save card's flag. */
  public readonly castRollingFor = (tokenUuid: string): string | null =>
    this.rolling?.tokens.includes(tokenUuid) === true ? this.rolling.castId : null;

  public async onMessageCreated(message: CastMessage): Promise<void> {
    if (this.ports.role() === 'act') {
      await this.process(message);
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

  private async process(message: CastMessage): Promise<void> {
    if (this.working.has(message.id)) {
      return;
    }
    this.working.add(message.id);
    const turn = this.queue.then(async () => this.decide(message));
    this.queue = turn.catch(() => undefined);
    try {
      await turn;
    } finally {
      this.working.delete(message.id);
    }
  }

  private async decide(message: CastMessage): Promise<void> {
    const cast = readSpellCast(message, this.ports.systemId());
    if (cast === null || this.ports.saveControls(message)[0]?.control !== 'spell-save') {
      return;
    }
    /* ⭐ Enemies' spells on player characters, 2026-09-28 (Lewis: "The GM's browser rolls them"). */
    const players =
      this.ports.playerSpellsOn() &&
      this.ports.authorIsPlayer(message) &&
      this.ports.attackerIsPlayers(cast.actorId);
    const enemies =
      !players && this.ports.enemySpellsOn() && this.ports.attackerIsEnemy(cast.actorId);
    if (this.ports.isHandled(message) || (!players && !enemies)) {
      return;
    }
    if (this.ports.flag(message, CLAIMED_FLAG) === true) {
      await this.decline(message, UNCONFIRMED);
      return;
    }
    if (this.isRecast(message, cast)) {
      await this.decline(message, RECAST);
      return;
    }

    const recorded = readRecordedTargets(message, this.ports.moduleId);
    const verdicts = recorded.map((token) => ({
      token,
      verdict: (enemies ? checkPlayerTarget : checkTarget)(this.ports.targetState(token)),
    }));
    const rollers = verdicts.filter((each) => each.verdict.kind === 'ok').map((each) => each.token);
    if (rollers.length === 0) {
      /* No roller means every verdict here is a reason to decline. */
      const why = verdicts.map((each) => (each.verdict as { reason: string }).reason);
      await this.decline(
        message,
        recorded.length === 0
          ? 'the caster had no targets'
          : `no target could roll: ${why.join('; ')}`
      );
      return;
    }

    await this.ports.setFlag(message.id, CLAIMED_FLAG, true);
    this.rolling = { castId: message.id, tokens: rollers };
    let outcome: Awaited<ReturnType<SpellSavePorts['rollSave']>>;
    try {
      outcome = await this.ports.rollSave(message.id, 0, rollers);
    } finally {
      this.rolling = null;
    }
    if (outcome.kind === 'rolled') {
      await this.ports.unsetFlag(message.id, PENDING_FLAG);
      return;
    }
    if (outcome.kind === 'refused') {
      await this.ports.unsetFlag(message.id, CLAIMED_FLAG);
    }
    await this.decline(message, outcome.reason);
  }

  /** 🔁 A re-click of an earlier cast (`recasts.ts`): only the first card of the run is rolled. */
  private isRecast(message: CastMessage, cast: SpellCastFacts): boolean {
    const systemId = this.ports.systemId();
    const recent = this.ports.recentMessages().filter((m) => m.id !== message.id);
    const self = { ...cast, targets: readRecordedTargets(message, this.ports.moduleId) };
    const casts = recent.flatMap((m) => {
      const each = readSpellCast(m, systemId);
      return each === null
        ? []
        : [{ ...each, targets: readRecordedTargets(m, this.ports.moduleId) }];
    });
    const damages = recent.flatMap((m) => readSpellDamage(m, systemId) ?? []);
    return recastRun(self, [...casts, self], damages)[0] !== self;
  }

  private async decline(message: CastMessage, reason: string): Promise<void> {
    if (this.ports.isHandled(message)) {
      return;
    }
    await this.ports.setFlag(message.id, DECLINED_FLAG, reason);
    await this.ports.unsetFlag(message.id, PENDING_FLAG);
  }
}
