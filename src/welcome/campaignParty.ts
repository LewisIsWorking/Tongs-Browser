import { normalizeCampaign } from '../bands/partyCampaign.js';

/**
 * Which party a new player's sheet goes into. Added 2026-10-05.
 *
 * Lewis, 2026-10-05: the campaign's party, the one a GM has marked with its campaign code (the same flag
 * the health bands read). A player never chooses between other parties.
 *
 * Lewis, 2026-10-08: "we should have a canonical primary party sheet for each world". With no party coded,
 * the sheet goes in the world's primary party (PF2e's active party, "The Party"), so the welcome works in
 * a world nobody has set up. ⚠️ Only for sheets: the health bands still need a code, because one world can
 * host several campaigns and a band in the wrong topic tells another table about a fight.
 */
export interface CampaignParty {
  readonly uuid: string;
  readonly name: string;
  /** The campaign code, or '' for the world's primary party standing in when no party has one. */
  readonly code: string;
  readonly primary?: boolean;
}

export type PartyPick =
  | { readonly kind: 'party'; readonly party: CampaignParty }
  /** No party has a campaign code and the world has no primary party: the request waits for a GM. */
  | { readonly kind: 'none' }
  /** Several campaign parties and the player did not pick one: the request waits for the GM. */
  | { readonly kind: 'ambiguous'; readonly parties: readonly CampaignParty[] };

interface FlaggedParty {
  readonly uuid: string;
  readonly name: string;
  readonly campaign: unknown;
  readonly primary?: boolean;
}

/**
 * The parties that carry a real campaign code (a party name typed by mistake does not count), or, when
 * none does, the world's primary party alone.
 */
export function campaignParties(parties: readonly FlaggedParty[]): CampaignParty[] {
  const coded = parties.flatMap((party) => {
    const code = normalizeCampaign(party.campaign);
    return code === '' ? [] : [{ uuid: party.uuid, name: party.name, code }];
  });
  const primary = parties.find((party) => party.primary === true);
  return coded.length > 0 || primary === undefined
    ? coded
    : [{ uuid: primary.uuid, name: primary.name, code: '', primary: true }];
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
