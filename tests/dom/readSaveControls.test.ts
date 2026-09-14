import { describe, expect, it } from 'vitest';

import { readSaveControlsFromHtml } from '../../src/deck/readSaveControls.js';

/**
 * Reading the saves a chat card asks for. Written 2026-09-13.
 *
 * ⛔ THE FIXTURES ARE MEASURED DATASETS from pf2e 8.5.0: a Quasit casting Fear, and the Quasit's Venom
 * ability with its enriched `@Check`. Only the surrounding markup is trimmed.
 */
const FEAR = `<div class="chat-card"><footer class="card-buttons">
  <button type="button" data-action="spell-save" data-save="will" data-dc="17"
    data-owner-title="Base DC 10, Modifier +7">Will Save</button></footer></div>`;

const VENOM = `<div class="description"><p>Saving Throw
  <a class="inline-check with-repost" data-pf2-traits="poison" data-pf2-label="Quasit Venom DC"
    data-pf2-check="fortitude" data-roller-role="target" data-pf2-dc="17">DC 17 Fortitude</a></p></div>`;

const read = (html: string) => readSaveControlsFromHtml(document, html);

describe('measured cards', () => {
  it("reads a spell card's save button", () => {
    expect(read(FEAR)).toEqual([{ statistic: 'will', dc: 17, control: 'spell-save', index: 0 }]);
  });

  it("reads an ability's inline check", () => {
    expect(read(VENOM)).toEqual([
      { statistic: 'fortitude', dc: 17, control: 'inline-check', index: 0 },
    ]);
  });
});

describe('what is not a save', () => {
  it('ignores a message with neither control', () => {
    expect(read('<p>The goblin laughs.</p>')).toEqual([]);
  });

  /**
   * ⛔ The index counts EVERY inline check, so the save after an Athletics check is index 1. Rolling
   * clicks the control at that index; counting only saves would click the Athletics check instead.
   */
  it('skips a non-save inline check without renumbering the save after it', () => {
    const html = `<a data-pf2-check="athletics" data-pf2-dc="20">Athletics</a>
      <a data-pf2-check="reflex" data-pf2-dc="19">Reflex</a>`;

    expect(read(html)).toEqual([
      { statistic: 'reflex', dc: 19, control: 'inline-check', index: 1 },
    ]);
  });

  /** ⚠️ PF2e's listener matches only links and spans, so a div is not a control it would roll. */
  it('does not count an element PF2e would not listen to', () => {
    expect(read('<div data-pf2-check="will" data-pf2-dc="15">Will</div>')).toEqual([]);
  });
});

describe('the DC', () => {
  it('is null when the control states no DC', () => {
    expect(read('<a data-pf2-check="will">Will</a>')[0]?.dc).toBeNull();
    expect(read('<a data-pf2-check="will" data-pf2-dc="">Will</a>')[0]?.dc).toBeNull();
  });

  it('is null when the DC is a formula rather than a number', () => {
    expect(read('<a data-pf2-check="will" data-pf2-dc="@self.level">Will</a>')[0]?.dc).toBeNull();
  });
});

describe('parsing a player-written message', () => {
  /** ⛔ Inert: the template's image never becomes a live element in the document. */
  it('does not put anything from the message into the document', () => {
    read('<img src="https://example.invalid/x.png" id="probe-img"><a data-pf2-check="will">W</a>');

    expect(document.getElementById('probe-img')).toBeNull();
  });
});
