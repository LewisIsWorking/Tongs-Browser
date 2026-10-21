import { MODULE_ID } from '../constants.js';
import { allowedSheets } from './extraSheets.js';
import type { CampaignSettings } from './playerCampaigns.js';
import type { WelcomeActor, WelcomeUser } from './welcomeDocuments.js';

/**
 * Whether the welcome offers a player another sheet, and its memory of Not now. Added 2026-10-21.
 *
 * Lewis, 2026-10-21: every player gets one sheet; /extrasheet raises it to 2, and 2 is the most. Companion
 * and familiar classes add nothing. The limit itself is `allowedSheets` (extraSheets.ts).
 *
 * ⚠️ Not now on a SECOND character is remembered on the user (`LATER_FLAG`, keyed "owned/allowed"), so a
 *    player happy with one sheet is not asked on every page load. A new grant, or a sheet gone, changes the
 *    key and asks once more. Not now on a FIRST sheet still lasts only the page load.
 * ⚠️ Only a FIRST sheet calls COO's helper GM in for a missing party list (startWelcome): offering another
 *    sheet is not worth calling a GM in.
 */
export const LATER_FLAG = 'anotherSheetLater';

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
  const allowed = allowedSheets(settings, user?.id ?? '');
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
