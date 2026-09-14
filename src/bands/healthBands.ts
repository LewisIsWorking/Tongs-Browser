/**
 * An enemy's health as a band players may see, never as HP. Added 2026-09-14.
 *
 * ⛔ WORDS APPROVED BY LEWIS, 2026-09-14. Ten segments, one per 10% of max HP, plus a separate 0:
 * 1 HP and dead never share a segment. Temporary HP is left out: current over max.
 *
 * ⚠️ ROUNDED UP, in integers. `ceil(hp * 10 / max)` puts exactly 50% in segment 5 every time, and 91-100%
 * in segment 10. Integer arithmetic, because `hp / max * 10` can land a hair above a whole number and
 * push an exact boundary into the next segment.
 *
 * ⚠️ The words must fit the creature: a robot does not bleed. The set is chosen from its traits.
 */
export type CreatureKind = 'living' | 'construct' | 'undead' | 'ooze' | 'incorporeal';

/** Index 0 is down; index 10 is 91-100%. */
export const BAND_WORDS: Readonly<Record<CreatureKind, readonly string[]>> = Object.freeze({
  living: [
    'Down',
    'Near death',
    'Staggering',
    'Reeling',
    'Battered',
    'Wounded',
    'Bloodied',
    'Bruised',
    'Scratched',
    'Grazed',
    'Unhurt',
  ],
  construct: [
    'Destroyed',
    'Barely running',
    'Critical',
    'Failing',
    'Smoking',
    'Sparking',
    'Damaged',
    'Dented',
    'Scored',
    'Scuffed',
    'Pristine',
  ],
  undead: [
    'Destroyed',
    'Near destroyed',
    'Barely holding',
    'Falling apart',
    'Breaking apart',
    'Crumbling',
    'Fractured',
    'Splintered',
    'Cracked',
    'Chipped',
    'Unharmed',
  ],
  ooze: [
    'Destroyed',
    'Nearly spilled',
    'Puddling',
    'Dissolving',
    'Splitting',
    'Leaking',
    'Seeping',
    'Sloshing',
    'Rippling',
    'Quivering',
    'Intact',
  ],
  incorporeal: [
    'Dispersed',
    'Almost gone',
    'Barely there',
    'Faint',
    'Flickering',
    'Dimming',
    'Fading',
    'Blurred',
    'Wavering',
    'Shimmering',
    'Vivid',
  ],
});

/** 0 when down, otherwise 1-10. A max of zero or less reads as down, since nothing sensible is left. */
export function segmentsFor(hp: number, max: number): number {
  if (hp <= 0 || max <= 0) {
    return 0;
  }
  return Math.min(10, Math.ceil((Math.min(hp, max) * 10) / max));
}

/**
 * ⚠️ ORDER MATTERS when a creature has two of these. A ghost is undead AND incorporeal, and fades rather
 * than cracks; an ooze that is also a construct still sloshes. So: incorporeal, ooze, undead, construct.
 * Measured on SF2e 1.5.0's bestiaries: robots carry `construct` and `robot`. NOT `tech`: that is also on
 * androids (`android, humanoid, tech`) and on a metal elemental, which do not dent.
 */
export function creatureKind(traits: readonly string[]): CreatureKind {
  const has = (...names: string[]) => names.some((name) => traits.includes(name));
  if (has('incorporeal')) return 'incorporeal';
  if (has('ooze')) return 'ooze';
  if (has('undead')) return 'undead';
  if (has('construct', 'robot')) return 'construct';
  return 'living';
}

export function bandWord(kind: CreatureKind, segments: number): string {
  const index = Math.max(0, Math.min(10, segments));
  return BAND_WORDS[kind].slice(index, index + 1).join('');
}
