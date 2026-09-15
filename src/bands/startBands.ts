import { automationRole } from '../automation/automationRole.js';
import type { RoleGlobals } from '../automation/automationRole.js';
import { MODULE_ID } from '../constants.js';
import { logger } from '../core/Logger.js';
import { BandReporter } from './BandReporter.js';
import { combatSubjects, subjectsForActor } from './bandTokens.js';
import type { BandGlobals } from './bandTokens.js';
import { CooClient } from './CooClient.js';
import type { CooPorts } from './CooClient.js';

/**
 * Health bands' settings, and connecting them to Foundry. Added 2026-09-14.
 *
 * ⛔ OFF UNTIL THE WORLD NAMES ITS CAMPAIGN. Nothing is posted anywhere while `bandsCampaign` is empty.
 *
 * ⛔ THE REFRESH TOKEN IS A CLIENT SETTING, hidden from the settings form: it lives in the GM's own browser
 * and is never synced to anyone. See `CooClient`.
 */
export const CAMPAIGN_SETTING = 'bandsCampaign';
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
}

export type StartGlobals = BandGlobals &
  RoleGlobals & {
    readonly fetch?: CooPorts['fetch'];
    readonly ui?: { readonly notifications?: { warn?(message: string): unknown } };
  };

export function registerBandSettings(settings: BandSettings): void {
  settings.register(MODULE_ID, CAMPAIGN_SETTING, {
    name: 'Path Wars campaign for health bands',
    hint:
      "The campaign code this world is, such as C06. Enemies' health bands are posted to that " +
      "campaign's combat topic, and exact HP is sent to the GM. Leave empty to post nothing.",
    scope: 'world',
    config: true,
    type: String,
    default: '',
  });
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
  const reporter = new BandReporter({
    role: () => automationRole(globals),
    campaign: () => {
      const value = settings.get(MODULE_ID, CAMPAIGN_SETTING);
      return typeof value === 'string' ? value.trim() : '';
    },
    subjectsFor: (actor) => subjectsForActor(actor, globals),
    combatSubjects: () => combatSubjects(globals),
    post: async (campaign, post) => client.postBand(campaign, post),
    warn: (message) => {
      globals.ui?.notifications?.warn?.(message);
    },
  });

  hooks.on('updateActor', (actor: unknown, changes: unknown) => {
    reporter.onActorUpdated(actor, changes).catch((error: unknown) => {
      logger.warn(`Health bands failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  });
  for (const name of ['canvasReady', 'createCombatant', 'updateCombat']) {
    hooks.on(name, () => {
      reporter.seed();
    });
  }
  reporter.seed();
  return reporter;
}
