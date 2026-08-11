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

const results = [];

function record(name, passed, detail) {
  results.push({ name, passed, detail });
}

/** The overlays exist at all. Everything below is meaningless if they do not. */
async function checkOverlaysAttached(page) {
  const found = await page.evaluate(() => ({
    cursor: document.querySelectorAll('.tb-cursor').length,
    bar: document.querySelectorAll('.tb-modifier-bar').length,
    keys: document.querySelectorAll('.tb-key').length,
  }));

  record(
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
async function checkCursorNotHitTestable(page) {
  const outcome = await page.evaluate(() => {
    const cursor = document.querySelector('.tb-cursor');
    const box = cursor.getBoundingClientRect();
    const points = [
      [box.left + box.width / 2, box.top + box.height / 2],
      [box.left + 1, box.top + 1],
      [box.right - 1, box.bottom - 1],
    ];
    const hits = points.map(([x, y]) => document.elementFromPoint(x, y)?.className ?? 'null');
    return { hits, anyCursor: hits.some((c) => String(c).includes('tb-cursor')) };
  });

  record('cursor is never hit testable', !outcome.anyCursor, outcome.hits.join(' | '));
}

/**
 * The HTML chrome half: does Foundry's own click handling accept a synthesised click.
 *
 * Asserted against ui.sidebar.tabGroups rather than against a CSS class, because that is Foundry's
 * own record of which tab is active. A class check would pass on a tab that merely looks selected.
 */
async function checkChromeRespondsToClick(page) {
  const before = await page.evaluate(() => ui.sidebar.tabGroups.primary);
  const target = before === 'combat' ? 'chat' : 'combat';

  const moved = await page.evaluate(
    ({ id, tab }) => {
      const button = document.querySelector(`button[data-tab="${tab}"]`);
      if (button === null) {
        return { ok: false, reason: `no sidebar button for '${tab}'` };
      }
      const box = button.getBoundingClientRect();
      const pointer = game.modules.get(id).api.getPointer();
      pointer.moveTo({ clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 });
      const over = pointer.getCurrentTarget();
      pointer.leftClick();
      return { ok: true, hovered: over?.dataset?.tab ?? over?.tagName ?? null };
    },
    { id: MODULE_ID, tab: target }
  );

  if (!moved.ok) {
    record('foundry chrome responds to a synthesised click', false, moved.reason);
    return;
  }

  // Polled rather than slept: the tab switch is synchronous today, and a fixed wait would be both
  // slower than needed and silently wrong if it ever stops being.
  const after = await page
    .waitForFunction((tab) => ui.sidebar.tabGroups.primary === tab, target, { timeout: 5000 })
    .then(() => target)
    .catch(async () => page.evaluate(() => ui.sidebar.tabGroups.primary));

  record(
    'foundry chrome responds to a synthesised click',
    after === target,
    `hovered=${moved.hovered} tab ${before} -> ${after} (wanted ${target})`
  );
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
async function checkCanvasRespondsToMove(page) {
  const outcome = await page.evaluate((id) => {
    const board = document.querySelector('#board');
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

  record(
    'pixi canvas tracks a synthesised pointer move',
    outcome.moved,
    `hit=#${outcome.target} ${JSON.stringify(outcome.first)} -> ${JSON.stringify(outcome.second)}`
  );
}

/**
 * The scene control toggle exists, and toggling it actually turns the module off and on.
 *
 * This is the module's escape hatch: if the pointer misbehaves mid session, reaching the settings
 * dialog means using the pointer to get there, which is the thing that is not working. So it is the
 * one control that has to work when nothing else does.
 *
 * It was completely absent on Foundry 14 until 2026-08-09, for two independent reasons, both
 * measured rather than guessed: the hook was registered at `ready` when Foundry builds the controls
 * exactly once before that, and the group is called `tokens` while the code looked for `token`.
 *
 * Judged by Foundry's own control state AND by the DOM, because either alone can lie: the state can
 * hold a tool that never renders, and a rendered button can be a leftover.
 */
async function checkSceneControlToggle(page) {
  const present = await page.evaluate((id) => {
    const groups = ui.controls.controls;
    const inGroup = Object.entries(groups).find(([, group]) =>
      Object.keys(group.tools ?? {}).includes(id)
    );
    return {
      group: inGroup?.[0] ?? null,
      groupNames: Object.keys(groups),
      inDom: document.querySelectorAll(`[data-tool="${id}"]`).length,
    };
  }, MODULE_ID);

  record(
    'scene control toggle is registered in the tokens group',
    present.group === 'tokens',
    `found in ${present.group ?? 'no group'}, of ${present.groupNames.join(', ')}`
  );

  record(
    'scene control toggle is rendered in the toolbar',
    present.inDom === 1,
    `${present.inDom} element(s) matching [data-tool="${MODULE_ID}"]`
  );

  if (present.inDom !== 1) {
    return;
  }

  /*
   * The toggle must not merely exist, it must be REACHABLE.
   *
   * At the default bar position of x 16 it was not. Measured on 14.365: the scene control toolbar
   * runs x 12 to 66 down the left edge, the bar was 445x54 at (16, 120), and the toggle at x 42 to
   * 66, y 132 to 156 was entirely underneath it. elementFromPoint at the toggle's centre returned
   * the bar's own collapse button, so a real finger could never have hit it.
   *
   * Judged by hit testing rather than by comparing rectangles, because that is the question a finger
   * asks. The default moved to x 88 to clear the toolbar.
   */
  const reachable = await page.evaluate((id) => {
    const button = document.querySelector(`[data-tool="${id}"]`);
    const box = button.getBoundingClientRect();
    const topmost = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return {
      topmost: topmost ? `${topmost.tagName.toLowerCase()}.${String(topmost.className)}` : null,
      isTheToggle: button === topmost || button.contains(topmost),
    };
  }, MODULE_ID);

  record(
    'the scene control toggle is not covered by the modifier bar',
    reachable.isTheToggle,
    `topmost element at the toggle's centre is ${reachable.topmost}`
  );

  /*
   * Invoked through the tool's own onChange, which is the callback Foundry calls, rather than by
   * clicking the button.
   *
   * ⚠️ THE LIMIT IS DELIBERATE AND WORTH STATING. This proves the wiring behind the button is
   * correct: the callback Foundry will invoke does flip the module and persist the setting. It does
   * NOT prove Foundry's own click routing reaches that callback, because a synthetic mouse click on
   * the button was measured not to trigger its data-action="tool" handler, which is a limitation of
   * the harness rather than a finding about the module.
   *
   * Reachability, the part a finger cares about, is asked separately above by hit testing. Between
   * the two, the only thing left unproven is Foundry's internal dispatch, which is Foundry's to get
   * right and which the device checklist still exercises.
   *
   * Toggled twice, so the world's saved setting ends where it started.
   */
  const before = await page.evaluate((id) => game.modules.get(id).api.isEnabled(), MODULE_ID);

  const fire = async () => {
    await page.evaluate((id) => {
      ui.controls.controls.tokens?.tools?.[id]?.onChange?.();
    }, MODULE_ID);
    await page.waitForTimeout(400);
    return page.evaluate((id) => game.modules.get(id).api.isEnabled(), MODULE_ID);
  };

  const middle = await fire();
  const after = await fire();

  record(
    'the scene control toggle actually toggles the module',
    middle === !before && after === before,
    `enabled ${before} -> ${middle} -> ${after}, so it flipped and came back`
  );
}

async function main() {
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

    await checkOverlaysAttached(page);
    await checkCursorNotHitTestable(page);
    await checkChromeRespondsToClick(page);
    await checkSceneControlToggle(page);

    createdScene = await ensureActiveScene(page);
    await checkCanvasRespondsToMove(page);

    const errors = log.filter((line) => line.startsWith('pageerror') || line.startsWith('error'));
    record('no page errors from the module', errors.length === 0, errors.join(' | ') || 'none');
  } finally {
    await removeProbeScene(page, createdScene);
    await browser.close();
  }

  const failed = results.filter((r) => !r.passed);

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

  if (failed.length > 0) {
    console.error(`\n${failed.length} of ${results.length} live checks failed.`);
    process.exitCode = 1;
  }
}

await main();
