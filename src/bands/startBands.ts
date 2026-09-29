import type { RoleGlobals } from '../automation/automationRole.js';
import { MODULE_ID } from '../constants.js';
import { logger } from '../core/Logger.js';
import { BandReporter } from './BandReporter.js';
import { combatSubjects, subjectsForActor } from './bandTokens.js';
import { sharedBandPorts } from './bandPorts.js';
import { registerPlayerHitSetting, buildPlayerHits } from './startPlayerHits.js';
import { registerSignInMenu } from './cooSignIn.js';
import type { SignInGlobals } from './cooSignIn.js';
import { readPartyCampaigns } from '../foundry/PartyAccess.js';
import type { FoundryGame } from '../foundry/PartyAccess.js';
import { registerPartyCampaignsMenu } from './partyCampaignsMenu.js';
import type { PartyCampaignGlobals } from './partyCampaignsMenu.js';
import type { MenuSettings } from './settingsMenu.js';
import type { BandGlobals } from './bandTokens.js';
import { CooClient } from './CooClient.js';
import type { CooPorts } from './CooClient.js';

/**
 * Health bands' settings, and connecting them to Foundry. Added 2026-09-14.
 *
 * ⛔ OFF UNTIL A PARTY HAS A CAMPAIGN. A combat whose player characters are in no party with a campaign
 * (Module Settings, Party campaigns) posts nothing; see `partyCampaign.ts`.
 *
 * ⛔ THE REFRESH TOKEN IS A CLIENT SETTING, hidden from the settings form: it lives in the GM's own browser
 * and is never synced to anyone. See `CooClient`.
 */
export const SERVER_SETTING = 'cooServerUrl';
export const REFRESH_SETTING = 'cooRefreshToken';
export const DEFAULT_SERVER = 'https://cooserver.duckdns.org';

export interface BandSettings {
  register(namespace: string, key: string, data: FoundrySettingRegistration): void;
  get(namespace: string, key: string): unknown;
  set(namespace: string, key: string, value: unknown): Promise<unknown>;
}

interface HooksLike {
  on(name: string, fn: (...args: never[]) => unknown): number;
  off(name: string, id: number): void;
}

export type StartGlobals = BandGlobals &
  RoleGlobals & {
    readonly game?: {
      readonly system?: { readonly id?: string };
      readonly modules?: { get?(id: string): { readonly version?: string } | undefined };
    };
    readonly fetch?: CooPorts['fetch'];
    readonly fromUuidSync?: (uuid: string) => { readonly name?: string } | null | undefined;
    readonly ui?: { readonly notifications?: { warn?(message: string): unknown } };
  };

export function registerBandSettings(settings: BandSettings): void {
  settings.register(MODULE_ID, SERVER_SETTING, {
    name: 'ComeOnOverUno server',
    hint: 'Where health bands are sent. Only change this for testing.',
    scope: 'client',
    config: true,
    type: String,
    default: DEFAULT_SERVER,
  });
  settings.register(MODULE_ID, REFRESH_SETTING, {
    name: 'ComeOnOverUno session',
    scope: 'client',
    config: false,
    type: String,
    default: '',
  });
  registerPlayerHitSetting(settings);
}

export type MenuStartGlobals = SignInGlobals & PartyCampaignGlobals & { readonly game?: unknown };

/** The GM's two buttons in the module settings: signing in, and each party's campaign. */
export function registerBandMenus(
  settings: MenuSettings,
  client: CooClient,
  globals: MenuStartGlobals
): void {
  registerSignInMenu(settings, client, globals);
  registerPartyCampaignsMenu(settings, globals, () =>
    readPartyCampaigns({ getGame: () => globals.game as FoundryGame | undefined })
  );
}

export function buildCooClient(settings: BandSettings, globals: StartGlobals): CooClient {
  const text = (key: string) => {
    const value = settings.get(MODULE_ID, key);
    return typeof value === 'string' ? value.trim() : '';
  };
  return new CooClient({
    fetch: async (url, init) => {
      if (globals.fetch === undefined) {
        throw new Error('this browser cannot make requests');
      }
      return globals.fetch(url, init);
    },
    serverUrl: () => text(SERVER_SETTING) || DEFAULT_SERVER,
    refreshToken: () => text(REFRESH_SETTING),
    saveRefreshToken: async (token) => {
      await settings.set(MODULE_ID, REFRESH_SETTING, token);
    },
    now: () => Date.now(),
    version: () => globals.game?.modules?.get?.(MODULE_ID)?.version ?? 'unknown',
  });
}

export function startBands(
  hooks: HooksLike,
  settings: BandSettings,
  globals: StartGlobals,
  given: CooClient | null
): BandReporter {
  /* The sign-in menu's client when init built one: COO rotates refresh tokens, so they must be one. */
  const client = given ?? buildCooClient(settings, globals);
  const shared = sharedBandPorts(hooks, globals);
  const reporter = new BandReporter({
    ...shared,
    subjectsFor: (actor) => subjectsForActor(actor, globals),
    combatSubjects: () => combatSubjects(globals),
    post: async (campaign, post) => client.postBand(campaign, post),
  });

  /* ⭐ Hits on player characters, 2026-09-28: the same events, the same sign-in, reported beside the bands. */
  const hits = buildPlayerHits(settings, globals, client, shared);
  const failed = (what: string) => (error: unknown) => {
    logger.warn(`${what} failed: ${error instanceof Error ? error.message : String(error)}`);
  };
  hooks.on('updateActor', (actor: unknown, changes: unknown) => {
    reporter.onActorUpdated(actor, changes).catch(failed('Health bands'));
    hits.onActorUpdated(actor, changes).catch(failed('Player hits'));
  });
  for (const name of ['canvasReady', 'createCombatant', 'updateCombat']) {
    hooks.on(name, () => {
      reporter.seed();
      hits.seed();
    });
  }
  reporter.seed();
  return reporter;
}
