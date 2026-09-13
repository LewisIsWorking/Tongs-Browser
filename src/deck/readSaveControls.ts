import type { SaveControlKind, SaveFacts, SaveStatistic } from './deckFacts.js';

/**
 * The saves a chat card asks for, read from PF2e's own controls in its HTML. Added 2026-09-13.
 *
 * ⛔ BUILT AGAINST MEASURED MESSAGES, pf2e 8.5.0, 2026-09-13, both found in the STORED content:
 *
 *     spell card (a Quasit casting Fear)
 *       <button data-action="spell-save" data-save="will" data-dc="17">
 *     enriched @Check (the Quasit's Venom)
 *       <a class="inline-check" data-pf2-check="fortitude" data-pf2-dc="17" data-roller-role="target">
 *
 * ⚠️ The selectors are PF2e's own, so rolling can click the very element PF2e listens to:
 * `ChatCards.listen` binds `button[data-action]` and `InlineRollLinks` matches `a[data-pf2-check]` and
 * `span[data-pf2-check]`. A looser selector here would count elements PF2e ignores, and the `index`
 * would then point at the wrong control.
 */
export const SAVE_CONTROL_SELECTORS: Readonly<Record<SaveControlKind, string>> = {
  'spell-save': 'a[data-action="spell-save"], button[data-action="spell-save"]',
  'inline-check': 'a[data-pf2-check], span[data-pf2-check]',
};

const STATISTICS: readonly SaveStatistic[] = ['fortitude', 'reflex', 'will'];

function asStatistic(value: string | undefined): SaveStatistic | null {
  return STATISTICS.find((statistic) => statistic === value) ?? null;
}

/** ⚠️ Only a whole number is a DC. `@self.level` or an absent DC reads as null, not as NaN or 0. */
function asDc(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') {
    return null;
  }
  const dc = Number(value);
  return Number.isInteger(dc) ? dc : null;
}

function readKind(root: ParentNode, control: SaveControlKind): SaveFacts[] {
  const saves: SaveFacts[] = [];
  root.querySelectorAll<HTMLElement>(SAVE_CONTROL_SELECTORS[control]).forEach((element, index) => {
    const data = element.dataset;
    const statistic = asStatistic(control === 'spell-save' ? data['save'] : data['pf2Check']);
    if (statistic !== null) {
      const dc = asDc(control === 'spell-save' ? data['dc'] : data['pf2Dc']);
      saves.push({ statistic, dc, control, index });
    }
  });
  return saves;
}

export function readSaveControls(root: ParentNode): SaveFacts[] {
  return [...readKind(root, 'spell-save'), ...readKind(root, 'inline-check')];
}

/**
 * ⛔ Parsed into a `<template>`, never a `<div>`. Template content is inert: an `<img>` in a player's
 * message does not load and nothing in it runs. The deck reads every visible message, including ones a
 * player wrote, so parsing must not be a way to make the GM's browser fetch anything.
 */
export function readSaveControlsFromHtml(doc: Document, html: string): SaveFacts[] {
  const template = doc.createElement('template');
  template.innerHTML = html;
  return readSaveControls(template.content);
}
