/**
 * A minimal CDP client, enough to evaluate code in one tab. Added 2026-08-11.
 *
 * ⚠️ Written because Playwright's `connectOverCDP` cannot attach to Chrome on this phone. It opens
 * the socket and then hangs, and the failure reads as though the adb forward were wrong:
 *
 *     <ws connected> ws://127.0.0.1:9222/devtools/browser
 *     browserType.connectOverCDP: Timeout 120000ms exceeded
 *
 * The forward was fine. connectOverCDP does not merely connect, it enumerates and auto attaches to
 * every target the browser owns: each tab, each service worker, each extension page. The device had
 * three service workers alongside the user's own tabs, and something in that handshake never
 * completes. Raising the timeout from 30s to 120s changed nothing, which is what says it is a stall
 * and not slowness.
 *
 * None of that machinery is needed here. Everything the drag check does happens inside one
 * `page.evaluate` against one tab, so a socket, `Runtime.evaluate` and a promise map cover it. No
 * dependency either: Node has had global `fetch` and `WebSocket` for several releases.
 *
 * The exported object deliberately mimics the small slice of Playwright's page API the checks use,
 * so the same check code runs against a desktop Playwright page or a phone over CDP without knowing
 * which it has.
 */

/** One entry from CDP's `/json/list`. Only the fields this needs are described. */
interface CdpTarget {
  readonly type: string;
  readonly url?: string;
  readonly title?: string;
  readonly webSocketDebuggerUrl: string;
}

export interface CdpPageOptions {
  readonly endpoint?: string;
  /** Substring of the tab's URL to attach to. See below for why this is not optional in practice. */
  readonly matchUrl?: string;
}

/** The slice of Playwright's page API the checks use, so the same check code drives either. */
export interface CdpPage {
  url: () => string | undefined;
  title: () => string | undefined;
  evaluate: <T>(fn: (arg: never) => T | Promise<T>, arg?: unknown) => Promise<T>;
  close: () => void;
}

interface PendingCall {
  readonly resolve: (value: unknown) => void;
  readonly reject: (reason: Error) => void;
}

interface CdpMessage {
  readonly id?: number;
  readonly error?: { readonly message?: string };
  readonly result?: unknown;
}

interface EvaluateResult {
  readonly exceptionDetails?: {
    readonly exception?: { readonly description?: string };
    readonly text?: string;
  };
  readonly result?: { readonly value?: unknown };
}

/**
 * Attach to one page target by URL substring.
 *
 * Selecting by URL rather than taking the first target matters on a real device: a phone's browser
 * has the user's own tabs in it, and driving whichever happened to be first would navigate someone's
 * browsing away and then report that Foundry was not ready.
 */
export async function connectCdpPage({
  endpoint = 'http://127.0.0.1:9222',
  matchUrl,
}: CdpPageOptions = {}): Promise<CdpPage> {
  const response = await fetch(`${endpoint}/json/list`, { signal: AbortSignal.timeout(10_000) });
  const targets = (await response.json()) as CdpTarget[];

  const pages = targets.filter((target) => target.type === 'page');
  const target =
    matchUrl === undefined
      ? pages[0]
      : pages.find((candidate) => (candidate.url ?? '').includes(matchUrl));

  if (target === undefined) {
    const seen = pages.map((candidate) => candidate.url || '(blank)').join(', ');
    throw new Error(
      `no page target matching '${String(matchUrl)}' on ${endpoint}. Tabs open: ${seen || 'none'}`
    );
  }

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map<number, PendingCall>();
  let nextId = 0;

  socket.addEventListener('message', (event) => {
    let message: CdpMessage;
    try {
      message = JSON.parse(String(event.data)) as CdpMessage;
    } catch {
      return;
    }
    if (message.id === undefined) {
      return;
    }
    const waiter = pending.get(message.id);
    if (waiter === undefined) {
      return;
    }
    pending.delete(message.id);
    if (message.error) {
      /*
       * The tab went away underneath us, which is a fact about the session and not a bug in the
       * check. Measured twice on 2026-08-11: a reload of Foundry on the phone mid run produced
       * `Inspected target navigated or closed` as a raw stack trace out of this very handler,
       * followed by a confusing `ReferenceError: canvas is not defined` from the cleanup running
       * against a context that no longer existed. Both read like code faults and neither was one.
       */
      const detail = message.error.message ?? 'CDP error';
      const navigated = /navigated or closed|Target closed|Session .* not found/i.test(detail);
      waiter.reject(
        new Error(
          navigated
            ? `the tab went away mid check: ${detail}. Foundry was probably reloaded or the tab was ` +
                `discarded. Nothing is wrong with the module or the check; run it again.`
            : detail
        )
      );
      return;
    }
    waiter.resolve(message.result);
  });

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('CDP socket failed to open')), {
      once: true,
    });
  });

  const send = (method: string, params: Record<string, unknown>): Promise<unknown> =>
    new Promise<unknown>((resolve, reject) => {
      const id = (nextId += 1);
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });

  await send('Runtime.enable', {});

  return {
    url: () => target.url,
    title: () => target.title,

    /**
     * Evaluate a function in the page and return its value.
     *
     * The argument is serialised into the expression rather than passed as a CDP argument, because
     * `Runtime.evaluate` takes an expression and nothing else. `awaitPromise` covers the async
     * functions the checks use, and `returnByValue` gets a plain object back instead of a remote
     * handle that would need another round trip to read.
     *
     * An exception in the page is rethrown here with the page's own message and stack. Swallowing it
     * would turn a broken check into a mysteriously empty result.
     */
    evaluate: async <T>(fn: (arg: never) => T | Promise<T>, arg?: unknown): Promise<T> => {
      const expression = `(${fn.toString()})(${JSON.stringify(arg ?? null)})`;
      const result = (await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      })) as EvaluateResult;
      if (result.exceptionDetails !== undefined) {
        const detail =
          result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text ??
          'evaluate failed';
        throw new Error(`page threw: ${detail}`);
      }
      return result.result?.value as T;
    },

    close: () => {
      socket.close();
    },
  };
}
