import { MODULE_ID } from '../constants.js';
import { PARTY_CAMPAIGN_FLAG } from '../foundry/PartyAccess.js';
import { campaignForCombat, normalizeCampaign } from './partyCampaign.js';
import type { CampaignChoice } from './partyCampaign.js';

/**
 * The campaign of the combat being viewed, from the player characters fighting in it. Added
 * 2026-09-15.
 *
 * Read from pf2e 8.5.0: a party's `prepareBaseData` adds itself to each member's `actor.parties`, a Set
 * of party actors, so a character knows every party it is in. The campaign is the flag a GM set on
 * those parties (`PARTY_CAMPAIGN_FLAG`).
 *
 * ⚠️ PLAYER CHARACTERS ONLY: `type: "character"` and owned by a player. An enemy has no party, and a
 * familiar or companion a player owns follows its character rather than deciding anything.
 *
 * ⚠️ Every Foundry method is called on its own object (`party.getFlag`).
 */
interface PartyLike {
  getFlag?(scope: string, key: string): unknown;
}

interface CombatantActor {
  readonly type?: string;
  readonly hasPlayerOwner?: boolean;
  readonly parties?: Iterable<PartyLike>;
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

export function combatCampaign(globals: CampaignGlobals): CampaignChoice {
  const characters = (globals.game?.combat?.combatants?.contents ?? [])
    .map((combatant) => combatant.actor)
    .filter(
      (actor): actor is CombatantActor =>
        actor?.type === 'character' && actor.hasPlayerOwner === true
    );
  return campaignForCombat(
    characters.map((actor) =>
      [...(actor.parties ?? [])].map((party) =>
        normalizeCampaign(party.getFlag?.(MODULE_ID, PARTY_CAMPAIGN_FLAG))
      )
    )
  );
}
