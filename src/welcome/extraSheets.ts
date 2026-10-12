import { MODULE_ID } from '../constants.js';
import type { CampaignSettings } from './playerCampaigns.js';

/**
 * How many extra character sheets each player may have here, as ComeOnOverUno last said. Added 2026-10-12.
 *
 * Lewis, 2026-10-12: "a command that gives someone a maximum of 1 additional sheet if they already have 1
 * sheet ... (maximum 2 in total)". The bot's `/extrasheet` records a grant per player and campaign; COO maps
 * it to Foundry user ids for this world and sends `extraSheets: { "<userId>": 1 }` beside `playerCampaigns`,
 * in the GM heartbeat reply and to its helper GM (`helper.extraSheets(map)`).
 *
 * ⚠️ A hidden WORLD setting, stored exactly like `playerCampaigns.ts`, so the GM's browser that hears it and
 *    the one that enforces it need not be the same, and the player's browser can read its own allowance.
 * ⚠️ Untrusted on the way in: only Foundry-shaped ids and whole numbers above 0 are kept, and every count is
 *    capped at `MAX_EXTRA`, so a damaged map can at most let a player make their one second sheet.
 */
export const EXTRA_SHEETS_SETTING = 'extraSheets';

/** At most one extra: 2 sheets in all (Lewis, 2026-10-12). Companion sheets never count. */
const MAX_EXTRA = 1;

export type ExtraSheets = Readonly<Record<string, number>>;

const FOUNDRY_ID = /^[A-Za-z0-9]{16}$/;

export function registerExtraSheets(settings: CampaignSettings): void {
  settings.register(MODULE_ID, EXTRA_SHEETS_SETTING, {
    scope: 'world',
    config: false,
    type: Object,
    default: {},
  });
}

/** Keeps only Foundry user ids with a whole number of extra sheets, capped at one. */
export function readExtraSheets(value: unknown): ExtraSheets {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  const kept: Record<string, number> = {};
  /* Sorted, so the same map in another order is not a change worth writing. */
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : 1
  );
  for (const [userId, extra] of entries) {
    if (FOUNDRY_ID.test(userId) && Number.isInteger(extra) && (extra as number) > 0) {
      kept[userId] = Math.min(extra as number, MAX_EXTRA);
    }
  }
  return kept;
}

/** How many character sheets a player may own here: 1, plus their extra (so 2 at most). */
export function allowedSheets(settings: CampaignSettings, userId: string): number {
  return 1 + (readExtraSheets(settings.get(MODULE_ID, EXTRA_SHEETS_SETTING))[userId] ?? 0);
}

/** Stores what COO said, only when it changed. A GM's browser only: a player cannot write a world setting. */
export async function storeExtraSheets(settings: CampaignSettings, value: unknown): Promise<void> {
  const next = readExtraSheets(value);
  const now = readExtraSheets(settings.get(MODULE_ID, EXTRA_SHEETS_SETTING));
  if (JSON.stringify(next) !== JSON.stringify(now)) {
    await settings.set(MODULE_ID, EXTRA_SHEETS_SETTING, next);
  }
}
