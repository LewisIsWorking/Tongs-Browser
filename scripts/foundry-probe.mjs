#!/usr/bin/env node
/**
 * Measures how a real Foundry treats synthesised keyboard events. Added 2026-08-09.
 *
 * This is the one question the whole modifier feature rests on, and it cannot be answered by any test
 * in this repo: jsdom has no Foundry, and the Chromium tests run against a stub that believes whatever
 * we tell it. Only a real Foundry knows whether its KeyboardManager updates downKeys from an event
 * whose isTrusted is false.
 *
 * Run: npm run probe:foundry     (a Foundry must be running with a world launched)
 *
 * The approach is lifted from ComeOnOverFoundry's tools/foundry-session.ts, whose comments record why
 * each step is shaped this way. Three of them are load bearing:
 *
 *   - Join by POSTing to /join, not by driving the form. Foundry disables the <option> for a user who
 *     is already connected, so the form path fails exactly when someone has the world open.
 *   - Wait on game.ready, not on a selector. The UI paints well before the world is usable.
 *   - Use a 1600x1000 viewport. Foundry refuses to boot below 1366x768, and the resulting failure does
 *     not mention resolution.
 */
import { chromium } from 'playwright';

const BASE = process.env.FOUNDRY_URL ?? 'http://localhost:30000';
const USER = process.env.FOUNDRY_USER ?? 'Gamemaster';
const PASSWORD = process.env.FOUNDRY_PASSWORD ?? '';
const MODULE_ID = 'tongs-browser';

/**
 * A server answering is not a world being loaded, and only /api/status distinguishes them. Both /join
 * and /game return 200 either way, so probing those reports a healthy world when there is none.
 */
async function requireActiveWorld() {
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

async function waitForReady(page) {
  await page.waitForFunction(() => globalThis.game?.ready === true, undefined, {
    timeout: 120_000,
  });
}

/** Resolve the user id from the name, then post the join directly. */
async function joinWorld(page) {
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

/**
 * Turn the module on if it is off, then reload so it actually initialises.
 *
 * Activation is written through the settings API rather than the Manage Modules dialog because the
 * dialog needs a click that Foundry's tour overlay intercepts, and because a setting write is
 * idempotent while a checkbox toggle is not.
 */
async function ensureModuleEnabled(page) {
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

/**
 * Measure the same thing the module measures, without asking the module.
 *
 * The module reports its own strategy, but that value is derived from its own probe, so quoting it
 * back proves only that it is self consistent. This dispatches an independent event and reads
 * downKeys directly, so the two can be compared and a disagreement is visible rather than assumed
 * away. It cleans up after itself whatever the answer.
 */
async function independentProbe(page) {
  return page.evaluate(() => {
    const manager = game.keyboard;
    const downKeys = manager?.downKeys;
    if (downKeys === undefined) {
      return { measurable: false, reason: 'game.keyboard.downKeys does not exist on this build' };
    }
    if (downKeys.has('ShiftLeft')) {
      return { measurable: false, reason: 'ShiftLeft was already held, so the probe would lie' };
    }

    const event = new KeyboardEvent('keydown', {
      code: 'ShiftLeft',
      key: 'Shift',
      bubbles: true,
      cancelable: true,
      composed: true,
      shiftKey: true,
    });
    document.dispatchEvent(event);

    const honoured = downKeys.has('ShiftLeft');

    document.dispatchEvent(
      new KeyboardEvent('keyup', { code: 'ShiftLeft', key: 'Shift', bubbles: true })
    );
    downKeys.delete('ShiftLeft');

    return {
      measurable: true,
      isTrusted: event.isTrusted,
      honoured,
      strategy: honoured ? 'events' : 'direct',
      downKeysType: downKeys.constructor?.name ?? null,
    };
  });
}

async function main() {
  const status = await requireActiveWorld();

  // PLAYWRIGHT_CHANNEL=chromium runs the full browser instead of the headless shell, which is the
  // escape hatch when only one of the two is downloaded. The shell is the default because it starts
  // faster, and a half finished `playwright install` is otherwise an opaque "executable doesn't exist".
  const channel = process.env.PLAYWRIGHT_CHANNEL;
  const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  const log = [];
  page.on('console', (message) => {
    const text = message.text();
    if (text.includes('Tongs Browser')) {
      log.push(`${message.type()}: ${text}`);
    }
  });
  page.on('pageerror', (error) => log.push(`pageerror: ${error.message}`));

  try {
    await joinWorld(page);
    const enabled = await ensureModuleEnabled(page);

    const reported = await page.evaluate((id) => {
      const entry = game.modules.get(id);
      return {
        found: entry !== undefined,
        active: entry?.active ?? false,
        version: entry?.version ?? null,
        strategy: entry?.api?.getKeyboardStrategy?.() ?? null,
      };
    }, MODULE_ID);

    const measured = await independentProbe(page);

    console.log(
      JSON.stringify(
        {
          target: BASE,
          world: status.world,
          core: status.version,
          enabledByThisRun: enabled,
          reported,
          measured,
          log,
        },
        null,
        2
      )
    );

    if (
      reported.strategy !== null &&
      measured.measurable &&
      reported.strategy !== measured.strategy
    ) {
      console.error(
        `\nDISAGREEMENT: the module reports '${reported.strategy}' but an independent probe measured ` +
          `'${measured.strategy}'. One of the two is wrong and it matters which.`
      );
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

await main();
