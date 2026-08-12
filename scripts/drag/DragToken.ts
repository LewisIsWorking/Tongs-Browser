import type { Page } from 'playwright';
import type { CdpPage } from '../cdp-page.ts';
import { evaluateOn } from './EvaluateOn.js';

/**
 * Driving one drag and watching every step of it. Extracted from foundry-drag-check 2026-08-12.
 *
 * ⚠️ This is the check that finally asserts on the OUTCOME rather than on the event stream: it waits
 * for the token's position to SETTLE, not merely to change, because Foundry animates a commit and a
 * position read mid animation is neither where it started nor where it is going.
 */
/**
 * Select the token, put the virtual pointer on it, grab, move, drop, and watch the document.
 *
 * The pointer is driven through the module's own public API rather than through synthesised touch,
 * on purpose. Touch would test the gesture layer as well, and when both are in the frame a failure
 * cannot say which one broke. The gesture layer already has its own check; this one is about whether
 * a held pointer moving across a token relocates it, which is the complaint.
 */
export async function dragControlledToken(
  page: Page | CdpPage,
  options: {
    readonly distance: number;
    readonly steps: number;
    readonly timeout: number;
    /** Pan the canvas mid drag, to prove a moving viewport does not cancel the interaction. */
    readonly pan: boolean;
  }
) {
  return evaluateOn(
    page,
    async ({
      dragDistance,
      dragSteps,
      commitTimeout,
      panDuringDrag,
    }: {
      dragDistance: number;
      dragSteps: number;
      commitTimeout: number;
      panDuringDrag: boolean;
    }) => {
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

        // Pan WITH the pointer, which is the arrangement under suspicion. See panDuringDrag.
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
      dragDistance: options.distance,
      dragSteps: options.steps,
      commitTimeout: options.timeout,
      panDuringDrag: options.pan,
    }
  );
}
