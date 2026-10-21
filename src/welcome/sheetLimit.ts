import { MODULE_ID } from '../constants.js';
import { itemSlugs } from './companionDocuments.js';
import type { CompanionActor } from './companionDocuments.js';
import { companionKindsFor } from './companionKinds.js';
import { allowedSheets } from './extraSheets.js';
import type { CampaignSettings } from './playerCampaigns.js';
import type { WelcomeActor, WelcomeUser } from './welcomeDocuments.js';

/**
 * What companions add to a player's sheet limit, and the welcome's memory of Not now. Added 2026-10-21.
 *
 * Lewis, 2026-10-21: "the sheet limit per person should be 2, if you have a companion class or a familiar
 * class then +1 for each instance of that". The limit itself is `allowedSheets` (extraSheets.ts).
 *
 * ⚠️ Not now on ANOTHER character is remembered on the user (`LATER_FLAG`, keyed "owned/allowed"), so a
 *    player happy with the sheets they have is not asked on every page load. A new grant or companion, or a
 *    sheet gone, changes the key and asks once more. Not now on a FIRST sheet still lasts only the page load.
 * ⚠️ Only a FIRST sheet calls COO's helper GM in for a missing party list (startWelcome): offering another
 *    sheet is not worth calling a GM in.
 */
export const LATER_FLAG = 'anotherSheetLater';

/**
 * How many more sheets these counted sheets allow: one per companion KIND each one's items grant
 * (`companionKindsFor`), so Animal Order and Animal Companion together are one, upgrades (Mature, Enhanced
 * Familiar) are none, and a Pet counts only without a familiar. The same sum as ComeOnOverUno's
 * companion-grants.mjs, per sheet. ⚠️ Foundry actors carry `items`, which `WelcomeActor` leaves out because
 * its subtypes type their items differently; `itemSlugs` reads them.
 */
export function companionGrants(sheets: readonly WelcomeActor[]): number {
  return sheets.reduce(
    (sum, sheet) => sum + companionKindsFor(itemSlugs(sheet as SheetWithItems)).length,
    0
  );
}

type SheetWithItems = WelcomeActor & Pick<CompanionActor, 'items'>;

/**
 * The player's browser: "owned/allowed" for their counted sheets, or null when they may not have another
 * sheet here, or said Not now to this one.
 */
export function sheetOffer(
  settings: CampaignSettings,
  user: WelcomeUser | undefined,
  counted: readonly WelcomeActor[]
): string | null {
  const owned = counted.length;
  const allowed = allowedSheets(settings, user?.id ?? '', companionGrants(counted));
  const key = `${String(owned)}/${String(allowed)}`;
  const later = owned > 0 && user?.getFlag?.(MODULE_ID, LATER_FLAG) === key;
  return owned >= allowed || later ? null : key;
}

/** Not now on an offer of another sheet, kept on the player's user. A first sheet is never remembered. */
export function rememberLater(user: WelcomeUser | undefined, key: string): void {
  if (!key.startsWith('0/')) {
    void user?.setFlag?.(MODULE_ID, LATER_FLAG, key);
  }
}
