#!/usr/bin/env node
/**
 * Does a real Foundry actually respond to the virtual pointer. Added 2026-08-09.
 *
 * Run: npm run check:foundry     (a Foundry must be running with a world launched)
 *
 * ADR 0004 settled the keyboard half of the trust question: Foundry honours synthesised
 * KeyboardEvents. The pointer half was still open, and it is two questions rather than one, because
 * Foundry has two interaction surfaces that fail independently (ADR 0003):
 *
 *   - the HTML chrome, ordinary DOM elements with ordinary listeners
 *   - the canvas, WebGL with PIXI doing its own hit testing
 *
 * A pointer that drives one and not the other produces the module's worst failure mode: the interface
 * works and the board does not, with nothing in the console either way. So both are exercised here,
 * separately, and each reports its own verdict.
 *
 * ⚠️ THIS WRITES TO A LIVE WORLD. It creates a scene, because the canvas check needs one and a world
 *    can legitimately have none. Everything it creates is named with PROBE_PREFIX and deleted in a
 *    finally block, so anything a crash leaves behind is identifiable and safe to remove by hand.
 */
import type { Page } from 'playwright';

import { createRecorder, describeOutcome, isFailure, type Recorder } from './live/recorder.ts';
import { checkChromeRespondsToClick } from './live/chromeChecks.ts';
import { checkSceneControlToggle } from './live/sceneControlChecks.ts';
import {
  BASE,
  MODULE_ID,
  captureModuleLog,
  ensureActiveScene,
  ensureModuleEnabled,
  joinWorld,
  launchBrowser,
  removeProbeScene,
  requireActiveWorld,
} from './foundry-session.ts';

/**
 * One check outcome.
 *
 * `passed: null` is a SKIP and is deliberately not a boolean, so a skip can never be mistaken for a
 * pass by a reader or by a filter. See the skip helper for why that distinction is load bearing.
 */
/** The overlays exist at all. Everything below is meaningless if they do not. */
async function checkOverlaysAttached(page: Page, recorder: Recorder) {
  const found = await page.evaluate(() => ({
    cursor: document.querySelectorAll('.tb-cursor').length,
    bar: document.querySelectorAll('.tb-modifier-bar').length,
    keys: document.querySelectorAll('.tb-key').length,
  }));

  recorder.record(
    'overlays attached',
    found.cursor === 1 && found.bar === 1 && found.keys > 0,
    `cursor=${found.cursor} bar=${found.bar} keys=${found.keys}`
  );
}

/**
 * The cursor must never be what the hit test finds.
 *
 * Unit tested already, but against a stub layout. Foundry stacks a lot of positioned elements and
 * this is the one property whose failure would make every click land on the cursor itself.
 */
async function checkCursorNotHitTestable(page: Page, recorder: Recorder) {
  const outcome = await page.evaluate(() => {
    const cursor = document.querySelector('.tb-cursor');
    if (cursor === null) {
      // Naming what is missing beats a TypeError from the next line. An absent cursor is a real
      // outcome, the module not having rendered, and it must not read as a failed hit test.
      throw new Error('no .tb-cursor in the document: the module has not drawn its pointer.');
    }
    const box = cursor.getBoundingClientRect();
    // Tuples rather than arrays, so destructuring gives numbers instead of number | undefined.
    const points: [number, number][] = [
      [box.left + box.width / 2, box.top + box.height / 2],
      [box.left + 1, box.top + 1],
      [box.right - 1, box.bottom - 1],
    ];
    const hits = points.map(([x, y]) => document.elementFromPoint(x, y)?.className ?? 'null');
    return { hits, anyCursor: hits.some((c) => String(c).includes('tb-cursor')) };
  });

  recorder.record('cursor is never hit testable', !outcome.anyCursor, outcome.hits.join(' | '));
}

/**
 * The canvas half: does PIXI update Foundry's own mouse position from a synthesised pointer move.
 *
 * canvas.mousePosition is Foundry's translated copy of where PIXI believes the pointer is. If that
 * moves, the whole canvas interaction path accepted the event. If it does not, hover and clicks on
 * the board are dead no matter how correct they look in the DOM.
 *
 * Asserted as a CHANGE from the previous value rather than against an expected coordinate, because
 * the scene to screen transform depends on zoom and padding, and hardcoding a number would be a test
 * of the arithmetic in this file rather than of Foundry.
 */
async function checkCanvasRespondsToMove(page: Page, recorder: Recorder) {
  const outcome = await page.evaluate((id) => {
    const board = document.querySelector('#board');
    if (board === null) {
      throw new Error('no #board in the document: Foundry has not drawn its canvas.');
    }
    const box = board.getBoundingClientRect();
    const pointer = game.modules.get(id).api.getPointer();

    const before = { x: canvas.mousePosition.x, y: canvas.mousePosition.y };
    pointer.moveTo({ clientX: box.left + box.width * 0.4, clientY: box.top + box.height * 0.4 });
    const first = { x: canvas.mousePosition.x, y: canvas.mousePosition.y };
    pointer.moveTo({ clientX: box.left + box.width * 0.6, clientY: box.top + box.height * 0.6 });
    const second = { x: canvas.mousePosition.x, y: canvas.mousePosition.y };

    return {
      before,
      first,
      second,
      target: document.elementFromPoint(box.left + box.width * 0.6, box.top + box.height * 0.6)?.id,
      moved: first.x !== second.x || first.y !== second.y,
    };
  }, MODULE_ID);

  recorder.record(
    'pixi canvas tracks a synthesised pointer move',
    outcome.moved,
    `hit=#${outcome.target} ${JSON.stringify(outcome.first)} -> ${JSON.stringify(outcome.second)}`
  );
}

async function main() {
  const recorder = createRecorder();
  const { record, results } = recorder;
  const status = await requireActiveWorld();
  const { browser, page } = await launchBrowser();
  const log = captureModuleLog(page);
  let createdScene = null;

  try {
    await joinWorld(page);
    await ensureModuleEnabled(page);

    const enabled = await page.evaluate(
      (id) => game.modules.get(id)?.api?.isEnabled() ?? false,
      MODULE_ID
    );
    record('module is enabled', enabled, `api.isEnabled() = ${enabled}`);

    await checkOverlaysAttached(page, recorder);
    await checkCursorNotHitTestable(page, recorder);
    await checkChromeRespondsToClick(page, recorder);
    await checkSceneControlToggle(page, recorder);

    createdScene = await ensureActiveScene(page);
    await checkCanvasRespondsToMove(page, recorder);

    const errors = log.filter((line) => line.startsWith('pageerror') || line.startsWith('error'));
    record('no page errors from the module', errors.length === 0, errors.join(' | ') || 'none');
  } finally {
    await removeProbeScene(page, createdScene);
    await browser.close();
  }

  const failed = results.filter(isFailure);

  console.log(
    JSON.stringify(
      { target: BASE, world: status.world, core: status.version, results, log },
      null,
      2
    )
  );

  for (const result of results) {
    console.error(`${describeOutcome(result)}  ${result.name}: ${result.detail}`);
  }

  if (failed.length > 0) {
    console.error(`\n${failed.length} of ${results.length} live checks failed.`);
    process.exitCode = 1;
  }
}

await main();
