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

/**
 * A CDP session, narrowed to the one method this needs.
 *
 * Structural rather than imported from Playwright, because the same driver is used against a session
 * obtained from `context.newCDPSession` and against a raw socket, and naming the single method used
 * says exactly what is required of either.
 */
/** A touch point in client coordinates. Ids are assigned by the Hand, one per finger. */
export interface TouchPoint {
  readonly x: number;
  readonly y: number;
}

export interface CdpSender {
  send: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
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

  send(type: string, points: readonly TouchPoint[]): Promise<unknown> {
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
