/**
 * Does dragging a token through the virtual pointer actually MOVE the token? Added 2026-08-11.
 *
 * ⚠️ This check exists because three rounds of device reports and three rounds of green tests
 * disagreed with each other, and the tests were the ones that were wrong. Every drag test in the
 * suite asserted on the EVENT STREAM: that a pointermove carried buttons=1, that the captured target
 * was reused, that the sequence builder emitted the right descriptors. All of that passed while a
 * real finger on a real phone moved nothing at all.
 *
 * The reason is not subtle in hindsight. A drag is not a sequence of events, it is a token ending up
 * somewhere else. Everything between those two facts is implementation, and a test that asserts on
 * implementation cannot fail when the implementation is wrong in a way nobody predicted. jsdom made
 * this unavoidable rather than merely tempting: there is no PIXI, no hit testing and no Foundry in
 * the unit suite, so the event stream is genuinely the only thing available to assert on there.
 *
 * So this asserts the one fact that matters, against a live Foundry, with the module's own pointer:
 *
 *     token.document.x and .y are different afterwards.
 *
 * Nothing else counts as a pass. The diagnostics are printed alongside because when it fails they
 * are what says why, but they are never what decides.
 */
import type { Page } from 'playwright';
import {
  ensureActiveScene,
  ensureModuleEnabled,
  ensureInGame,
  removeProbeScene,
  requireActiveWorld,
} from './foundry-session.ts';
import { evaluateOn } from './drag/EvaluateOn.ts';
import { openSurface } from './drag/Surface.ts';
import {
  ANDROID_COMMIT_TIMEOUT_MS,
  COMMIT_TIMEOUT_MS,
  DRAG_DISTANCE,
  DRAG_STEPS,
  HOLD_MS,
  MOBILE_DPR,
  PAN_DURING_DRAG,
  USE_ANDROID,
  USE_MOBILE,
} from './drag/Options.ts';
import { takeSubjectToken } from './drag/SubjectToken.ts';
import { findDragFailures } from './drag/Verdicts.ts';
import { putTheTokenBack } from './drag/PutBack.ts';
import { dragControlledToken } from './drag/DragToken.ts';
import { format, report } from './drag/Report.ts';

/**
 * The slice of a page these checks actually need, satisfied by BOTH surfaces.
 *
 * Playwright's `Page` and the raw CDP stand in are different types that do the same job here, and
 * only `evaluate` is common ground. Naming that says what the checks require instead of demanding a
 * Playwright page they do not need, and it is why the same check body runs against a desktop browser
 * and a phone without knowing which it has.
 */

async function main() {
  await requireActiveWorld();

  const launched = await openSurface();
  const { browser, page, device } = launched;

  if (USE_MOBILE) {
    console.log(
      `Emulating phone INPUT: touch on, mobile user agent, dpr ${String(MOBILE_DPR)}, ` +
        `at a Foundry legal viewport. This is emulation, not hardware.`
    );
  }

  if (device !== undefined) {
    console.log(
      `Android: ${String(device.width)}x${String(device.height)} dpr ${String(device.devicePixelRatio)}, ` +
        `${String(device.maxTouchPoints)} touch points`
    );
  }

  const failures = [];
  let sceneId = null;
  let created = null;
  let restore: { name: string; x: number; y: number } | null = null;

  try {
    if (USE_ANDROID) {
      /*
       * On the device, ASSERT the preconditions rather than arranging them.
       *
       * Joining, enabling a module and activating a scene all navigate or reload, and this is
       * someone's live session on their own phone: the tab is already in the world, which is how the
       * bug was found. Reloading it to satisfy a checklist would destroy the state being measured and
       * would count as the harness breaking the thing it came to look at.
       *
       * Asserting instead means a missing precondition is a clear message rather than a mysterious
       * later failure.
       */
      const state = await evaluateOn(page, () => ({
        ready: globalThis.game?.ready === true,
        module: globalThis.game?.modules?.get('tongs-browser')?.active === true,
        api: globalThis.game?.modules?.get('tongs-browser')?.api !== undefined,
        canvas: globalThis.canvas?.ready === true,
        build: globalThis.game?.modules?.get('tongs-browser')?.version,
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio,
      }));
      console.log(
        `Device tab: ${String(state.width)}x${String(state.height)} dpr ${String(state.dpr)}, ` +
          `game ready ${String(state.ready)}, module ${String(state.module)}, canvas ${String(state.canvas)}`
      );
      if (!state.ready || !state.module || !state.api || !state.canvas) {
        throw new Error(
          `the device tab is not in a usable state: ready=${String(state.ready)} module=${String(state.module)} ` +
            `api=${String(state.api)} canvas=${String(state.canvas)}. Open the world on the phone first.`
        );
      }
    } else {
      /*
       * Narrowed rather than cast blindly: outside the android branch the page IS a Playwright page,
       * because that is the only thing `launchBrowser` returns, and these three helpers
       * genuinely need `goto` and `waitForFunction` rather than only `evaluate`.
       */
      // Through `unknown` because the two page types share no structural overlap, and narrowed here
      // rather than at the top because ONLY these three helpers need `goto` and `waitForFunction`.
      const playwrightPage = page as unknown as Page;
      await ensureInGame(playwrightPage);
      await ensureModuleEnabled(playwrightPage);
      sceneId = await ensureActiveScene(playwrightPage, { label: 'drag check' });
    }

    ({ created, restore } = await takeSubjectToken(page, USE_ANDROID));

    const result = await dragControlledToken(page, {
      distance: DRAG_DISTANCE,
      steps: DRAG_STEPS,
      timeout: USE_ANDROID ? ANDROID_COMMIT_TIMEOUT_MS : COMMIT_TIMEOUT_MS,
      pan: PAN_DURING_DRAG,
      holdMs: HOLD_MS,
    });

    report(result);

    /*
     * The press has to land on Foundry's board before any drag verdict means anything.
     *
     * Checked as a hard error rather than a failure, because a bad press point makes the drag result
     * unreadable rather than bad: "did not move" would be perfectly true and would send someone
     * looking at the module. This is the guard against this check ever accusing the code it tests.
     */
    if (!result.hitDescription.startsWith('canvas#board')) {
      throw new Error(
        `the press point ${format(result.client)} is over ${result.hitDescription}, not canvas#board. ` +
          `The check cannot say anything about dragging until it can reach the canvas.`
      );
    }

    failures.push(...findDragFailures(result));
  } finally {
    await putTheTokenBack(page, { created, restore });

    await removeProbeScene(page as unknown as Page, sceneId);

    /*
     * Do NOT close a browser we merely attached to. On Android this is the user's own Chrome, with
     * their own tabs in it, and closing it to tidy up after a check would be a rude way to end a
     * diagnostic. Disconnecting is enough; the tab stays where it is, which is also useful when the
     * check fails and someone wants to look at the screen.
     */
    if (browser === null) {
      // Raw CDP: closing the socket detaches. The tab, and the user's browsing, stay exactly as they
      // were, which is the whole point of not using a browser level connection here.
      page.close();
    } else {
      await browser.close();
    }
  }

  if (failures.length > 0) {
    console.error(`\nFAIL (${String(failures.length)}):`);
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log('\nPASS: the virtual pointer moves a token.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
