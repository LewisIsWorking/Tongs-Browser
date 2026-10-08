/**
 * A PF2e character as the Roll Pad reads it, every roll method recording what it was asked. Written
 * 2026-10-08, in the shape of PF2e 8.5's `CharacterPF2e`: `system.actions` holds strikes with
 * `variants[].roll`, `damage` and `critical`; `perception`, `saves.*` and `skills.*` are statistics
 * with `label`, `mod`, `rank` and `roll`.
 *
 * ⚠️ Each method records `this` as well as its params: PF2e's statistics read `this`, so a roll
 * called detached from its owner would fail in Foundry and must fail here.
 */
export interface RollCall {
  readonly what: string;
  readonly self: unknown;
  readonly params: unknown;
}

export function padActor(calls: RollCall[] = []) {
  function roller(what: string) {
    return function (this: unknown, params: unknown) {
      calls.push({ what, self: this, params });
      return Promise.resolve({});
    };
  }
  const statistic = (key: string, label: string, mod: number, rank: number) => ({
    label,
    mod,
    rank,
    roll: roller(key),
  });
  const longsword = {
    type: 'strike',
    label: 'Longsword',
    ready: true,
    variants: [
      { label: 'Strike +9', roll: roller('longsword 0') },
      { label: 'MAP -5', roll: roller('longsword 1') },
      { label: 'MAP -10', roll: roller('longsword 2') },
    ],
    damage: roller('longsword damage'),
    critical: roller('longsword critical'),
  };
  return {
    name: 'Thorin',
    system: {
      actions: [
        longsword,
        { type: 'strike', label: 'Hidden fist', visible: false, variants: [] },
        {
          type: 'strike',
          label: 'Shortbow',
          ready: false,
          variants: [{ label: 'Strike +7', roll: roller('shortbow 0') }],
          damage: roller('shortbow damage'),
        },
      ],
    },
    perception: statistic('perception', 'Perception', 6, 2),
    saves: {
      fortitude: statistic('fortitude', 'Fortitude', 8, 2),
      reflex: statistic('reflex', 'Reflex', 4, 1),
      will: statistic('will', 'Will', -1, 1),
    },
    skills: {
      stealth: statistic('stealth', 'Stealth', 1, 0),
      athletics: statistic('athletics', 'Athletics', 7, 1),
      acrobatics: statistic('acrobatics', 'Acrobatics', 2, 0),
      'warfare-lore': statistic('warfare-lore', 'Warfare Lore', 4, 1),
    },
  };
}
