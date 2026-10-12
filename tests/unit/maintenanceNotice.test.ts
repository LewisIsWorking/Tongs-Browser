import { describe, expect, it } from 'vitest';

import { bannerText, readMaintenance, verdict } from '../../src/maintenance/maintenanceNotice.js';

/**
 * COO's nightly update, as Tongs reads it (2026-10-11). Lewis: "force people off the world and give them a
 * detailed progress UI". The banner counts down on the SERVER's clock; `running` sends people to the page.
 */
const T = Date.parse('2026-10-12T04:55:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

describe('readMaintenance', () => {
  it('reads a warning, keeping how far the server clock is from this one', () => {
    const m = readMaintenance(
      { phase: 'warning', world: 'c06', now: iso(T + 90_000), closesAt: iso(T + 300_000) },
      T
    );
    expect(m).toEqual({ phase: 'warning', world: 'c06', closesAt: T + 300_000, skewMs: 90_000 });
  });

  it('is null for anything that is not COO (a world it does not host answers with a 404 page)', () => {
    expect(readMaintenance(null, T)).toBeNull();
    expect(readMaintenance({ phase: 'nonsense' }, T)).toBeNull();
    expect(readMaintenance('<html>', T)).toBeNull();
  });

  it('copes without a world or times', () => {
    expect(readMaintenance({ phase: 'running' }, T)).toEqual({
      phase: 'running',
      world: null,
      closesAt: null,
      skewMs: 0,
    });
  });
});

describe('verdict', () => {
  const warn = readMaintenance(
    { phase: 'warning', world: 'c06', now: iso(T), closesAt: iso(T + 272_000) },
    T
  );

  it('counts down on the server clock', () => {
    expect(verdict(warn, 'c06', T)).toEqual({ kind: 'banner', secondsLeft: 272 });
    // This phone runs a minute fast: the server's clock still decides.
    const skewed = readMaintenance(
      { phase: 'warning', world: 'c06', now: iso(T), closesAt: iso(T + 272_000) },
      T + 60_000
    );
    expect(verdict(skewed, 'c06', T + 60_000)).toEqual({ kind: 'banner', secondsLeft: 272 });
  });

  it('never counts below zero', () => {
    expect(verdict(warn, 'c06', T + 400_000)).toEqual({ kind: 'banner', secondsLeft: 0 });
  });

  it('sends people to the progress page once the update runs', () => {
    expect(verdict(readMaintenance({ phase: 'running', world: 'c06' }, T), 'c06', T)).toEqual({
      kind: 'leave',
    });
    expect(verdict(readMaintenance({ phase: 'running', world: null }, T), 'c06', T)).toEqual({
      kind: 'leave',
    });
  });

  it('leaves a tab on another world alone', () => {
    expect(verdict(warn, 'c01', T)).toEqual({ kind: 'none' });
    expect(verdict(readMaintenance({ phase: 'running', world: 'c06' }, T), 'c01', T)).toEqual({
      kind: 'none',
    });
  });

  it('says nothing when idle, done or failed', () => {
    for (const phase of ['idle', 'done', 'failed']) {
      expect(verdict(readMaintenance({ phase, world: 'c06' }, T), 'c06', T)).toEqual({
        kind: 'none',
      });
    }
    expect(verdict(null, 'c06', T)).toEqual({ kind: 'none' });
  });
});

describe('bannerText', () => {
  it('says when, and that nothing is lost', () => {
    expect(bannerText(272)).toContain('closes in 4:32');
    expect(bannerText(272)).toContain('Everything is saved');
    expect(bannerText(5)).toContain('closes in 0:05');
    expect(bannerText(0)).toContain('is closing now');
  });
});
