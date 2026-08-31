import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DragDiagnostics } from '../../src/debug/DragDiagnostics.js';
import { stubFoundryEnvironment } from './support/moduleUnderTest.js';

/**
 * The two callbacks `DragDiagnostics` hands to its collaborators. Written 2026-08-31.
 *
 * ⚠️ Both are about NOT LOSING a diagnostic silently, which is the only failure mode that matters
 * here. The report renders either way, so a lost input looks exactly like a quiet session.
 *
 *   onObservation  carries what Foundry did into the journal, beside the button press that caused it
 *   fallback       the last resort when there is no chat to whisper into
 *
 * COVERS: either callback unwired, so its input never reaches the report.
 * MISSES: whether the report READS well, which `diagnosticsReport` and `diagnosticsPlainText` own.
 */
/**
 * ⚠️ `dragging` is settable because the capture window opens on a false-to-true TRANSITION of
 * `isDragging`, not on any event. A fixture pinned to `false` leaves the observers permanently quiet,
 * and the first draft of the observation test below failed for exactly that reason - measuring the
 * fixture rather than the bridge it meant to test.
 */
let dragging = false;

function diagnostics(): DragDiagnostics {
  return new DragDiagnostics({
    document,
    window,
    isDragging: () => dragging,
    pointerPosition: () => ({ clientX: 10, clientY: 10 }),
    keyboardStrategy: () => 'events',
    isEnabled: () => true,
  });
}

const globals = globalThis as unknown as Record<string, unknown>;

beforeEach(() => {
  stubFoundryEnvironment();
  Reflect.deleteProperty(globals, 'CONFIG');
  dragging = false;
});

describe('what Foundry did reaching the journal', () => {
  /**
   * ⚠️ The observation goes to TWO places and the duplication is deliberate. `DragObservers` keeps
   * its own `dragEndings` list of what Foundry did; the journal is the one place a Foundry action
   * sits NEXT TO the button press that caused it. `DragObservers` records that reading either alone
   * "cost four device round trips", so a bridge that quietly stops carrying them is expensive in a
   * way no error ever shows.
   */
  it('records a Foundry observation in the journal', () => {
    const prototype: Record<string, unknown> = {
      draw: () => undefined,
      destroy: () => undefined,
    };
    globals['CONFIG'] = { Token: { objectClass: { prototype } } };

    const subject = diagnostics();

    // Open the capture window: the observers report only while a drag is being recorded.
    dragging = true;
    subject.recordDispatch({ type: 'pointerdown' }, document.body);
    (prototype['draw'] as () => void).call({});

    const sources = subject.journal.getEntries().map((entry) => entry.source);
    expect(sources).toContain('foundry');
  });
});

describe('when there is no chat to whisper into', () => {
  /**
   * ⚠️ Chat is the ONLY diagnostic channel a phone has - getting at devtools on Android needs a cable
   * and a laptop. When it is missing the console is all that is left, and silence would be the worst
   * outcome of the three. A developer reading this in desktop devtools is a real case.
   */
  it('warns rather than dropping the report on the floor', () => {
    Reflect.deleteProperty(globals, 'ChatMessage');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    diagnostics().whisperDiagnostics();

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('still whispers to chat when chat is there', () => {
    const created: unknown[] = [];
    globals['ChatMessage'] = {
      create: (message: unknown) => {
        created.push(message);
      },
    };

    diagnostics().whisperDiagnostics();

    expect(created).toHaveLength(1);
  });

  /**
   * ⚠️ Returns before doing anything when Foundry is not there at all, rather than assembling a
   * report out of undefined. The guard is what lets the button be tapped at any time.
   */
  it('does nothing at all when there is no game', () => {
    Reflect.deleteProperty(globals, 'game');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(() => {
      diagnostics().whisperDiagnostics();
    }).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
