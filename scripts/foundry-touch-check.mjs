#!/usr/bin/env node
/**
 * Drive the module with REAL touch events, against a real Foundry. Added 2026-08-09.
 *
 * Run: npm run check:touch     (a Foundry must be running with a world launched)
 *
 * ADR 0005 measured that Foundry accepts the virtual pointer, but it drove `VirtualPointer` directly
 * through the module API. Everything upstream of that, `TouchBinder` and the gesture state machine,
 * had never seen a finger: the unit tests construct `TouchEvent` objects by hand, and jsdom has no
 * touch hardware at all.
 *
 * These touches are dispatched through Chrome DevTools Protocol, so they arrive with `isTrusted`
 * true, from the browser's own input pipeline, with the browser generating its own compatibility
 * pointer and mouse events alongside them exactly as a real tablet would. That last part matters as
 * much as the touches: suppressing those compatibility events is a real feature with a real failure
 * mode, and it cannot be exercised by any hand built event.
 *
 * ⚠️ WRITES TO A LIVE WORLD, same as the pointer check: creates a `[probe]` scene if the world has no
 *    active one, and deletes it in a finally.
 */
import {
  BASE,
  MODULE_ID,
  captureModuleLog,
  ensureModuleEnabled,
  joinWorld,
  launchBrowser,
  requireActiveWorld,
} from './foundry-session.mjs';

const PROBE_PREFIX = '[probe]';

/** Matches SettingDefinitions. Asserted loosely, but the direction and rough size come from these. */
const SENSITIVITY = 1.5;
const LONG_PRESS_MS = 500;

const results = [];

function record(name, passed, detail) {
  results.push({ name, passed, detail });
}

/**
 * A finger, driven through CDP rather than through Playwright's touchscreen helper.
 *
 * The helper can tap but cannot hold or drag, and both of those are gestures this module defines
 * behaviour for. Going to the protocol directly is the only way to control the timing between
 * touchStart and touchEnd, which is the entire difference between a tap and a long press.
 */
class Finger {
  constructor(client) {
    this.client = client;
  }

  async down(x, y) {
    await this.client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, id: 1 }],
    });
  }

  async moveTo(x, y) {
    await this.client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y, id: 1 }],
    });
  }

  async up() {
    await this.client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  /** A drag in steps, because one large jump is not what a finger does and not what the machine sees. */
  async drag(fromX, fromY, deltaX, deltaY, steps = 8) {
    await this.down(fromX, fromY);
    for (let step = 1; step <= steps; step += 1) {
      await this.moveTo(fromX + (deltaX * step) / steps, fromY + (deltaY * step) / steps);
    }
    await this.up();
  }
}

const pointerPosition = (page) =>
  page.evaluate((id) => {
    const position = game.modules.get(id).api.getPointer().getPosition();
    return { x: position.clientX, y: position.clientY };
  }, MODULE_ID);

/**
 * One finger drag moves the pointer, by roughly the drag distance times sensitivity.
 *
 * Asserted as a ratio inside a generous band rather than an exact figure. The pointer clamps at the
 * viewport edge and the gesture machine has a small movement threshold before it starts, so an exact
 * equality here would be a test of arithmetic that would fail for reasons that are not bugs.
 */
async function checkDragMovesPointer(page, finger, board) {
  const before = await pointerPosition(page);

  const deltaX = 200;
  const deltaY = 120;
  await finger.drag(board.x + board.width * 0.3, board.y + board.height * 0.5, deltaX, deltaY);

  const after = await pointerPosition(page);
  const movedX = after.x - before.x;
  const movedY = after.y - before.y;
  const ratioX = movedX / (deltaX * SENSITIVITY);

  record(
    'one finger drag moves the pointer',
    movedX > 0 && movedY > 0 && ratioX > 0.6 && ratioX < 1.2,
    `moved (${movedX.toFixed(0)}, ${movedY.toFixed(0)}) for a ${deltaX}x${deltaY} drag, ` +
      `x ratio ${ratioX.toFixed(2)} of the expected ${SENSITIVITY}x`
  );
}

/**
 * The single most important behavioural claim in the module, and the one a user notices instantly.
 *
 * MANUAL-TESTING puts it this way: "Tap clicks at the pointer, not where your finger landed. If it
 * clicks under your finger, something is wrong."
 *
 * So the pointer is parked on a sidebar tab, and the tap happens far away over the canvas. If the tab
 * changes, the click went to the pointer. If it does not, the click went to the finger, and the whole
 * trackpad model is broken. Judged by Foundry's own tab state.
 */
async function checkTapClicksAtPointerNotFinger(page, finger, board) {
  const before = await page.evaluate(() => ui.sidebar.tabGroups.primary);
  const target = before === 'combat' ? 'chat' : 'combat';

  const parked = await page.evaluate(
    ({ id, tab }) => {
      const button = document.querySelector(`button[data-tab="${tab}"]`);
      if (button === null) {
        return null;
      }
      const box = button.getBoundingClientRect();
      const centre = { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
      game.modules.get(id).api.getPointer().moveTo(centre);
      return centre;
    },
    { id: MODULE_ID, tab: target }
  );

  if (parked === null) {
    record('tap clicks at the pointer, not the finger', false, `no sidebar button for '${target}'`);
    return;
  }

  // Deliberately nowhere near the parked pointer, and over the canvas rather than over the chrome.
  const fingerX = board.x + board.width * 0.25;
  const fingerY = board.y + board.height * 0.75;
  await finger.down(fingerX, fingerY);
  await finger.up();

  const after = await page
    .waitForFunction((tab) => ui.sidebar.tabGroups.primary === tab, target, { timeout: 5000 })
    .then(() => target)
    .catch(async () => page.evaluate(() => ui.sidebar.tabGroups.primary));

  record(
    'tap clicks at the pointer, not the finger',
    after === target,
    `pointer parked at (${parked.clientX.toFixed(0)}, ${parked.clientY.toFixed(0)}), ` +
      `finger tapped (${fingerX.toFixed(0)}, ${fingerY.toFixed(0)}), tab ${before} -> ${after}`
  );
}

/**
 * A held finger becomes a right click at the pointer.
 *
 * Judged by listening for the contextmenu event rather than by looking for a Foundry menu, and that
 * limit is deliberate: an empty canvas has no token to open a HUD for, so a menu appearing is not
 * available as evidence here. What this does prove is that the long press timer fires under real
 * event timing, which no unit test with an injected clock can show.
 */
async function checkLongPressRightClicks(page, finger, board) {
  await page.evaluate(() => {
    globalThis.__probeContextMenus = [];
    document.addEventListener(
      'contextmenu',
      (event) => {
        globalThis.__probeContextMenus.push({ x: event.clientX, y: event.clientY });
        event.preventDefault();
      },
      { capture: true }
    );
  });

  const parked = await pointerPosition(page);

  await finger.down(board.x + board.width * 0.5, board.y + board.height * 0.5);
  await new Promise((resolve) => setTimeout(resolve, LONG_PRESS_MS + 300));
  await finger.up();

  const seen = await page.evaluate(() => globalThis.__probeContextMenus);
  const atPointer = seen.some(
    (point) => Math.abs(point.x - parked.x) < 2 && Math.abs(point.y - parked.y) < 2
  );

  record(
    'long press produces a right click at the pointer',
    seen.length > 0 && atPointer,
    `${seen.length} contextmenu event(s) ${JSON.stringify(seen)}, pointer at ` +
      `(${parked.x.toFixed(0)}, ${parked.y.toFixed(0)})`
  );
}

/**
 * The browser's own touch derived pointer events must not reach Foundry.
 *
 * If they do, every gesture is seen twice: once as the module intends and once as the browser's
 * compatibility event, and Foundry acts on both. This is the failure that no hand built event can
 * reproduce, because only a genuine touch makes the browser emit the compatibility pair.
 *
 * Counted at the document in the BUBBLE phase, which is where Foundry's own listeners sit. The module
 * stops these in the capture phase, so anything counted here got past it.
 */
async function checkNativeTouchSuppressed(page, finger, board) {
  await page.evaluate((virtualId) => {
    globalThis.__probeLeaked = [];
    document.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch' && event.pointerId !== virtualId) {
        globalThis.__probeLeaked.push({ id: event.pointerId, type: event.pointerType });
      }
    });
  }, 9001);

  await finger.drag(board.x + board.width * 0.5, board.y + board.height * 0.5, 60, 40, 4);

  const leaked = await page.evaluate(() => globalThis.__probeLeaked);

  record(
    'native touch pointer events never reach foundry',
    leaked.length === 0,
    leaked.length === 0 ? 'none leaked past the capture phase' : JSON.stringify(leaked)
  );
}

async function ensureActiveScene(page) {
  if (await page.evaluate(() => globalThis.canvas?.ready === true)) {
    return null;
  }

  const id = await page.evaluate(async (prefix) => {
    const scene = await Scene.create({
      name: `${prefix} Tongs Browser touch check`,
      width: 2000,
      height: 2000,
      grid: { size: 100 },
      padding: 0.25,
    });
    await scene.activate();
    return scene.id;
  }, PROBE_PREFIX);

  await page.waitForFunction(() => globalThis.canvas?.ready === true, undefined, {
    timeout: 120_000,
  });

  return id;
}

async function main() {
  const status = await requireActiveWorld();
  const { browser, page } = await launchBrowser({ hasTouch: true });
  const log = captureModuleLog(page);
  let createdScene = null;

  try {
    await joinWorld(page);
    await ensureModuleEnabled(page);
    createdScene = await ensureActiveScene(page);

    const touchable = await page.evaluate(() => 'ontouchstart' in window);
    record(
      'browser context reports touch support',
      touchable,
      `ontouchstart in window = ${touchable}`
    );

    const client = await page.context().newCDPSession(page);
    const finger = new Finger(client);

    const board = await page.evaluate(() => {
      const box = document.querySelector('#board').getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    });

    await checkDragMovesPointer(page, finger, board);
    await checkTapClicksAtPointerNotFinger(page, finger, board);
    await checkLongPressRightClicks(page, finger, board);
    await checkNativeTouchSuppressed(page, finger, board);

    const errors = log.filter((line) => line.startsWith('pageerror') || line.startsWith('error'));
    record('no page errors from the module', errors.length === 0, errors.join(' | ') || 'none');
  } finally {
    if (createdScene !== null) {
      await page
        .evaluate(async (id) => {
          await game.scenes.get(id)?.delete();
        }, createdScene)
        .catch((error) => {
          console.error(`could not delete the probe scene ${createdScene}: ${String(error)}`);
        });
    }
    await browser.close();
  }

  console.log(
    JSON.stringify(
      { target: BASE, world: status.world, core: status.version, results, log },
      null,
      2
    )
  );

  for (const result of results) {
    console.error(`${result.passed ? 'PASS' : 'FAIL'}  ${result.name}: ${result.detail}`);
  }

  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.error(`\n${failed.length} of ${results.length} touch checks failed.`);
    process.exitCode = 1;
  }
}

await main();
