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
import type { Page } from 'playwright';
import {
  BASE,
  HOST_BASE,
  MODULE_ID,
  connectAndroidBrowser,
  PROBE_PREFIX,
  ensureActiveScene,
  ensureModuleEnabled,
  joinWorld,
  removeProbeScene,
  requireActiveWorld,
} from './foundry-session.ts';
import { Finger } from './foundry-touch.ts';

/** Matches DEFAULT_POSITION in src/modifiers/ModifierBar.ts. */
const DEFAULT_BAR_POSITION = { x: 88, y: 120 };

/**
 * One check outcome.
 *
 * `passed: null` is a SKIP and is deliberately not a boolean, so a skip can never be mistaken for a
 * pass by a reader or by a filter. See the skip helper for why that distinction is load bearing.
 */
interface CheckResult {
  readonly name: string;
  readonly passed: boolean | null;
  readonly detail: string;
}

/**
 * A Foundry token, described only as far as this harness reads it.
 *
 * Deliberately partial. Foundry ships no types and its Token surface is enormous, so a fuller
 * interface would be a second description of somebody else's object, drifting with every release.
 * Naming the handful of fields actually touched says what the harness depends on and nothing more.
 */
interface FoundryToken {
  id: string;
  name: string;
  center: { x: number; y: number };
  document: { x: number; y: number; update: (data: unknown) => Promise<unknown> };
  nameplate?: { visible?: boolean };
  control: (options?: { releaseOthers?: boolean }) => void;
}

const results: CheckResult[] = [];

function record(name: string, passed: boolean, detail: string): void {
  results.push({ name, passed, detail });
}

/**
 * A skip is recorded as its own outcome, never as a pass.
 *
 * The emulator image available here runs Chromium 133 against a Foundry that wants 146, so a canvas
 * that never becomes ready is a plausible outcome rather than an impossible one. Reporting that as
 * green would be the worst available answer: it would claim coverage of exactly the gesture work
 * that is hardest to verify and easiest to break.
 */
function skip(name: string, reason: string): void {
  results.push({ name, passed: null, detail: `SKIPPED: ${reason}` });
}

/**
 * Page errors, kept with their stacks so they can be attributed.
 *
 * Attribution is the point. Foundry 14.365 calls RegExp.escape, which Chromium only shipped in 136,
 * so on an older device Foundry throws errors of its own before this module does anything at all.
 * Failing on every page error would blame us for the browser; ignoring every page error would blind
 * the check. Matching the stack against our own bundle name splits them correctly.
 */
function captureAttributedErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push({ message: error.message, stack: error.stack ?? '' });
  });
  return errors;
}

/**
 * Compensate for a Chromium font bug that has nothing to do with this module, and say so out loud.
 *
 * Measured 2026-08-10 on the coo_phone emulator, Chromium 133 against Foundry 14.365:
 * fonts/fontawesome/webfonts/fa-duotone-900.woff2 downloads perfectly, HTTP 200 and 326,968 bytes,
 * and then fails to decode. Chromium reports an OTS font parse failure as
 * `NetworkError: A network error occurred.`, which is why this reads as a connectivity problem and
 * is not one. Its sibling fonts decode fine, so it is that one WOFF2 and that one browser version.
 *
 * Foundry does not catch the resulting rejection, so startup stops: game.ready stays false forever
 * while the interface renders completely, which looks exactly like a module having broken the world.
 * Proven by experiment rather than assumed: swallowing only this rejection takes ready from
 * never-true to true in ten seconds, canvas included.
 *
 * The shim is deliberately narrow. It swallows font decode failures and nothing else, it is applied
 * only by this Android harness and never by the module or by any other check, and every font it
 * swallows is reported as a check result. An environment fix that hides itself would be worse than
 * the bug, because every later result would rest on it silently.
 */
async function installFontDecodeShim(page: Page) {
  await page.addInitScript(() => {
    globalThis.__tbSwallowedFonts = [];
    const original = FontFace.prototype.load;
    FontFace.prototype.load = function patched(...args) {
      return original.apply(this, args).catch((error) => {
        globalThis.__tbSwallowedFonts.push(`${this.family}: ${error.name}: ${error.message}`);
        return this;
      });
    };
  });
}

function captureLog(page: Page) {
  const log: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (text.includes('Tongs Browser')) {
      log.push(`${message.type()}: ${text}`);
    }
  });
  return log;
}

/** Geometry of the things the user has to be able to hit, measured in the live page. */
function readGeometry(page: Page) {
  return page.evaluate((id) => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const toggle = document.querySelector(`[data-tool="${id}"]`);
    const bar = document.querySelector('.tb-modifier-bar');

    let reachable = null;
    let topmost = null;
    if (toggle) {
      const r = toggle.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      reachable = toggle === top || toggle.contains(top);
      topmost = top ? `${top.tagName.toLowerCase()}.${String(top.className)}` : null;
    }

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      toggle: rect(toggle),
      toggleReachable: reachable,
      toggleTopmost: topmost,
      bar: rect(bar),
      barControls: [...document.querySelectorAll('.tb-modifier-bar button')].map((b) => ({
        label: (b.textContent ?? '').trim() || b.className,
        ...rect(b),
      })),
    };
  }, MODULE_ID);
}

const overlaps = (a, b) =>
  a !== null && b !== null && a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;

const insideViewport = (r, viewport) =>
  r !== null && r.x >= 0 && r.y >= 0 && r.right <= viewport.width && r.bottom <= viewport.height;

/**
 * The module's own report of the keyboard strategy, checked against an independent measurement.
 *
 * Trusting the log line alone would test the module's opinion of itself. This dispatches a shift
 * keydown and asks Foundry's own KeyboardManager whether it registered, which is the thing the
 * modifier bar depends on and the only answer that matters.
 */
async function checkKeyboardStrategy(page: Page, log) {
  const reported =
    log.find((line) => line.includes('Keyboard strategy:'))?.match(/strategy: (\w+)/)?.[1] ?? null;

  const measured = await page.evaluate(() => {
    const manager = globalThis.game?.keyboard;
    if (!manager?.downKeys) {
      return { usable: false, reason: 'game.keyboard.downKeys is not there at all' };
    }
    const before = manager.downKeys.has('ShiftLeft');
    const event = new KeyboardEvent('keydown', {
      key: 'Shift',
      code: 'ShiftLeft',
      shiftKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);
    const after = manager.downKeys.has('ShiftLeft');
    window.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'Shift', code: 'ShiftLeft', bubbles: true })
    );
    return {
      usable: true,
      isTrusted: event.isTrusted,
      downKeysType: manager.downKeys.constructor?.name ?? 'unknown',
      honoured: after && !before,
    };
  });

  record(
    'the module reports a keyboard strategy on Android',
    reported !== null,
    `logged: ${reported ?? 'nothing'}`
  );

  if (!measured.usable) {
    record('Foundry honours synthesised keyboard events on Android', false, measured.reason);
    return;
  }

  record(
    'Foundry honours synthesised keyboard events on Android',
    measured.honoured === true,
    `isTrusted=${measured.isTrusted}, downKeys is a ${measured.downKeysType}, registered=${measured.honoured}`
  );

  record(
    'the strategy measured on Android agrees with the one the module reports',
    (measured.honoured && reported === 'events') || (!measured.honoured && reported !== 'events'),
    `independent measurement says ${measured.honoured ? 'honoured' : 'not honoured'}, module says ${reported}`
  );
}

/**
 * Two probe tokens on the active scene, so hover can be judged and so moving BETWEEN them can be.
 *
 * Returns the ids to delete, or null when the world cannot supply an actor type. Everything created
 * carries PROBE_PREFIX and is removed in the finally, same contract as the probe scene.
 *
 * displayName is set to 30, TOKEN_DISPLAY_MODES.HOVER, deliberately. That is the mode whose
 * nameplate visibility Foundry derives from the hover state, so the nameplate becomes a readable
 * consequence of hovering rather than a decoration that was always on.
 */
async function createProbeTokens(page: Page) {
  return page.evaluate(async (prefix) => {
    const actorType = game.documentTypes.Actor.find((type) => type !== 'base');
    if (actorType === undefined) {
      return null;
    }

    const actor = await Actor.create({ name: `${prefix} hover probe`, type: actorType });
    if (!actor) {
      return null;
    }

    const grid = canvas.scene.grid.size;
    const placements = [
      { x: grid * 3, y: grid * 3 },
      { x: grid * 6, y: grid * 3 },
    ];

    const tokens = await canvas.scene.createEmbeddedDocuments(
      'Token',
      placements.map((at, index) => ({
        name: `${prefix} hover ${String(index)}`,
        actorId: actor.id,
        x: at.x,
        y: at.y,
        width: 1,
        height: 1,
        // TOKEN_DISPLAY_MODES.HOVER, so the nameplate follows hover rather than being always on.
        displayName: 30,
      }))
    );

    /*
     * Wait for the placeables to be DRAWN. createEmbeddedDocuments resolves when the documents
     * exist, which is earlier than when canvas.tokens has objects for them, so reading a baseline
     * straight away reports nameplate visibility as null and the whole check judges nothing.
     */
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const drawn = tokens.every(
        (token: FoundryToken) => canvas.tokens.get(token.id)?.nameplate !== undefined
      );
      if (drawn) {
        break;
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
    }

    return {
      actorId: actor.id,
      tokenIds: tokens.map(
        (token: { name: string; id: string; document: { x: number; y: number } }) => token.id
      ),
    };
  }, PROBE_PREFIX);
}

async function removeProbeTokens(page: Page, probe) {
  if (!probe) {
    return;
  }
  await page
    .evaluate(async ({ actorId, tokenIds }) => {
      await canvas.scene.deleteEmbeddedDocuments('Token', tokenIds);
      await game.actors.get(actorId)?.delete();
    }, probe)
    .catch((error) => {
      console.error(`could not remove the probe tokens: ${String(error)}`);
    });
}

/**
 * Hover, which is the entire reason this module exists.
 *
 * Position tracking was already proven in ADR 0005: the canvas follows the pointer. That is a
 * strictly weaker claim than this one. A pointer can update `canvas.mousePosition` perfectly while
 * Foundry never runs a single hover transition, and the user would see a cursor gliding over tokens
 * that never light up, never show a nameplate and never open a PF2e HUD panel. Nothing had ever
 * measured the difference.
 *
 * Judged against Foundry's own state, never a CSS class:
 *   - `token.hover`, the getter on PlaceableObject
 *   - `canvas.tokens.hover`, the layer's record of which object is current
 *   - `token.nameplate.visible`, which for displayName 30 Foundry derives from hover
 *
 * ⛔ `highlightObjects` is asserted off first. `_canViewMode(HOVER)` returns
 * `this.hover || this.layer.highlightObjects`, so with highlighting on every nameplate is visible and
 * this check would pass without the pointer having done anything at all.
 */
async function checkHoverSemantics(page: Page, probe) {
  if (!probe || probe.tokenIds.length < 2) {
    skip('hovering a token makes Foundry hover it', 'the world could not supply two probe tokens');
    return;
  }

  const baseline = await page.evaluate(
    ({ ids }) => {
      const tokens = ids.map((id) => canvas.tokens.get(id));
      return {
        highlightObjects: canvas.tokens.highlightObjects === true,
        hovered: tokens.map(
          (token: { name: string; id: string; document: { x: number; y: number } }) =>
            token?.hover ?? null
        ),
        nameplates: tokens.map(
          (token: { name: string; id: string; document: { x: number; y: number } }) =>
            token?.nameplate?.visible ?? null
        ),
      };
    },
    { ids: probe.tokenIds }
  );

  /*
   * The two conditions that would make everything below meaningless, and only those.
   *
   * Nameplate visibility is deliberately NOT asserted here, only reported. A freshly drawn token
   * carries visible=true until Foundry's first refresh applies displayName, so a baseline read can
   * legitimately catch it either way. Asserting it produced a failure that said nothing about the
   * module. The nameplate assertion that matters is the TRANSITION, further down.
   */
  record(
    'nothing is highlighting every token, which would make a hover check meaningless',
    baseline.highlightObjects === false && baseline.hovered.every((h) => h === false),
    `highlightObjects=${baseline.highlightObjects}, hover=${JSON.stringify(baseline.hovered)}, nameplates (reported, not asserted)=${JSON.stringify(baseline.nameplates)}`
  );

  /** Drive the pointer to a token's centre, in client pixels, and report what Foundry saw. */
  const hoverToken = async (index) =>
    page.evaluate(
      async ({ id, ids, moduleId }) => {
        const token = canvas.tokens.get(id);
        const centre = token.center;

        /*
         * Pan to the token before converting, because a token can be perfectly placed and still be
         * nowhere near the screen. On a 3000px scene at 0.5 zoom the first attempt aimed at client
         * (-769, -584): the maths was right and the token was simply off view, and the pointer
         * clamps at the viewport edge so it never arrived. Panning makes the target reachable
         * instead of merely computable.
         */
        canvas.pan({ x: centre.x, y: centre.y });
        await new Promise((resolve) => {
          setTimeout(resolve, 300);
        });

        const global = canvas.stage.toGlobal({ x: centre.x, y: centre.y });
        const view = canvas.app.view.getBoundingClientRect();
        const client = { clientX: view.x + global.x, clientY: view.y + global.y };

        game.modules.get(moduleId).api.getPointer().moveTo(client);
        await new Promise((resolve) => {
          setTimeout(resolve, 250);
        });

        const tokens = ids.map((other: { x: number; y: number }) => canvas.tokens.get(other));
        return {
          client,
          // Cross check the coordinate maths against Foundry's own reading of where the mouse is,
          // so a hover failure can be told apart from a conversion failure.
          mouse: { x: canvas.mousePosition.x, y: canvas.mousePosition.y },
          insideToken:
            canvas.mousePosition.x >= token.document.x &&
            canvas.mousePosition.x <= token.document.x + token.w &&
            canvas.mousePosition.y >= token.document.y &&
            canvas.mousePosition.y <= token.document.y + token.h,
          hovered: tokens.map((other: { x: number; y: number }) => other?.hover ?? null),
          nameplates: tokens.map(
            (other: { x: number; y: number }) => other?.nameplate?.visible ?? null
          ),
          layerHoverIsThis: canvas.tokens.hover === token,
        };
      },
      { id: probe.tokenIds[index], ids: probe.tokenIds, moduleId: MODULE_ID }
    );

  const first = await hoverToken(0);

  record(
    'the pointer lands inside the token it is aimed at',
    first.insideToken,
    `moved to client (${Math.round(first.client.clientX)}, ${Math.round(first.client.clientY)}), Foundry read the mouse at scene (${Math.round(first.mouse.x)}, ${Math.round(first.mouse.y)})`
  );

  /*
   * If hover did not happen, find out WHOSE fault it is before reporting anything.
   *
   * The control is a hand built pointermove at the identical coordinates, dispatched straight at the
   * canvas with the module bypassed entirely. If the control produces hover and we did not, the
   * module is at fault and that is a real failure. If the control fails too, this browser cannot
   * produce a hover transition from any scripted pointer event, and blaming the module would be
   * simply wrong.
   *
   * Measured 2026-08-10: desktop Chrome gives hover=true for both, the Chromium 133 emulator gives
   * hover=false for both. Same module, same Foundry, same PIXI 7.4.3. Without this control the check
   * reports a confident, plausible and false module bug.
   */
  if (first.hovered[0] !== true) {
    const control = await page.evaluate(
      async ({ id, at }) => {
        const token = canvas.tokens.get(id);
        canvas.app.view.dispatchEvent(
          new PointerEvent('pointermove', {
            clientX: at.clientX,
            clientY: at.clientY,
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            buttons: 0,
            button: -1,
          })
        );
        await new Promise((resolve) => {
          setTimeout(resolve, 400);
        });
        return { hovered: token?.hover === true };
      },
      { id: probe.tokenIds[0], at: first.client }
    );

    if (!control.hovered) {
      skip(
        'hovering a token makes Foundry hover it',
        'this browser produces no hover from ANY scripted pointer event. A hand built pointermove ' +
          'at the same coordinates, with the module bypassed, also failed to hover, while the same ' +
          'control succeeds on desktop Chrome. The module is not implicated; the environment cannot ' +
          'express the behaviour. Re-run on a device with Chromium 146 or newer.'
      );
      skip('hovering a token shows its nameplate', 'hover itself could not be produced here');
      skip(
        'moving between two tokens updates the hover rather than leaving the first one lit',
        'hover itself could not be produced here'
      );
      return;
    }

    record(
      'hovering a token makes Foundry hover it',
      false,
      `the module's pointer did not hover, but a hand built pointermove at the SAME coordinates did. ` +
        `That points at the module rather than the browser.`
    );
    return;
  }

  record(
    'hovering a token makes Foundry hover it',
    first.hovered[0] === true && first.layerHoverIsThis,
    `token.hover=${String(first.hovered[0])}, canvas.tokens.hover is this token=${String(first.layerHoverIsThis)}`
  );

  record(
    'hovering a token shows its nameplate',
    first.nameplates[0] === true,
    `nameplate.visible went ${String(baseline.nameplates[0])} -> ${String(first.nameplates[0])}`
  );

  const second = await hoverToken(1);

  /*
   * The checklist item that matters most, and the one a single token cannot express: moving between
   * two tokens has to turn the first one OFF. A hover that only ever accumulates leaves a trail of
   * lit tokens behind the cursor, which is worse than no hover at all.
   */
  record(
    'moving between two tokens updates the hover rather than leaving the first one lit',
    second.hovered[1] === true && second.hovered[0] === false,
    `after moving to the second token, hover reads ${JSON.stringify(second.hovered)} and nameplates ${JSON.stringify(second.nameplates)}`
  );
}

/**
 * Tap clicks at the pointer, not under the finger. The trackpad model, on real hardware.
 *
 * Judged by Foundry's own sidebar state rather than by a CSS class, and deliberately with the finger
 * far away from the pointer, so a pass cannot come from the two happening to coincide.
 */
async function checkTapClicksAtPointer(page: Page, finger) {
  const target = await page.evaluate(() => {
    const tab = document.querySelector('button[data-tab="combat"]');
    if (!tab) return null;
    const r = tab.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, before: ui.sidebar.tabGroups.primary };
  });

  if (target === null) {
    skip(
      'tap clicks at the pointer rather than under the finger',
      'no combat sidebar tab to aim at'
    );
    return;
  }

  // moveTo takes one PointerPosition, not two numbers. Passing two silently produces a NaN
  // position, which surfaces much later as "elementFromPoint: the provided double value is
  // non-finite" from inside the module, and reads as a module crash rather than a caller mistake.
  await page.evaluate(
    ({ id, x, y }) => game.modules.get(id).api.getPointer().moveTo({ clientX: x, clientY: y }),
    { id: MODULE_ID, x: target.x, y: target.y }
  );

  /*
   * Pick the tap point by asking the page what is actually there, rather than hardcoding one.
   *
   * A fixed (60, 400) is a perfectly good spot on a 1600px desktop window and a bad one on a 412px
   * phone, where x 60 is inside Foundry's scene control column. Tapping chrome instead of the board
   * made this check fail for a reason that had nothing to do with the behaviour under test, which is
   * the failure mode that wastes the most time: a red result that accuses the feature.
   */
  const spot = await page.evaluate(() => {
    const board = document.querySelector('#board');
    if (!board) return null;
    const r = board.getBoundingClientRect();

    /*
     * Scan for a point that genuinely hits the board rather than trusting the centre. The centre is
     * the worst candidate on a paused world, because Foundry puts its GAME PAUSED banner exactly
     * there, and a <p> over the board is indistinguishable from a broken pointer if you only look at
     * the result.
     */
    const fractions = [0.5, 0.35, 0.65, 0.25, 0.75];
    for (const fy of fractions) {
      for (const fx of fractions) {
        const x = Math.round(r.x + r.width * fx);
        const y = Math.round(r.y + r.height * fy);
        const top = document.elementFromPoint(x, y);
        const over = top ? `${top.tagName.toLowerCase()}.${String(top.className)}` : '';
        if (/board|canvas/i.test(over)) {
          return { x, y, over };
        }
      }
    }

    const centre = document.elementFromPoint(
      Math.round(r.x + r.width / 2),
      Math.round(r.y + r.height / 2)
    );
    return {
      x: null,
      y: null,
      over: centre ? `${centre.tagName.toLowerCase()}.${String(centre.className)}` : null,
    };
  });

  if (spot === null || spot.x === null) {
    skip(
      'tap clicks at the pointer rather than under the finger',
      `no point on #board was clear; the centre is covered by ${spot?.over ?? 'nothing'}`
    );
    return;
  }

  // Far from the pointer, and confirmed to be over the board, so nothing native could do it.
  await finger.tap(spot.x, spot.y);
  await page.waitForTimeout(600);

  const after = await page.evaluate(() => ui.sidebar.tabGroups.primary);

  if (after === 'combat' && target.before !== 'combat') {
    record(
      'tap clicks at the pointer rather than under the finger',
      true,
      `pointer parked on the combat tab, finger tapped at (${spot.x},${spot.y}) over ${spot.over}, sidebar went ${target.before} -> ${after}`
    );
    return;
  }

  /*
   * The tap did not activate the tab. Establish WHOSE fault that is before reporting it, the same
   * way the hover check does, because "tap is broken" and "this page ignores scripted clicks" look
   * identical from the outside and lead to completely different work.
   *
   * The control is a plain scripted click on the same element with the module bypassed. Measured
   * 2026-08-10 on the Chromium 133 emulator: the control switched the tab while the module's tap
   * delivered pointerdown, mousedown, pointerup and mouseup to the right element and never a click.
   * That is a real gap rather than an environment limit, so it is reported as a failure and the
   * detail says exactly which events did arrive.
   */
  const control = await page.evaluate(async () => {
    const tab = document.querySelector('button[data-tab="combat"]');
    const seen = [];
    const spy = (event) => seen.push(event.type);
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      tab.addEventListener(type, spy, { once: true });
    }
    const before = ui.sidebar.tabGroups.primary;
    tab.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, view: window, detail: 1 })
    );
    await new Promise((resolve) => {
      setTimeout(resolve, 600);
    });
    return { before, after: ui.sidebar.tabGroups.primary, seen };
  });

  if (control.after !== 'combat') {
    skip(
      'tap clicks at the pointer rather than under the finger',
      `this page does not respond to a scripted click at all: a plain click dispatched straight at ` +
        `the tab, with the module bypassed, left the sidebar on ${control.after}. Nothing about the ` +
        `module can be concluded from that.`
    );
    return;
  }

  record(
    'tap clicks at the pointer rather than under the finger',
    false,
    `pointer parked on the combat tab, finger tapped at (${spot.x},${spot.y}) over ${spot.over}, ` +
      `sidebar stayed on ${after}. A plain scripted click on the SAME element does switch it ` +
      `(${control.before} -> ${control.after}), so the page is fine and the tap is not producing an ` +
      `activation the tab acts on.`
  );
}

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

    // Judge the shipped default, not wherever the bar was last dragged to.
    originalBarPosition = await page.evaluate(
      ({ id, position }) => {
        const previous = game.settings.get(id, 'barPosition');
        game.settings.set(id, 'barPosition', position);
        return previous;
      },
      { id: MODULE_ID, position: DEFAULT_BAR_POSITION }
    );
    await page.waitForTimeout(500);

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

    // Canvas dependent work. The scene is bigger than the phone viewport on purpose.
    let canvasReady = false;
    try {
      createdScene = await ensureActiveScene(page, {
        width: 3000,
        height: 3000,
        label: 'android check',
      });
      canvasReady = await page.evaluate(() => globalThis.canvas?.ready === true);
    } catch (error) {
      skip('the canvas becomes ready on Android', String(error.message ?? error));
    }

    if (canvasReady) {
      record(
        'the canvas becomes ready on Android',
        true,
        `scale ${await page.evaluate(() => canvas.stage.scale.x.toFixed(3))}`
      );
      const client = await page.context().newCDPSession(page);
      await checkTapClicksAtPointer(page, new Finger(client));

      probeTokens = await createProbeTokens(page);
      await checkHoverSemantics(page, probeTokens);
    } else {
      skip(
        'tap clicks at the pointer rather than under the finger',
        'the canvas never became ready'
      );
      skip('hovering a token makes Foundry hover it', 'the canvas never became ready');
    }

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
    if (originalBarPosition !== null) {
      await page
        .evaluate(({ id, position }) => game.settings.set(id, 'barPosition', position), {
          id: MODULE_ID,
          position: originalBarPosition,
        })
        .catch(() => {
          console.error('could not restore the original modifier bar position');
        });
    }
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
