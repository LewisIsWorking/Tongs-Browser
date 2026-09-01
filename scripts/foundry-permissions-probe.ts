/**
 * What a PLAYER can and cannot do to actors, measured rather than assumed. Written 2026-09-01.
 *
 * ⚠️ The sheet-creation feature turns entirely on what a player is FORBIDDEN from doing, and getting
 * that wrong in either direction is expensive. Assume too little and the feature needs a GM relay it
 * did not need; assume too much and it ships a flow that throws on a real player's device, where
 * nobody can open a console to find out why.
 *
 * This asks Foundry 14.366 directly, as the GM, about the rules it will apply to players. It creates
 * nothing and changes nothing: every question is answered from `CONST`, `game.permissions` and the
 * static `canUserCreate`/`testUserPermission` predicates.
 *
 * Run: node scripts/foundry-permissions-probe.ts
 */
import { BASE, joinWorld, launchBrowser, requireActiveWorld } from './foundry-session.ts';

interface Finding {
  readonly question: string;
  readonly answer: string;
}

async function main(): Promise<void> {
  const status = await requireActiveWorld();
  console.log(`World "${status.world}" on Foundry ${status.version}, system ${status.system}.\n`);

  const { browser, page } = await launchBrowser();
  try {
    await joinWorld(page);

    const findings = (await page.evaluate(() => {
      const out: { question: string; answer: string }[] = [];
      const game = (globalThis as { game?: Record<string, unknown> }).game;
      const CONST = (globalThis as { CONST?: Record<string, unknown> }).CONST;
      const say = (question: string, answer: unknown): void => {
        out.push({ question, answer: String(answer) });
      };

      const levels = (CONST?.['DOCUMENT_OWNERSHIP_LEVELS'] ?? {}) as Record<string, number>;
      say('ownership levels', Object.keys(levels).join(', '));

      const permissions = game?.['permissions'] as Record<string, string[]> | undefined;
      say(
        'roles granted ACTOR_CREATE',
        permissions?.['ACTOR_CREATE']?.join(', ') || '(none, so no role may create actors)'
      );

      /*
       * The role numbers matter more than the names: PLAYER is 1, TRUSTED 2, ASSISTANT 3, GM 4, and
       * a permission list holds the NUMBERS. A list of ["1"] means ordinary players may create.
       */
      const roles = (CONST?.['USER_ROLES'] ?? {}) as Record<string, number>;
      say('user roles', JSON.stringify(roles));

      const users = (game?.['users'] as { contents?: unknown[] } | undefined)?.contents ?? [];
      const players = users.filter((user) => (user as { isGM?: boolean }).isGM !== true) as {
        name?: string;
        id?: string;
        role?: number;
      }[];
      say('non-GM users in this world', players.map((user) => user.name).join(', ') || '(none)');

      const ActorClass = (globalThis as { Actor?: { canUserCreate?: (u: unknown) => boolean } })
        .Actor;
      const probe = players[0];
      if (probe !== undefined && ActorClass?.canUserCreate !== undefined) {
        const user = (game?.['users'] as { get?: (id: string) => unknown } | undefined)?.get?.(
          probe.id ?? ''
        );
        say(
          `can "${String(probe.name)}" create an Actor at all`,
          ActorClass.canUserCreate(user) === true ? 'YES' : 'NO'
        );
      } else {
        say('can a player create an Actor at all', 'no non-GM user to ask about');
      }

      /*
       * The decisive one for the design. A player cannot grant ownership, so a sheet they create
       * cannot be assigned to anyone by them. If this says the update is denied, the create flow has
       * to run on a GM client, which is what the existing PauseRelay already does for pausing.
       */
      const anyActor = (game?.['actors'] as { contents?: unknown[] } | undefined)?.contents?.[0] as
        | { canUserModify?: (u: unknown, a: string, d?: unknown) => boolean; name?: string }
        | undefined;
      if (anyActor !== undefined && probe !== undefined) {
        const user = (game?.['users'] as { get?: (id: string) => unknown } | undefined)?.get?.(
          probe.id ?? ''
        );
        say(
          `can that player change ownership on "${String(anyActor.name)}"`,
          anyActor.canUserModify?.(user, 'update', { ownership: {} }) === true ? 'YES' : 'NO'
        );
      }

      const folders = (game?.['folders'] as { contents?: unknown[] } | undefined)?.contents ?? [];
      say('folders this client can see', String(folders.length));
      say(
        'folder documents expose an ownership field',
        folders[0] !== undefined && 'ownership' in (folders[0] as object) ? 'YES' : 'NO'
      );

      return out;
    })) as Finding[];

    for (const finding of findings) {
      console.log(`  ${finding.question}: ${finding.answer}`);
    }
  } finally {
    await browser.close();
  }
}

await main().catch((error: unknown) => {
  console.error(`Probe failed against ${BASE}:`, error);
  process.exitCode = 1;
});
