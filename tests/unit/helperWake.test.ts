import { describe, expect, it, vi } from 'vitest';

import { HelperWake } from '../../src/welcome/helperWake.js';

/** When the welcome asks for COO's helper GM. 2026-10-16. */
describe('HelperWake', () => {
  it('calls once per page load for the party list', () => {
    const summon = vi.fn();
    const wake = new HelperWake(summon);
    wake.forPartyList();
    wake.forPartyList();
    expect(summon).toHaveBeenCalledOnce();
  });

  it('calls once for each waiting request, and again only for a new one', () => {
    const summon = vi.fn();
    const wake = new HelperWake(summon);
    wake.forRequest('r1');
    wake.forRequest('r1');
    expect(summon).toHaveBeenCalledOnce();
    wake.forRequest('r2');
    expect(summon).toHaveBeenCalledTimes(2);
  });
});
