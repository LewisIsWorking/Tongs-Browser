import type { SaveFacts } from '../deck/deckFacts.js';
import type { SaveOutcome } from '../deck/rollSaveThroughSystem.js';
import { CLAIMED_FLAG, DECLINED_FLAG, PENDING_FLAG } from './AutoApply.js';
import type { AutoApplyPorts } from './AutoApply.js';
import { readRecordedTargets, readSpellCast } from './spellFacts.js';
import type { CastMessage } from './spellFacts.js';
import { checkTarget } from './targetCheck.js';

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
  | 'targetState'
  | 'setFlag'
  | 'unsetFlag'
> & {
  readonly moduleId: string;
  readonly saveControls: (message: CastMessage) => readonly SaveFacts[];
  readonly rollSave: (
    messageId: string,
    saveIndex: number,
    tokens: readonly string[]
  ) => Promise<SaveOutcome>;
};

const UNCONFIRMED = 'saves were started earlier and never confirmed; check before rolling them';

export class SpellSaves {
  private readonly ports: SpellSavePorts;
  private readonly working = new Set<string>();

  public constructor(ports: SpellSavePorts) {
    this.ports = ports;
  }

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
    try {
      await this.decide(message);
    } finally {
      this.working.delete(message.id);
    }
  }

  private async decide(message: CastMessage): Promise<void> {
    const cast = readSpellCast(message, this.ports.systemId());
    if (cast === null || this.ports.saveControls(message)[0]?.control !== 'spell-save') {
      return;
    }
    if (
      this.ports.isHandled(message) ||
      !this.ports.authorIsPlayer(message) ||
      !this.ports.attackerIsPlayers(cast.actorId)
    ) {
      return;
    }
    if (this.ports.flag(message, CLAIMED_FLAG) === true) {
      await this.decline(message, UNCONFIRMED);
      return;
    }

    const recorded = readRecordedTargets(message, this.ports.moduleId);
    const verdicts = recorded.map((token) => ({
      token,
      verdict: checkTarget(this.ports.targetState(token)),
    }));
    if (verdicts.some((each) => each.verdict.kind === 'later')) {
      await this.ports.setFlag(message.id, PENDING_FLAG, true);
      return;
    }
    const rollers = verdicts.filter((each) => each.verdict.kind === 'ok').map((each) => each.token);
    if (rollers.length === 0) {
      const why = verdicts
        .map((each) => (each.verdict.kind === 'deck' ? each.verdict.reason : ''))
        .filter(Boolean);
      await this.decline(
        message,
        recorded.length === 0
          ? 'the caster had no targets'
          : `no target could roll: ${why.join('; ')}`
      );
      return;
    }

    await this.ports.setFlag(message.id, CLAIMED_FLAG, true);
    const outcome = await this.ports.rollSave(message.id, 0, rollers);
    if (outcome.kind === 'rolled') {
      await this.ports.unsetFlag(message.id, PENDING_FLAG);
      return;
    }
    if (outcome.kind === 'refused') {
      await this.ports.unsetFlag(message.id, CLAIMED_FLAG);
    }
    await this.decline(message, outcome.reason);
  }

  private async decline(message: CastMessage, reason: string): Promise<void> {
    if (this.ports.isHandled(message)) {
      return;
    }
    await this.ports.setFlag(message.id, DECLINED_FLAG, reason);
    await this.ports.unsetFlag(message.id, PENDING_FLAG);
  }
}
