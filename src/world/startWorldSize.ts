import { automationRole } from '../automation/automationRole.js';
import type { RoleGlobals } from '../automation/automationRole.js';
import type { CooClient } from '../bands/CooClient.js';
import { MODULE_ID } from '../constants.js';
import { logger } from '../core/Logger.js';
import { readWorldSize, sizeWarning } from './worldSize.js';

/**
 * Asking ComeOnOverUno how big this world is, once at launch, and warning the GM. Added 2026-09-23.
 *
 * ⛔ ONE BROWSER ASKS: the active full GM's, like every other automation here (`automationRole`). A warning on
 * every player's screen would be noise about something only the GM can act on.
 *
 * ⚠️ SILENT WHENEVER IT CANNOT ANSWER. Not signed in, an older server, a world the server does not hold (The
 * Forge, where nothing can measure it): all of them mean no warning, never an error. A GM launching a game is
 * busy, and a courtesy that interrupts them is worse than no courtesy.
 */
const LIMIT_SETTING = 'worldSizeWarnMb';
const DEFAULT_LIMIT_MB = 100;

interface SizeSettings {
  register(module: string, key: string, definition: object): void;
  get(module: string, key: string): unknown;
}

export type SizeGlobals = RoleGlobals & {
  readonly game?: RoleGlobals['game'] & { readonly world?: { readonly id?: unknown } };
  readonly ui?: { readonly notifications?: { warn?(message: string, options?: object): unknown } };
};

export function registerWorldSizeSetting(settings: SizeSettings): void {
  settings.register(MODULE_ID, LIMIT_SETTING, {
    name: 'Warn when this world passes (MB)',
    hint:
      'At launch, Tongs asks ComeOnOverUno how big this world is on disk and warns you once if it is over ' +
      'this. 0 turns the warning off. Needs the ComeOnOverUno sign-in, and a world the server hosts.',
    scope: 'world',
    config: true,
    type: Number,
    default: DEFAULT_LIMIT_MB,
  });
}

function limitMb(settings: SizeSettings): number {
  const value = settings.get(MODULE_ID, LIMIT_SETTING);
  return typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_LIMIT_MB;
}

/** Asks once, and returns what the GM was told, so a caller can see what happened. */
export async function checkWorldSize(
  settings: SizeSettings,
  client: CooClient | null,
  globals: SizeGlobals
): Promise<string | null> {
  const world = globals.game?.world?.id;
  const limit = limitMb(settings);
  if (
    client === null ||
    limit <= 0 ||
    typeof world !== 'string' ||
    automationRole(globals) !== 'act'
  ) {
    return null;
  }
  const response = await client.call(
    'GET',
    `/api/foundry/worlds/${encodeURIComponent(world)}/size`
  );
  if (response === 'signed-out' || response.status !== 200) {
    return null;
  }
  const warning = sizeWarning(readWorldSize(await response.json().catch(() => null)), limit);
  if (warning !== null) {
    logger.warn(warning);
    globals.ui?.notifications?.warn?.(warning, { permanent: true });
  }
  return warning;
}

export function startWorldSize(
  hooks: { once(event: string, handler: () => unknown): unknown },
  settings: SizeSettings,
  client: CooClient | null,
  globals: SizeGlobals
): void {
  hooks.once('ready', () => {
    void checkWorldSize(settings, client, globals).catch((error: unknown) => {
      logger.warn(`world size check failed: ${String(error)}`);
    });
  });
}
