/**
 * Driving real touch through CDP. Extracted 2026-08-10 when the Android check became the third
 * caller, after foundry-touch-check and foundry-multitouch-check.
 *
 * Why the protocol rather than Playwright's touchscreen helper: the helper can tap, but it cannot
 * hold or drag, and both of those are gestures this module defines behaviour for. Only going to
 * Input.dispatchTouchEvent directly gives control of the timing between touchStart and touchEnd,
 * which is the entire difference between a tap and a long press.
 *
 * Why not hand built TouchEvent objects: a script constructed event has isTrusted false, and more
 * importantly the browser does not emit its own compatibility pointer and mouse events for one. Those
 * derived events are a large part of what the module has to suppress, so a harness that never
 * produces them would be testing a world where the hardest problem does not exist.
 */

/** A touch point in client coordinates. Ids are assigned by the Hand, one per finger. */
export interface TouchPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * The one CDP payload this file ever sends.
 *
 * ⚠️ If a future caller ever hands a `Hand` or `Finger` the raw socket sender from `cdp-page.ts`,
 * whose params are `Record<string, unknown>`, this must become a `type` alias rather than an
 * interface. Only type aliases get an implicit index signature, so an interface is not assignable to
 * a `Record`. It is an interface today because nothing does that yet, and the swap is one keyword.
 */
export interface TouchDispatch {
  type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel';
  touchPoints: { x: number; y: number; id: number }[];
}

/**
 * A CDP session, narrowed to the one method this needs.
 *
 * Structural rather than imported from Playwright, because the same driver is used against a session
 * obtained from `context.newCDPSession` and against a raw socket, and naming the single method used
 * says exactly what is required of either.
 *
 * ⚠️ Narrowed to the literal method NAME, not `string`, and that is what makes Playwright's own
 * `CDPSession` fit. Its `send` is generic over `keyof Protocol.CommandParameters`, and a property
 * typed function is checked contravariantly, so a `string` parameter here demands a sender that
 * accepts EVERY string and Playwright's rightly does not. Naming the single method asks for exactly
 * what is used, which both senders can honestly promise. It also means a typo in the method name is
 * a compile error rather than a silent no op against a live browser.
 */
export interface CdpSender {
  send: (method: 'Input.dispatchTouchEvent', params: TouchDispatch) => Promise<unknown>;
}

/** A single finger. */
export class Finger {
  public constructor(private readonly client: CdpSender) {}

  async down(x: number, y: number): Promise<void> {
    await this.client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, id: 1 }],
    });
  }

  async moveTo(x: number, y: number): Promise<void> {
    await this.client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y, id: 1 }],
    });
  }

  async up(): Promise<void> {
    await this.client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  /** A drag in steps, because one large jump is not what a finger does and not what the machine sees. */
  async drag(
    fromX: number,
    fromY: number,
    deltaX: number,
    deltaY: number,
    steps = 8
  ): Promise<void> {
    await this.down(fromX, fromY);
    for (let step = 1; step <= steps; step += 1) {
      await this.moveTo(fromX + (deltaX * step) / steps, fromY + (deltaY * step) / steps);
    }
    await this.up();
  }

  /** A tap, deliberately brief so it can never be read as the start of a long press. */
  async tap(x: number, y: number): Promise<void> {
    await this.down(x, y);
    await this.up();
  }
}

/** Two or more fingers, for pan and pinch. */
export class Hand {
  public constructor(private readonly client: CdpSender) {}

  send(type: TouchDispatch['type'], points: readonly TouchPoint[]): Promise<unknown> {
    return this.client.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((point, index) => ({ x: point.x, y: point.y, id: index + 1 })),
    });
  }

  start(points: readonly TouchPoint[]): Promise<unknown> {
    return this.send('touchStart', points);
  }

  move(points: readonly TouchPoint[]): Promise<unknown> {
    return this.send('touchMove', points);
  }

  end(): Promise<unknown> {
    return this.send('touchEnd', []);
  }
}
