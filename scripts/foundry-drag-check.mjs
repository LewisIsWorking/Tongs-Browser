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
import {
  BASE,
  connectAndroidBrowser,
  ensureActiveScene,
  ensureModuleEnabled,
  joinWorld,
  launchBrowser,
  removeProbeScene,
  requireActiveWorld,
  PROBE_PREFIX,
} from './foundry-session.mjs';

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
 * How far to drag, and in how many steps.
 *
 * Foundry's MouseInteractionManager will not start a drag until the pointer has travelled its
 * `dragResistance` of 10px from the press, so a single large jump and a distance under 10 are both
 * ways to measure nothing. 240px over 12 steps clears the gate several times over and still looks
 * like a hand rather than a teleport. The grid in the probe scene is 100px, so this is a move of
 * more than two squares and cannot be confused with a snap back to the origin square.
 */
const DRAG_DISTANCE = 240;
const DRAG_STEPS = 12;

/**
 * Foundry commits a token move by updating the document over the socket, which is a round trip even
 * against a local server. Polling for the change rather than sleeping means a fast machine finishes
 * immediately and a slow one still passes, and a genuine failure costs this long exactly once.
 */
const COMMIT_TIMEOUT_MS = 8000;

/**
 * How far the committed position may differ from the distance dragged, in canvas units.
 *
 * One grid square. Snapping to the grid is allowed to move the result by up to half a square in each
 * axis, and the probe scene's grid is 100, so anything inside 100 is explained by snapping and
 * anything outside it is the drag not following the pointer.
 */
const TRAVEL_TOLERANCE = 100;

async function main() {
  await requireActiveWorld();

  const { browser, page, device } = USE_ANDROID
    ? await connectAndroidBrowser()
    : await launchBrowser();

  if (device !== undefined) {
    console.log(
      `Android: ${String(device.width)}x${String(device.height)} dpr ${String(device.devicePixelRatio)}, ` +
        `${String(device.maxTouchPoints)} touch points`
    );
  }

  const failures = [];
  let sceneId = null;
  let created = null;

  try {
    await joinWorld(page);
    await ensureModuleEnabled(page);
    sceneId = await ensureActiveScene(page, { label: 'drag check' });

    created = await createProbeToken(page);
    const result = await dragControlledToken(page, {
      distance: DRAG_DISTANCE,
      steps: DRAG_STEPS,
      timeout: COMMIT_TIMEOUT_MS,
    });

    report(result);

    /*
     * The press has to land on Foundry's board before any drag verdict means anything.
     *
     * Checked as a hard error rather than a failure, because a bad press point makes the drag result
     * unreadable rather than bad: "did not move" would be perfectly true and would send someone
     * looking at the module. This is the guard against this check ever accusing the code it tests.
     */
    if (result.hitDescription !== 'canvas#board') {
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
    if (created !== null) {
      await removeProbeToken(page, created).catch((error) => {
        console.error(`could not remove the probe token: ${String(error)}`);
      });
    }
    await removeProbeScene(page, sceneId);
    /*
     * Do NOT close a browser we merely attached to. On Android this is the user's own Chrome, with
     * their own tabs in it, and closing it to tidy up after a check would be a rude way to end a
     * diagnostic. Disconnecting is enough; the tab stays where it is, which is also useful when the
     * check fails and someone wants to look at the screen.
     */
    if (USE_ANDROID) {
      await browser.close({ reason: 'detaching from the device' }).catch(() => undefined);
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
async function createProbeToken(page) {
  return page.evaluate(async (prefix) => {
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
  }, PROBE_PREFIX);
}

async function removeProbeToken(page, { actorId, tokenId }) {
  await page.evaluate(
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
async function dragControlledToken(page, { distance, steps, timeout }) {
  return page.evaluate(
    async ({ dragDistance, dragSteps, commitTimeout }) => {
      const api = game.modules.get('tongs-browser')?.api;
      if (api === undefined) {
        throw new Error('the module exposes no api, so it did not reach its ready hook.');
      }
      if (!api.isEnabled()) {
        api.enable();
      }

      const token = canvas.tokens.placeables.find((candidate) =>
        candidate.name.startsWith('[probe]')
      );
      if (token === undefined) {
        throw new Error('the probe token is not on the canvas.');
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
      const hitDescription =
        elementAtPoint === null
          ? 'nothing'
          : `${elementAtPoint.tagName.toLowerCase()}#${elementAtPoint.id || '(no id)'}`;

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
        // A frame between steps, so PIXI actually processes each move rather than coalescing the
        // whole drag into one. A real finger cannot produce twelve moves inside one frame either.
        await new Promise((resolve) => requestAnimationFrame(resolve));

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
    { dragDistance: distance, dragSteps: steps, commitTimeout: timeout }
  );
}

const format = (point) => `(${String(point.x)}, ${String(point.y)})`;

function report(result) {
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
    `  origin aliases PIXI pointer: ${String(result.originAliasesPointer)}` +
      (result.originAliasesPointer === true
        ? '  <-- any hypot(pointer - screenOrigin) is structurally 0.0'
        : '')
  );
  console.log('  per step (ours / foundry destination / clone x / state):');
  for (const entry of result.trace) {
    console.log(
      `    ${String(entry.step).padStart(2)}: ${String(entry.ours).padStart(5)} / ` +
        `${String(entry.destination).padStart(5)} / ${String(entry.clone).padStart(5)} / ${String(entry.state)}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
