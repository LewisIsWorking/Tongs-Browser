/**
 * Can the virtual pointer actually PLAY the game? Written 2026-08-10.
 *
 * The other checks answer "did the event arrive" and "did Foundry's state change". This one answers
 * a blunter question: can someone holding only this pointer select a token, open a sheet, drag a
 * figure across the map, open the HUD, zoom, and roll dice.
 *
 * ⚠️ THE FIRST TWO VERSIONS OF THIS FILE WERE WRONG, in the same direction both times: they reported
 *    confident capability gaps that did not exist. Every single failure they found survived isolation
 *    intact. The module was fine and the instrument was not. What was wrong, and what is done now:
 *
 *    1. The control ran only AFTER the subject had failed, from whatever state that failure left
 *       behind. A control that runs second is a sequel, not a control. Now both paths run from the
 *       same freshly built state.
 *    2. One trial was reported as fact. Now every path runs three times and the trials are printed,
 *       because a capability that works once and not again is FLAKY, which is its own finding.
 *    3. ⭐ Worst and last found: all seven capabilities shared ONE actor, ONE token and one
 *       accumulating world, running in sequence, so each case inherited the wreckage of the last.
 *       Now every trial builds its own actor and token and deletes them again. A probe that reuses a
 *       fixture across cases measures history, not behaviour.
 *    4. The aim is asserted as its own precondition. If the pointer did not land inside the target,
 *       the trial reports AIM rather than a behaviour failure, because "the feature is broken" and
 *       "the feature was never reached" are different findings.
 *
 * ⚠️ WRITES TO A LIVE WORLD: a `[probe]` scene if there is none, plus a `[probe]` actor and token per
 *    trial. All removed as it goes, and the scene in the finally.
 */
import {
  BASE,
  ensureActiveScene,
  ensureModuleEnabled,
  joinWorld,
  launchBrowser,
  removeProbeScene,
  requireActiveWorld,
} from './foundry-session.ts';

const TRIALS = Number(process.env.PROBE_TRIALS ?? '3');

const status = await requireActiveWorld();
const { browser, page } = await launchBrowser({ hasTouch: true });
let scene = null;

try {
  await joinWorld(page);
  await ensureModuleEnabled(page);
  scene = await ensureActiveScene(page, { width: 3000, height: 3000, label: 'play probe' });

  const rows = await page.evaluate(async (trials) => {
    const results = [];
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const pointer = game.modules.get('tongs-browser').api.getPointer();
    const view = canvas.app.view;
    const grid = canvas.scene.grid.size;
    const HOME = { x: grid * 3, y: grid * 3 };

    /** A brand new actor and token for one trial, torn down afterwards whatever happens. */
    async function withFixture(run) {
      const type = game.documentTypes.Actor.find((t) => t !== 'base');
      const actor = await Actor.create({ name: '[probe] play', type });
      const [doc] = await canvas.scene.createEmbeddedDocuments('Token', [
        { name: '[probe] play', actorId: actor.id, x: HOME.x, y: HOME.y, displayName: 30 },
      ]);
      // createEmbeddedDocuments resolves before the placeable is drawn.
      for (let attempt = 0; attempt < 50; attempt += 1) {
        if (canvas.tokens.get(doc.id)?.nameplate !== undefined) break;
        await wait(100);
      }
      const token = canvas.tokens.get(doc.id);
      try {
        return await run({ actor, doc, token });
      } finally {
        canvas.hud.token?.clear();
        canvas.tokens.releaseAll();
        if (actor.sheet?.rendered) await actor.sheet.close();
        await canvas.scene.deleteEmbeddedDocuments('Token', [doc.id]).catch(() => undefined);
        await actor.delete().catch(() => undefined);
        await wait(300);
      }
    }

    /** Pan, wait for the transform, convert, move, and REPORT whether the aim actually landed. */
    async function aim(token) {
      canvas.pan({ x: token.center.x, y: token.center.y });
      await wait(400);
      const global = canvas.stage.toGlobal({ x: token.center.x, y: token.center.y });
      const box = view.getBoundingClientRect();
      const at = { clientX: box.x + global.x, clientY: box.y + global.y };
      pointer.moveTo(at);
      await wait(250);
      const mouse = canvas.mousePosition;
      const landed =
        mouse.x >= token.document.x &&
        mouse.x <= token.document.x + token.w &&
        mouse.y >= token.document.y &&
        mouse.y <= token.document.y + token.h;
      return { at, landed };
    }

    const pointerEvent = (type, at, extra = {}) =>
      new PointerEvent(type, {
        clientX: at.clientX,
        clientY: at.clientY,
        bubbles: true,
        cancelable: true,
        composed: true,
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
        composed: true,
        view: window,
        ...extra,
      });

    /**
     * Run one path `trials` times, each in its own fixture. Outcomes are 'yes', 'no', or 'AIM' when
     * the precondition failed and the trial therefore says nothing about the behaviour.
     */
    async function run(path, read, needsToken = true) {
      const outcomes = [];
      for (let trial = 0; trial < trials; trial += 1) {
        if (!needsToken) {
          await path({});
          await wait(900);
          outcomes.push((await read({})) ? 'yes' : 'no');
          continue;
        }

        const outcome = await withFixture(async (fixture) => {
          const aimed = await aim(fixture.token);
          if (!aimed.landed) return 'AIM';
          await path({ ...fixture, at: aimed.at });
          await wait(900);
          return (await read(fixture)) ? 'yes' : 'no';
        });
        outcomes.push(outcome);
      }
      return outcomes;
    }

    const reliable = (outcomes) => outcomes.every((o) => o === 'yes');

    async function capability(name, viaPointer, viaNative, read, needsToken = true) {
      const pointerTrials = await run(viaPointer, read, needsToken);
      let controlTrials = null;
      if (!reliable(pointerTrials) && viaNative !== null) {
        controlTrials = await run(viaNative, read, needsToken);
      }
      results.push({ name, pointerTrials, controlTrials });
    }

    await capability(
      'select a token',
      async () => {
        pointer.leftClick();
      },
      async ({ at }) => {
        view.dispatchEvent(pointerEvent('pointerdown', at, { button: 0, buttons: 1 }));
        view.dispatchEvent(mouseEvent('mousedown', at, { button: 0, buttons: 1, detail: 1 }));
        view.dispatchEvent(pointerEvent('pointerup', at, { button: 0, buttons: 0 }));
        view.dispatchEvent(mouseEvent('mouseup', at, { button: 0, buttons: 0, detail: 1 }));
        view.dispatchEvent(mouseEvent('click', at, { button: 0, detail: 1 }));
      },
      async ({ token }) => token.controlled === true
    );

    await capability(
      'open the character sheet by double click',
      async () => {
        pointer.doubleClick();
      },
      async ({ at }) => {
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
      async ({ actor }) => actor.sheet?.rendered === true
    );

    await capability(
      'open the token HUD by right click',
      async () => {
        pointer.rightClick();
      },
      async ({ at }) => {
        view.dispatchEvent(pointerEvent('pointerdown', at, { button: 2, buttons: 2 }));
        view.dispatchEvent(mouseEvent('mousedown', at, { button: 2, buttons: 2, detail: 1 }));
        view.dispatchEvent(pointerEvent('pointerup', at, { button: 2, buttons: 0 }));
        view.dispatchEvent(mouseEvent('mouseup', at, { button: 2, buttons: 0, detail: 1 }));
        view.dispatchEvent(mouseEvent('contextmenu', at, { button: 2, detail: 0 }));
      },
      async () => canvas.hud.token?.rendered === true
    );

    await capability(
      'drag a token to a new square',
      async () => {
        pointer.beginDrag();
        for (let step = 0; step < 10; step += 1) {
          pointer.dragBy(15, 0);
          await wait(50);
        }
        pointer.endDrag();
      },
      async ({ at }) => {
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
      async ({ doc }) => canvas.scene.tokens.get(doc.id).x !== HOME.x
    );

    let zoomBefore = 0;
    await capability(
      'zoom with the wheel',
      async () => {
        zoomBefore = canvas.stage.scale.x;
        pointer.wheel(-120);
      },
      async ({ at }) => {
        zoomBefore = canvas.stage.scale.x;
        view.dispatchEvent(
          new WheelEvent('wheel', {
            clientX: at.clientX,
            clientY: at.clientY,
            deltaY: -120,
            bubbles: true,
            cancelable: true,
            composed: true,
            view: window,
          })
        );
      },
      async () => canvas.stage.scale.x !== zoomBefore
    );

    /*
     * Foundry 14's chat box is a <prose-mirror> element, not a <textarea>, so setting .value does
     * nothing at all, silently. Typing has to go through the contenteditable the editor owns.
     */
    let messagesBefore = 0;
    await capability(
      'roll dice from the chat box',
      async () => {
        messagesBefore = game.messages.size;
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
      null,
      async () => game.messages.size > messagesBefore,
      false
    );

    /**
     * Aim the pointer at a DOM element's centre and report whether it actually got there.
     *
     * Same precondition discipline as the canvas aim: a click that missed is a different finding
     * from a click that was ignored.
     */
    async function aimAtElement(element) {
      if (!element) {
        return { at: null, landed: false, topmost: 'the element does not exist' };
      }
      if (element.getClientRects().length === 0) {
        return { at: null, landed: false, topmost: 'the element has no layout box' };
      }
      const box = element.getBoundingClientRect();
      const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
      pointer.moveTo(at);
      await wait(250);
      const top = document.elementFromPoint(at.clientX, at.clientY);
      return {
        at,
        landed: element === top || element.contains(top) || (top?.contains(element) ?? false),
        topmost: top
          ? `${top.tagName.toLowerCase()}.${String(top.className).slice(0, 40)}`
          : 'nothing',
      };
    }

    /*
     * Creating an actor from the sidebar, entirely through the pointer.
     *
     * Foundry renders a create button per sidebar tab and hides the ones that are not showing, so
     * the visible one has to be chosen rather than the first match. Picking the first would click
     * "Create Scene" while reporting on actors.
     */
    {
      const outcomes = [];
      const madeNames = [];
      let blockedBy = '';
      for (let trial = 0; trial < trials; trial += 1) {
        const name = `[probe] made ${String(trial)}`;
        await ui.sidebar.changeTab('actors', 'primary');
        await wait(700);

        /*
         * Foundry renders a create button per sidebar tab and hides the ones not showing, so the
         * button has to be chosen by being genuinely on screen, not by being the first match.
         * Picking the first clicks "Create Scene" while reporting on actors, and a button that has a
         * layout box can still sit outside the viewport, which makes elementFromPoint return null
         * and reads as "blocked by nothing".
         */
        const createButton = [
          ...document.querySelectorAll('button[data-action="createEntry"]'),
        ].find((button) => {
          const box = button.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) return false;
          // The CENTRE has to be on screen, not the whole box. A sidebar button flush against the
          // right edge can overhang by a pixel and still be perfectly clickable.
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          return cx >= 0 && cy >= 0 && cx <= window.innerWidth && cy <= window.innerHeight;
        });

        const aimed = await aimAtElement(createButton);
        if (!aimed.landed) {
          blockedBy = `create button blocked by ${aimed.topmost}`;
          outcomes.push('AIM');
          continue;
        }
        pointer.leftClick();
        await wait(1200);

        const dialog = [...document.querySelectorAll('.application')].find(
          (element) => element.querySelector('input[name="name"]') !== null
        );
        if (!dialog) {
          outcomes.push('no');
          continue;
        }

        const nameInput = dialog.querySelector('input[name="name"]');
        nameInput.value = name;
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        nameInput.dispatchEvent(new Event('change', { bubbles: true }));

        const submit = dialog.querySelector('button[type="submit"], button[data-action="ok"]');
        const submitAimed = await aimAtElement(submit);
        if (!submitAimed.landed) {
          blockedBy = `create dialog submit blocked by ${submitAimed.topmost}`;
          outcomes.push('AIM');
          continue;
        }
        pointer.leftClick();
        await wait(1800);

        const made = game.actors.getName(name);
        outcomes.push(made ? 'yes' : 'no');
        if (made) {
          madeNames.push(name);
          if (made.sheet?.rendered) await made.sheet.close();
          await made.delete().catch(() => undefined);
        }
        await wait(300);
      }
      results.push({
        name: 'create an actor from the sidebar',
        pointerTrials: outcomes,
        controlTrials: null,
        note:
          `created ${String(madeNames.length)} actor(s) end to end through the pointer` +
          (blockedBy === '' ? '' : `; ${blockedBy}`),
      });
    }

    /*
     * Assigning ownership, and having it persist.
     *
     * ⚠️ The <select> value is set programmatically on purpose, and that is a real limit rather than
     * a shortcut: a native select dropdown is operating system UI that no synthesised pointer event
     * can open or choose from, on any platform. What IS driven by the pointer is the part that
     * matters on a phone, which is finding and pressing Save Changes. The assertion is that the
     * ownership actually persisted on the document afterwards.
     */
    {
      const outcomes = [];
      for (let trial = 0; trial < trials; trial += 1) {
        const type = game.documentTypes.Actor.find((t) => t !== 'base');
        const actor = await Actor.create({ name: '[probe] ownership', type });
        let player = game.users.find((user) => user.name === '[probe] player');
        if (!player) {
          player = await User.create({
            name: '[probe] player',
            role: CONST.USER_ROLES.PLAYER,
          });
        }

        const app = new foundry.applications.apps.DocumentOwnershipConfig({ document: actor });
        await app.render(true);
        await wait(1500);

        const root = app.element instanceof HTMLElement ? app.element : app.element?.[0];
        const select = root?.querySelector(`select[name="${player.id}"]`);
        const submit = root?.querySelector('button[type="submit"]');

        if (!select || !submit) {
          outcomes.push('no');
        } else {
          select.value = String(CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
          select.dispatchEvent(new Event('change', { bubbles: true }));

          const aimed = await aimAtElement(submit);
          if (!aimed.landed) {
            outcomes.push('AIM');
          } else {
            pointer.leftClick();
            await wait(1500);
            const level = actor.ownership?.[player.id];
            outcomes.push(level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER ? 'yes' : 'no');
          }
        }

        await app.close().catch(() => undefined);
        await actor.delete().catch(() => undefined);
        await player.delete().catch(() => undefined);
        await wait(300);
      }
      results.push({
        name: 'assign ownership and have it persist',
        pointerTrials: outcomes,
        controlTrials: null,
        note: 'the select is set programmatically because a native dropdown is OS UI; the Save press is the pointer',
      });
    }

    /*
     * Dropping an actor from the sidebar onto the map. HTML5 drag and drop, so it never touches the
     * virtual pointer, but it is how a scene gets populated in the first place.
     */
    const dropOutcomes = [];
    let dropNote = '';
    for (let trial = 0; trial < trials; trial += 1) {
      const outcome = await withFixture(async ({ actor, token }) => {
        const before = canvas.tokens.placeables.length;
        const entry = document.querySelector(
          `.directory-item[data-entry-id="${actor.id}"], [data-document-id="${actor.id}"]`
        );
        if (!entry) return 'no';
        const transfer = new DataTransfer();
        entry.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
        dropNote = transfer.getData('text/plain') || '(Foundry wrote no drag payload)';
        const aimed = await aim(token);
        view.dispatchEvent(
          new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer,
            clientX: aimed.at.clientX + 200,
            clientY: aimed.at.clientY,
          })
        );
        await wait(1200);
        const after = canvas.tokens.placeables.length;
        // Remove anything the drop created, so the next trial starts level.
        const extras = canvas.tokens.placeables
          .filter((t) => t.name.startsWith('[probe]') && t.id !== token.id)
          .map((t) => t.id);
        if (extras.length > 0) await canvas.scene.deleteEmbeddedDocuments('Token', extras);
        return after > before ? 'yes' : 'no';
      });
      dropOutcomes.push(outcome);
    }
    results.push({
      name: 'drop a token from the actor sidebar',
      pointerTrials: dropOutcomes,
      controlTrials: null,
      note: dropNote,
    });

    return results;
  }, TRIALS);

  console.log(
    JSON.stringify(
      { target: BASE, world: status.world, core: status.version, trials: TRIALS, rows },
      null,
      2
    )
  );

  const verdict = (trialsList) => {
    if (trialsList.every((o) => o === 'yes')) return 'YES';
    if (trialsList.some((o) => o === 'AIM')) return 'AIM FAILED';
    if (trialsList.some((o) => o === 'yes')) return 'FLAKY';
    return 'no';
  };

  console.error(
    `\ncapability                                  | via pointer | native control  (${String(TRIALS)} trials each)`
  );
  console.error(
    '--------------------------------------------|-------------|---------------------------'
  );
  for (const row of rows) {
    const control =
      row.controlTrials === null
        ? 'not needed'
        : row.controlTrials.every((o) => o === 'yes')
          ? 'reliable -> OUR GAP'
          : row.controlTrials.some((o) => o === 'yes')
            ? 'flaky -> inconclusive'
            : 'also fails -> inconclusive';
    console.error(`${row.name.padEnd(43)} | ${verdict(row.pointerTrials).padEnd(11)} | ${control}`);
  }

  const gaps = rows.filter(
    (row) =>
      !row.pointerTrials.some((o) => o === 'yes') &&
      row.controlTrials !== null &&
      row.controlTrials.every((o) => o === 'yes')
  );
  console.error(
    `\n${String(gaps.length)} capability gap(s): the pointer failed every trial and a native control succeeded in every trial.`
  );
  process.exitCode = gaps.length > 0 ? 1 : 0;
} finally {
  await removeProbeScene(page, scene);
  await browser.close();
}
