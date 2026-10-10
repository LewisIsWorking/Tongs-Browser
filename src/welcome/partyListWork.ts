import { MODULE_ID } from '../constants.js';
import { readPartyCampaigns } from '../foundry/PartyAccess.js';
import type { FoundryGame } from '../foundry/PartyAccess.js';
import { campaignParties } from './campaignParty.js';
import { sharedParties, WELCOME_SETTING } from './startSheetRequests.js';
import type { WelcomeSettings } from './startSheetRequests.js';

/**
 * The party list players choose from, as work a GM's browser still owes. Added 2026-10-10.
 *
 * ⛔ Found live in C00/C01 (2026-10-10, "Day 3 of asking for char sheets"): a player cannot see a party they
 *    are not in, so the welcome reads the list a GM's browser shares (`welcomeParties`). Until a GM opens the
 *    world after its parties get a campaign code, that list is empty, the welcome closes, nothing is queued,
 *    and so nothing ever called COO's helper GM either. Now the welcome calls the helper itself, and this
 *    item keeps the helper's visit open until its Tongs has shared the list (and says so in COO's report).
 */
export const PARTY_LIST_WORK = 'the party list new players choose from';

/** GM only: the shared list differs from the world's campaign parties. A player's browser always says no. */
export function partyListBehind(settings: WelcomeSettings, game: FoundryGame | undefined): boolean {
  if (game?.user?.isGM !== true || settings.get(MODULE_ID, WELCOME_SETTING) !== true) {
    return false;
  }
  const parties = campaignParties(readPartyCampaigns({ getGame: () => game }));
  return JSON.stringify(sharedParties(settings)) !== JSON.stringify(parties);
}
