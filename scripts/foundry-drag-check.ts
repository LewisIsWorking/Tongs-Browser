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
import type { Browser, Page } from 'playwright';
import { connectCdpPage, type CdpPage } from './cdp-page.ts';
import {
  BASE,
  ensureActiveScene,
  ensureModuleEnabled,
  ensureInGame,
  launchBrowser,
  removeProbeScene,
  requireActiveWorld,
  PROBE_PREFIX,
} from './foundry-session.ts';

/**
 * `--android` drives Chrome on the actual phone instead of desktop Chromium.
 *
 * This check passes on desktop and the same gesture fails on a device, which means desktop can no
 * longer answer the question. Running the identical assertions against real hardware is the only way
 * to see the difference rather than infer it from a pasted report, and inferring it has now cost
 * three releases.
 *
 * Needs the adb forward and an address the DEVICE can reach:
 *
 *   adb forward tcp:9222 localabstract:chrome_devtools_remote
 *   FOUNDRY_URL=http://<host-lan-ip>:30000 npm run check:drag -- --android
 */
const USE_ANDROID = process.argv.includes('--android');

/**
 * `--mobile` turns on the phone's INPUT characteristics: touch, a mobile user agent, dpr 3.
 *
 * A device fails a gesture this check passes on desktop, and no device is plugged in, so the only
 * way to see the difference rather than infer it is to make the desktop browser as much like the
 * phone as Chromium allows, one variable at a time. Emulation is a weaker claim than hardware and is
 * recorded as such.
 *
 * ⚠️ It deliberately does NOT shrink the viewport to the phone's 360x607, though that was the first
 * thing tried. **Foundry itself refuses to run below 1024x768** and replaces the whole interface with
 * a paragraph saying so, which the press-point guard caught immediately:
 *
 *   element there: p "Foundry Virtual Tabletop requires a usable window dimensions of 1024px by
 *   768px or greater."
 *
 * The phone only gets past that because this module's UI scaler makes Foundry believe the window is
 * larger than it is. So viewport size cannot be varied on its own here; it is entangled with the
 * scaler. Touch, the mobile user agent and the device pixel ratio can be, and they are the
 * candidates that would change how events are produced and mapped.
 *
 * dpr 3 comes from the device's own report: `viewRect=0,0 360x607 res=3`.
 */
const USE_MOBILE = process.argv.includes('--mobile');
const MOBILE_DPR = 3;

/**
 * `--pan` pans the canvas while the drag is in progress.
 *
 * The remaining candidate for a drag origin that follows the pointer. `screenOrigin` is in SCREEN
 * space, so when the canvas pans, the same world point lands on different screen pixels and Foundry
 * has to rewrite it or the drag would jump. That rewrite is correct in isolation. It stops being
 * correct if the canvas is panning WITH the pointer, because then the origin chases the pointer and
 * Foundry's 10px gate can never open however far you drag.
 *
 * On a phone, a one finger drag moves the pointer, and anything that also nudges the canvas would
 * produce exactly this. Desktop never pans during a drag, which is why desktop has never seen it.
 */
const PAN_DURING_DRAG = process.argv.includes('--pan');

/**
 * How far to drag, and in how many steps.
 *
 * Foundry's MouseInteractionManager will not start a drag until the pointer has travelled its
 * `dragResistance` of 10px from the press, so a single large jump and a distance under 10 are both
 * ways to measure nothing. 240px over 12 steps clears the gate several times over and still looks
 * like a hand rather than a teleport. The grid in the probe scene is 100px, so this is a move of
 * more than two squares and cannot be confused with a snap back to the origin square.
 */
const DRAG_DISTANCE = 240;

/**
 * `--steps=N` splits the same distance into N moves, which changes the SIZE of each one.
 *
 * That size turns out to matter enormously and nothing here was varying it. Desktop drags 240px in
 * 12 steps of 20px and clears Foundry's 10px gate on the very first move, while a finger on a phone
 * produced 55 moves of about 1.6px each for 86.5px of travel. Those are the same gesture to a human
 * and completely different event streams to Foundry, and only one of them had ever been tested.
 */
const stepsArgument = process.argv.find((argument) => argument.startsWith('--steps='));
const DRAG_STEPS = stepsArgument === undefined ? 12 : Number(stepsArgument.split('=')[1]);

/**
 * Foundry commits a token move by updating the document over the socket, which is a round trip even
 * against a local server. Polling for the change rather than sleeping means a fast machine finishes
 * immediately and a slow one still passes, and a genuine failure costs this long exactly once.
 */
const COMMIT_TIMEOUT_MS = 8000;

/**
 * The same wait, on a device, where a Foundry socket round trip is a completely different animal.
 *
 * ⚠️ Measured 2026-08-11: a `deleteEmbeddedDocuments` issued to the phone took MINUTES to come back,
 * long enough that a desktop client deleted the same token first and the phone's call finally
 * returned "Token ... does not exist!". Pure JavaScript evaluated on that same tab returned
 * instantly, so this is not a slow device or a suspended tab: it is specifically the round trip
 * through Foundry's socket over wireless adb.
 *
 * Eight seconds would therefore have reported "the token did not move" about a move that was simply
 * still in flight, which is the harness accusing the feature for its own reasons. That has already
 * happened three times in this file and each time it cost a round of chasing the wrong thing.
 */
const ANDROID_COMMIT_TIMEOUT_MS = 120_000;

/**
 * How far the committed position may differ from the distance dragged, in canvas units.
 *
 * One grid square. Snapping to the grid is allowed to move the result by up to half a square in each
 * axis, and the probe scene's grid is 100, so anything inside 100 is explained by snapping and
 * anything outside it is the drag not following the pointer.
 */
const TRAVEL_TOLERANCE = 100;

/**
 * The slice of a page these checks actually need, satisfied by BOTH surfaces.
 *
 * Playwright's `Page` and the raw CDP stand in are different types that do the same job here, and
 * only `evaluate` is common ground. Naming that says what the checks require instead of demanding a
 * Playwright page they do not need, and it is why the same check body runs against a desktop browser
 * and a phone without knowing which it has.
 */
/**
 * Evaluate on either page surface.
 *
 * Both do exactly the same thing at runtime; they differ only in generic plumbing, and Playwright's
 * overloads make the union uncallable without help. One documented adapter beats a cast at every
 * call site, and it keeps the check body identical for desktop and device.
 */
function evaluateOn<T>(
  target: Page | CdpPage,
  fn: (arg: never) => T | Promise<T>,
  arg?: unknown
): Promise<T> {
  return (target as CdpPage).evaluate(fn, arg);
}

async function main() {
  await requireActiveWorld();

  /*
   * Two genuinely different surfaces, not one type with two shapes.
   *
   * Playwright's `Page` and the raw CDP stand in do the same job for the checks and are not
   * structurally compatible: Playwright's `evaluate` carries generic overloads nothing here can
   * satisfy. Rather than contort a common interface into existence, the union is kept honest and
   * narrowed at the two places where a Playwright only method is actually required.
   */
  const launched: {
    browser: Browser | null;
    page: Page | CdpPage;
    device?: { width: number; height: number; devicePixelRatio: number; maxTouchPoints: number };
  } = USE_ANDROID
    ? { browser: null, page: await connectCdpPage({ matchUrl: '/game' }) }
    : await launchBrowser(
        USE_MOBILE
          ? {
              hasTouch: true,
              isMobile: true,
              deviceScaleFactor: MOBILE_DPR,
              // A size Foundry accepts. See MOBILE_DPR's comment for why the phone's own 360x607
              // cannot be used here.
              viewport: { width: 1366, height: 768 },
            }
          : undefined
      );
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

/**
 * A token to drag, and an actor to hang it on.
 *
 * The actor type is read from the system rather than hardcoded, because this world runs `coo` and
 * the next one will not. Hardcoding "character" would make the check fail on a system that spells it
 * differently, and that failure would accuse the drag.
 */
async function createProbeToken(page: Page | CdpPage) {
  return evaluateOn(
    page,
    async (prefix) => {
      /*
       * Two shapes, both real. `game.documentTypes.Actor` is an array of names; the same key on
       * `game.system.documentTypes` is an object keyed by name whose values carry the type's metadata.
       * Reading only one of them threw `.filter is not a function` on this world, which is a confusing
       * way to be told the schema is not what you assumed.
       */
      const declared = game.documentTypes?.Actor ?? game.system.documentTypes?.Actor ?? [];
      const names = Array.isArray(declared) ? declared : Object.keys(declared);
      const type = names.filter((name) => name !== 'base')[0];
      if (type === undefined) {
        throw new Error('this system declares no Actor types, so no token can be made.');
      }

      const actor = await Actor.create({ name: `${prefix} drag subject`, type });

      // Placed well inside the scene, so a 240px drag in any direction stays on the canvas. A token
      // dragged off the scene is refused, and the refusal looks exactly like the bug being hunted.
      const [document] = await canvas.scene.createEmbeddedDocuments('Token', [
        { name: `${prefix} drag subject`, actorId: actor.id, x: 600, y: 600, width: 1, height: 1 },
      ]);

      return { actorId: actor.id, tokenId: document.id };
    },
    PROBE_PREFIX
  );
}

async function removeProbeToken(
  page: Page | CdpPage,
  { actorId, tokenId }: { actorId: string; tokenId: string }
) {
  await evaluateOn(
    page,
    async ({ actor, token }) => {
      await canvas.scene?.deleteEmbeddedDocuments('Token', [token]).catch(() => undefined);
      await game.actors.get(actor)?.delete();
    },
    { actor: actorId, token: tokenId }
  );
}

/**
 * Select the token, put the virtual pointer on it, grab, move, drop, and watch the document.
 *
 * The pointer is driven through the module's own public API rather than through synthesised touch,
 * on purpose. Touch would test the gesture layer as well, and when both are in the frame a failure
 * cannot say which one broke. The gesture layer already has its own check; this one is about whether
 * a held pointer moving across a token relocates it, which is the complaint.
 */
async function dragControlledToken(
  page: Page | CdpPage,
  { distance, steps, timeout }: { distance: number; steps: number; timeout: number }
) {
  return evaluateOn(
    page,
    async ({ dragDistance, dragSteps, commitTimeout, panDuringDrag }) => {
      const api = game.modules.get('tongs-browser')?.api;
      if (api === undefined) {
        throw new Error('the module exposes no api, so it did not reach its ready hook.');
      }
      if (!api.isEnabled()) {
        api.enable();
      }

      /*
       * The token this run is about: whatever is already controlled, or the probe if this run made
       * one. Searching only for a `[probe]` name broke the moment the device path stopped creating
       * tokens and started adopting the user's own, which is the better subject anyway.
       */
      const token =
        canvas.tokens.controlled[0] ??
        canvas.tokens.placeables.find((candidate: { name: string }) =>
          candidate.name.startsWith('[probe]')
        );
      if (token === undefined) {
        throw new Error('no token to drag: none is controlled and no probe token exists.');
      }
      token.control({ releaseOthers: true });

      // The select tool, because Token#_canDrag refuses outright under any other one, and the world
      // remembers whichever tool was last used by a human.
      ui.controls?.activate?.({ control: 'tokens', tool: 'select' });

      /*
       * Canvas coordinates to client coordinates.
       *
       * Foundry offers this mapping directly and it accounts for the stage transform, the canvas
       * element's position and the device pixel ratio all at once. Reimplementing it from
       * canvas.stage.worldTransform is possible and is how this got the offset wrong the first time.
       */
      /*
       * Bring the token into view BEFORE mapping it to a client point.
       *
       * ⚠️ Without this the check pressed at (-375, -325) and reported "the token did not move",
       * which is true and completely misleading: nothing was pressed at all. A scene larger than the
       * viewport opens centred on the scene, not on whatever the check happens to care about, so a
       * token at canvas (650, 650) sits off the top left corner. That is the harness accusing the
       * feature, and it is the exact failure this whole check exists to stop happening.
       *
       * Scale 1 as well as position, so the press point cannot drift with a remembered zoom.
       */
      canvas.pan({ x: token.center.x, y: token.center.y, scale: 1 });
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const centre = token.center;
      const client = canvas.clientCoordinatesFromCanvas(centre);

      const before = { x: token.document.x, y: token.document.y };
      const controlledAtStart = canvas.tokens.controlled.length;
      // What the browser says is at that point. If this is not the board, the mapping is the bug and
      // every downstream number is describing a press on the wrong element.
      const elementAtPoint = document.elementFromPoint(Math.round(client.x), Math.round(client.y));
      /*
       * Name the element AND quote it. "p#(no id) is in the way" is true and useless; the text is
       * what says whether it is a warning to dismiss, a notification to wait out, or the module's
       * own furniture in the wrong place.
       */
      const hitDescription =
        elementAtPoint === null
          ? 'nothing'
          : `${elementAtPoint.tagName.toLowerCase()}#${elementAtPoint.id || '(no id)'}` +
            `${elementAtPoint.className ? `.${String(elementAtPoint.className).split(' ').join('.')}` : ''}` +
            ` "${(elementAtPoint.textContent ?? '').trim().slice(0, 120)}"`;

      const pointer = api.getPointer();
      pointer.moveTo({ clientX: Math.round(client.x), clientY: Math.round(client.y) });
      pointer.beginDrag();

      /*
       * A reading after every step, of the three positions that must agree.
       *
       * Where OUR pointer thinks it is, where Foundry recorded the drag destination, and where the
       * drag clone actually sits. A drag that fails is a disagreement between those three, and which
       * pair disagrees names the bug: pointer against destination is the event mapping, destination
       * against clone is Foundry declining to follow.
       */
      /*
       * Count the moves PIXI delivers to the TOKEN LAYER against those it delivers to the stage.
       *
       * Foundry binds its drag move handler on `this.layer`, so a move that reaches the stage but not
       * the tokens layer cannot advance a drag. A device reported layer=8 against stage=112, and
       * nothing here had ever measured the same ratio on a surface where dragging works, which makes
       * that 8 impossible to interpret.
       */
      let layerMoves = 0;
      let stageMoves = 0;
      canvas.tokens.on('pointermove', () => {
        layerMoves += 1;
      });
      canvas.stage.on('pointermove', () => {
        stageMoves += 1;
      });

      const trace = [];
      let originAliasesPointer = null;
      /*
       * Never drag further than the viewport can hold.
       *
       * The hit tester clamps the pointer inside the viewport, so a 240px drag on a 360px wide phone
       * would press at the middle, run into the right edge, and stop. The pointer would then be
       * exactly where the clamp put it rather than where it was sent, the token would move less than
       * asked, and the check would report "the drag is not following the pointer" about its own
       * arithmetic. A third of the viewport clears Foundry's 10px gate many times over on any screen
       * it runs on.
       */
      const usable = Math.min(dragDistance, Math.floor(window.innerWidth / 3));
      const stride = usable / dragSteps;
      for (let step = 0; step < dragSteps; step += 1) {
        pointer.moveBy(stride, 0);

        // Pan WITH the pointer, which is the arrangement under suspicion. See PAN_DURING_DRAG.
        if (panDuringDrag) {
          const centre = canvas.stage.pivot;
          canvas.pan({ x: centre.x + stride, y: centre.y });
        }
        /*
         * A frame between steps, so PIXI processes each move rather than coalescing the whole drag
         * into one. A real finger cannot produce twelve moves inside one frame either.
         *
         * ⚠️ Raced against a timer, because `requestAnimationFrame` DOES NOT FIRE IN A BACKGROUND
         * TAB. On a phone that is not an edge case: the moment the user switches to another app or
         * tab, the Foundry tab stops painting and this loop waits forever. Two device runs hung here
         * with no output at all, which reads as the check being broken rather than as the tab being
         * in the background.
         */
        await Promise.race([
          new Promise((resolve) => requestAnimationFrame(resolve)),
          new Promise((resolve) => setTimeout(resolve, 50)),
        ]);

        const data = token.mouseInteractionManager?.interactionData;
        /*
         * Is Foundry's recorded drag origin the SAME OBJECT as PIXI's live pointer?
         *
         * If it is, then every diagnostic that computes `hypot(pointer - screenOrigin)` is
         * subtracting a value from itself and can only ever report 0.0, forever, on every device,
         * whether the drag works or not. A device reported exactly 0.0 across a whole gesture, which
         * is far too clean for a real measurement. PIXI reuses one rootPointerEvent and mutates its
         * `global` in place, so an assignment without a clone aliases the two.
         */
        if (originAliasesPointer === null && data?.screenOrigin !== undefined) {
          originAliasesPointer = data.screenOrigin === canvas.app.renderer.events.pointer.global;
        }
        trace.push({
          step,
          ours: Math.round(pointer.getPosition().clientX),
          // screenOrigin is now the prime suspect. A device's numbers say it moved 139px with the
          // pointer, which would keep Foundry's 10px gate shut forever. If it is fixed here and
          // moving there, the difference between the two environments IS the bug.
          origin: data?.screenOrigin === undefined ? null : Math.round(data.screenOrigin.x),
          destination: data?.destination === undefined ? null : Math.round(data.destination.x),
          clone: data?.clones?.[0] === undefined ? null : Math.round(data.clones[0].document.x),
          state: token.mouseInteractionManager?.state ?? -1,
        });
      }

      const peakState = token.mouseInteractionManager?.state ?? -1;
      const peakClones =
        token.mouseInteractionManager?.interactionData?.clones?.length ??
        canvas.tokens.preview?.children?.length ??
        0;

      pointer.endDrag();

      /*
       * Wait for the position to SETTLE, not merely to change.
       *
       * ⚠️ This read the first changed value and reported a 240px drag as a 22.7px one, three runs
       * running. Foundry 13 and later animate a token along its movement path, so the document
       * passes through every intermediate coordinate on the way to the destination. Breaking on the
       * first difference samples the token mid flight, and the number it returns is real, stable
       * enough to look trustworthy, and completely wrong.
       *
       * The trace made it obvious in hindsight: Foundry's drag destination and the drag clone both
       * tracked the pointer perfectly to 800, while the "committed" reading said 622.74. A value
       * nothing else agrees with is a measurement problem, not a behaviour problem.
       *
       * Settled means unchanged across consecutive samples once it has moved at all.
       */
      const deadline = Date.now() + commitTimeout;
      let after = { x: token.document.x, y: token.document.y };
      let stableFor = 0;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const now = { x: token.document.x, y: token.document.y };
        const changedSinceLastSample = now.x !== after.x || now.y !== after.y;
        after = now;
        if (now.x === before.x && now.y === before.y) {
          // Not started yet. Nothing has moved, so there is nothing to call settled.
          continue;
        }
        stableFor = changedSinceLastSample ? 0 : stableFor + 1;
        if (stableFor >= 3) {
          break;
        }
      }

      return {
        before,
        after,
        moved: after.x !== before.x || after.y !== before.y,
        // How far the token went, against how far the pointer went. Both in canvas units, so the
        // comparison holds at any zoom: client pixels divided by the stage scale ARE canvas units.
        travelled: Math.hypot(after.x - before.x, after.y - before.y),
        expected: usable / canvas.stage.scale.x,
        peakState,
        peakClones,
        pointerStillDragging: pointer.isDragging(),
        controlled: canvas.tokens.controlled.length,
        controlledAtStart,
        layerMoves,
        stageMoves,
        trace,
        originAliasesPointer,
        scale: canvas.stage.scale.x,
        centre: { x: Math.round(centre.x), y: Math.round(centre.y) },
        client: { x: Math.round(client.x), y: Math.round(client.y) },
        hitDescription,
        activeTool: game.activeTool,
        locked: token.document.locked === true,
      };
    },
    {
      dragDistance: distance,
      dragSteps: steps,
      commitTimeout: timeout,
      panDuringDrag: PAN_DURING_DRAG,
    }
  );
}

const format = (point: { x: number; y: number }) => `(${String(point.x)}, ${String(point.y)})`;

/**
 * Everything the check measured. Loose on purpose: the shape is built inside `page.evaluate` where
 * Foundry's own untyped API supplies most of it, so a strict interface here would be a second,
 * drifting description of a thing the page already decides.
 */
interface DragCheckResult {
  before: { x: number; y: number };
  after: { x: number; y: number };
  moved: boolean;
  travelled: number;
  expected: number;
  scale: number;
  peakState: number;
  peakClones: number;
  centre: { x: number; y: number };
  client: { x: number; y: number };
  hitDescription: string;
  controlledAtStart: number;
  controlled: number;
  activeTool: string;
  locked: boolean;
  pointerStillDragging: boolean;
  layerMoves: number;
  stageMoves: number;
  originAliasesPointer: boolean | null;
  trace: {
    step: number;
    ours: number;
    origin: number | null;
    destination: number | null;
    clone: number | null;
    state: number;
  }[];
}

function report(result: DragCheckResult) {
  console.log(`Foundry at ${BASE}`);
  console.log(`  token position : ${format(result.before)} -> ${format(result.after)}`);
  console.log(`  moved          : ${result.moved ? 'YES' : 'NO'}`);
  console.log(
    `  travelled      : ${result.travelled.toFixed(1)} of an expected ${result.expected.toFixed(1)} canvas px (scale ${result.scale.toFixed(2)})`
  );
  console.log(`  peak state     : ${String(result.peakState)} (4 is DRAG)`);
  console.log(`  drag clones    : ${String(result.peakClones)}`);
  console.log(`  token centre   : ${format(result.centre)} in canvas space`);
  console.log(`  press point    : ${format(result.client)} in client space`);
  console.log(`  element there  : ${result.hitDescription}`);
  console.log(
    `  controlled     : ${String(result.controlledAtStart)} at start, ${String(result.controlled)} at end`
  );
  console.log(`  active tool    : ${String(result.activeTool)}`);
  console.log(`  token locked   : ${String(result.locked)}`);
  console.log(`  still dragging : ${String(result.pointerStillDragging)}`);
  console.log(
    `  PIXI moves     : layer=${String(result.layerMoves)} stage=${String(result.stageMoves)}` +
      ` (a device reported layer=8 stage=112 on a drag that failed)`
  );
  console.log(
    `  origin aliases PIXI pointer: ${String(result.originAliasesPointer)}` +
      (result.originAliasesPointer === true
        ? '  <-- any hypot(pointer - screenOrigin) is structurally 0.0'
        : '')
  );
  console.log('  per step (ours / screenOrigin / destination / clone x / state):');
  for (const entry of result.trace) {
    console.log(
      `    ${String(entry.step).padStart(2)}: ${String(entry.ours).padStart(5)} / ` +
        `${String(entry.origin).padStart(5)} / ${String(entry.destination).padStart(5)} / ` +
        `${String(entry.clone).padStart(5)} / ${String(entry.state)}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
