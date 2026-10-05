import { normalizeCampaign } from '../bands/partyCampaign.js';

/**
 * Which party a new player's sheet goes into. Added 2026-10-05.
 *
 * Lewis, 2026-10-05: the campaign's party, the one a GM has marked with its campaign code (the same flag
 * the health bands read). A player never chooses between other parties.
 */
export interface CampaignParty {
  readonly uuid: string;
  readonly name: string;
  readonly code: string;
}

export type PartyPick =
  | { readonly kind: 'party'; readonly party: CampaignParty }
  /** No party in this world has a campaign code yet: the request waits until a GM marks one. */
  | { readonly kind: 'none' }
  /** Several campaign parties and the player did not pick one: the request waits for the GM. */
  | { readonly kind: 'ambiguous'; readonly parties: readonly CampaignParty[] };

interface FlaggedParty {
  readonly uuid: string;
  readonly name: string;
  readonly campaign: unknown;
}

/** The parties that carry a real campaign code. A party name typed by mistake does not count. */
export function campaignParties(parties: readonly FlaggedParty[]): CampaignParty[] {
  return parties.flatMap((party) => {
    const code = normalizeCampaign(party.campaign);
    return code === '' ? [] : [{ uuid: party.uuid, name: party.name, code }];
  });
}

/**
 * ⚠️ A party the player named must STILL be a campaign party when the GM's browser acts, which may be days
 *    later. If it no longer is, the pick falls back to the world's only campaign party, or waits.
 */
export function pickParty(requested: string | null, parties: readonly CampaignParty[]): PartyPick {
  const named = parties.find((party) => party.uuid === requested);
  if (named !== undefined) {
    return { kind: 'party', party: named };
  }
  if (parties.length === 0) {
    return { kind: 'none' };
  }
  const only = parties.length === 1 ? parties[0] : undefined;
  return only === undefined ? { kind: 'ambiguous', parties } : { kind: 'party', party: only };
}
