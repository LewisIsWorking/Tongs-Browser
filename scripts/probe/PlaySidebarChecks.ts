/**
 * Ownership and drag-to-map, the two sidebar capabilities that are not creating an actor.
 * Extracted from foundry-play-probe 2026-08-18; creating lives in PlayCreateActorCheck.ts.
 *
 * Installed rather than imported: see PlayRuntime.ts for why an evaluate callback cannot reach an
 * import, and why these meet at one window namespace instead.
 */
import type { Page } from 'playwright';

import { PLAY_GLOBAL, type PlayWindow } from './PlayRuntime.ts';

export async function installSidebarChecks(page: Page): Promise<void> {
  await page.addInitScript((globalName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const namespace: any = ((window as PlayWindow)[globalName as '__tongsPlay'] ??= {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    namespace.sidebarChecks = async (kit: any) => {
      const { trials, results, wait, pointer, aim, aimAtElement, withFixture, view, openTab } = kit;

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
          const type = game.documentTypes.Actor.find((t: string) => t !== 'base');
          const actor = await Actor.create({ name: '[probe] ownership', type });
          let player = game.users.find((user: { name?: string }) => user.name === '[probe] player');
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
       *
       * ⚠️ Opens the tab first, for the same reason the create check does: the directory entry to
       * start the drag from is only laid out on screen once the sidebar is expanded.
       */
      const dropOutcomes = [];
      let dropNote = '';
      for (let trial = 0; trial < trials; trial += 1) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const outcome = await withFixture(async ({ actor, token }: any) => {
          const before = canvas.tokens.placeables.length;
          await openTab('actors');
          const entry = document.querySelector(
            `.directory-item[data-entry-id="${actor.id}"], [data-document-id="${actor.id}"]`
          );
          if (!entry) return 'no';
          const transfer = new DataTransfer();
          entry.dispatchEvent(
            new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer })
          );
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
          const extras: string[] = canvas.tokens.placeables
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((other: any) => other.name.startsWith('[probe]') && other.id !== token.id)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((other: any) => other.id);
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
    };
  }, PLAY_GLOBAL);
}
