import { describe, expect, it, vi } from 'vitest';

import { ActivityLog, MAX_EVENTS, requestText } from '../../src/bands/activityLog.js';
import type { CooClient } from '../../src/bands/CooClient.js';
import { isSignedIn } from '../../src/bands/startBands.js';
import {
  activityHtml,
  FIRST_REPORT_MS,
  HEARTBEAT_MS,
  registerActivityMenu,
  startStatusHeartbeat,
  STATUS_PATH,
  statusReport,
} from '../../src/bands/tongsStatus.js';

/**
 * What Tongs Browser has done (2026-10-19): a log of requests, warnings and sign-in changes, shown in a GM
 * menu and sent to COO as a heartbeat, so a missing combat post can be traced without joining the game.
 */
describe('the activity log', () => {
  it('keeps the newest events, with their time', () => {
    let now = Date.UTC(2026, 9, 19, 10, 0, 0);
    const log = new ActivityLog(() => now);
    for (let i = 0; i < MAX_EVENTS + 5; i++) {
      log.record('request', `event ${String(i)}`);
      now += 1000;
    }
    const entries = log.entries();
    expect(entries).toHaveLength(MAX_EVENTS);
    expect(entries[0]?.text).toBe('event 5');
    expect(entries.at(-1)?.at).toBe('2026-10-19T10:00:44.000Z');
  });

  it('names a request by its path, never its server or query string', () => {
    expect(
      requestText(
        'https://cooserver.duckdns.org/api/pathwars/campaigns/C06/combat-band?x=1',
        'POST',
        200
      )
    ).toBe('POST /api/pathwars/campaigns/C06/combat-band 200');
    expect(requestText('/api/auth/refresh?t=secret', undefined, 'unreachable')).toBe(
      'GET /api/auth/refresh unreachable'
    );
  });
});

describe('the status heartbeat', () => {
  const gm = { id: 'u1', role: 4, name: 'Gamemaster' };
  const globals = (user: object) => ({
    game: { world: { id: 'the-grand-explorers' }, user, users: { activeGM: gm } },
  });
  const ports = (log = new ActivityLog(() => 0)) => ({
    log,
    signedIn: () => false,
    version: () => '0.60.0',
    every: vi.fn(),
    later: vi.fn(),
  });

  it('reports the world, sign-in and log from a full GM, and nothing from anyone else', () => {
    const p = ports();
    p.log.record('warning', 'not signed in');

    expect(statusReport(globals(gm), p)).toEqual({
      world: 'the-grand-explorers',
      version: '0.60.0',
      signedIn: false,
      role: 'act',
      user: 'Gamemaster',
      events: p.log.entries(),
    });
    expect(statusReport(globals({ id: 'u2', role: 1, name: 'Player' }), p)).toBeNull();
    expect(statusReport({ game: { user: gm } }, p)).toBeNull();
    expect(statusReport(globals({ id: 'u1', role: 4 }), p)).toMatchObject({ user: '' });
  });

  it('reports soon after the world loads, then every few minutes, and shrugs off a failure', async () => {
    const tell = vi.fn(() => Promise.reject(new Error('offline')));
    const p = ports();
    startStatusHeartbeat({ tell } as unknown as CooClient, globals(gm), p);

    expect(p.later).toHaveBeenCalledWith(expect.any(Function), FIRST_REPORT_MS);
    expect(p.every).toHaveBeenCalledWith(expect.any(Function), HEARTBEAT_MS);
    (p.every.mock.calls[0]?.[0] as () => void)();
    await Promise.resolve();
    expect(tell).toHaveBeenCalledWith(STATUS_PATH, expect.objectContaining({ signedIn: false }));
  });

  it('says whether this browser keeps a sign-in', () => {
    expect(isSignedIn({ get: () => ' token ' })).toBe(true);
    expect(isSignedIn({ get: () => '' })).toBe(false);
    expect(isSignedIn({})).toBe(false);
  });
});

describe('the Tongs activity menu', () => {
  it('shows the sign-in state and the events newest first, escaped', () => {
    const log = new ActivityLog(() => Date.UTC(2026, 9, 19, 10, 0, 0));
    log.record('request', 'POST /a 200');
    log.record('warning', '<b>no campaign</b>');

    const html = activityHtml(false, log.entries());
    expect(html).toContain('Not signed in');
    expect(html.indexOf('no campaign')).toBeLessThan(html.indexOf('POST /a 200'));
    expect(html).toContain('&#60;b&#62;');
    expect(html).not.toContain('<b>no campaign');
    expect(activityHtml(true, [])).toContain('Nothing has happened yet');
  });

  it('is a GM menu that opens a dialog of the log', async () => {
    const registerMenu = vi.fn();
    const input = vi.fn(() => Promise.resolve(null));
    class ApplicationV2 {
      public render(): unknown {
        return undefined;
      }
    }
    const globals = {
      foundry: { applications: { api: { ApplicationV2, DialogV2: { input } } } },
      game: { user: { isGM: true } },
    };

    expect(
      registerActivityMenu({ registerMenu }, globals, new ActivityLog(() => 0), () => true)
    ).toBe(true);
    const entry = registerMenu.mock.calls[0]?.[2] as {
      restricted: boolean;
      type: new () => { render(): unknown };
    };
    expect(entry.restricted).toBe(true);
    await new entry.type().render();
    expect(input).toHaveBeenCalledWith(
      expect.objectContaining({ window: { title: 'Tongs activity' } })
    );
  });
});
