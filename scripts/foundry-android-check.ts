/**
 * What the module actually does on a real Android browser. Written 2026-08-10.
 *
 * Every other check in this repo drives desktop Chrome and synthesises the Android-ness: a touch
 * context, a narrow viewport, injected touch events. This one drives Chrome running on an actual
 * Android device or emulator, over the DevTools socket adb forwards, so the viewport is a real phone
 * viewport and the touchscreen is real hardware. That distinction matters more than it sounds,
 * because the module's whole reason to exist is a screen too small for Foundry's own stated minimum,
 * and a desktop window resized to 412px is not the same thing as a device that is 412px.
 *
 * Prerequisites, and the script says so rather than failing obscurely if they are missing:
 *
 *   adb forward tcp:9222 localabstract:chrome_devtools_remote
 *   FOUNDRY_URL=http://10.0.2.2:30000   (how the DEVICE reaches the host; 10.0.2.2 on an emulator)
 *   FOUNDRY_HOST_URL=http://localhost:30000   (how THIS process reaches the host; usually the default)
 *
 * ⚠️ WRITES TO A LIVE WORLD. It creates a `[probe]` scene if the world has none, and it moves the
 *    modifier bar to its default position so that the geometry checks judge the shipped default
 *    rather than wherever the bar was last dragged. Both are restored in a finally.
 */
import {
  BASE,
  HOST_BASE,
  connectAndroidBrowser,
  ensureModuleEnabled,
  joinWorld,
  removeProbeScene,
  requireActiveWorld,
} from './foundry-session.ts';
import { runCanvasChecks } from './android/CanvasChecks.js';
import { removeProbeTokens } from './android/ProbeTokens.js';
import { moveBarToDefault, restoreBarPosition } from './android/BarSetting.js';
import { checkKeyboardStrategy } from './android/CheckKeyboard.js';
import { record, results } from './android/CheckResults.js';
import { insideViewport, overlaps, readGeometry } from './android/Geometry.js';
import {
  captureAttributedErrors,
  captureLog,
  installFontDecodeShim,
} from './android/PageObservers.js';

async function main() {
  const status = await requireActiveWorld();
  const { browser, page, device } = await connectAndroidBrowser();

  const log = captureLog(page);
  const errors = captureAttributedErrors(page);
  let createdScene = null;
  let originalBarPosition = null;
  let probeTokens = null;

  try {
    record(
      'the browser under test really is Android with a touchscreen',
      /Android/.test(device.userAgent) && device.maxTouchPoints > 0,
      `${device.width}x${device.height} at dpr ${device.devicePixelRatio}, ${device.maxTouchPoints} touch points, ${device.userAgent}`
    );

    await installFontDecodeShim(page);
    await joinWorld(page);
    await ensureModuleEnabled(page);

    const swallowed = await page.evaluate(() => globalThis.__tbSwallowedFonts ?? []);
    record(
      'the harness font shim is reported rather than hidden',
      true,
      swallowed.length === 0
        ? 'no font decode failures on this browser, so the shim did nothing'
        : `compensated for ${swallowed.length} Chromium font decode failure(s), none of them this module's: ${swallowed.join('; ')}`
    );

    record(
      'the viewport is genuinely smaller than the minimum Foundry asks for',
      device.width < 1024,
      `${device.width}x${device.height}, against Foundry's stated 1024x768 minimum, which is the situation this module exists for`
    );

    originalBarPosition = await moveBarToDefault(page);

    await checkKeyboardStrategy(page, log);

    const geometry = await readGeometry(page);

    record(
      'the scene control toggle exists in the tokens group',
      geometry.toggle !== null,
      geometry.toggle === null
        ? 'no element with our data-tool attribute'
        : `at (${Math.round(geometry.toggle.x)}, ${Math.round(geometry.toggle.y)})`
    );

    record(
      'the scene control toggle is actually reachable at phone width',
      geometry.toggleReachable === true,
      `hit test at its centre finds ${geometry.toggleTopmost}`
    );

    record(
      'the scene control toggle is on screen',
      insideViewport(geometry.toggle, geometry.viewport),
      geometry.toggle === null
        ? 'absent'
        : `right edge ${Math.round(geometry.toggle.right)} against a viewport ${geometry.viewport.width} wide`
    );

    record(
      'the modifier bar at its default position does not cover the toggle',
      !overlaps(geometry.bar, geometry.toggle),
      geometry.bar === null
        ? 'no modifier bar'
        : `bar x ${Math.round(geometry.bar.x)}-${Math.round(geometry.bar.right)}, toggle x ${Math.round(geometry.toggle?.x ?? 0)}-${Math.round(geometry.toggle?.right ?? 0)}`
    );

    const offscreen = geometry.barControls.filter((c) => !insideViewport(c, geometry.viewport));
    record(
      'every modifier bar control is on screen at phone width',
      geometry.barControls.length > 0 && offscreen.length === 0,
      geometry.barControls.length === 0
        ? 'the bar rendered no controls at all'
        : `${geometry.barControls.length} controls, ${offscreen.length} off screen` +
            (offscreen.length > 0
              ? `: ${offscreen.map((c) => `${c.label} at x ${Math.round(c.x)}-${Math.round(c.right)}`).join(', ')}`
              : '')
    );

    const debris = await runCanvasChecks(page);
    createdScene = debris.scene;
    probeTokens = debris.tokens;

    const ours = errors.filter(
      (e) => /tongs-browser/.test(e.stack) || /tongs-browser/.test(e.message)
    );
    const theirs = errors.filter((e) => !ours.includes(e));
    record(
      'no page errors come from this module',
      ours.length === 0,
      ours.length === 0
        ? `none from us; ${theirs.length} from elsewhere on the page` +
            (theirs.length > 0
              ? ` (${[...new Set(theirs.map((e) => e.message))].join(' | ')})`
              : '')
        : ours.map((e) => e.message).join(' | ')
    );
  } finally {
    await restoreBarPosition(page, originalBarPosition);
    // Tokens before the scene, since deleting the scene first would orphan the delete.
    await removeProbeTokens(page, probeTokens);
    await removeProbeScene(page, createdScene);
    await browser.close();
  }

  console.log(
    JSON.stringify(
      {
        device: BASE,
        host: HOST_BASE,
        world: status.world,
        core: status.version,
        results,
        log,
      },
      null,
      2
    )
  );

  const skipped = results.filter((r) => r.passed === null);
  const failed = results.filter((r) => r.passed === false);

  for (const result of results) {
    const label = result.passed === null ? 'SKIP' : result.passed ? 'PASS' : 'FAIL';
    console.error(`${label}  ${result.name}: ${result.detail}`);
  }
  if (skipped.length > 0) {
    console.error(`\n${skipped.length} check(s) could not run. A skip is not a pass.`);
  }

  process.exitCode = failed.length > 0 ? 1 : 0;
}

await main();
