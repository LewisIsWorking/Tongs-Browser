import type { NameRules } from '../bands/bandSubject.js';

/**
 * A Foundry encounter read into what the combat topic's tracker shows. Added 2026-09-16.
 *
 * ⛔ DECIDED WITH LEWIS: SIDE PHASES, as his own posts run them ("Round 1: Unacted Allies", numbered, with each
 * player named). ComeOnOverUno renders the text and decides the phase from these facts: the allies' phase lasts
 * while any ally has not acted.
 *
 * ⚠️ ACTED MEANS THE TURN HAS PASSED. Foundry keeps no "has acted" flag; its tracker keeps a turn pointer over
 * `combat.turns`. A combatant before the pointer in the current round has had its turn. Before the encounter
 * starts, nobody has.
 *
 * ⛔ PLAYERS ARE TOLD ONLY WHAT THEY CAN SEE. A combatant the GM has hidden is left out entirely, and a defeated
 * one no longer takes turns. An enemy is named by PF2e's own rule (`playersCanSeeName || !nameVisibility`),
 * otherwise "The creature", exactly as the health bands name it.
 */
export interface EncounterCombatant {
  readonly name: string;
  readonly acted: boolean;
  readonly telegramUserId?: string;
}

export interface EncounterSnapshot {
  readonly encounterId: string;
  readonly round: number;
  readonly allies: EncounterCombatant[];
  readonly enemies: EncounterCombatant[];
  readonly ended: boolean;
  readonly trackerMessageId?: number;
}

export interface CombatantLike {
  readonly name?: string | null;
  readonly hidden?: boolean;
  readonly defeated?: boolean;
  readonly token?: {
    readonly name?: string;
    readonly hidden?: boolean;
    readonly playersCanSeeName?: boolean;
  } | null;
  readonly actor?: {
    readonly hasPlayerOwner?: boolean;
    readonly alliance?: string | null;
    readonly ownership?: Readonly<Record<string, number>>;
  } | null;
}

export interface CombatLike {
  readonly id?: string;
  readonly round?: number;
  readonly turn?: number | null;
  readonly turns?: readonly CombatantLike[];
}

/** Foundry's OWNER permission level. */
const OWNER = 3;

/** Each player's Telegram user id, keyed by their Foundry user id; see `playerLinks.ts`. */
export type PlayerLinks = Readonly<Record<string, string>>;

/** The Telegram player of the first Foundry user who OWNS this actor and has a link. */
function playerOf(combatant: CombatantLike, links: PlayerLinks): string | undefined {
  const owners = Object.entries(combatant.actor?.ownership ?? {}).filter(
    ([user, level]) => user !== 'default' && level >= OWNER
  );
  return owners.map(([user]) => links[user]).find((id): id is string => typeof id === 'string');
}

export function readEncounter(
  combat: CombatLike,
  links: PlayerLinks,
  rules: NameRules,
  ended = false
): EncounterSnapshot | null {
  if (typeof combat.id !== 'string') {
    return null;
  }
  const round = combat.round ?? 0;
  const turn = round > 0 ? (combat.turn ?? 0) : -1;
  const allies: EncounterCombatant[] = [];
  const enemies: EncounterCombatant[] = [];
  (combat.turns ?? []).forEach((combatant, index) => {
    if (
      combatant.hidden === true ||
      combatant.token?.hidden === true ||
      combatant.defeated === true
    ) {
      return;
    }
    const actor = combatant.actor;
    const name = combatant.token?.name ?? combatant.name ?? '';
    const acted = index < turn;
    if (actor?.hasPlayerOwner === true || actor?.alliance === 'party') {
      const player = playerOf(combatant, links);
      allies.push({ name, acted, ...(player === undefined ? {} : { telegramUserId: player }) });
    } else {
      const seen = combatant.token?.playersCanSeeName === true || !rules.nameVisibility;
      enemies.push({ name: seen ? name : rules.mystifiedName, acted });
    }
  });
  return { encounterId: combat.id, round, allies, enemies, ended };
}
