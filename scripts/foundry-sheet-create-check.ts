#!/usr/bin/env node
/**
 * Press create for real, judge the sheet it made, and remove it. Added 2026-09-12.
 *
 * Run: npm run check:sheets:create   (a PF2e world with exactly one party and one user)
 *
 * ⛔ THIS ONE WRITES TO THE WORLD, and says so up front. `check:sheets` promises it writes nothing
 * and keeps that promise by declining to press create where pressing would write. This is the half
 * it declines: it creates one actor, asserts what happened to it, and deletes it.
 *
 * ⛔ CLEANUP FINDS ITS TARGET BY ID DIFF, NEVER BY NAME. See `newActorIds`. A name match would pick up
 * any real character sharing the default name, and this script would delete it.
 *
 * ⚠️ It only runs on the world shape where one tap creates with no prompt: one party, one user. Any
 * other shape puts a picker in the way, and a script that guessed its way through a picker would be
 * testing its own guesses. It refuses and says why.
 */
import {
  ensureInGame,
  ensureModuleEnabled,
  joinWorld,
  launchBrowser,
  requireActiveWorld,
} from './foundry-session.ts';
import { judgeCreatedSheet, newActorIds, type Verdict } from './sheets/createVerdict.ts';
import { pressOutcomeFor } from './sheets/expectations.ts';
import { readWorld } from './sheets/partyChecks.ts';

/** Only the parts of a PF2e actor this check reads or calls. */
interface ActorLike {
  readonly id: string;
  readonly uuid: string;
  readonly type: string;
  readonly _source?: { readonly folder?: string | null };
  readonly ownership?: Readonly<Record<string, number>>;
  readonly system?: { readonly details?: { readonly members?: readonly { uuid: string }[] } };
  readonly removeMembers?: (uuid: string) => Promise<void>;
  readonly delete: () => Promise<void>;
}

interface G {
  game: {
    actors: { contents: ActorLike[]; get: (id: string) => ActorLike | undefined };
    users: { contents: { id: string }[] };
  };
  CONST: { DOCUMENT_OWNERSHIP_LEVELS: { OWNER: number } };
}

await requireActiveWorld();
const { browser, page } = await launchBrowser({ hasTouch: true });
let verdicts: Verdict[] = [];
let created: string[] = [];
const heard: string[] = [];

try {
  await joinWorld(page);
  await ensureInGame(page);
  await ensureModuleEnabled(page);

  const world = await readWorld(page);
  const shape = pressOutcomeFor('create-sheet', world);
  if (shape.kind !== 'creates') {
    console.error(`Refusing to run: this world does not create on one tap (${shape.because}).`);
    process.exitCode = 1;
  } else {
    const before = await page.evaluate(() =>
      (globalThis as unknown as G).game.actors.contents.map((actor) => actor.id)
    );

    /*
     * ⛔ RECORD WHAT HAPPENED, not only whether an actor appeared. The first live run reported
     * "0 new actor(s) appeared" and nothing else, which is a result with no diagnosis: it could not
     * say whether the tap missed, the flow showed a notice, or creation threw. Everything the page
     * says between the tap and the verdict is kept and printed.
     */
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        heard.push(`console.${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => {
      heard.push(`pageerror: ${error.message}`);
    });

    const button = page.locator('[data-action="create-sheet"]').first();
    heard.push(
      `create button found: ${String(await button.count())}, visible: ${String(await button.isVisible())}`
    );
    await button.click();

    /* ⚠️ Poll for the actor rather than sleeping: creation is a round trip to the server. */
    await page
      .waitForFunction(
        (count) => (globalThis as unknown as G).game.actors.contents.length > count,
        before.length,
        { timeout: 20_000 }
      )
      .catch(() => undefined);

    heard.push(
      `after the tap, on screen: ${await page.evaluate(
        () =>
          [...document.querySelectorAll('.tb-choice-menu, #notifications .notification')]
            .map((node) => (node.textContent ?? '').trim().replace(/\s+/g, ' '))
            .join(' | ') || '(no menu or notification)'
      )}`
    );

    const after = await page.evaluate(() =>
      (globalThis as unknown as G).game.actors.contents.map((actor) => actor.id)
    );
    created = newActorIds(before, after);

    /*
     * ⛔ WAIT FOR THE SECOND WRITE, not only the first. Creation is `Actor.create` THEN
     * `party.addMembers`, and the actor appears in `game.actors` the moment the first resolves, while
     * the second is still on its way to the server. The first version of this check read membership
     * right there and reported "NOT in the party" for a sheet that joined a moment later; no
     * outside-the-party warning was logged, which is what gave the race away.
     *
     * ⚠️ A timeout still ends in the verdict rather than hanging, so a sheet that genuinely never
     * joins is reported as not joined, and is not mistaken for a slow one.
     */
    if (created.length > 0) {
      await page
        .waitForFunction(
          (id) => {
            const g = globalThis as unknown as G;
            const uuid = g.game.actors.get(id)?.uuid;
            const party = g.game.actors.contents.find((candidate) => candidate.type === 'party');
            const members = g.game.actors.get(party?.id ?? '')?.system?.details?.members ?? [];
            return members.some((member) => member.uuid === uuid);
          },
          created[0] ?? '',
          { timeout: 20_000 }
        )
        .catch(() => {
          heard.push('the sheet was not in the party after 20s of waiting');
        });
    }

    const facts =
      created.length === 0
        ? null
        : await page.evaluate((id) => {
            const g = globalThis as unknown as G;
            const actor = g.game.actors.get(id);
            const party = g.game.actors.contents.find((candidate) => candidate.type === 'party');
            const members = g.game.actors.get(party?.id ?? '')?.system?.details?.members ?? [];
            const ownerId = g.game.users.contents[0]?.id ?? '';
            return {
              type: actor?.type ?? '',
              folder: actor?._source?.folder ?? null,
              inParty: members.some((member) => member.uuid === actor?.uuid),
              ownerLevel: actor?.ownership?.[ownerId],
            };
          }, created[0] ?? '');

    const ownerLevel = await page.evaluate(
      () => (globalThis as unknown as G).CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
    );
    verdicts = judgeCreatedSheet(created.length, facts, { type: 'character', ownerLevel });
  }
} finally {
  /*
   * ⛔ IN `finally`, so a failed assertion or a thrown error still removes what was made. A check
   * that left an actor behind whenever it failed would make its own failures cumulative.
   */
  for (const id of created) {
    const removed = await page
      .evaluate(async (actorId) => {
        const g = globalThis as unknown as G;
        const actor = g.game.actors.get(actorId);
        if (actor === undefined) {
          return 'already gone';
        }
        const party = g.game.actors.contents.find((candidate) => candidate.type === 'party');
        await g.game.actors.get(party?.id ?? '')?.removeMembers?.(actor.uuid);
        await actor.delete();
        return 'deleted';
      }, id)
      .catch((error: unknown) => `FAILED: ${String(error)}`);
    console.error(`cleanup ${id}: ${removed}`);
  }
  await browser.close();
}

for (const line of heard) {
  console.error(`  ${line}`);
}
for (const verdict of verdicts) {
  console.error(`${verdict.passed ? 'PASS' : 'FAIL'}  ${verdict.name}: ${verdict.detail}`);
}
const failed = verdicts.filter((verdict) => !verdict.passed);
if (failed.length > 0 || verdicts.length === 0) {
  process.exitCode = 1;
}
