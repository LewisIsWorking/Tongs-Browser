import { describe, expect, it } from 'vitest';

import { playerHint } from '../../src/welcome/Companions.js';
import { COMPANION_KINDS } from '../../src/welcome/companionKinds.js';
import { KIBWE, world } from './support/companionWorld.js';

/** Companion sheets when something is missing, and what the player is told. 2026-10-12. */
describe('when something is missing', () => {
  it('tells the GM a create failed, and does not try again this session', async () => {
    let tries = 0;
    const { companions, told, marks } = world([KIBWE], [], {
      create: async () => {
        tries += 1;
        return Promise.reject(new Error('Foundry said no.'));
      },
    });
    await companions.serve();
    await companions.serve();
    expect(tries).toBe(1);
    expect(marks).toEqual([]);
    expect(told).toEqual([
      "Tongs could not make Kibwe's Animal Companion for Lai: Foundry said no.",
    ]);
  });

  it('still marks a companion that could not join the party, and says why', async () => {
    const { companions, marks, told } = world([KIBWE], [], {
      join: async () => Promise.reject(new Error('No room.')),
    });
    await companions.serve();
    expect(marks).toEqual(['Actor.A=animal-companion']);
    expect(told[0]).toBe(
      "Tongs made Kibwe's Animal Companion for Lai. It could not join The Party: No room."
    );
  });

  it("says Companion Compendia's pack is missing, without crashing, and survives a failed whisper", async () => {
    const { companions, told, marks } = world([{ ...KIBWE, ownerIds: ['u1', 'u7'] }], [], {
      packLabel: () => null,
      tellPlayers: async () => Promise.reject(new Error('no chat')),
    });
    await companions.serve();
    expect(told[0]).toBe(
      `Tongs made Kibwe's Animal Companion for Lai and a player. Companion Compendia's "AC-Ancestries-and-Class" pack is missing here; Tongs assumes the pf2e-animal-companions module is active.`
    );
    expect(marks).toHaveLength(1);
  });
});

describe('a create that throws something odd', () => {
  it('still says what went wrong', async () => {
    const { companions, told } = world([KIBWE], [], {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      create: async () => Promise.reject('offline'),
    });
    await companions.serve();
    expect(told).toEqual(["Tongs could not make Kibwe's Animal Companion for Lai: offline"]);
  });
});

describe("the player's hint", () => {
  const kind = (name: string) => COMPANION_KINDS.find((each) => each.kind === name)!;
  it('says what each sheet still needs', () => {
    expect(playerHint('X', kind('pet'), null)).toContain('choose its pet abilities');
    expect(playerHint('X', kind('familiar'), null)).toContain('choose its familiar abilities');
    expect(playerHint('X', kind('drone'), null)).toContain("build it from your drone's rules");
    expect(playerHint('X', kind('undead-companion'), 'CC Ancestries')).toContain(
      'with the undead trait'
    );
    expect(playerHint('X', kind('eidolon'), null)).toContain('not on in this world yet');
  });
});
