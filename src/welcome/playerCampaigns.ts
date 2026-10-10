import { MODULE_ID } from '../constants.js';
import { normalizeCampaign } from '../bands/partyCampaign.js';

/**
 * Which campaigns each player posts in, as ComeOnOverUno last said. Added 2026-10-10.
 *
 * Lewis, 2026-10-10: "if you've messaged C01 CHAT then you should get sheet in the C01 party, likewise with
 * C00". C00 and C01 share one world (so do C06 and C11), and nothing in Foundry says which campaign a new
 * player is in. COO does: it reads the bot's roster and answers with each Foundry user's campaign codes.
 *
 * ⚠️ A hidden WORLD setting, so the GM's browser that hears it and the one that makes the sheet need not be
 *    the same. Two writers: the GM heartbeat reply (`playerCampaigns`), and COO's helper GM, which is not
 *    signed in to COO and is handed the same map with each visit (`helper.campaigns(map)`).
 * ⚠️ Untrusted on the way in (the helper's call is made from the page): only Foundry-shaped ids and real
 *    campaign codes are kept, and a wrong entry can at most send a sheet to another coded party.
 */
export const PLAYER_CAMPAIGNS_SETTING = 'playerCampaigns';

export type PlayerCampaigns = Readonly<Record<string, readonly string[]>>;

export interface CampaignSettings {
  register(namespace: string, key: string, data: object): void;
  get(namespace: string, key: string): unknown;
  set(namespace: string, key: string, value: unknown): Promise<unknown>;
}

const FOUNDRY_ID = /^[A-Za-z0-9]{16}$/;

export function registerPlayerCampaigns(settings: CampaignSettings): void {
  settings.register(MODULE_ID, PLAYER_CAMPAIGNS_SETTING, {
    scope: 'world',
    config: false,
    type: Object,
    default: {},
  });
}

/** Keeps only Foundry user ids with at least one real campaign code. */
export function readPlayerCampaigns(value: unknown): PlayerCampaigns {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  const kept: Record<string, string[]> = {};
  for (const [userId, codes] of Object.entries(value as Record<string, unknown>)) {
    const clean = Array.isArray(codes)
      ? [...new Set(codes.map(normalizeCampaign).filter((code) => code !== ''))].sort()
      : [];
    if (FOUNDRY_ID.test(userId) && clean.length > 0) {
      kept[userId] = clean;
    }
  }
  return kept;
}

/** The campaigns one player posts in; none when COO has not said. */
export function campaignsOf(settings: CampaignSettings, userId: string): readonly string[] {
  return readPlayerCampaigns(settings.get(MODULE_ID, PLAYER_CAMPAIGNS_SETTING))[userId] ?? [];
}

/** Stores what COO said, only when it changed. A GM's browser only: a player cannot write a world setting. */
export async function storePlayerCampaigns(
  settings: CampaignSettings,
  value: unknown
): Promise<void> {
  const next = readPlayerCampaigns(value);
  const now = readPlayerCampaigns(settings.get(MODULE_ID, PLAYER_CAMPAIGNS_SETTING));
  if (JSON.stringify(next) !== JSON.stringify(now)) {
    await settings.set(MODULE_ID, PLAYER_CAMPAIGNS_SETTING, next);
  }
}
