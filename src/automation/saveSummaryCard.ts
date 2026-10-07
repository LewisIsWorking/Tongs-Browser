import { readBandSubject } from '../bands/bandSubject.js';
import type { NameRules, TokenView } from '../bands/bandSubject.js';
import { escapeHtml } from '../bands/settingsMenu.js';
import type { DamageGroup } from './validateSpellDamage.js';

/**
 * The card that tells the table what Tongs rolled for a spell. Added 2026-10-07.
 *
 * ⛔ DECIDED WITH LEWIS: "a card in the chat ... not saying what the numerical result was, just the stage
 * success (critical success, success, fail, critical failure) and the same information as posted to
 * telegram such as health bands", and the saves themselves are GM-only. So the card holds degrees, then
 * the damage each target took and its band once the damage lands, and never a number.
 *
 * ⚠️ Names follow the bands' rules: a creature the players may not name is "The creature", and a band is
 * shown only where Telegram would show one (an enemy in combat that the players can see).
 */
export const SUMMARY_FLAG = 'saveSummary';

export type Taken = 'none' | DamageGroup['optionId'];

export interface SummaryTarget {
  readonly name: string;
  readonly outcome: string;
  /** What the damage did to it, or null before any damage was applied. */
  readonly taken: Taken | null;
  readonly band: { readonly segments: number; readonly word: string } | null;
}

export interface SummaryCard {
  readonly spellName: string;
  readonly targets: readonly SummaryTarget[];
}

/** Stored on the card, so the next save or the damage can rewrite it, and the caster's browser can tell. */
export interface SummaryFlags {
  readonly castId: string;
  readonly casterUserId: string | null;
  readonly text: string;
  readonly taken: Readonly<Record<string, Taken>> | null;
}

/** ⚠️ A Map, not an object: a save's outcome must never match `constructor`. */
const DEGREES: ReadonlyMap<string, string> = new Map([
  ['criticalSuccess', 'Critical success'],
  ['success', 'Success'],
  ['failure', 'Failure'],
  ['criticalFailure', 'Critical failure'],
]);
const TAKEN: Readonly<Record<Taken, string>> = {
  none: 'no damage',
  half: 'half damage',
  full: 'full damage',
  double: 'double damage',
};
const SEGMENTS = 10;

/** The name players may see, and the band Telegram would post; see the note above. */
export function summaryTarget(
  view: TokenView | null,
  rules: NameRules
): Pick<SummaryTarget, 'name' | 'band'> {
  const subject = view === null ? null : readBandSubject(view, rules);
  if (subject !== null) {
    return { name: subject.name, band: { segments: subject.segments, word: subject.word } };
  }
  const named =
    view !== null &&
    !view.hidden &&
    !view.unseen &&
    (view.ally || view.playersCanSeeName || !rules.nameVisibility);
  return { name: named ? view.name : rules.mystifiedName, band: null };
}

export function summaryLine(target: SummaryTarget): string {
  const degree = DEGREES.get(target.outcome) ?? 'Rolled';
  if (target.taken === null) {
    return `${target.name}: ${degree}`;
  }
  const band =
    target.band === null
      ? ''
      : `. ${'▰'.repeat(target.band.segments)}${'▱'.repeat(SEGMENTS - target.band.segments)} ${target.band.word}`;
  return `${target.name}: ${degree}, ${TAKEN[target.taken]}${band}`;
}

/** The caster's pop-up. */
export function summaryText(card: SummaryCard): string {
  return `Tongs rolled the saves against ${card.spellName}. ${card.targets.map(summaryLine).join('; ')}.`;
}

export function summaryHtml(card: SummaryCard): string {
  const lines = card.targets.map((target) => `<li>${escapeHtml(summaryLine(target))}</li>`);
  return (
    `<div class="tongs-save-summary"><p><strong>Saves against ${escapeHtml(card.spellName)}</strong></p>` +
    `<ul>${lines.join('')}</ul><p><em>Rolled by Tongs; the rolls are for the GM's eyes only.</em></p></div>`
  );
}

/** The card's own flags, or null for any other message. */
export function summaryOf(
  message: { readonly flags?: Readonly<Record<string, unknown>> },
  moduleId: string
): SummaryFlags | null {
  const mine = message.flags?.[moduleId] as Record<string, unknown> | undefined;
  const flags = mine?.[SUMMARY_FLAG] as Partial<SummaryFlags> | undefined;
  return typeof flags?.castId === 'string' ? (flags as SummaryFlags) : null;
}

/** The pop-up text when this browser's user cast the spell, otherwise null. */
export function popupFor(
  message: { readonly flags?: Readonly<Record<string, unknown>> },
  moduleId: string,
  myUserId: string | null
): string | null {
  const flags = summaryOf(message, moduleId);
  return flags !== null && myUserId !== null && flags.casterUserId === myUserId ? flags.text : null;
}
