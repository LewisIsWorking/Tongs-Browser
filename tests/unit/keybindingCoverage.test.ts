import { describe, expect, it } from 'vitest';

import { barCodesFrom, trayIdsFrom } from '../../scripts/keybindings/parse.ts';
import {
  countByKind,
  findProblems,
  ROUTES,
  type Route,
} from '../../scripts/keybindings/coverage.ts';
import { CORE_BINDINGS } from '../../scripts/keybindings/snapshot.ts';

/**
 * The keybinding coverage guard. Written 2026-09-07.
 *
 * COVERS: the rules, and the parsing that feeds them, against made up input.
 * MISSES: whether the snapshot still matches the installed Foundry. Nothing here can know that; the
 *   snapshot is dated and the guard prints the version it was taken from so a stale one is visible.
 */
const binding = (name: string) => [{ name, keys: ['KeyZ'] }];

describe('accounting for every binding', () => {
  /** ⛔ The reason the guard exists: a NEW Foundry binding must not pass unnoticed. */
  it('reports a binding with no route at all', () => {
    const problems = findProblems(new Set(), new Set(), binding('invented'), {});

    expect(problems).toHaveLength(1);
    expect(problems[0]?.reason).toContain('not accounted for');
    /* ⚠️ Names the KEYS, so the message says what the capability is rather than only that one exists. */
    expect(problems[0]?.reason).toContain('KeyZ');
  });

  it('accepts a binding that has one', () => {
    const routes: Record<string, Route> = { invented: { kind: 'bar', via: 'KeyZ' } };

    expect(findProblems(new Set(['KeyZ']), new Set(), binding('invented'), routes)).toEqual([]);
  });
});

describe('routes that stopped being true', () => {
  /**
   * ⛔ The half with teeth. A table claiming "target is reached by the bar key KeyT" is worth nothing
   * if removing KeyT leaves it reading as authoritative, which is how a coverage document rots into a
   * confident lie.
   */
  it('reports a route naming a bar key the bar no longer offers', () => {
    const routes: Record<string, Route> = { invented: { kind: 'bar', via: 'KeyZ' } };
    const problems = findProblems(new Set(['KeyOther']), new Set(), binding('invented'), routes);

    expect(problems[0]?.reason).toContain('no longer offers');
  });

  it('reports a route naming a tray button the control pad no longer offers', () => {
    const routes: Record<string, Route> = { invented: { kind: 'tray', via: 'gone' } };
    const problems = findProblems(new Set(), new Set(['other']), binding('invented'), routes);

    expect(problems[0]?.reason).toContain('no longer offers');
  });

  /** ⚠️ The other direction: a route for something Foundry has since dropped is dead weight. */
  it('reports a route for a binding Foundry no longer registers', () => {
    const routes: Record<string, Route> = { retired: { kind: 'gap', note: 'gone from core' } };
    const problems = findProblems(new Set(), new Set(), binding('invented'), routes);

    expect(problems.map((problem) => problem.binding)).toContain('retired');
  });

  /** ⚠️ `ui` and `gap` name no control, so nothing about them can go stale this way. */
  it('does not police a ui or gap route, which claim no control of ours', () => {
    const routes: Record<string, Route> = {
      invented: { kind: 'ui', via: 'somewhere', note: 'reachable on screen' },
    };

    expect(findProblems(new Set(), new Set(), binding('invented'), routes)).toEqual([]);
  });
});

describe('parsing the module’s own source', () => {
  it('reads key codes out of the definitions', () => {
    const source = "{ code: 'KeyT', key: 't' },\n{ code: 'Escape', key: 'Escape' },";

    expect([...barCodesFrom(source)]).toEqual(['KeyT', 'Escape']);
  });

  /** ⚠️ Six spaces of indent, which is where a tray action's `id` sits and where a nested one does not. */
  it('reads tray ids out of the action list', () => {
    const source = "    {\n      id: 'sidebar',\n      label: 'x',\n    },\n  id: 'not-an-action',";

    expect([...trayIdsFrom(source)]).toEqual(['sidebar']);
  });
});

describe('the live table', () => {
  /** ⚠️ Every real binding is classified. This is the assertion the whole guard is built to make. */
  it('accounts for every binding Foundry registers', () => {
    for (const entry of CORE_BINDINGS) {
      expect(ROUTES[entry.name], `${entry.name} has no route`).toBeDefined();
    }
  });

  it('counts every route under exactly one kind', () => {
    const counts = countByKind();
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

    expect(total).toBe(Object.keys(ROUTES).length);
  });
});
