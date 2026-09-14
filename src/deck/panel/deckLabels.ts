import type { SaveFacts } from '../deckFacts.js';
import type { TokenCandidate } from './tokenCandidates.js';

/**
 * What the save buttons and the deck's own controls say. Added 2026-09-14.
 *
 * ⚠️ Every button names what pressing it does, per `src/ui/README.md`: on a phone there is no hover to
 * check first. "Roll Will DC 17 for Goblin and Orc", never "Roll".
 */
const STATISTIC_NAME: Readonly<Record<SaveFacts['statistic'], string>> = {
  fortitude: 'Fortitude',
  reflex: 'Reflex',
  will: 'Will',
};

function describeSave(save: SaveFacts): string {
  const name = STATISTIC_NAME[save.statistic];
  return save.dc === null ? `${name} save` : `${name} DC ${String(save.dc)}`;
}

/** `Goblin`, `Goblin and Orc`, `Goblin, Orc and Troll`. */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) {
    return names.join('');
  }
  return `${names.slice(0, -1).join(', ')} and ${names.slice(-1).join('')}`;
}

/** The button on a card, which opens the choice of who rolls. */
export function chooseRollersLabel(save: SaveFacts): string {
  return `Choose who rolls ${describeSave(save)}`;
}

/** The confirm button, which names every roller, or says what is still missing. */
export function rollLabel(save: SaveFacts, chosen: readonly TokenCandidate[]): string {
  return chosen.length === 0
    ? `Tap each creature that rolls ${describeSave(save)}`
    : `Roll ${describeSave(save)} for ${listNames(chosen.map((candidate) => candidate.name))}`;
}

/** Where the GM is in the deck. */
export function positionLabel(index: number, count: number): string {
  return count === 0 ? 'Nothing to apply or roll' : `Card ${String(index + 1)} of ${String(count)}`;
}
