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
import { chromium } from 'playwright';

export const BASE = process.env.FOUNDRY_URL ?? 'http://localhost:30000';
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
    const res = await fetch(`${BASE}/api/status`, { signal: AbortSignal.timeout(5000) });
    status = await res.json();
  } catch {
    throw new Error(`nothing is answering on ${BASE}. Start Foundry and launch a world.`);
  }
  if (status.active !== true) {
    throw new Error(`${BASE} is up but no world is launched. Launch one, then run this again.`);
  }
  return status;
}

export async function waitForReady(page) {
  await page.waitForFunction(() => globalThis.game?.ready === true, undefined, {
    timeout: 120_000,
  });
}

/**
 * Open a browser sized for Foundry.
 *
 * PLAYWRIGHT_CHANNEL=chrome runs the installed Chrome instead of a downloaded Chromium, which is the
 * escape hatch when the pinned build is missing. A half finished `playwright install` otherwise
 * presents as an opaque "executable doesn't exist".
 */
export async function launchBrowser() {
  const channel = process.env.PLAYWRIGHT_CHANNEL;
  const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  return { browser, page };
}

/** Collect the module's own console output, plus anything that throws. */
export function captureModuleLog(page) {
  const log = [];
  page.on('console', (message) => {
    const text = message.text();
    if (text.includes('Tongs Browser')) {
      log.push(`${message.type()}: ${text}`);
    }
  });
  page.on('pageerror', (error) => log.push(`pageerror: ${error.message}`));
  return log;
}

/** Resolve the user id from the name, post the join directly, then wait for the world. */
export async function joinWorld(page) {
  await page.goto(`${BASE}/join`, { waitUntil: 'networkidle', timeout: 60_000 });

  const userId = await page.evaluate((name) => {
    const options = [...document.querySelectorAll("select[name='userid'] option")];
    return options.find((o) => (o.textContent ?? '').trim() === name)?.value ?? null;
  }, USER);

  if (userId === null) {
    const available = await page.evaluate(() =>
      [...document.querySelectorAll("select[name='userid'] option")]
        .map((o) => (o.textContent ?? '').trim())
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

/** Turn the module on if it is off, then reload so it actually initialises. */
export async function ensureModuleEnabled(page) {
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
