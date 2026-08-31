/**
 * Foundry's `Hooks` registry, captured so a test can invoke what was registered. Extracted
 * 2026-08-31 when the scene control binding suite needed the same thing the clamp binding suite had.
 *
 * ⚠️ Records the ID as well as the hook name, which `mainUnderTest.captureHooks` does not. Unbinding
 * passes an id back to `Hooks.off`, and passing the wrong one silently leaves the listener installed:
 * the caller believes it has unbound, the hook keeps firing, and nothing reports a fault. A capture
 * that drops the id cannot tell that apart from a correct unbind.
 */
export interface Registration {
  hook: string;
  id: number;
  /**
   * ⚠️ A REST parameter, so a captured callback can be invoked with no argument at all. The render
   * hooks take none; the scene control hook takes the controls collection. A single-parameter type
   * would typecheck one caller and reject the other.
   */
  callback: (...args: never[]) => void;
}

export interface Removal {
  hook: string;
  id: number;
}

export interface CapturedRegistry {
  registered: Registration[];
  removed: Removal[];
}

/** Installs the fake registry on `globalThis` and returns what it collects. */
export function captureHookRegistry(): CapturedRegistry {
  const registered: Registration[] = [];
  const removed: Removal[] = [];

  Object.assign(globalThis, {
    Hooks: {
      on: (hook: string, callback: (...args: never[]) => void) => {
        // Ids start at 1, because 0 is falsy and this class stores `null` for "not bound".
        const id = registered.length + 1;
        registered.push({ hook, id, callback });
        return id;
      },
      off: (hook: string, id: number) => {
        removed.push({ hook, id });
      },
    },
  });

  return { registered, removed };
}
