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
  MOBILE_DPR,
  PAN_DURING_DRAG,
  TRAVEL_TOLERANCE,
  USE_ANDROID,
  USE_MOBILE,
} from './drag/Options.ts';
import { createProbeToken, removeProbeToken } from './drag/ProbeToken.ts';
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

    /*
     * On a device, ADOPT a token that is already there rather than creating one.
     *
     * ⚠️ Creating a probe actor and token is four document writes, and every write to the phone is a
     * Foundry socket round trip that has been measured in MINUTES over wireless adb. Two runs died
     * that way having produced no output at all, and both left probe entities behind in a live world
     * for someone else to clean up.
     *
     * None of it is needed. The check needs a token it may move, and the world already has one that
     * the user has selected: that is what they were dragging when they hit the bug, which makes it a
     * better subject than anything this could invent. The position is restored afterwards, so the
     * only write is the drag itself, which is the thing under test.
     */
    if (USE_ANDROID) {
      const adopted = await evaluateOn(page, () => {
        const token = canvas.tokens.controlled[0] ?? canvas.tokens.placeables[0];
        if (token === undefined) {
          return null;
        }
        token.control({ releaseOthers: true });
        return { name: token.name, x: token.document.x, y: token.document.y };
      });
      if (adopted === null) {
        throw new Error('the scene on the device has no token to drag. Put one on the map first.');
      }
      console.log(
        `Adopted the existing token '${String(adopted.name)}' at (${String(adopted.x)}, ${String(adopted.y)}). ` +
          `Nothing is created and its position is restored afterwards.`
      );
      restore = adopted;
    } else {
      created = await createProbeToken(page);
    }

    const result = await dragControlledToken(page, {
      distance: DRAG_DISTANCE,
      steps: DRAG_STEPS,
      timeout: USE_ANDROID ? ANDROID_COMMIT_TIMEOUT_MS : COMMIT_TIMEOUT_MS,
      pan: PAN_DURING_DRAG,
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

    if (!result.moved) {
      failures.push(
        `the token did not move: ${format(result.before)} -> ${format(result.after)}. ` +
          `Foundry peaked at interaction state ${result.peakState} with ${String(result.peakClones)} clone(s).`
      );
    } else if (Math.abs(result.travelled - result.expected) > TRAVEL_TOLERANCE) {
      /*
       * "It moved" is not the requirement. The requirement is that it followed the pointer.
       *
       * Measured 2026-08-11 on the first passing run: a 240px drag moved the token 17.64px, and the
       * check said PASS. A token that lurches a fraction of the way is a bug a user would describe
       * as "dragging barely works", and a check that cannot tell it apart from a correct drag is the
       * same blind spot as the event-stream tests, just further along.
       *
       * The tolerance is one grid square, which is what snapping is allowed to take.
       */
      failures.push(
        `the token moved ${result.travelled.toFixed(1)}px but the pointer travelled ${result.expected.toFixed(1)}px ` +
          `at scale ${result.scale.toFixed(2)}. The drag is not following the pointer.`
      );
    }
    if (result.pointerStillDragging) {
      failures.push('the pointer still believes a button is held after endDrag.');
    }
  } finally {
    if (restore !== null) {
      // Captured into a const so the arrow callbacks below keep the narrowing. A closure over the
      // mutable binding would not.
      const putBack = restore;
      // Put the adopted token back. The drag is allowed to move it; the check is not allowed to
      // leave it moved, because this is somebody's live game and not a fixture.
      await evaluateOn(
        page,
        async (at: { name: string; x: number; y: number }) => {
          const token = canvas.tokens.controlled[0] ?? canvas.tokens.placeables[0];
          await token?.document.update({ x: at.x, y: at.y });
        },
        putBack
      ).catch((error: Error) => {
        console.error(
          `could not put '${putBack.name}' back at (${String(putBack.x)}, ${String(putBack.y)}): ${String(error)}`
        );
      });
    }
    if (created !== null) {
      await removeProbeToken(page, created).catch((error: Error) => {
        console.error(`could not remove the probe token: ${String(error)}`);
      });
    }
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
