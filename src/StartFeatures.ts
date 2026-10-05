import { startAutoApply } from './automation/startAutoApply.js';
import { startSpellSaves } from './automation/startSpellSaves.js';
import { startSpellDamage } from './automation/startSpellDamage.js';
import type { AutoGlobals } from './automation/buildAutoApply.js';
import { startBands } from './bands/startBands.js';
import type { CooClient } from './bands/CooClient.js';
import { startEncounterSync } from './encounter/startEncounterSync.js';
import { startWorldSwaps } from './swaps/startWorldSwaps.js';
import type { SwapGlobals } from './swaps/startWorldSwaps.js';
import { startAfkGuard } from './swaps/startAfkGuard.js';
import { foundryCreateUser } from './swaps/LiveUsers.js';
import type { UserGlobals } from './swaps/LiveUsers.js';
import { startRestoreOwners } from './owners/startRestoreOwners.js';
import type { OwnerGlobals } from './owners/startRestoreOwners.js';
import { startWorldSize } from './world/startWorldSize.js';
import { registerWelcomeSettings, startSheetRequests } from './welcome/startSheetRequests.js';
import type { WelcomeGlobals } from './welcome/startSheetRequests.js';
import { startWelcome } from './welcome/startWelcome.js';
import type { SizeGlobals } from './world/startWorldSize.js';

/**
 * Starting everything that waits for `ready`. Extracted from main.ts 2026-09-20, when adding world
 * swaps took the entry point over its size ceiling.
 *
 * ⚠️ EVERY ONE OF THESE IS OFF UNTIL A GM TURNS IT ON, per world, except world swaps: that one only
 * makes ComeOnOverUno ask before it closes the world, so off is the dangerous setting (`src/swaps`).
 * The new-player welcome is on, but does nothing until a GM gives a party a campaign code (`src/welcome`).
 *
 * ⚠️ The COO ones start only when `init` managed to build the client, because their settings were
 * registered in the same breath and neither exists without it.
 */
export interface FeatureParts {
  readonly deck: Parameters<typeof startAutoApply>[0];
  /* Foundry's own globals, not each module's narrower view of them: every one of these reads a
     different subset, and the intersection of five subsets is not a thing main.ts can hand over. */
  readonly hooks: FoundryHooks;
  readonly settings: FoundryClientSettings;
  readonly globals: typeof globalThis;
  readonly document: Document;
  readonly client: CooClient | null;
}

export function startFeatures(parts: FeatureParts): void {
  const { deck, hooks, settings, globals, client } = parts;
  /* Phase 2: off per world until a GM turns it on. See automation/startAutoApply.ts. */
  startAutoApply(deck, hooks, settings, globals as AutoGlobals);
  startSpellSaves(deck, hooks, settings, globals as AutoGlobals, parts.document);
  startSpellDamage(deck, hooks, settings, globals as AutoGlobals);
  /* Health bands: off until a party has a campaign. See bands/startBands.ts. */
  startBands(hooks, settings, globals, client);
  /* Restore owners: a GM button giving players back what their pre-move user owned. See src/owners. */
  startRestoreOwners(settings, globals as OwnerGlobals);
  /* New players: welcomed, sheet made by a GM, then a checklist. Inert until a party has a campaign code. */
  registerWelcomeSettings(settings);
  startSheetRequests(hooks, settings, globals as WelcomeGlobals);
  startWelcome(hooks, settings, globals, parts.document);
  /* Idle GM sign-out: frees the world whether or not COO is signed in, so it starts before that check. */
  const idleSeconds = startAfkGuard(settings, globals, {
    target: parts.document,
    now: () => Date.now(),
    every: (run, ms) => setInterval(run, ms),
  });
  if (client === null) {
    return;
  }
  /* Encounter sync: off per world; its settings exist only if init built the client. */
  startEncounterSync(hooks, settings, globals, client);
  /* World swaps: tells COO a GM is here, and asks before another campaign takes the server. */
  startWorldSwaps(settings, globals as SwapGlobals, client, undefined, {
    ...(idleSeconds === undefined ? {} : { idleSeconds }),
    createUser: foundryCreateUser(globals as UserGlobals),
  });
  /* One question at launch: is this world bigger than the GM asked to hear about? See src/world. */
  startWorldSize(hooks, settings, client, globals as SizeGlobals);
}
