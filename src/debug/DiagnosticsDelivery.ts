import { copyToClipboard } from './Clipboard.js';
import { toPlainText } from './DiagnosticsReport.js';

/**
 * Getting the diagnostics report to somebody who is holding a phone.
 *
 * ⚠️ Chat AND clipboard, not either. Reading the report off a screenshot is the slowest part of this
 * loop and it TRUNCATES: a phone chat window shows about fifteen lines and silently hides the rest,
 * which has already cost a full round trip on the one field that mattered. The clipboard carries the
 * whole thing, and the chat message is what makes it visible that a report exists at all.
 *
 * Whispered to self, so a diagnostic never lands in front of players mid session.
 */
export interface DiagnosticsDeliveryOptions {
  readonly document: Document;
  /** Foundry's ChatMessage.create, or undefined when there is no chat to whisper into. */
  readonly createChatMessage: ((data: unknown) => unknown) | undefined;
  /** The user to whisper to. An absent id whispers to nobody rather than to everybody. */
  readonly userId: string | undefined;
  readonly notify: ((message: string) => void) | undefined;
  /** Where the report goes when there is no chat at all. */
  readonly fallback: (text: string) => void;
}

export interface DeliveryOutcome {
  readonly copied: boolean;
  readonly whispered: boolean;
}

export function deliverDiagnostics(
  lines: readonly string[],
  options: DiagnosticsDeliveryOptions
): DeliveryOutcome {
  const plain = toPlainText(lines);
  const copied = copyToClipboard(options.document, plain);

  if (options.createChatMessage === undefined) {
    // No chat, so the console is all there is. Still worth emitting: a developer on a desktop
    // reading this in devtools is a real case, and silence would be the worst outcome.
    options.fallback(plain);
    return { copied, whispered: false };
  }

  options.createChatMessage({
    content: `<em>${
      copied ? 'Copied to clipboard.' : 'Clipboard refused, read below.'
    }</em><br>${lines.join('<br>')}`,
    /*
     * An absent user id whispers to NOBODY, which is deliberate. Foundry treats an empty whisper
     * array as "everyone", so defaulting the other way would broadcast a diagnostic to the whole
     * table at the exact moment something is going wrong.
     */
    whisper: options.userId === undefined ? [] : [options.userId],
  });

  options.notify?.(
    copied ? 'Tongs diagnostics copied to clipboard.' : 'Tongs diagnostics whispered to you.'
  );

  return { copied, whispered: true };
}
