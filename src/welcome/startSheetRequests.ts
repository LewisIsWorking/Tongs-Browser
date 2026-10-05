import { MODULE_ID } from '../constants.js';
import { createSheetWithFoundry } from '../foundry/CreateSheetDeps.js';
import { readGmPresence } from '../foundry/DesignatedGm.js';
import type { GmGame } from '../foundry/DesignatedGm.js';
import { readPartyCampaigns } from '../foundry/PartyAccess.js';
import type { FoundryGame } from '../foundry/PartyAccess.js';
import { logger } from '../core/Logger.js';
import { campaignParties } from './campaignParty.js';
import type { CampaignParty } from './campaignParty.js';
import { MADE_FOR_FLAG } from './sheetRequest.js';
import { SheetRequests } from './SheetRequests.js';
import { actorMadeFor, answerRequest, pendingRequests } from './welcomeDocuments.js';
import type { WelcomeGame } from './welcomeDocuments.js';

/**
 * The GM's half of the new-player welcome. Added 2026-10-05; the rules are in SheetRequests.ts.
 *
 * ⚠️ It also copies the world's campaign parties into a world setting. A player may not be able to see
 *    the party actor at all, but every player can read a world setting, so this is how a player's browser
 *    knows whether to welcome them and which campaigns to offer. It is refreshed whenever a party changes.
 */
export const WELCOME_SETTING = 'newPlayerWelcome';
export const PARTIES_SETTING = 'welcomeParties';

export interface WelcomeSettings {
  register(namespace: string, key: string, data: object): void;
  get(namespace: string, key: string): unknown;
  set(namespace: string, key: string, value: unknown): Promise<unknown>;
}

export interface WelcomeHooks {
  on(name: string, fn: (...args: never[]) => unknown): unknown;
}

export interface WelcomeGlobals {
  readonly game?: WelcomeGame & GmGame;
  readonly ui?: { readonly notifications?: { info?(message: string): unknown } };
}

export function registerWelcomeSettings(settings: WelcomeSettings): void {
  settings.register(MODULE_ID, WELCOME_SETTING, {
    name: 'Welcome new players',
    hint: 'A player with no character here is welcomed and can ask for one. A GM makes it the next time one is online, in the party with a campaign code.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });
  settings.register(MODULE_ID, PARTIES_SETTING, {
    scope: 'world',
    config: false,
    type: Object,
    default: { parties: [] },
  });
}

/** The campaign parties as the GM last saw them; read on any client. */
export function sharedParties(settings: WelcomeSettings): CampaignParty[] {
  const stored = settings.get(MODULE_ID, PARTIES_SETTING) as { parties?: unknown } | undefined;
  const list: unknown[] = Array.isArray(stored?.parties) ? stored.parties : [];
  /* ⚠️ Re-checked on the way out: a code that is no longer a code, or a damaged entry, offers nothing. */
  return campaignParties(
    list.flatMap((entry) => {
      const party = entry as Partial<CampaignParty> | null;
      return typeof party?.uuid === 'string' && typeof party.name === 'string'
        ? [{ uuid: party.uuid, name: party.name, campaign: party.code }]
        : [];
    })
  );
}

export function startSheetRequests(
  hooks: WelcomeHooks,
  settings: WelcomeSettings,
  globals: WelcomeGlobals
): SheetRequests {
  const game = (): (WelcomeGame & GmGame) | undefined => globals.game;
  const parties = (): CampaignParty[] =>
    campaignParties(readPartyCampaigns({ getGame: () => game() as FoundryGame | undefined }));
  const requests = new SheetRequests({
    isDesignatedGm: () => readGmPresence({ getGame: game }).isMe,
    pending: () => pendingRequests(game()),
    campaignParties: parties,
    madeFor: (requestId) => actorMadeFor(game(), requestId),
    create: async (sheet) =>
      createSheetWithFoundry({
        name: sheet.name,
        ownerId: sheet.ownerId,
        partyUuid: sheet.partyUuid,
        flags: { [MODULE_ID]: { [MADE_FOR_FLAG]: sheet.requestId } },
      }),
    answer: async (userId, result) => answerRequest(game(), userId, result),
    tellGm: (text) => globals.ui?.notifications?.info?.(text),
  });

  const on = (): boolean => settings.get(MODULE_ID, WELCOME_SETTING) === true;
  const run = (): void => {
    if (!on() || game()?.user?.isGM !== true) {
      return;
    }
    void shareParties(settings, parties())
      .then(async () => requests.serve())
      .catch((error: unknown) => {
        logger.warn(
          `New player sheets failed: ${error instanceof Error ? error.message : String(error)}`
        );
      });
  };
  for (const name of ['updateUser', 'userConnected', 'createActor', 'updateActor', 'deleteActor']) {
    hooks.on(name, run);
  }
  run();
  return requests;
}

/** Only written when it changed, so a GM's browser does not rewrite the setting on every actor update. */
async function shareParties(settings: WelcomeSettings, parties: CampaignParty[]): Promise<void> {
  if (JSON.stringify(sharedParties(settings)) !== JSON.stringify(parties)) {
    await settings.set(MODULE_ID, PARTIES_SETTING, { parties });
  }
}
