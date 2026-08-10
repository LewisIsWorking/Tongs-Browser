/**
 * Can the virtual pointer actually PLAY the game? Written 2026-08-10.
 *
 * The other checks answer "did the event arrive" and "did Foundry's state change". This one answers
 * a blunter question: can a user holding only this pointer select a token, open a sheet, drag a
 * figure across the map, open the HUD, zoom, and roll dice. Those are the things the module exists
 * to make possible, and several of them had never been exercised end to end.
 *
 * ⭐ Every capability that fails is retried with a NATIVE CONTROL: the same interaction, built by
 * hand and dispatched straight at the canvas with the module bypassed. The control is what makes the
 * result actionable, because "the module cannot do this" and "nothing scripted can do this" look
 * identical from the outside and lead to completely different work. See ADR 0010.
 *
 *   module works                  -> YES
 *   module fails, control works   -> a real gap in the module
 *   module fails, control fails   -> inconclusive; scripted input cannot express it here
 *
 * ⚠️ WRITES TO A LIVE WORLD: a `[probe]` scene if there is none, plus a `[probe]` actor and token.
 *    All removed in the finally.
 */
import {
  BASE,
  ensureActiveScene,
  ensureModuleEnabled,
  joinWorld,
  launchBrowser,
  removeProbeScene,
  requireActiveWorld,
} from './foundry-session.mjs';

const status = await requireActiveWorld();
const { browser, page } = await launchBrowser({ hasTouch: true });
let scene = null;

try {
  await joinWorld(page);
  await ensureModuleEnabled(page);
  scene = await ensureActiveScene(page, { width: 3000, height: 3000, label: 'play probe' });

  const rows = await page.evaluate(async () => {
    const results = [];
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const pointer = game.modules.get('tongs-browser').api.getPointer();
    const view = canvas.app.view;

    const grid = canvas.scene.grid.size;
    const actorType = game.documentTypes.Actor.find((type) => type !== 'base');
    const actor = await Actor.create({ name: '[probe] play', type: actorType });
    const [doc] = await canvas.scene.createEmbeddedDocuments('Token', [
      { name: '[probe] play', actorId: actor.id, x: grid * 3, y: grid * 3, displayName: 30 },
    ]);
    await wait(1200);
    const token = canvas.tokens.get(doc.id);

    /*
     * Pan, WAIT, then convert, then move. Converting immediately after canvas.pan reads a stale
     * stage transform, and every interaction below then aims at the wrong place while looking
     * perfectly correct in the code. That mistake made six capabilities report as broken when only
     * two were.
     */
    const aim = async (target) => {
      canvas.pan({ x: target.center.x, y: target.center.y });
      await wait(400);
      const global = canvas.stage.toGlobal({ x: target.center.x, y: target.center.y });
      const box = view.getBoundingClientRect();
      const at = { clientX: box.x + global.x, clientY: box.y + global.y };
      pointer.moveTo(at);
      await wait(250);
      return at;
    };

    const pointerEvent = (type, at, extra = {}) =>
      new PointerEvent(type, {
        clientX: at.clientX,
        clientY: at.clientY,
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        view: window,
        ...extra,
      });
    const mouseEvent = (type, at, extra = {}) =>
      new MouseEvent(type, {
        clientX: at.clientX,
        clientY: at.clientY,
        bubbles: true,
        cancelable: true,
        view: window,
        ...extra,
      });

    /*
     * Every case runs from a clean state and runs TWICE, for both the module and the control.
     *
     * The first version of this ran the control only after the module had already failed, from
     * whatever state that failure left behind, and reported a single trial as fact. That is not a
     * control, it is a sequel, and it produced a confident and completely false "dragging a token is
     * broken". Re-measured with a reset before every attempt and two trials each:
     *
     *   module drag  -> moved, moved      (deterministic)
     *   native drag  -> moved, no move    (flaky)
     *
     * The module was reliable and the control was the unreliable one. So a gap is only claimed when
     * the pointer fails EVERY trial and the control succeeds in EVERY trial. Anything else is
     * reported as inconclusive, because a flaky control cannot convict anything.
     */
    async function capability(name, reset, viaModule, viaNative, read, trials = 2) {
      const pointerTrials = [];
      for (let trial = 0; trial < trials; trial += 1) {
        await reset();
        await viaModule();
        await wait(900);
        pointerTrials.push(await read());
      }
      const pointerReliable = pointerTrials.every(Boolean);

      let controlTrials = null;
      if (!pointerReliable) {
        controlTrials = [];
        for (let trial = 0; trial < trials; trial += 1) {
          await reset();
          await viaNative();
          await wait(900);
          controlTrials.push(await read());
        }
      }

      results.push({
        name,
        pointerTrials,
        controlTrials,
        pointerReliable,
        pointerSometimes: pointerTrials.some(Boolean),
        controlReliable: controlTrials === null ? null : controlTrials.every(Boolean),
      });
    }

    /*
     * Put the world back exactly where it started, including the token's position, before every
     * single attempt. A reset that leaves the token where the last drag dropped it makes the next
     * "did it move" read meaningless.
     */
    const home = { x: grid * 3, y: grid * 3 };
    const clear = async () => {
      canvas.tokens.releaseAll();
      if (actor.sheet?.rendered) {
        await actor.sheet.close();
      }
      canvas.hud.token?.clear();
      await canvas.scene.updateEmbeddedDocuments('Token', [{ _id: doc.id, x: home.x, y: home.y }]);
      await wait(500);
    };

    await capability(
      'select a token',
      clear,
      async () => {
        await aim(token);
        pointer.leftClick();
      },
      async () => {
        const at = await aim(token);
        view.dispatchEvent(pointerEvent('pointerdown', at, { button: 0, buttons: 1 }));
        view.dispatchEvent(mouseEvent('mousedown', at, { button: 0, buttons: 1, detail: 1 }));
        view.dispatchEvent(pointerEvent('pointerup', at, { button: 0, buttons: 0 }));
        view.dispatchEvent(mouseEvent('mouseup', at, { button: 0, buttons: 0, detail: 1 }));
        view.dispatchEvent(mouseEvent('click', at, { button: 0, detail: 1 }));
      },
      async () => token.controlled === true
    );

    await capability(
      'open the character sheet by double click',
      clear,
      async () => {
        await aim(token);
        pointer.doubleClick();
      },
      async () => {
        const at = await aim(token);
        for (const detail of [1, 2]) {
          view.dispatchEvent(pointerEvent('pointerdown', at, { button: 0, buttons: 1 }));
          view.dispatchEvent(mouseEvent('mousedown', at, { button: 0, buttons: 1, detail }));
          view.dispatchEvent(pointerEvent('pointerup', at, { button: 0, buttons: 0 }));
          view.dispatchEvent(mouseEvent('mouseup', at, { button: 0, buttons: 0, detail }));
          view.dispatchEvent(mouseEvent('click', at, { button: 0, detail }));
          await wait(60);
        }
        view.dispatchEvent(mouseEvent('dblclick', at, { button: 0, detail: 2 }));
      },
      async () => actor.sheet?.rendered === true
    );

    await capability(
      'open the token HUD by right click',
      clear,
      async () => {
        await aim(token);
        pointer.rightClick();
      },
      async () => {
        const at = await aim(token);
        view.dispatchEvent(pointerEvent('pointerdown', at, { button: 2, buttons: 2 }));
        view.dispatchEvent(mouseEvent('mousedown', at, { button: 2, buttons: 2 }));
        view.dispatchEvent(pointerEvent('pointerup', at, { button: 2, buttons: 0 }));
        view.dispatchEvent(mouseEvent('mouseup', at, { button: 2, buttons: 0 }));
        view.dispatchEvent(mouseEvent('contextmenu', at, { button: 2 }));
      },
      async () => canvas.hud.token?.rendered === true
    );

    const homeX = home.x;
    await capability(
      'drag a token to a new square',
      clear,
      async () => {
        await aim(token);
        pointer.leftClick();
        await wait(300);
        await aim(token);
        pointer.beginDrag();
        for (let step = 0; step < 10; step += 1) {
          pointer.dragBy(15, 0);
          await wait(50);
        }
        pointer.endDrag();
      },
      async () => {
        const at = await aim(token);
        view.dispatchEvent(pointerEvent('pointerdown', at, { button: 0, buttons: 1 }));
        view.dispatchEvent(mouseEvent('mousedown', at, { button: 0, buttons: 1 }));
        for (let step = 1; step <= 10; step += 1) {
          const to = { clientX: at.clientX + step * 15, clientY: at.clientY };
          view.dispatchEvent(pointerEvent('pointermove', to, { buttons: 1 }));
          view.dispatchEvent(mouseEvent('mousemove', to, { buttons: 1 }));
          await wait(50);
        }
        const end = { clientX: at.clientX + 150, clientY: at.clientY };
        view.dispatchEvent(pointerEvent('pointerup', end, { button: 0, buttons: 0 }));
        view.dispatchEvent(mouseEvent('mouseup', end, { button: 0, buttons: 0 }));
      },
      async () => token.document.x !== homeX
    );

    let zoomBefore = canvas.stage.scale.x;
    await capability(
      'zoom with the wheel',
      async () => {
        zoomBefore = canvas.stage.scale.x;
        await wait(200);
      },
      async () => {
        await aim(token);
        pointer.wheel(-120);
      },
      async () => {
        const at = await aim(token);
        view.dispatchEvent(
          new WheelEvent('wheel', {
            clientX: at.clientX,
            clientY: at.clientY,
            deltaY: -120,
            bubbles: true,
            cancelable: true,
            view: window,
          })
        );
      },
      async () => canvas.stage.scale.x !== zoomBefore
    );

    /*
     * Foundry 14's chat box is a <prose-mirror> element, not a textarea, so setting .value does
     * nothing at all. Typing has to go through the contenteditable the editor owns.
     */
    let messagesBefore = game.messages.size;
    await capability(
      'roll dice from the chat box',
      async () => {
        messagesBefore = game.messages.size;
      },
      async () => {
        const editable = document
          .querySelector('prose-mirror#chat-message')
          ?.querySelector('[contenteditable="true"], .ProseMirror');
        if (editable) {
          editable.focus();
          document.execCommand('insertText', false, '/r 1d20');
          await wait(200);
          editable.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              bubbles: true,
              cancelable: true,
            })
          );
        }
      },
      async () => {
        await ui.chat.processMessage('/r 1d20');
      },
      async () => game.messages.size > messagesBefore
    );

    /*
     * Dropping an actor from the sidebar onto the map. This is HTML5 drag and drop rather than
     * pointer input, so it never touches the virtual pointer, and it is worth knowing that it works
     * because it is how a scene gets populated in the first place.
     */
    const tokensBefore = canvas.tokens.placeables.length;
    const entry = document.querySelector(
      `.directory-item[data-entry-id="${actor.id}"], [data-document-id="${actor.id}"]`
    );
    let dropDetail = 'no sidebar entry found for the probe actor';
    if (entry) {
      const transfer = new DataTransfer();
      entry.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
      dropDetail = transfer.getData('text/plain') || '(Foundry wrote no drag payload)';
      const at = await aim(token);
      view.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
          clientX: at.clientX + 200,
          clientY: at.clientY,
        })
      );
      await wait(1200);
    }
    const dropped = canvas.tokens.placeables.length > tokensBefore;
    results.push({
      name: 'drop a token from the actor sidebar',
      pointerTrials: [dropped],
      controlTrials: null,
      pointerReliable: dropped,
      pointerSometimes: dropped,
      controlReliable: null,
      note: dropDetail,
    });

    await canvas.scene.deleteEmbeddedDocuments(
      'Token',
      canvas.tokens.placeables.filter((t) => t.name.startsWith('[probe]')).map((t) => t.id)
    );
    await actor.delete();
    return results;
  });

  console.log(
    JSON.stringify({ target: BASE, world: status.world, core: status.version, rows }, null, 2)
  );

  const verdict = (row) => {
    if (row.pointerReliable) return 'YES';
    if (row.pointerSometimes) return 'FLAKY';
    return 'no';
  };
  const controlText = (row) => {
    if (row.controlTrials === null) return 'not needed';
    if (row.controlReliable) return 'reliable -> OUR GAP';
    if (row.controlTrials.some(Boolean)) return 'flaky -> inconclusive';
    return 'also fails -> inconclusive';
  };

  console.error('\ncapability                                  | via pointer | native control');
  console.error(
    '--------------------------------------------|-------------|---------------------------'
  );
  for (const row of rows) {
    console.error(`${row.name.padEnd(43)} | ${verdict(row).padEnd(11)} | ${controlText(row)}`);
  }

  /*
   * A gap needs the pointer to fail EVERY trial and the control to succeed in EVERY trial. A flaky
   * control convicts nothing: it was a single flaky control trial that produced a confident and
   * false "dragging a token is broken" the first time this ran.
   */
  const gaps = rows.filter((row) => !row.pointerSometimes && row.controlReliable === true);
  console.error(
    `\n${String(gaps.length)} capability gap(s): the pointer failed every trial and a native control succeeded in every trial.`
  );
  const flaky = rows.filter((row) => row.pointerSometimes && !row.pointerReliable);
  if (flaky.length > 0) {
    console.error(
      `${String(flaky.length)} capability(s) FLAKY through the pointer, which is its own finding: ${flaky.map((row) => row.name).join(', ')}`
    );
  }
} finally {
  await removeProbeScene(page, scene);
  await browser.close();
}
