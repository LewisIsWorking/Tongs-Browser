import { automationRole } from '../automation/automationRole.js';
import { readPartyCampaigns } from '../foundry/PartyAccess.js';
import type { FoundryGame } from '../foundry/PartyAccess.js';
import { readSeenAttacker } from './attackerView.js';
import { MANUAL_CAUSE } from './bandCause.js';
import type { BandPorts } from './BandReporter.js';
import { combatOfToken } from './bandTokens.js';
import { watchCause } from './causeWatch.js';
import type { CauseHooks } from './causeWatch.js';
import { combatCampaign } from './combatCampaign.js';
import type { StartGlobals } from './startBands.js';

/**
 * What the band reporter and the player-hit reporter share: whose browser acts, which campaign a token's
 * fight belongs to, why an actor's HP changed, and how the GM is told. Moved out of `startBands.ts`
 * 2026-09-28, when the player-hit reporter became the second user.
 */
export type SharedBandPorts = Pick<BandPorts, 'role' | 'campaign' | 'causeFor' | 'warn'>;

/** How long to wait for PF2e's damage-taken card after an HP change before calling it manual. */
const CAUSE_WINDOW_MS = 3000;

export function sharedBandPorts(hooks: CauseHooks, globals: StartGlobals): SharedBandPorts {
  const systemId = () => globals.game?.system?.id ?? '';
  const uuidOf = (actor: unknown) => {
    const uuid = (actor as { uuid?: unknown } | null)?.uuid;
    return typeof uuid === 'string' ? uuid : null;
  };
  const nameOf = (ref: string) => {
    try {
      return globals.fromUuidSync?.(ref)?.name ?? null;
    } catch {
      return null;
    }
  };
  return {
    role: () => automationRole(globals),
    campaign: (tokenUuid) =>
      combatCampaign(
        combatOfToken(globals, tokenUuid),
        readPartyCampaigns({ getGame: () => globals.game as FoundryGame | undefined })
      ),
    causeFor: async (actor) => {
      const uuid = uuidOf(actor);
      return uuid === null
        ? { gm: MANUAL_CAUSE, shown: null }
        : watchCause(hooks, systemId(), uuid, CAUSE_WINDOW_MS, nameOf, (attacker) =>
            readSeenAttacker(globals, attacker)
          );
    },
    warn: (message) => {
      globals.ui?.notifications?.warn?.(message);
    },
  };
}
