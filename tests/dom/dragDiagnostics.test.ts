import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DragDiagnostics } from '../../src/debug/DragDiagnostics.js';

/**
 * Everything the module measures about a drag, gathered in one place.
 *
 * ⚠️ Gathered here rather than spread through the composition root because a diagnostic is only worth
 * anything if it describes ONE moment. Five separate defects came from fields read at different
 * times, so the rule is that the readings live together and are taken together.
 *
 * The untested half was the wiring between the three pieces: the journal that records causes, the
 * recorder that measures, and the observers that watch Foundry. Each is covered on its own; nothing
 * covered whether they are connected to each other correctly.
 */
type MutableGlobal = Record<string, unknown>;
const globals = globalThis as unknown as MutableGlobal;

function build() {
  const listeners = new Map<string, () => void>();
  const fakeWindow = {
    addEventListener: (type: string, handler: () => void) => listeners.set(type, handler),
  } as unknown as Window;

  let dragging = false;
  const diagnostics = new DragDiagnostics({
    document,
    window: fakeWindow,
    isDragging: () => dragging,
    pointerPosition: () => ({ clientX: 100, clientY: 200 }),
    keyboardStrategy: () => 'events',
    isEnabled: () => true,
  });

  return {
    diagnostics,
    resize: () => listeners.get('resize')?.(),
    setDragging: (value: boolean) => {
      dragging = value;
    },
  };
}

const board = () => {
  const element = document.createElement('canvas');
  element.id = 'board';
  return element;
};

beforeEach(() => {
  document.body.innerHTML = '';
  for (const key of ['canvas', 'game', 'ui', 'ChatMessage', '__TB_BUILD_VERSION__']) {
    Reflect.deleteProperty(globals, key);
  }
});

/**
 * ⚠️ The journal is the one place a Foundry action sits NEXT TO the button press that caused it. A
 * tray press is the single most useful entry in the whole report, and it happens in the UI layer,
 * which is exactly why four rounds of self contained diagnostics never captured one.
 */
describe('the timeline of causes and effects', () => {
  it('records a control the user touched, which a snapshot can never reconstruct', () => {
    const { diagnostics } = build();

    diagnostics.recordUi('grab pressed');

    expect(JSON.stringify(diagnostics.journal.getEntries())).toContain('grab pressed');
  });

  /** A dispatch has to reach BOTH the measurements and the timeline, or one of them is blind. */
  it('puts a dispatched event on the timeline as well as through the recorder', () => {
    const { diagnostics } = build();

    diagnostics.recordDispatch({ type: 'pointerdown', buttons: 1 }, board());

    expect(JSON.stringify(diagnostics.journal.getEntries())).toContain('pointerdown');
  });

  it('puts raw gesture input on the timeline too', () => {
    const { diagnostics } = build();

    diagnostics.countGestureInput('touchmove');

    expect(JSON.stringify(diagnostics.journal.getEntries())).toContain('touchmove');
  });
});

/**
 * ⚠️ THE OBSERVERS ASK THE RECORDER whether a drag is open, not the pointer. Those are different
 * questions: the capture window stays open across the drop so the report can be read afterwards,
 * while the pointer stops dragging the moment the finger lifts. Wiring this to `isDragging` would
 * stop counting at the drop and lose exactly the resizes worth knowing about.
 */
describe('what the observers are asked', () => {
  /*
   * ⚠️ THERE IS NO TEST HERE for the resize count, and its absence is deliberate. One was written and
   * removed before it was ever committed: it ended in `expect(...).toBeDefined()`, which cannot fail,
   * because `DragDiagnostics` exposes no way to read that count without a live Foundry to build a
   * report against.
   *
   * The rule it would have covered is tested where it can actually be asserted, in
   * tests/dom/dragObservers.test.ts: resizes are counted only while a drag record is open. Writing a
   * second, weaker version here would have added a passing line and no protection.
   */
  it('survives a resize arriving before any drag has started', () => {
    const { diagnostics, resize } = build();

    resize();
    resize();

    expect(() => {
      diagnostics.whisperDiagnostics();
    }).not.toThrow();
  });
});

/**
 * ⚠️ Reporting must never be the thing that breaks. It runs on a phone, at the moment somebody is
 * already investigating a failure, and a diagnostic that throws while diagnosing leaves them with
 * less than they started with.
 */
describe('whispering the report when Foundry is not there', () => {
  it('returns quietly rather than throwing', () => {
    const { diagnostics } = build();

    expect(() => {
      diagnostics.whisperDiagnostics();
    }).not.toThrow();
  });

  it('says nothing into chat, since there is nothing to report against', () => {
    const createChatMessage = vi.fn();
    globals['ChatMessage'] = { create: createChatMessage };
    const { diagnostics } = build();

    diagnostics.whisperDiagnostics();

    expect(createChatMessage).not.toHaveBeenCalled();
  });
});
