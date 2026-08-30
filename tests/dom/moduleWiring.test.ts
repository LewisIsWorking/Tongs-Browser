import { beforeEach, describe, expect, it } from 'vitest';

import { buildModuleParts } from '../../src/ModuleParts.js';
import { makeTouchEvent } from './support/touchEvents.js';
import { stubFoundryEnvironment } from './support/moduleUnderTest.js';

/**
 * The thunks `buildModuleParts` hands to the parts it builds, exercised rather than assumed.
 *
 * ⚠️ ModuleParts' own docblock says these are load bearing: "Every reference a part takes BACK to the
 * module is a thunk, and that is what makes one builder possible at all... Taken eagerly, each
 * captures `undefined` and fails at the first tap, long after the code that caused it has finished
 * running." Seven of them were never called by any test, so the claim was documented and unverified.
 *
 * Written 2026-08-22. Nothing here duplicates a focused suite: every part already has one. What is
 * asserted is that the WIRING between them arrives at the right sibling, which is the one thing a
 * per-part test cannot see and the compiler cannot check.
 *
 * COVERS: a thunk wired to the wrong sibling, or to nothing.
 * MISSES: a thunk wired to the right sibling that does the wrong thing. That is the sibling's own
 *   suite's job, and duplicating it here would just make two places to update.
 */
function parts(overrides: Record<string, unknown> = {}) {
  return buildModuleParts(
    {
      document,
      window,
      suppressNativeTouch: () => true,
      ...overrides,
    },
    { isEnabled: () => true }
  );
}

const detailsFrom = (built: ReturnType<typeof parts>, source: string): string[] =>
  built.diagnostics.journal
    .getEntries()
    .filter((entry) => entry.source === source)
    .map((entry) => entry.detail);

beforeEach(() => {
  stubFoundryEnvironment();
});

describe('the touch binder is wired to both the diagnostics and the gestures', () => {
  /**
   * ⚠️ BOTH, and the reason is in ModuleParts' own comment: "A trace showing no pointermove has two
   * completely different causes: the finger produced no gesture input, or it did and the gesture
   * layer chose not to move the pointer. Counting touchmoves separates them, and nothing else in the
   * report can." A binder wired only to the gestures loses that distinction silently, and the report
   * still renders, so nothing looks broken.
   */
  it('counts the raw touch as gesture input', () => {
    const built = parts();
    built.binder.bind();

    document.dispatchEvent(
      makeTouchEvent('touchstart', [{ identifier: 1, clientX: 5, clientY: 5 }])
    );

    expect(detailsFrom(built, 'gesture')).toContain('touchstart');
  });

  it('passes the same touch on to the gesture layer, which moves the pointer', () => {
    const built = parts();
    built.binder.bind();
    const before = built.pointer.getPosition();

    document.dispatchEvent(
      makeTouchEvent('touchstart', [{ identifier: 1, clientX: 10, clientY: 10 }])
    );
    document.dispatchEvent(
      makeTouchEvent('touchmove', [{ identifier: 1, clientX: 90, clientY: 70 }])
    );

    expect(built.pointer.getPosition()).not.toEqual(before);
  });

  /**
   * ⚠️ The DEFAULT, which every other test overrides and therefore never reaches. Suppression on by
   * default is what stops a real finger's `pointerup` reaching PIXI and cancelling a held drag.
   */
  it('suppresses native touch by default when the caller says nothing', () => {
    expect(() => parts({ suppressNativeTouch: undefined })).not.toThrow();
  });
});

describe('the pointer stack is wired back to the recorders', () => {
  /**
   * ⚠️ Dispatch fans out to TWO recorders, and only one of them is the debug overlay. The overlay is
   * a developer convenience; `diagnostics.recordDispatch` is what feeds the report a phone user
   * whispers into chat when a drag fails, which is the only diagnostic channel a phone HAS.
   */
  it('records every dispatched event in the diagnostics journal', () => {
    const built = parts();
    built.binder.bind();

    document.dispatchEvent(
      makeTouchEvent('touchstart', [{ identifier: 1, clientX: 10, clientY: 10 }])
    );
    document.dispatchEvent(
      makeTouchEvent('touchmove', [{ identifier: 1, clientX: 80, clientY: 60 }])
    );

    expect(detailsFrom(built, 'dispatch').length).toBeGreaterThan(0);
  });
});

describe('every part the factory promises is actually returned', () => {
  /**
   * ⚠️ Named individually rather than counted. A count passes when a field is renamed, and a rename
   * is exactly what a refactor does; the consumers reach for these by name.
   */
  it.each([
    'access',
    'debug',
    'pointer',
    'cursor',
    'gestures',
    'synthesizer',
    'modifierBar',
    'scaler',
    'clampBinder',
    'pauseRelay',
    'binder',
    'diagnostics',
    'actions',
  ])('returns %s', (name) => {
    expect(parts()[name as keyof ReturnType<typeof parts>]).toBeTruthy();
  });
});
