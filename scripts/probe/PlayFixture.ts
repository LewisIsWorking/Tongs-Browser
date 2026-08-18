/**
 * A brand new actor and token per trial, torn down again afterwards.
 * Extracted from PlayKit 2026-08-18.
 *
 * ⚠️ THIS IS THE THIRD OF THE FOUR CORRECTIONS the probe's history records, and the one found last:
 * all seven capabilities used to share ONE actor, ONE token and one accumulating world, running in
 * sequence, so each case inherited the wreckage of the last. A probe that reuses a fixture across
 * cases measures history, not behaviour.
 *
 * The teardown is in a `finally` for the same reason: a capability that throws still has to leave the
 * world clean, or every later trial is measuring the mess rather than the feature.
 *
 * Installed rather than imported, and composed into the kit through the namespace at runtime. See
 * PlayRuntime.ts for why.
 */
import type { Page } from 'playwright';

import { PLAY_GLOBAL, type PlayWindow } from './PlayRuntime.ts';

export async function installPlayFixture(page: Page): Promise<void> {
  await page.addInitScript((globalName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const namespace: any = ((window as PlayWindow)[globalName as '__tongsPlay'] ??= {});

    namespace.makeFixture = (
      wait: (ms: number) => Promise<void>,
      home: { x: number; y: number }
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async function withFixture<T>(run: (fixture: any) => Promise<T>): Promise<T> {
        const type: string = game.documentTypes.Actor.find((t: string) => t !== 'base');
        const actor = await Actor.create({ name: '[probe] play', type });
        const [doc] = await canvas.scene.createEmbeddedDocuments('Token', [
          { name: '[probe] play', actorId: actor.id, x: home.x, y: home.y, displayName: 30 },
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

      return { withFixture };
    };
  }, PLAY_GLOBAL);
}
