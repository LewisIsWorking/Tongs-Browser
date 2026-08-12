import { chromium, type ConsoleMessage, type Page } from 'playwright';

/**
 * Getting a browser in front of a live Foundry, desktop or phone. Extracted from foundry-session
 * 2026-08-12.
 *
 * Extracted because that file reached 398 lines against a hard 200 limit, and because these three
 * are the only part of it that owns a PROCESS rather than a step. A desktop launch and an Android
 * attach fail in entirely different ways and neither failure has anything to do with Foundry.
 */

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
