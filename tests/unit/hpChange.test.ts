import { describe, expect, it } from 'vitest';

import type { BandCause } from '../../src/bands/bandCause.js';
import { hpChangeReason, poolsOf, readHpChange } from '../../src/bands/hpChange.js';

/** The words and numbers of one HP or Stamina change; the reporter is `hpLog.test.ts`. Added 2026-10-17. */
describe('what an HP change says', () => {
  const shown = (text: string, item: string | null, attacker: string): BandCause => ({
    gm: text,
    shown: { text, item, attacker: { name: attacker } as never },
  });

  it('names what hit, when players may know, and never the IWR', () => {
    const cause = shown(
      'Electrical Bolt from Chamber of Scribing',
      'Electrical Bolt',
      'Chamber of Scribing'
    );
    expect(
      hpChangeReason({ ...cause, gm: `${cause.gm}; resistance electricity -5` }, 'Daichi')
    ).toBe('Electrical Bolt from Chamber of Scribing');
  });

  it('names a condition on the character itself by the condition alone', () => {
    expect(
      hpChangeReason(
        shown('Persistent Electricity from Daichi', 'Persistent Electricity', 'Daichi'),
        'Daichi'
      )
    ).toBe('Persistent Electricity');
  });

  it('never names a source players cannot see', () => {
    expect(hpChangeReason({ gm: 'Claw from Hidden Thing', shown: null }, 'Daichi')).toBe(
      'damage, from a source players cannot see'
    );
    expect(hpChangeReason({ gm: 'healed by Heal from Hidden Thing', shown: null }, 'Daichi')).toBe(
      'healing, from a source players cannot see'
    );
  });

  it('reads pools without the Stamina variant as HP alone', () => {
    const pools = poolsOf({ system: { attributes: { hp: { value: 12, max: 20 } } } });
    expect(pools).toEqual({ hp: 12, maxHp: 20, sp: null, maxSp: null });
    expect(
      readHpChange('a', 'A', { hp: 20, maxHp: 20, sp: null, maxSp: null }, pools!, 't')
    ).toEqual({
      actorId: 'a',
      name: 'A',
      hpBefore: 20,
      hpAfter: 12,
      maxHp: 20,
      at: 't',
    });
  });
});
