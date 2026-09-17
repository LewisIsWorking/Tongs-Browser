import type { NameRules } from '../bands/bandSubject.js';
import { MODULE_ID } from '../constants.js';

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
 *
 * 📜 Added 2026-09-17 for the encounter's wiki page: its name, the scene it is fought on, and each combatant's
 * initiative. The name is the GM's (`flags['tongs-browser'].encounterName`) when set, otherwise the scene's.
 */
export interface EncounterCombatant {
  readonly name: string;
  readonly acted: boolean;
  readonly telegramUserId?: string;
  readonly initiative?: number;
}

export interface EncounterSnapshot {
  readonly encounterId: string;
  readonly round: number;
  readonly allies: EncounterCombatant[];
  readonly enemies: EncounterCombatant[];
  readonly ended: boolean;
  readonly trackerMessageId?: number;
  readonly name?: string;
  readonly location?: string;
}

export interface CombatantLike {
  readonly name?: string | null;
  readonly hidden?: boolean;
  readonly defeated?: boolean;
  readonly initiative?: number | null;
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
  readonly scene?: { readonly name?: string; readonly navName?: string } | null;
  readonly flags?: Readonly<Record<string, { readonly encounterName?: unknown } | undefined>>;
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

/** The encounter's name and location, each left out when Foundry has none. */
function naming(combat: CombatLike): { name?: string; location?: string } {
  /* ⛔ The navigation name when the GM set one: players see that, and the real name can be a spoiler. */
  const shown = combat.scene?.navName?.trim();
  const location = shown === undefined || shown === '' ? combat.scene?.name?.trim() : shown;
  const given = combat.flags?.[MODULE_ID]?.encounterName;
  const name = typeof given === 'string' && given.trim() !== '' ? given.trim() : location;
  return {
    ...(name === undefined || name === '' ? {} : { name }),
    ...(location === undefined || location === '' ? {} : { location }),
  };
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
    const rolled =
      typeof combatant.initiative === 'number' ? { initiative: combatant.initiative } : {};
    if (actor?.hasPlayerOwner === true || actor?.alliance === 'party') {
      const player = playerOf(combatant, links);
      allies.push({
        name,
        acted,
        ...(player === undefined ? {} : { telegramUserId: player }),
        ...rolled,
      });
    } else {
      const seen = combatant.token?.playersCanSeeName === true || !rules.nameVisibility;
      enemies.push({ name: seen ? name : rules.mystifiedName, acted, ...rolled });
    }
  });
  return { encounterId: combat.id, round, allies, enemies, ended, ...naming(combat) };
}
