import { afterEach, describe, expect, it, vi } from 'vitest';

import { WelcomeWindow } from '../../src/welcome/WelcomeWindow.js';
import { MAX_IMPORT_BYTES } from '../../src/welcome/ImportPicker.js';
import { COO_EXPORT } from '../unit/support/cooFoundryExport.js';

/** Choosing a ComeOnOverUno export on the welcome. 2026-10-05. */
afterEach(() => {
  document.body.replaceChildren();
});

function open() {
  const create = vi.fn();
  new WelcomeWindow(document, { create, later: vi.fn(), retry: vi.fn() }).show({
    kind: 'ask',
    world: 'W',
    parties: [],
  });
  const file = document.querySelector<HTMLInputElement>('#tongs-welcome input[type=file]')!;
  const name = document.querySelector<HTMLInputElement>('#tongs-welcome-input')!;
  const status = () => document.querySelector('.tw-import-status')?.textContent;
  const choose = (blob: Blob | undefined) => {
    Object.defineProperty(file, 'files', {
      value: blob === undefined ? [] : [blob],
      configurable: true,
    });
    file.dispatchEvent(new Event('change'));
  };
  const submit = () => {
    document.querySelector<HTMLButtonElement>('#tongs-welcome button.tw-primary')!.click();
  };
  return { create, name, status, choose, submit };
}
const json = (value: unknown) => new Blob([JSON.stringify(value)], { type: 'application/json' });

describe('the import picker', () => {
  it('reads an export, names the character, and sends it with the request', async () => {
    const w = open();
    w.choose(json(COO_EXPORT));
    await vi.waitFor(() => {
      expect(w.status()).toBe('Will import Theo Ironhand: Level 1 Dwarf Fighter.');
    });
    expect(w.name.value).toBe('Theo Ironhand');
    w.submit();
    expect(w.create).toHaveBeenCalledWith(
      'Theo Ironhand',
      null,
      expect.objectContaining({ level: 1 })
    );
  });

  it('keeps a name the player already typed', async () => {
    const w = open();
    w.name.value = 'Vex';
    w.choose(json(COO_EXPORT));
    await vi.waitFor(() => {
      expect(w.status()).toContain('Will import');
    });
    expect(w.name.value).toBe('Vex');
  });

  it('describes an export that has no name, and leaves the name box empty', async () => {
    const w = open();
    w.choose(json({ items: [{ name: 'Toughness', type: 'feat' }] }));
    await vi.waitFor(() => {
      expect(w.status()).toBe('Will import Level 1.');
    });
    expect(w.name.value).toBe('');
  });

  it.each([
    ['not JSON', new Blob(['{nope'])],
    ['JSON that is not a character', json({ hello: 1 })],
    ['a character with nothing in it', json({ name: 'X', items: [] })],
  ])('turns away %s, and sends no import', async (_what, blob) => {
    const w = open();
    w.choose(blob);
    await vi.waitFor(() => {
      expect(w.status()).toContain('not a ComeOnOver');
    });
    w.submit();
    expect(w.create).toHaveBeenCalledWith('', null, null);
  });

  it('turns away a file too big to be a character', async () => {
    const w = open();
    w.choose(new Blob(['x'.repeat(MAX_IMPORT_BYTES + 1)]));
    await vi.waitFor(() => {
      expect(w.status()).toContain('too big');
    });
  });

  it('clears the choice when the file is removed', async () => {
    const w = open();
    w.choose(json(COO_EXPORT));
    await vi.waitFor(() => {
      expect(w.status()).toContain('Will import');
    });
    w.choose(undefined);
    await vi.waitFor(() => {
      expect(w.status()).toBe('');
    });
    w.submit();
    expect(w.create).toHaveBeenCalledWith('Theo Ironhand', null, null);
  });
});
