import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DragObservers } from '../../src/debug/DragObservers.js';

/**
 * What a later `attach` must NOT undo. Written 2026-08-31.
 *
 * ⚠️ `attach` is called repeatedly - its own comment says "retrying until the canvas and a token
 * exist" - so it runs against a Foundry that is sometimes there and sometimes not. Idempotence of the
 * WRAPPING is already covered, by `foundryDragHooksIdempotence.test.ts` and by the marker each wrapper
 * carries, so this is not about double wrapping.
 *
 * It is about the RECORD. `hookDragEndings` returns early once both hooks are installed, and without
 * that early return a later attach re-runs the installer against whatever Foundry looks like now and
 * assigns its result over `hooksInstalled`. A scene change or a deselected token is enough to make
 * that result `false`, and the report would then state that the hooks were never installed while they
 * were in fact installed and working.
 *
 * That is the exact failure mode this whole file exists to prevent: a diagnostic that confidently
 * states something the code did not measure, sending the reader somewhere they need not go. The
 * report has been wrong about its own numbers three separate times.
 *
 * COVERS: a later attach downgrading `hooksInstalled` from true to false.
 * MISSES: double wrapping, which the wrapper's own marker owns.
 */
type MutableGlobal = Record<string, unknown>;
const globals = globalThis as unknown as MutableGlobal;

function observers(): DragObservers {
  const window = {
    addEventListener: () => undefined,
  } as unknown as Window;
  return new DragObservers({ window, isCapturing: () => true, onObservation: vi.fn() });
}

/** Foundry present enough for both hooks to install: a token prototype and a controlled token. */
function foundryPresent(): void {
  globals['CONFIG'] = {
    Token: { objectClass: { prototype: { draw: () => undefined, destroy: () => undefined } } },
  };
  globals['canvas'] = {
    tokens: {
      controlled: [
        {
          mouseInteractionManager: {
            constructor: { prototype: { _handleDragDrop: () => undefined } },
          },
        },
      ],
    },
  };
}

beforeEach(() => {
  Reflect.deleteProperty(globals, 'canvas');
  Reflect.deleteProperty(globals, 'CONFIG');
});

describe('attaching again after Foundry has moved on', () => {
  it('installs both hooks when Foundry is there', () => {
    foundryPresent();
    const subject = observers();

    subject.attach();

    expect(subject.snapshot().hooksInstalled).toEqual({ token: true, manager: true });
  });

  /**
   * ⚠️ THE CASE THE EARLY RETURN EXISTS FOR. A scene change or a deselected token leaves no
   * controlled token to read a manager prototype from. Re-running the installer then reports
   * failure, and assigning that over the record turns a working observer into one the report
   * describes as absent.
   */
  it('does not forget that the hooks are installed when the token goes away', () => {
    foundryPresent();
    const subject = observers();
    subject.attach();

    Reflect.deleteProperty(globals, 'canvas');
    Reflect.deleteProperty(globals, 'CONFIG');
    subject.attach();

    expect(subject.snapshot().hooksInstalled).toEqual({ token: true, manager: true });
  });

  /**
   * ⚠️ The early return is deliberately narrow: it fires only when BOTH are installed. A partial
   * install must keep retrying, because the manager prototype is unreachable until a token has been
   * selected, which can be long after the token prototype is available.
   */
  it('keeps retrying while only one of the two is installed', () => {
    globals['CONFIG'] = {
      Token: { objectClass: { prototype: { draw: () => undefined, destroy: () => undefined } } },
    };
    const subject = observers();
    subject.attach();
    expect(subject.snapshot().hooksInstalled.manager).toBe(false);

    foundryPresent();
    subject.attach();

    expect(subject.snapshot().hooksInstalled).toEqual({ token: true, manager: true });
  });
});
