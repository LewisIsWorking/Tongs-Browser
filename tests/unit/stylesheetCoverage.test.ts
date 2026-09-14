import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { listSourceFiles } from '../../scripts/sizes/listing.ts';

/**
 * Every class the module puts on an element has a rule in the stylesheet. Written 2026-09-14.
 *
 * ⛔ WHY THIS EXISTS. The create-sheet and party-access pickers shipped in 0.28.0 and 0.29.0 with NO
 * styles at all: `tb-choice-menu` was never written into `tongs-browser.css`. Every test passed,
 * because jsdom has no layout and a picker with no rules still has rows to click. Measured in a real
 * Foundry at 1600x1000, the picker was a 61x28px button in the top right corner, under the 44px a
 * phone needs. Nothing anywhere compared the class names the code writes with the rules that exist.
 *
 * ⚠️ Read as TEXT, with comments stripped, so prose that names a class is not counted as using it.
 */
const CLASS = /(?<![-\w./])tb-[a-z0-9]+(?:(?:__|--|[_-])[a-z0-9]+)*/g;

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Classes that are MARKERS, deliberately unstyled. Each is read by something other than the
 * stylesheet, and says what.
 */
const MARKERS: Readonly<Record<string, string>> = {
  'tb-key--sticky': 'names the key kind; tests/dom/keyButtons.test.ts asserts it',
  'tb-key--momentary': 'names the key kind; tests/dom/keyButtons.test.ts asserts it',
  'tb-roll-deck__card--picker': 'tells a picker from a card; it looks the same on purpose',
};

const used = new Map<string, string>();
for (const file of listSourceFiles().filter((f) => f.startsWith('src/') && f.endsWith('.ts'))) {
  for (const match of stripComments(readFileSync(file, 'utf8')).matchAll(CLASS)) {
    if (!used.has(match[0])) {
      used.set(match[0], file);
    }
  }
}

const styled = new Set(
  [...readFileSync('styles/tongs-browser.css', 'utf8').matchAll(/\.(tb-[a-z0-9_-]+)/g)].map(
    (match) => match[1]
  )
);

describe('classes the module writes', () => {
  /** ⚠️ Proves the scan sees real classes, so an empty result cannot pass by looking at nothing. */
  it('finds the classes it knows are in use', () => {
    expect(used.size).toBeGreaterThan(20);
    expect(used.has('tb-cursor')).toBe(true);
    expect(used.has('tb-choice-menu__item')).toBe(true);
  });

  it('have a rule in the stylesheet, unless they are a documented marker', () => {
    const unstyled = [...used]
      .filter(([name]) => !styled.has(name) && MARKERS[name] === undefined)
      .map(([name, file]) => `${name} (${file})`);

    expect(unstyled).toEqual([]);
  });

  /** A marker that gains a rule, or stops being used, should leave the list rather than rot in it. */
  it('lists only markers that are used and still unstyled', () => {
    const stale = Object.keys(MARKERS).filter((name) => !used.has(name) || styled.has(name));

    expect(stale).toEqual([]);
  });
});
