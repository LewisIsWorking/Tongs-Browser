import { afterEach, describe, expect, it, vi } from 'vitest';

import { deliverDiagnostics } from '../../src/debug/DiagnosticsDelivery.js';

/**
 * Getting the report to somebody holding a phone.
 *
 * Chat AND clipboard, not either. Reading it off a screenshot is the slowest part of this loop and it
 * TRUNCATES: a phone chat window shows about fifteen lines and silently hides the rest, which cost a
 * full round trip on the one field that mattered. The clipboard carries the whole thing; the chat
 * message is what makes it visible that a report exists at all.
 */
afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function withClipboard(succeeds: boolean) {
  Object.defineProperty(document, 'execCommand', { value: () => succeeds, configurable: true });
  Object.defineProperty(document.defaultView?.navigator ?? navigator, 'clipboard', {
    value: undefined,
    configurable: true,
  });
}

function options(overrides: Partial<Parameters<typeof deliverDiagnostics>[1]> = {}) {
  return {
    document,
    createChatMessage: vi.fn(),
    userId: 'user-1',
    notify: vi.fn(),
    fallback: vi.fn(),
    ...overrides,
  };
}

describe('deliverDiagnostics', () => {
  it('copies the plain text and whispers the markup', () => {
    withClipboard(true);
    const createChatMessage = vi.fn();

    const outcome = deliverDiagnostics(['<strong>a</strong>', 'b'], options({ createChatMessage }));

    expect(outcome).toEqual({ copied: true, whispered: true });
    expect(createChatMessage).toHaveBeenCalledOnce();
    const message = createChatMessage.mock.calls[0]?.[0] as {
      content: string;
      whisper: string[];
    };
    expect(message.content).toContain('Copied to clipboard.');
    expect(message.content).toContain('<strong>a</strong><br>b');
  });

  it('says so in the message when the clipboard refused', () => {
    withClipboard(false);
    const createChatMessage = vi.fn();

    const outcome = deliverDiagnostics(['a'], options({ createChatMessage }));

    expect(outcome.copied).toBe(false);
    const message = createChatMessage.mock.calls[0]?.[0] as { content: string };
    expect(message.content).toContain('Clipboard refused, read below.');
  });

  /**
   * ⚠️ An absent user id whispers to NOBODY, deliberately. Foundry treats an empty whisper array as
   * "everyone", so defaulting the other way would broadcast a diagnostic to the whole table at the
   * exact moment something is going wrong.
   */
  it('whispers to the user, and to nobody when there is no user', () => {
    withClipboard(true);

    // Captured directly rather than through the options object, whose type is the union the
    // production code takes and so does not carry vitest's mock surface.
    const named = vi.fn();
    deliverDiagnostics(['a'], options({ createChatMessage: named }));
    expect((named.mock.calls[0]?.[0] as { whisper: string[] }).whisper).toEqual(['user-1']);

    const anonymous = vi.fn();
    deliverDiagnostics(['a'], options({ createChatMessage: anonymous, userId: undefined }));
    expect((anonymous.mock.calls[0]?.[0] as { whisper: string[] }).whisper).toEqual([]);
  });

  /** No chat means the console is all there is, and silence would be the worst outcome. */
  it('falls back to the console when there is no chat', () => {
    withClipboard(true);
    const opts = options({ createChatMessage: undefined });

    const outcome = deliverDiagnostics(['<strong>a</strong>', 'b'], opts);

    expect(outcome).toEqual({ copied: true, whispered: false });
    expect(opts.fallback).toHaveBeenCalledWith('a\nb');
    expect(opts.notify).not.toHaveBeenCalled();
  });

  it('notifies which of the two routes carried the report', () => {
    withClipboard(true);
    const copied = options();
    deliverDiagnostics(['a'], copied);
    expect(copied.notify).toHaveBeenCalledWith('Tongs diagnostics copied to clipboard.');

    withClipboard(false);
    const refused = options();
    deliverDiagnostics(['a'], refused);
    expect(refused.notify).toHaveBeenCalledWith('Tongs diagnostics whispered to you.');
  });

  it('does not throw when there is nothing to notify with', () => {
    withClipboard(true);

    expect(() => {
      deliverDiagnostics(['a'], options({ notify: undefined }));
    }).not.toThrow();
  });
});
