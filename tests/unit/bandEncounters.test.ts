import { describe, expect, it } from 'vitest';

import { BandReporter } from '../../src/bands/BandReporter.js';
import { combatOfToken, combatSubjects, subjectsForActor } from '../../src/bands/bandTokens.js';
import type { ActorLike, BandGlobals, TokenDocLike } from '../../src/bands/bandTokens.js';

/**
 * Found live on Forge, 2026-09-15: the GM's tracker showed encounter 1 while a player hit an enemy in
 * encounter 4, and its band was never posted. A band follows the encounter its creature is in.
 */
const enemy = (hp: number): ActorLike => ({
  isToken: false,
  hasPlayerOwner: false,
  alliance: 'opposition',
  system: { attributes: { hp: { value: hp, max: 10 } }, traits: { value: ['animal'] } },
  hasCondition: () => false,
  getActiveTokens: () => [],
});
const token = (scene: string, id: string, actor: ActorLike): TokenDocLike => ({
  id,
  uuid: `Scene.${scene}.Token.${id}`,
  name: id,
  hidden: false,
  playersCanSeeName: true,
  actor,
});
const tiny = enemy(6);
const kibweFoe = enemy(10);
const world: BandGlobals = {
  game: {
    combats: {
      contents: [
        {
          id: 'one',
          started: true,
          combatants: {
            contents: [{ tokenId: 'Foe', sceneId: 'S1', token: token('S1', 'Foe', kibweFoe) }],
          },
        },
        {
          id: 'four',
          started: true,
          combatants: {
            contents: [{ tokenId: 'Tiny', sceneId: 'S9', token: token('S9', 'Tiny', tiny) }],
          },
        },
      ],
    },
  },
};

describe('a band in an encounter the tracker is not showing', () => {
  it('finds a linked enemy fighting on a scene the GM is not viewing', () => {
    expect(subjectsForActor(tiny, world).map((s) => s?.tokenUuid)).toEqual(['Scene.S9.Token.Tiny']);
    expect(combatSubjects(world).map((s) => s?.tokenUuid)).toEqual([
      'Scene.S1.Token.Foe',
      'Scene.S9.Token.Tiny',
    ]);
  });

  it("names the creature's own encounter, and none for a token in no encounter or no token at all", () => {
    expect(combatOfToken(world, 'Scene.S9.Token.Tiny')?.id).toBe('four');
    expect(combatOfToken(world, 'Scene.S9.Token.Nobody')).toBeUndefined();
    expect(combatOfToken(world, 'not a token')).toBeUndefined();
  });

  it("asks for the campaign of each creature's own token, so two encounters post to their own topics", async () => {
    const asked: string[] = [];
    const reporter = new BandReporter({
      role: () => 'act',
      campaign: (tokenUuid) => {
        asked.push(tokenUuid);
        return { kind: 'one', code: tokenUuid.includes('S9') ? 'C04' : 'C06' };
      },
      subjectsFor: (actor) => subjectsForActor(actor, world),
      combatSubjects: () => [],
      post: () => Promise.resolve('sent'),
      causeFor: () => Promise.resolve('manual change'),
      warn: () => undefined,
    });
    await reporter.onActorUpdated(tiny, { system: { attributes: { hp: { value: 6 } } } });
    await reporter.onActorUpdated(kibweFoe, { system: { attributes: { hp: { value: 10 } } } });
    expect(asked).toEqual(['Scene.S9.Token.Tiny', 'Scene.S1.Token.Foe']);
  });
});
