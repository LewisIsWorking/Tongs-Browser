import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyToClipboard, copyWithExecCommand } from '../../src/debug/Clipboard.js';

/**
 * The copy button, and the reason it is not simply `navigator.clipboard.writeText`.
 *
 * `navigator.clipboard` is gated to SECURE CONTEXTS. A self hosted Foundry on a LAN address is plain
 * http, which is precisely the setup this module exists for, so on the target device the modern API
 * is undefined and the deprecated `execCommand` path is the ONLY one that runs. That inverts the
 * usual priority: the fallback is the feature.
 */
afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function withClipboard(writeText: ((value: string) => Promise<void>) | undefined) {
  Object.defineProperty(document.defaultView?.navigator ?? navigator, 'clipboard', {
    value: writeText === undefined ? undefined : { writeText },
    configurable: true,
  });
}

describe('copyToClipboard', () => {
  it('uses the clipboard API when it is available', () => {
    const writeText = vi.fn(() => Promise.resolve());
    withClipboard(writeText);

    expect(copyToClipboard(document, 'a report')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('a report');
  });

  /** The insecure context, which is the one the phone is actually in. */
  it('falls back to execCommand when the clipboard API is missing', () => {
    withClipboard(undefined);
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });

    expect(copyToClipboard(document, 'a report')).toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  /**
   * A clipboard API that exists and then REJECTS. Permission can be refused after the call, so the
   * fallback has to be wired to the rejection rather than only to the API being absent.
   */
  it('falls back when the clipboard API rejects', async () => {
    withClipboard(() => Promise.reject(new Error('denied')));
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });

    expect(copyToClipboard(document, 'a report')).toBe(true);

    // The rejection is handled a microtask later, which is why the return value cannot report it.
    await Promise.resolve();
    await Promise.resolve();
    expect(execCommand).toHaveBeenCalledWith('copy');
  });
});

describe('copyWithExecCommand', () => {
  it('reports what execCommand said, and removes its field either way', () => {
    Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true });

    expect(copyWithExecCommand(document, 'text')).toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('returns false and still cleans up when execCommand throws', () => {
    Object.defineProperty(document, 'execCommand', {
      value: () => {
        throw new Error('not allowed');
      },
      configurable: true,
    });

    expect(copyWithExecCommand(document, 'text')).toBe(false);
    // The finally is the point: a throw must not leave a stray textarea in Foundry's DOM.
    expect(document.querySelector('textarea')).toBeNull();
  });

  /**
   * Off screen rather than `display: none`, because an unrendered field cannot be selected and the
   * copy then silently does nothing. Asserted on the element while it is still in the document.
   */
  it('renders the field off screen rather than hiding it', () => {
    let seen: { position: string; display: string; top: string } | null = null;
    Object.defineProperty(document, 'execCommand', {
      value: () => {
        const field = document.querySelector('textarea');
        seen = {
          position: field?.style.position ?? '',
          display: field?.style.display ?? '',
          top: field?.style.top ?? '',
        };
        return true;
      },
      configurable: true,
    });

    expect(copyWithExecCommand(document, 'text')).toBe(true);
    expect(seen).toEqual({ position: 'fixed', display: '', top: '-1000px' });
  });
});
