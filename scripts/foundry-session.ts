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
import { chromium, type ConsoleMessage, type Page } from 'playwright';

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

/**
 * Open a browser sized for Foundry.
 *
 * PLAYWRIGHT_CHANNEL=chrome runs the installed Chrome instead of a downloaded Chromium, which is the
 * escape hatch when the pinned build is missing. A half finished `playwright install` otherwise
 * presents as an opaque "executable doesn't exist".
 */
export async function launchBrowser({
  hasTouch = false,
  viewport = { width: 1600, height: 1000 },
  deviceScaleFactor = 1,
  isMobile = false,
} = {}) {
  const channel = process.env.PLAYWRIGHT_CHANNEL;
  const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  /*
   * isMobile and deviceScaleFactor are exposed because a desktop browser at a small viewport is NOT
   * a phone, and pretending otherwise hides the class of bug that only appears on one.
   *
   * Chromium only emits touch derived pointer events, sets a mobile user agent and applies a device
   * pixel ratio when told to emulate a mobile device. A drag that works at 1600x1000 and fails on a
   * 360x607 phone differs in all three, and the only honest way to find out which one matters is to
   * turn them on here rather than to reason about it.
   */
  const page = await browser.newPage({ viewport, hasTouch, deviceScaleFactor, isMobile });
  return { browser, page };
}

/**
 * Attach to Chrome running on a real Android device or emulator, over the DevTools socket that adb
 * forwards:
 *
 *   adb forward tcp:9222 localabstract:chrome_devtools_remote
 *
 * This is a genuinely different surface from launchBrowser. There is no viewport to set and no
 * hasTouch to opt into: the viewport is whatever the device's screen gives us, which is the point,
 * and the touchscreen is real hardware.
 *
 * The Android assertion is not defensive noise. If the forward is missing or points at a stale
 * socket, port 9222 can still answer, and without this check the script would pass against desktop
 * Chrome while reporting an Android result. A harness that cannot fail to be what it claims is not
 * evidence of anything.
 */
export async function connectAndroidBrowser({
  endpoint = 'http://127.0.0.1:9222',
  matchUrl = undefined,
} = {}) {
  let browser;
  try {
    /*
     * A generous timeout, because the default 30s is a desktop number.
     *
     * connectOverCDP does not merely open a socket, it enumerates and attaches to every target the
     * browser has: each tab, each service worker, each extension page. On a real phone with the
     * user's own browsing open that is a lot of targets over a Wi-Fi debugging link, and the
     * measured failure is the worst kind to read: `<ws connected>` followed by a timeout, which
     * looks like the forward being wrong when the forward is fine.
     */
    browser = await chromium.connectOverCDP(endpoint, { timeout: 120_000 });
  } catch (error) {
    throw new Error(
      `no DevTools endpoint on ${endpoint}. Run: adb forward tcp:9222 localabstract:chrome_devtools_remote`,
      { cause: error }
    );
  }

  const context = browser.contexts()[0];
  if (!context) {
    await browser.close();
    throw new Error(`${endpoint} answered but exposed no browser context.`);
  }

  /*
   * Pick the Foundry tab, not merely the first one.
   *
   * A real phone has a real browser on it, with the user's own tabs. Measured 2026-08-11: page[0]
   * could just as easily have been a Claude conversation or a deck list, and a check that drives
   * whatever tab happens to be first would navigate someone's browsing away mid session and then
   * report that Foundry was not ready. That is the harness breaking the thing it is measuring.
   */
  const pages = context.pages();
  const page =
    (matchUrl === undefined
      ? undefined
      : pages.find((candidate) => candidate.url().includes(matchUrl))) ??
    pages[0] ??
    (await context.newPage());
  const device = await page.evaluate(() => ({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
  }));

  if (!/Android/.test(device.userAgent)) {
    await browser.close();
    throw new Error(
      `${endpoint} is not Android. User agent says: ${device.userAgent}. Check the adb forward points at the device you mean.`
    );
  }
  if (device.maxTouchPoints < 1) {
    await browser.close();
    throw new Error(
      `${endpoint} reports Android but no touch points, so nothing here would exercise touch.`
    );
  }

  return { browser, page, device };
}

/** Collect the module's own console output, plus anything that throws. */
export function captureModuleLog(page: Page): string[] {
  const log: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    const text = message.text();
    if (text.includes('Tongs Browser')) {
      log.push(`${message.type()}: ${text}`);
    }
  });
  page.on('pageerror', (error: Error) => log.push(`pageerror: ${error.message}`));
  return log;
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

/** A point in client coordinates, which is what every touch and pointer driver here speaks. */
export interface ClientPoint {
  readonly x: number;
  readonly y: number;
}

/** Foundry's canvas element, in client coordinates. */
export interface BoardBox extends ClientPoint {
  readonly width: number;
  readonly height: number;
}

/**
 * Where Foundry's canvas is on screen.
 *
 * ⚠️ THROWS rather than returning a default when `#board` is absent, and the difference is the whole
 * reason this exists. Every caller uses the result as the origin of a gesture, so a fallback of
 * (0, 0) would press the top left corner of the window: a real press, on the wrong element, that
 * produces a plausible looking FAIL for whichever behaviour was under test. The check would then be
 * blaming the module for a world that never finished loading its canvas.
 *
 * Extracted 2026-08-12 from four scripts that each repeated the query, two of which were reading
 * `getBoundingClientRect` straight off a possibly null result.
 */
export async function boardBox(page: Page): Promise<BoardBox> {
  return page.evaluate(() => {
    const board = document.querySelector('#board');
    if (board === null) {
      throw new Error(
        'No #board in the page, so Foundry has no canvas to press. The world is probably still ' +
          'loading, or the join never completed.'
      );
    }
    const box = board.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  });
}

/** The middle of the canvas, which is where a gesture with no particular target belongs. */
export async function boardCentre(page: Page): Promise<ClientPoint> {
  const box = await boardBox(page);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Anything this creates in a live world is named with this prefix, so a crash that skips the cleanup
 * leaves something identifiable rather than a mystery scene.
 */
export const PROBE_PREFIX = '[probe]';

/**
 * Create a scene only if the world has no active one, and say which happened by returning the id to
 * delete or null. Extracted 2026-08-10 when the Android check became the second caller.
 *
 * The dimensions are a parameter and not a constant on purpose. The scene must be larger than the
 * viewport it will be judged in, because a scene that fits on screen loads at scale 1, and 1 is the
 * one value that hides an entire class of zoom bug: multiplying by it is indistinguishable from
 * ignoring it. That is why the pinch check asks for 4000 and why a phone viewport can be satisfied
 * by less. Callers that do not care get a size that is larger than a desktop window.
 */
export async function ensureActiveScene(
  page: Page,
  { width = 2000, height = 2000, label = 'canvas check' } = {}
) {
  const existing = await page.evaluate(() => globalThis.canvas?.ready === true);
  if (existing) {
    return null;
  }

  const id = await page.evaluate(
    async ({
      prefix,
      sceneWidth,
      sceneHeight,
      name,
    }: {
      prefix: string;
      sceneWidth: number;
      sceneHeight: number;
      name: string;
    }) => {
      const scene = await Scene.create({
        name: `${prefix} Tongs Browser ${name}`,
        width: sceneWidth,
        height: sceneHeight,
        grid: { size: 100 },
        padding: 0.25,
      });
      await scene.activate();
      return scene.id;
    },
    { prefix: PROBE_PREFIX, sceneWidth: width, sceneHeight: height, name: label }
  );

  await page.waitForFunction(() => globalThis.canvas?.ready === true, undefined, {
    timeout: 120_000,
  });

  return id;
}

/** Remove a scene created by ensureActiveScene. Safe to call with null. */
export async function removeProbeScene(page: Page, id: string | null): Promise<void> {
  if (id === null || id === undefined) {
    return;
  }
  await page
    .evaluate(async (sceneId) => {
      await game.scenes.get(sceneId)?.delete();
    }, id)
    .catch((error) => {
      console.error(`could not delete the probe scene ${id}: ${String(error)}`);
    });
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
