import { MODULE_ID } from '../constants.js';
import { AfkGuard } from './AfkGuard.js';

/**
 * Wires AfkGuard into Foundry: the setting, the activity it watches, the timer, and the sign-out.
 * Added 2026-09-26 (Lewis: "a 2 hour afk GM auto kick timer"). Only a GM's browser runs it.
 */
const AFK_SETTING = 'gmAfkMinutes';
const TICK_MS = 30_000;
const ACTIVITY = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;

interface AfkSettings {
  register(module: string, key: string, definition: object): void;
  get(module: string, key: string): unknown;
}

export interface AfkGlobals {
  readonly game?: { readonly user?: { readonly isGM?: boolean }; logOut?(): unknown };
  readonly foundry?: {
    readonly applications?: {
      readonly api?: { readonly DialogV2?: { confirm?(options: object): Promise<unknown> } };
    };
  };
  readonly location?: { assign?(url: string): void };
}

export interface AfkEnvironment {
  readonly target: { addEventListener(type: string, listener: () => void, options?: object): void };
  readonly now: () => number;
  readonly every: (run: () => void, ms: number) => unknown;
}

export function registerAfkGuard(settings: AfkSettings): void {
  settings.register(MODULE_ID, AFK_SETTING, {
    name: 'Sign out an idle GM (minutes)',
    hint:
      'After this long with no mouse or keyboard activity, a GM is asked "Still there?" and, five minutes ' +
      'later, signed out of Foundry, so an unattended browser does not hold this world for other campaigns. ' +
      '0 turns it off.',
    scope: 'world',
    config: true,
    type: Number,
    range: { min: 0, max: 480, step: 5 },
    default: 120,
  });
}

/** Starts the guard for a GM. Returns its idle clock for the heartbeat, or undefined when it does not run. */
export function startAfkGuard(
  settings: AfkSettings,
  globals: AfkGlobals,
  env: AfkEnvironment
): (() => number) | undefined {
  if (globals.game?.user?.isGM !== true) {
    return undefined;
  }
  const minutes = Number(settings.get(MODULE_ID, AFK_SETTING) ?? 120);
  const guard = new AfkGuard(
    {
      now: env.now,
      warn: async () => {
        const answer = await globals.foundry?.applications?.api?.DialogV2?.confirm?.({
          window: { title: 'Still there?' },
          content:
            '<p>No activity for a while. In five minutes you will be signed out of Foundry, so this world ' +
            'is free for other campaigns.</p>',
          yes: { label: "I'm here" },
          no: { label: 'Sign me out now' },
          rejectClose: false,
        });
        return answer !== false; // closing the prompt is still someone at the keyboard
      },
      signOut: () => {
        if (globals.game?.logOut) {
          globals.game.logOut();
        } else {
          globals.location?.assign?.('/join');
        }
      },
    },
    Number.isFinite(minutes) ? minutes : 120
  );
  for (const type of ACTIVITY) {
    env.target.addEventListener(
      type,
      () => {
        guard.touch();
      },
      { passive: true }
    );
  }
  env.every(() => {
    void guard.tick();
  }, TICK_MS);
  return () => guard.idleSeconds();
}
