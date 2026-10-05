import { afterEach, describe, it, expect, vi } from 'vitest';

import { startWelcome } from '../../src/welcome/startWelcome.js';
import { COO_EXPORT } from '../unit/support/cooFoundryExport.js';
import { player, press, welcomeText } from './support/welcomePlayer.js';

/** The welcome with a ComeOnOver export chosen: the request carries it to the GM. 2026-10-05. */
afterEach(() => {
  document.body.replaceChildren();
});

describe('the welcome, starting from an export', () => {
  it('sends the chosen ComeOnOver export with the request', async () => {
    const t = player();
    startWelcome(t.hooks, t.settings, t.globals, document);
    const file = document.querySelector<HTMLInputElement>('#tongs-welcome input[type=file]')!;
    Object.defineProperty(file, 'files', { value: [new Blob([JSON.stringify(COO_EXPORT)])] });
    file.dispatchEvent(new Event('change'));
    await vi.waitFor(() => {
      expect(welcomeText()).toContain('Will import Theo Ironhand');
    });
    press('Create my character');
    await vi.waitFor(() => {
      expect(t.user.setFlag).toHaveBeenCalled();
    });
    expect(t.userFlags['sheetRequest']).toMatchObject({
      name: 'Theo Ironhand',
      importBuild: { name: 'Theo Ironhand', type: 'character' },
    });
  });
});
