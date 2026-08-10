#!/usr/bin/env node
/**
 * Two finger pan and pinch, against a real Foundry canvas. Added 2026-08-09.
 *
 * Run: npm run check:multitouch     (a Foundry must be running with a world launched)
 *
 * ADR 0006 covered single finger touch and named multi touch as the remaining gap. Closing it found
 * a real bug on the first attempt, which is recorded in ADR 0007: the pinch was building on a
 * remembered scale of 1 rather than on the scale the canvas was actually at, so the first pinch of
 * every session lurched by a factor of 1/initialScale.
 *
 * That is why the pinch assertion here is a RATIO between the scale before and after, compared
 * against the ratio the fingers moved. An assertion against an absolute scale would have passed
 * happily while the canvas jumped, because the number it jumped to was itself perfectly predictable.
 *
 * ⚠️ WRITES TO A LIVE WORLD: creates a `[probe]` scene when there is no active one, deletes it in a
 *    finally.
 */
import {
  BASE,
  captureModuleLog,
  ensureActiveScene,
  ensureModuleEnabled,
  joinWorld,
  launchBrowser,
  removeProbeScene,
  requireActiveWorld,
} from './foundry-session.mjs';
import { Hand } from './foundry-touch.mjs';

const results = [];

function record(name, passed, detail) {
  results.push({ name, passed, detail });
}

const viewport = (page) =>
  page.evaluate(() => ({
    scale: canvas.stage.scale.x,
    pivot: { x: canvas.stage.pivot.x, y: canvas.stage.pivot.y },
  }));

/**
 * Two fingers moving together pan the canvas, and the map moves WITH the fingers.
 *
 * Foundry's pivot is the point the viewport is centred on, so dragging the map right means the pivot
 * moves left. Asserted as a sign rather than a magnitude, because the pixel to scene conversion
 * depends on the current zoom and pinning it would test the arithmetic rather than the behaviour.
 */
async function checkTwoFingerPan(page, hand, centre) {
  const before = await viewport(page);

  const gap = 80;
  const start = [
    { x: centre.x - gap, y: centre.y },
    { x: centre.x + gap, y: centre.y },
  ];
  await hand.start(start);
  for (let step = 1; step <= 6; step += 1) {
    const shift = (120 * step) / 6;
    await hand.move(start.map((point) => ({ x: point.x + shift, y: point.y + shift })));
  }
  await hand.end();

  const after = await viewport(page);
  const movedX = after.pivot.x - before.pivot.x;
  const movedY = after.pivot.y - before.pivot.y;

  record(
    'two finger drag pans the canvas, map following the fingers',
    movedX < 0 && movedY < 0,
    `fingers moved +120,+120 and the pivot moved (${movedX.toFixed(0)}, ${movedY.toFixed(0)}), ` +
      `which should be negative on both axes`
  );

  record(
    'panning does not change the zoom',
    Math.abs(after.scale - before.scale) < 1e-6,
    `scale ${before.scale} -> ${after.scale}`
  );
}

/**
 * A pinch scales the canvas RELATIVE to where it already was.
 *
 * This is the regression guard for ADR 0007. Before the fix, a canvas sitting at 0.5 took a 1.6x
 * pinch and landed on 1.6, a jump of 3.2x, because the controller multiplied the ratio onto a
 * remembered 1 and applied the result absolutely.
 */
async function checkPinchIsRelative(page, hand, centre) {
  const before = await viewport(page);

  const startGap = 100;
  const endGap = 160;
  const fingerRatio = endGap / startGap;

  await hand.start([
    { x: centre.x - startGap, y: centre.y },
    { x: centre.x + startGap, y: centre.y },
  ]);
  await hand.move([
    { x: centre.x - endGap, y: centre.y },
    { x: centre.x + endGap, y: centre.y },
  ]);
  await hand.end();

  const after = await viewport(page);
  const appliedRatio = after.scale / before.scale;
  const error = Math.abs(appliedRatio - fingerRatio) / fingerRatio;

  record(
    'pinch scales relative to where the canvas already was',
    error < 0.05,
    `scale ${before.scale} -> ${after.scale}, applied ratio ${appliedRatio.toFixed(3)} against a ` +
      `finger ratio of ${fingerRatio.toFixed(3)}, error ${(error * 100).toFixed(1)}%`
  );

  return after;
}

/** Pinching back in returns roughly where it started, so the two directions agree. */
async function checkPinchIsReversible(page, hand, centre, beforePinch) {
  await hand.start([
    { x: centre.x - 160, y: centre.y },
    { x: centre.x + 160, y: centre.y },
  ]);
  await hand.move([
    { x: centre.x - 100, y: centre.y },
    { x: centre.x + 100, y: centre.y },
  ]);
  await hand.end();

  const after = await viewport(page);
  const drift = Math.abs(after.scale - beforePinch.scale) / beforePinch.scale;

  record(
    'pinching back in returns to roughly the starting zoom',
    drift < 0.05,
    `back to ${after.scale.toFixed(4)} from a start of ${beforePinch.scale.toFixed(4)}, ` +
      `drift ${(drift * 100).toFixed(1)}%`
  );
}

async function main() {
  const status = await requireActiveWorld();
  const { browser, page } = await launchBrowser({ hasTouch: true });
  const log = captureModuleLog(page);
  let createdScene = null;

  try {
    await joinWorld(page);
    await ensureModuleEnabled(page);
    // 4000 deliberately: larger than the viewport, so Foundry fits it and the canvas does NOT start
    // at 1. A scene that happened to load at 1 would hide the very bug this file exists to guard.
    createdScene = await ensureActiveScene(page, {
      width: 4000,
      height: 4000,
      label: 'multitouch check',
    });

    const client = await page.context().newCDPSession(page);
    const hand = new Hand(client);

    const start = await viewport(page);
    record(
      'the scene does not start at 1x, so a relative pinch is measurable',
      Math.abs(start.scale - 1) > 0.01,
      `canvas loaded at ${start.scale}`
    );

    const board = await page.evaluate(() => {
      const box = document.querySelector('#board').getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    });

    await checkTwoFingerPan(page, hand, board);
    const afterPinch = await checkPinchIsRelative(page, hand, board);
    await checkPinchIsReversible(page, hand, board, { scale: afterPinch.scale / (160 / 100) });

    const errors = log.filter((line) => line.startsWith('pageerror') || line.startsWith('error'));
    record('no page errors from the module', errors.length === 0, errors.join(' | ') || 'none');
  } finally {
    await removeProbeScene(page, createdScene);
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
    console.error(`\n${failed.length} of ${results.length} multitouch checks failed.`);
    process.exitCode = 1;
  }
}

await main();
