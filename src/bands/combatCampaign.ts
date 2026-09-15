import type { PartyCampaignEntry } from '../foundry/PartyAccess.js';
import { campaignForCombat, normalizeCampaign } from './partyCampaign.js';
import type { CampaignChoice } from './partyCampaign.js';

/**
 * The campaign of the combat being viewed, from the player characters fighting in it. Added
 * 2026-09-15.
 *
 * ⛔ MEMBERSHIP IS READ FROM EACH PARTY'S OWN MEMBER LIST, NOT FROM `actor.parties`. Found live
 * 2026-09-15 and read in pf2e 8.5.0: a party adds itself to its members' `actor.parties` only when
 * `fromUuidSync(party.uuid) === party`, which is false while a new party is still being created. So a
 * party made during a session is in none of its members' `parties` until something updates it, and a
 * combat would read "no campaign" for no visible reason. `system.details.members` is the source data,
 * there from the moment the party exists.
 *
 * ⚠️ PLAYER CHARACTERS ONLY: `type: "character"` and owned by a player. An enemy decides nothing, and a
 * familiar or companion a player owns follows its character.
 */
interface CombatantActor {
  readonly uuid?: string;
  readonly type?: string;
  readonly hasPlayerOwner?: boolean;
}

export interface CampaignGlobals {
  readonly game?: {
    readonly combat?: {
      readonly combatants?: {
        readonly contents?: readonly { readonly actor?: CombatantActor | null }[];
      };
    } | null;
  };
}

export function combatCampaign(
  globals: CampaignGlobals,
  parties: readonly PartyCampaignEntry[]
): CampaignChoice {
  const characters = (globals.game?.combat?.combatants?.contents ?? [])
    .map((combatant) => combatant.actor)
    .filter(
      (actor): actor is CombatantActor =>
        actor?.type === 'character' && actor.hasPlayerOwner === true
    );
  return campaignForCombat(
    characters.map((actor) =>
      parties
        .filter((party) => actor.uuid !== undefined && party.members.includes(actor.uuid))
        .map((party) => normalizeCampaign(party.campaign))
    )
  );
}
