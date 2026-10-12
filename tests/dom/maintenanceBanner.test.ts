import { afterEach, describe, expect, it, vi } from 'vitest';

import { bannerPorts, startMaintenance } from '../../src/maintenance/startMaintenance.js';

/** The countdown banner and the wiring to Foundry's socket (2026-10-11). */
afterEach(() => {
  document.body.innerHTML = '';
});

describe('the maintenance banner', () => {
  it('is one live status element, updated in place and removed when hidden', () => {
    const banner = bannerPorts(document);
    banner.show('closes in 4:32');
    banner.show('closes in 4:31');
    const found = document.querySelectorAll('#tongs-maintenance-banner');
    expect(found).toHaveLength(1);
    expect(found[0]?.getAttribute('role')).toBe('status');
    expect(found[0]?.textContent).toBe('closes in 4:31');
    banner.hide();
    expect(document.getElementById('tongs-maintenance-banner')).toBeNull();
  });
});

describe('startMaintenance', () => {
  it('asks COO same-origin, and a lost socket during a countdown goes to the progress page', async () => {
    const handlers: Record<string, () => void> = {};
    const assign = vi.fn();
    const now = Date.now();
    const fetch = vi.fn(async () =>
      Promise.resolve({
        ok: true,
        json: async () =>
          Promise.resolve({
            phase: 'warning',
            world: 'c06',
            now: new Date(now).toISOString(),
            closesAt: new Date(now + 60_000).toISOString(),
          }),
      })
    );
    startMaintenance(
      {
        game: { world: { id: 'c06' }, socket: { on: (event, run) => (handlers[event] = run) } },
        location: { assign },
        fetch,
      },
      document,
      () => undefined
    );
    await vi.waitFor(() => {
      expect(document.getElementById('tongs-maintenance-banner')).not.toBeNull();
    });
    expect(fetch).toHaveBeenCalledWith(
      '/coo-api/foundry/maintenance',
      expect.objectContaining({ credentials: 'omit' })
    );
    handlers['disconnect']?.();
    expect(assign).toHaveBeenCalledWith('/coo-updating');
  });

  it('a tick that throws is swallowed, from the timer and from the first look alike', async () => {
    const broken = {} as unknown as Document; // no getElementById: drawing the banner throws
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      startMaintenance(
        { game: { world: { id: 'c06' } }, fetch: async () => Promise.reject(new Error('offline')) },
        broken,
        (run) => {
          run();
        }
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
