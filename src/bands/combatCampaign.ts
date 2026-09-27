import type { PartyCampaignEntry } from '../foundry/PartyAccess.js';
import { campaignForCombat, normalizeCampaign } from './partyCampaign.js';
import type { CampaignChoice } from './partyCampaign.js';

/**
 * The campaign of an encounter, from the player characters fighting in it. Added
 * 2026-09-15.
 *
 * ⛔ MEMBERSHIP IS READ FROM EACH PARTY'S OWN MEMBER LIST, NOT FROM `actor.parties`. Found live
 * 2026-09-15 and read in pf2e 8.5.0: a party adds itself to its members' `actor.parties` only when
 * `fromUuidSync(party.uuid) === party`, which is false while a new party is still being created. So a
 * party made during a session is in none of its members' `parties` until something updates it, and a
 * combat would read "no campaign" for no visible reason. `system.details.members` is the source data,
 * there from the moment the party exists.
 *
 * ⛔ A CHARACTER IS MATCHED BY ITS TOKEN'S BASE ACTOR. A party lists world actors (`Actor.id`), but a
 * token that is not linked to its actor carries a synthetic actor whose uuid is
 * `Scene.s.Token.t.Actor.id`, which no party lists. Foundry 14's `TokenDocument#baseActor` is the world
 * actor either way.
 *
 * ⚠️ CHARACTERS ONLY: `type: "character"`. An enemy decides nothing, and a familiar or companion follows
 * its character.
 *
 * ⛔ OWNERSHIP IS NOT ASKED, changed 2026-09-25. Found live on the self-hosted Foundry: moving the worlds off
 * The Forge cleared every player login, so each character stays unowned until a GM reassigns it. Changer
 * shot a kobold in C04 and no band was posted, because the only character in the fight "had no player
 * owner". Being listed by a party with a campaign code is what makes a character one of a table's, and only
 * a GM can put it there, so that is the whole test.
 */
interface CombatantActor {
  readonly uuid?: string;
  readonly name?: string;
  readonly type?: string;
}

export interface CampaignCombatant {
  readonly actor?: CombatantActor | null;
  readonly token?: { readonly baseActor?: { readonly uuid?: string } | null } | null;
}

/** The encounter the band's creature is fighting in; see `bandTokens.combatOfToken`. */
export interface CampaignCombat {
  readonly combatants?: { readonly contents?: readonly CampaignCombatant[] };
}

export function combatCampaign(
  combat: CampaignCombat | undefined,
  parties: readonly PartyCampaignEntry[]
): CampaignChoice {
  return campaignForCombat(
    (combat?.combatants?.contents ?? []).flatMap((combatant) => {
      const actor = combatant.actor;
      if (actor?.type !== 'character') {
        return [];
      }
      const uuid = combatant.token?.baseActor?.uuid ?? actor.uuid;
      return [
        {
          name: actor.name ?? 'an unnamed character',
          campaigns: parties
            .filter((party) => uuid !== undefined && party.members.includes(uuid))
            .map((party) => normalizeCampaign(party.campaign)),
        },
      ];
    })
  );
}
