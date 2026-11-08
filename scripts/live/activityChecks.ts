import type { Page, Response } from 'playwright';

import { MODULE_ID } from '../foundry-session.ts';
import type { Recorder } from './recorder.ts';

/**
 * What Tongs has done, checked in a real Foundry (2026-11-08): the GM's "Tongs activity" menu, and the status
 * heartbeat COO keeps per world (`src/bands/tongsStatus.ts`). Unit tests cover both against stubs; this is
 * the proof that a real GM browser on the real server actually reports, because a silent heartbeat looks
 * exactly like a world nobody has opened.
 */
const STATUS_PATH = '/api/tongs/status';
/** The first report goes 30 s after the world loads (`FIRST_REPORT_MS`); this allows for a slow join. */
const HEARTBEAT_WAIT_MS = 75_000;

/**
 * Starts listening for the first heartbeat. Call it BEFORE joining the world, because the report is timed
 * from the module's start and a listener added later can miss it.
 */
export function awaitHeartbeat(page: Page): Promise<Response | null> {
  return page
    .waitForResponse((r) => r.url().includes(STATUS_PATH) && r.request().method() === 'POST', {
      timeout: HEARTBEAT_WAIT_MS,
    })
    .catch(() => null);
}

/** The heartbeat reached COO and named this world and this version of the module. */
export async function checkHeartbeat(
  page: Page,
  recorder: Recorder,
  heartbeat: Promise<Response | null>
) {
  const expected = await page.evaluate(
    (id) => ({
      world: game.world.id as string,
      version: (game.modules.get(id)?.version ?? '') as string,
      gm: game.user.role === 4,
    }),
    MODULE_ID
  );
  if (!expected.gm) {
    recorder.skip('heartbeat reaches COO', 'only a full GM reports; join as one to check it');
    return;
  }
  const response = await heartbeat;
  if (response === null) {
    recorder.record(
      'heartbeat reaches COO',
      false,
      `no report within ${String(HEARTBEAT_WAIT_MS)} ms`
    );
    return;
  }
  const sent = (response.request().postDataJSON() ?? {}) as { world?: string; version?: string };
  recorder.record(
    'heartbeat reaches COO',
    response.status() === 204 && sent.world === expected.world && sent.version === expected.version,
    `${String(response.status())} for world=${String(sent.world)} version=${String(sent.version)}, ` +
      `expected ${expected.world} ${expected.version}`
  );
}

/** The GM's activity menu is registered and opens on the sign-in state, then closes again. */
export async function checkActivityMenu(page: Page, recorder: Recorder) {
  const key = `${MODULE_ID}.tongsActivity`;
  const registered = await page.evaluate((k) => game.settings.menus.has(k), key);
  recorder.record('activity menu is registered', registered, key);
  if (!registered) {
    return;
  }
  await page.evaluate((k) => {
    const Menu = game.settings.menus.get(k).type;
    new Menu().render(true);
  }, key);
  const dialog = page.locator('.application', { hasText: 'Tongs activity' }).last();
  const shown = await dialog
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => dialog.innerText())
    .catch(() => '');
  recorder.record(
    'activity menu opens on the sign-in state',
    /signed in/i.test(shown),
    shown === '' ? 'no dialog appeared' : shown.replace(/\s+/g, ' ').slice(0, 160)
  );
  await dialog
    .getByRole('button', { name: 'Close' })
    .first()
    .click({ timeout: 5_000 })
    .catch(() => undefined);
}
