import { beforeEach, describe, expect, it } from 'vitest';

import { MODULE_ID } from '../../src/constants.js';
import { bootMain } from './support/mainUnderTest.js';

/**
 * The scene control button, from `main.ts` registering it to a tap flipping the setting.
 *
 * ⚠️ The existing init suite asserts the `getSceneControlButtons` hook is REGISTERED, and stops
 * there. Nothing ever invoked it, so the button it injects and both callbacks behind it were
 * unreached: `isActive`, which decides whether the button reads as on, and `onToggle`, which decides
 * what a tap does.
 *
 * That button is the module's escape hatch. Its own class says why: "If the pointer misbehaves mid
 * session, opening the settings dialog to disable it means using the pointer to do so, which is
 * exactly the thing that is not working." A broken toggle is only discovered at the moment nothing
 * else works either.
 *
 * Written 2026-08-30.
 */
interface Tool {
  name: string;
  active: boolean;
  order?: number;
  onClick?: () => void;
  onChange?: () => void;
}

interface Group {
  name?: string;
  tools?: Tool[] | Record<string, Tool>;
}

/** Runs `init`, then hands the scene control hook whatever shape the test wants to pass it. */
async function injectInto(controls: Record<string, Group> | Group[], values = {}) {
  const booted = await bootMain(values);
  booted.hooks.once.get('init')?.();
  (booted.hooks.on.get('getSceneControlButtons') as ((c: unknown) => void) | undefined)?.(controls);
  return booted;
}

const toolsOf = (group: Group): Tool[] =>
  Array.isArray(group.tools) ? group.tools : Object.values(group.tools ?? {});

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('injecting the button into the scene controls', () => {
  it('adds the button to the tokens group', async () => {
    const controls = { tokens: { name: 'tokens', tools: {} } };

    await injectInto(controls);

    expect(toolsOf(controls.tokens).map((tool) => tool.name)).toContain(MODULE_ID);
  });

  /**
   * ⚠️ Foundry's own `#prepareControls` does `control.tools ??= {}` AFTER calling this hook, so a
   * group with no tools of its own arrives with `tools` undefined. A previous
   * `typeof group.tools === 'object'` test failed on undefined and silently wrote nothing, which
   * looks exactly like the hook never firing.
   */
  it('creates the tools collection when the group arrives without one', async () => {
    const controls: Record<string, Group> = { tokens: { name: 'tokens' } };

    await injectInto(controls);

    expect(toolsOf(controls['tokens']!).map((tool) => tool.name)).toContain(MODULE_ID);
  });

  it('handles the older array shape as well as the record one', async () => {
    const controls: Group[] = [{ name: 'tokens', tools: [] }];

    await injectInto(controls);

    expect(toolsOf(controls[0]!).map((tool) => tool.name)).toContain(MODULE_ID);
  });

  /**
   * ⚠️ THE HARMFUL FALLBACK, removed and kept out by this test. There used to be a fallback that
   * took the FIRST group when no token group was found. On Foundry 14 the group is called `tokens`,
   * the code looked for `token`, and the fallback therefore put the button silently into `regions` -
   * the group furthest from where anyone would look. Writing nothing is the correct answer.
   */
  it('writes nothing at all rather than guessing a group', async () => {
    const controls = {
      regions: { name: 'regions', tools: {} },
      lighting: { name: 'lighting', tools: {} },
    };

    await injectInto(controls);

    for (const group of Object.values(controls)) {
      expect(toolsOf(group)).toHaveLength(0);
    }
  });
});

describe('what the button reports and what a tap does', () => {
  it('reads as on when the stored setting says the module is enabled', async () => {
    const controls = { tokens: { name: 'tokens', tools: {} } };

    await injectInto(controls, { enabled: true });

    expect(toolsOf(controls.tokens)[0]?.active).toBe(true);
  });

  it('reads as off when the stored setting says so', async () => {
    const controls = { tokens: { name: 'tokens', tools: {} } };

    await injectInto(controls, { enabled: false });

    expect(toolsOf(controls.tokens)[0]?.active).toBe(false);
  });

  /**
   * ⚠️ THE INVARIANT. `main.ts` says it in the code: "Writing the setting rather than calling enable
   * directly, so the scene control and the settings dialog cannot disagree about what is on."
   *
   * Calling `instance.enable()` here would look identical from the user's seat for exactly one tap,
   * and then the settings dialog would still read `false` while the module ran. This asserts the
   * SETTING moved, which is the only thing both surfaces read.
   */
  it('flips the stored setting rather than reaching for the module directly', async () => {
    const controls = { tokens: { name: 'tokens', tools: {} } };
    const booted = await injectInto(controls, { enabled: false });

    toolsOf(controls.tokens)[0]?.onClick?.();

    expect(booted.settings.stored.get('enabled')).toBe(true);
  });

  /** Both callbacks are set because the one Foundry invokes for a toggle tool has changed. */
  it('flips the setting from onChange too, since Foundry has used both', async () => {
    const controls = { tokens: { name: 'tokens', tools: {} } };
    const booted = await injectInto(controls, { enabled: false });

    toolsOf(controls.tokens)[0]?.onChange?.();

    expect(booted.settings.stored.get('enabled')).toBe(true);
  });

  it('turns the module back off on a second tap', async () => {
    const controls = { tokens: { name: 'tokens', tools: {} } };
    const booted = await injectInto(controls, { enabled: true });

    toolsOf(controls.tokens)[0]?.onClick?.();

    expect(booted.settings.stored.get('enabled')).toBe(false);
  });
});
