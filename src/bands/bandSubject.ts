import { bandWord, creatureKind, segmentsFor } from './healthBands.js';

/**
 * Whether a token's health may be told to players, and under what name. Added 2026-09-14.
 *
 * ⛔ FROM THE PHASE 2 BRIEF: a public band reveals that a creature exists, so only tokens players can
 * currently see are posted, and only under the name they can see.
 *
 * ⛔ THE NAME FOLLOWS PF2e's OWN RULE, read from pf2e 8.5.0's chat code:
 * `playersCanSeeName || !game.pf2e.settings.tokens.nameVisibility`, and otherwise PF2e's own
 * "The creature" (`PF2E.Token.Mystified.TheCreature`). Measured: SF2e 1.5.0 has the same setting under
 * `game.pf2e` and the same key. `playersCanSeeName` itself is true only for the Always and Hover
 * nameplate modes or a party creature.
 */
export interface TokenView {
  readonly tokenUuid: string;
  readonly name: string;
  readonly hidden: boolean;
  readonly playersCanSeeName: boolean;
  readonly hp: number;
  readonly maxHp: number;
  readonly traits: readonly string[];
  /** A player owns it, or it fights on the party's side. */
  readonly ally: boolean;
  readonly inCombat: boolean;
  /** Any of PF2e's invisible, undetected or unnoticed conditions. */
  readonly unseen: boolean;
}

export interface NameRules {
  readonly nameVisibility: boolean;
  readonly mystifiedName: string;
}

export interface BandSubject {
  readonly tokenUuid: string;
  readonly name: string;
  readonly segments: number;
  readonly word: string;
  readonly hp: number;
  readonly maxHp: number;
}

/** Null when this token's health is none of the players' business. */
export function readBandSubject(view: TokenView, rules: NameRules): BandSubject | null {
  if (view.ally || !view.inCombat || view.hidden || view.unseen || view.maxHp <= 0) {
    return null;
  }
  const segments = segmentsFor(view.hp, view.maxHp);
  return {
    tokenUuid: view.tokenUuid,
    name: view.playersCanSeeName || !rules.nameVisibility ? view.name : rules.mystifiedName,
    segments,
    word: bandWord(creatureKind(view.traits), segments),
    hp: Math.max(0, view.hp),
    maxHp: view.maxHp,
  };
}
