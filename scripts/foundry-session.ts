/**
 * Getting a browser into a live Foundry world. Extracted 2026-08-09.
 *
 * Extracted the moment a second script needed it, for the reason ComeOnOverFoundry's
 * tools/foundry-session.ts gives for its own extraction: a second copy of a login is a second thing
 * to get subtly wrong, in a way whose failure mode is "it hangs" rather than "it errors".
 *
 * Every step here replaced something that seemed simpler and was not:
 *
 *   - Join by POSTing to /join, not by driving the form. Foundry disables the <option> for a user who
 *     is already connected, so the form path fails exactly when someone has the world open.
 *   - Wait on game.ready, not on a selector. The UI paints well before the world is usable, and
 *     asserting against a half initialised game reports races as failures.
 *   - Use a viewport of at least 1366x768. Foundry refuses to boot below it, and the resulting error
 *     says nothing about resolution.
 *   - Enable the module by writing the setting, not by clicking Manage Modules. Foundry's tour
 *     overlay intercepts pointer events on that screen, and a setting write is idempotent.
 */
import { type Page } from 'playwright';

/**
 * There are two addresses here, not one, and conflating them cost real time on 2026-08-10.
 *
 * HOST_BASE is the URL this Node process can reach. BASE is the URL the *browser* can reach. On
 * desktop they are the same string, which is exactly why one constant seemed sufficient. Driving
 * Chrome on an Android emulator makes them necessarily different: the emulator reaches the host only
 * through the NAT alias 10.0.2.2, and the host cannot resolve that at all.
 *
 * Keeping one constant would make requireActiveWorld fetch an address Node cannot reach and report
 * "nothing is answering", which reads as "Foundry is down" when Foundry is perfectly healthy. That
 * is the worst kind of wrong message: it accuses the thing under test.
 */
export { boardBox, boardCentre, type BoardBox, type ClientPoint } from './foundry/geometry.ts';
export { PROBE_PREFIX, ensureActiveScene, removeProbeScene } from './foundry/scenes.ts';
export { captureModuleLog, connectAndroidBrowser, launchBrowser } from './foundry/browsers.ts';

export const HOST_BASE = process.env.FOUNDRY_HOST_URL ?? 'http://localhost:30000';
export const BASE = process.env.FOUNDRY_URL ?? HOST_BASE;
export const USER = process.env.FOUNDRY_USER ?? 'Gamemaster';
export const PASSWORD = process.env.FOUNDRY_PASSWORD ?? '';
export const MODULE_ID = 'tongs-browser';

/**
 * A server answering is not a world being loaded, and only /api/status distinguishes them. Both
 * /join and /game return 200 either way, so probing those reports a healthy world when there is none.
 */
export async function requireActiveWorld() {
  let status;
  try {
    const res = await fetch(`${HOST_BASE}/api/status`, { signal: AbortSignal.timeout(5000) });
    status = await res.json();
  } catch {
    throw new Error(`nothing is answering on ${HOST_BASE}. Start Foundry and launch a world.`);
  }
  if (status.active !== true) {
    throw new Error(
      `${HOST_BASE} is up but no world is launched. Launch one, then run this again.`
    );
  }
  return status;
}

export async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(() => globalThis.game?.ready === true, undefined, {
    timeout: 120_000,
  });
}

/** Resolve the user id from the name, post the join directly, then wait for the world. */
export async function joinWorld(page: Page): Promise<void> {
  await page.goto(`${BASE}/join`, { waitUntil: 'networkidle', timeout: 60_000 });

  /**
   * networkidle is a network gate, not a render gate, and those are not the same event. Foundry 14
   * renders the join form client side after the document settles, so the select can exist while it
   * is still empty. On desktop the render wins that race every time, which is why this was invisible
   * until an Android emulator lost it and the script reported "no user named 'Gamemaster'. This
   * world offers: " with nothing after the colon.
   *
   * Waiting for the option to carry a value waits for the thing actually needed. A sleep would only
   * move the flake somewhere quieter, and the failure it produces accuses the world of having no
   * users, which sends you looking in entirely the wrong place.
   */
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll<HTMLOptionElement>("select[name='userid'] option")].some(
        (option) => option.value !== ''
      ),
    undefined,
    { timeout: 30_000 }
  );

  const userId = await page.evaluate((name) => {
    const options = [
      ...document.querySelectorAll<HTMLOptionElement>("select[name='userid'] option"),
    ];
    return (
      options.find((o: HTMLOptionElement) => (o.textContent ?? '').trim() === name)?.value ?? null
    );
  }, USER);

  if (userId === null) {
    const available = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLOptionElement>("select[name='userid'] option")]
        .map((o: HTMLOptionElement) => (o.textContent ?? '').trim())
        .filter(Boolean)
    );
    throw new Error(`no user named '${USER}'. This world offers: ${available.join(', ')}`);
  }

  const result = await page.evaluate(
    async ({ id, secret }) => {
      const res = await fetch('/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', userid: id, password: secret }),
      });
      return res.json();
    },
    { id: userId, secret: PASSWORD }
  );

  if (result.status !== 'success') {
    throw new Error(`join refused: ${result.message ?? JSON.stringify(result)}`);
  }

  await page.goto(`${BASE}/game`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitForReady(page);
}

/**
 * Join only if not already in the game.
 *
 * On a device the browser is often already sitting in a world, because that is how the bug was found
 * in the first place. Re-joining would navigate away from a live session, discard whatever was on
 * screen, and can bump the same user off their own seat. Checking first costs one evaluate and keeps
 * a diagnostic from being destructive.
 */
export async function ensureInGame(page: Page): Promise<boolean> {
  const alreadyIn = await page.evaluate(() => globalThis.game?.ready === true).catch(() => false);
  if (alreadyIn) {
    return false;
  }
  await joinWorld(page);
  return true;
}

/** Turn the module on if it is off, then reload so it actually initialises. */
export async function ensureModuleEnabled(page: Page): Promise<boolean> {
  const alreadyOn = await page.evaluate((id) => game.modules.get(id)?.active === true, MODULE_ID);
  if (alreadyOn) {
    return false;
  }

  await page.evaluate(async (id) => {
    const config = { ...game.settings.get('core', 'moduleConfiguration'), [id]: true };
    await game.settings.set('core', 'moduleConfiguration', config);
  }, MODULE_ID);

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitForReady(page);
  return true;
}
