import type { Page } from 'playwright';

import { MODULE_ID } from '../foundry-session.ts';
import { boardCentre } from '../foundry/geometry.ts';
import { createProbeToken, removeProbeToken } from '../drag/ProbeToken.ts';
import type { Finger } from '../foundry-touch.ts';
import type { Recorder } from '../live/recorder.ts';

/**
 * The user's ACTUAL sequence, end to end: tap the grab button with a finger, pause, drag with a
 * finger, tap again to drop. Added 2026-08-13.
 *
 * ⚠️ Nothing else covers this path, and that is why a bug lived in it for five rounds. `check:drag`
 * drives the pointer from JavaScript and never touches the bar; `check:touch` touches the bar but
 * never drags a token. The one path a person actually takes had no check at all.
 *
 * ⚠️ The PAUSE is load bearing. Foundry cancels a held drag after 500ms as a long press, and a person
 * takes about that long to lift, reposition and start moving. Without it this would pass against the
 * exact bug it exists to catch, which is what every other drag check did.
 */
export interface GrabDragResult {
  readonly probeToken: { actorId: string; tokenId: string } | null;
}

export async function checkGrabThenDrag(
  page: Page,
  finger: Finger,
  grab: { x: number; y: number },
  recorder: Recorder
): Promise<GrabDragResult> {
  /*
   * ⚠️ The grab button is a LATCH, and an earlier check in this run taps it. Without resetting, the
   * tap below turns the grab OFF rather than on, and this reports that dragging is broken because
   * nothing was ever held. Two checks sharing one latched control is a state leak between tests, and
   * it produced a confident FAIL against working code.
   */
  await page.evaluate((id: string) => {
    const pointer = game.modules.get(id).api.getPointer();
    if (pointer.isDragging()) {
      pointer.cancelDrag();
    }
  }, MODULE_ID);

  const probeToken = await createProbeToken(page);

  /*
   * ⚠️ Controlled, PANNED INTO VIEW, and only then mapped to a client point. Creating a token does
   * not select it, and a scene larger than the viewport opens centred on the scene rather than on
   * whatever a check cares about. Skipping the pan makes the harness press an off screen point and
   * then report that the module failed to move a token it never touched.
   *
   * `canvas.clientCoordinatesFromCanvas` is Foundry's own mapping. Recomputing it from
   * `canvas.stage.worldTransform` is possible and is how the first version got it wrong, leaving the
   * pointer parked at (0, 0) while the check blamed the module.
   */
  await page.evaluate(async (id: string) => {
    const placed = canvas.tokens.placeables.at(-1);
    placed?.control({ releaseOthers: true });
    if (placed) {
      canvas.pan({ x: placed.center.x, y: placed.center.y, scale: 1 });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const client = canvas.clientCoordinatesFromCanvas(placed.center);
      game.modules
        .get(id)
        .api.getPointer()
        .moveTo({ clientX: Math.round(client.x), clientY: Math.round(client.y) });
    }
  }, MODULE_ID);
  await page.waitForTimeout(300);

  const before = await readToken(page);
  if (before === null) {
    /* ⚠️ SKIP: the harness could not put a token on the canvas, which says nothing about dragging. */
    recorder.skip(
      'tapping grab then dragging with a finger moves the token',
      'the probe token was created but nothing ended up controlled'
    );
    return { probeToken };
  }

  const board = await boardCentre(page);
  await finger.tap(grab.x, grab.y);
  const heldAfterGrab = await readHeld(page);

  await page.waitForTimeout(700);
  await finger.drag(board.x, board.y, 140, 0, 12);
  const heldAfterDrag = await readHeld(page);

  /*
   * ⚠️ A SECOND tap, to drop. The grab button is a latch: the first tap holds the drag and the second
   * releases it, so a sequence that only grabs and moves never commits anything. The first version
   * omitted it and reported the module had failed to move a token it was never asked to put down.
   */
  await finger.tap(grab.x, grab.y);
  await page.waitForTimeout(1500);

  const after = await readToken(page);
  recorder.record(
    'tapping grab then dragging with a finger moves the token',
    after !== null && (after.x !== before.x || after.y !== before.y),
    `(${String(before.x)}, ${String(before.y)}) -> (${String(after?.x ?? -1)}, ` +
      `${String(after?.y ?? -1)}) after a 700ms hold. After the grab: ${heldAfterGrab}. ` +
      `After the drag: ${heldAfterDrag}`
  );

  return { probeToken };
}

async function readToken(page: Page): Promise<{ x: number; y: number } | null> {
  return page.evaluate(() => {
    const first = canvas.tokens.controlled[0];
    return first === undefined ? null : { x: first.document.x, y: first.document.y };
  });
}

/**
 * ⚠️ Carried into the verdict rather than printed as it happens. A FAIL saying only "the token did
 * not move" cannot say whether the grab was even held, and the two are different bugs: state 3 with
 * dragging true means the grab worked and the drag did not, state 1 with dragging false means the
 * button never latched at all.
 */
async function readHeld(page: Page): Promise<string> {
  return JSON.stringify(
    await page.evaluate((id: string) => {
      const api = game.modules.get(id).api;
      const token = canvas.tokens.controlled[0];
      return {
        dragging: api.getPointer().isDragging(),
        pointer: api.getPointer().getPosition(),
        state: token?.mouseInteractionManager?.state ?? null,
        previews: canvas.tokens.preview?.children.length ?? 0,
      };
    }, MODULE_ID)
  );
}

export { removeProbeToken };
