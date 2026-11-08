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
/** The first report goes 30 s after the world loads (`FIRST_REPORT_MS`); this allows for a slow machine. */
const HEARTBEAT_WAIT_MS = 75_000;
const DIALOG_WAIT_MS = 60_000;

/**
 * Starts listening for the first heartbeat. Call it BEFORE joining the world, because the report is timed
 * from the module's start and a listener added later can miss it. It has no limit of its own: a world can
 * take minutes to load here, so the limit starts in `checkHeartbeat`, once the world is up.
 */
export function awaitHeartbeat(page: Page): Promise<Response> {
  return new Promise((resolve) => {
    const onResponse = (response: Response) => {
      if (response.url().includes(STATUS_PATH) && response.request().method() === 'POST') {
        page.off('response', onResponse);
        resolve(response);
      }
    };
    page.on('response', onResponse);
  });
}

/** The heartbeat reached COO and named this world and this version of the module. */
export async function checkHeartbeat(page: Page, recorder: Recorder, heartbeat: Promise<Response>) {
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
  const response = await Promise.race([
    heartbeat,
    page.waitForTimeout(HEARTBEAT_WAIT_MS).then(() => null),
  ]);
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
  /*
   * Read in the page on a 1 s timer, not with a locator: locators wait on animation frames, which headless
   * Chromium barely draws with the Foundry canvas up (same reason as `waitForReady`).
   */
  const shown = await page
    .waitForFunction(
      () => {
        const dialog = [...document.querySelectorAll<HTMLElement>('.application')].find((a) =>
          a.textContent.includes('Tongs activity')
        );
        return dialog === undefined ? false : dialog.innerText;
      },
      undefined,
      { timeout: DIALOG_WAIT_MS, polling: 1_000 }
    )
    .then((handle) => handle.jsonValue() as Promise<string>)
    .catch(() => '');
  recorder.record(
    'activity menu opens on the sign-in state',
    /signed in/i.test(shown),
    shown === '' ? 'no dialog appeared' : shown.replace(/\s+/g, ' ').slice(0, 160)
  );
  await page.evaluate(() => {
    const dialog = [...document.querySelectorAll('.application')].find((a) =>
      a.textContent.includes('Tongs activity')
    );
    dialog?.querySelector<HTMLElement>('button[data-action="ok"]')?.click();
  });
}
