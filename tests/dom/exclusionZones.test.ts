import { beforeEach, describe, expect, it } from 'vitest';

import { ExclusionZones } from '../../src/gesture/ExclusionZones.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('ExclusionZones', () => {
  const zones = new ExclusionZones();

  function withMarkup(html: string, selector: string): Element {
    document.body.innerHTML = html;
    const element = document.querySelector(selector);
    if (element === null) {
      throw new Error(`Fixture selector ${selector} matched nothing.`);
    }
    return element;
  }

  it('excludes text inputs, so typing in chat keeps a real keyboard and caret', () => {
    expect(zones.isExcluded(withMarkup('<input id="x">', '#x'))).toBe(true);
  });

  it('excludes textareas', () => {
    expect(zones.isExcluded(withMarkup('<textarea id="x"></textarea>', '#x'))).toBe(true);
  });

  it('excludes contenteditable regions', () => {
    expect(zones.isExcluded(withMarkup('<div id="x" contenteditable="true"></div>', '#x'))).toBe(
      true
    );
  });

  it('does not exclude contenteditable explicitly turned off', () => {
    expect(zones.isExcluded(withMarkup('<div id="x" contenteditable="false"></div>', '#x'))).toBe(
      false
    );
  });

  it('excludes the chat log, so native momentum scrolling keeps working', () => {
    expect(zones.isExcluded(withMarkup('<ol id="chat-log"></ol>', '#chat-log'))).toBe(true);
  });

  /**
   * Uses closest rather than matches, so a tap on a nested span inside an excluded container is
   * excluded too. Checking only the exact element hit would leak every child.
   */
  it('excludes descendants of an excluded container, not just the container itself', () => {
    const span = withMarkup(
      '<ol id="chat-log"><li class="message"><span id="inner">rolled 17</span></li></ol>',
      '#inner'
    );
    expect(zones.isExcluded(span)).toBe(true);
  });

  it('honours the explicit opt out attribute, so other modules can carve themselves out', () => {
    expect(
      zones.isExcluded(withMarkup('<div id="x" data-tongs-browser="ignore"></div>', '#x'))
    ).toBe(true);
  });

  it('does not exclude the canvas or ordinary interface elements', () => {
    expect(zones.isExcluded(withMarkup('<canvas id="board"></canvas>', '#board'))).toBe(false);
    expect(zones.isExcluded(withMarkup('<div id="plain"></div>', '#plain'))).toBe(false);
  });

  it('treats a null target as not excluded rather than throwing', () => {
    expect(zones.isExcluded(null)).toBe(false);
  });

  it('accepts additional selectors without a code change', () => {
    const widened = new ExclusionZones({ additionalSelectors: ['.my-module-panel'] });
    expect(widened.isExcluded(withMarkup('<div id="x" class="my-module-panel"></div>', '#x'))).toBe(
      true
    );
  });

  /**
   * ⚠️ PINS A LIVE AUDIT FINDING. `#chat-log` is an ID selector and it matched NOTHING on Foundry
   * 14.365: the log is `<ol class="chat-log">`, and the id belongs to the v12 markup. The exclusion
   * only kept working because `.chat-scroll` wraps the log and `closest` found that instead, which
   * is luck rather than design.
   *
   * The class form was added after that audit. Without this assertion it reads as a duplicate of the
   * id form and is exactly the kind of thing a tidy-up deletes, which would leave chat protected by
   * coincidence again.
   */
  it('excludes the chat log by class, not only by the id older Foundry used', () => {
    const selector = new ExclusionZones().getSelector();

    expect(selector).toContain('.chat-log');
    expect(selector).toContain('#chat-log');
  });

  /** Extra selectors widen the set without a code change, and must survive into the real selector. */
  it('carries an additional selector through to the one it matches on', () => {
    const selector = new ExclusionZones({
      additionalSelectors: ['.someone-elses-widget'],
    }).getSelector();

    expect(selector).toContain('.someone-elses-widget');
    expect(selector).toContain('.chat-log');
  });
});
