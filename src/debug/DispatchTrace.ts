/**
 * The last few events actually put on the wire. Extracted from TongsBrowser 2026-08-12.
 *
 * Every STATIC check can be healthy while a drag still does nothing, which is exactly what a real
 * device reported: select tool, `_canDrag` true, pointer inside the token, canvas ready, and no
 * movement. At that point the only thing left to look at is the event stream itself, and on a phone
 * there is no console to look at it in.
 *
 * A ring buffer rather than a growing list, because this records every dispatch for the whole
 * session, and a leak in a diagnostic is a poor trade for information nobody has asked for yet.
 */

/** How many recent dispatches to keep. Enough for a whole short drag on a phone chat window. */
export const DISPATCH_TRACE_LENGTH = 18;

export interface TracedDispatch {
  readonly type: string;
  readonly buttons?: number | undefined;
  readonly position?: { readonly clientX: number; readonly clientY: number } | undefined;
}

export class DispatchTrace {
  private readonly lines: string[] = [];

  public constructor(private readonly limit: number = DISPATCH_TRACE_LENGTH) {}

  /**
   * Record one dispatch.
   *
   * `buttons` is the whole story for dragging: it has to stay non zero on every move between the
   * down and the up, or Foundry reads the stream as a hover and nothing follows the pointer. Seeing
   * `pointermove buttons=0` in this list while a grab is held would name that bug outright.
   *
   * Coordinates are here because they became the question. A device had Foundry measuring a movement
   * distance of exactly 0.0px across eleven moves, and the trace recorded type, buttons and target,
   * which is everything except the field that decides it.
   */
  public record(descriptor: TracedDispatch, targetDescription: string): void {
    const buttons = descriptor.buttons ?? 0;
    const at = descriptor.position;
    const where =
      at === undefined
        ? ''
        : ` @${String(Math.round(at.clientX))},${String(Math.round(at.clientY))}`;
    const line = `${descriptor.type} buttons=${String(buttons)}${where} -> ${targetDescription}`;

    /*
     * Collapse a run of identical lines rather than filling the report with them.
     *
     * A held pointer that is not moving emits the same line hundreds of times, and the buffer is
     * eighteen entries long: without this, a moment of stillness at the end of a gesture erases the
     * whole gesture before it. That has already happened on a device and produced a trace describing
     * only the pause.
     */
    const last = this.lines[this.lines.length - 1];
    if (last?.startsWith(line) === true) {
      const repeats = /\bx(\d+)$/.exec(last);
      const count = repeats === null ? 2 : Number(repeats[1]) + 1;
      this.lines[this.lines.length - 1] = `${line} x${String(count)}`;
      return;
    }

    this.lines.push(line);
    if (this.lines.length > this.limit) {
      this.lines.shift();
    }
  }

  public getLines(): readonly string[] {
    return this.lines;
  }

  public get length(): number {
    return this.lines.length;
  }

  public clear(): void {
    this.lines.length = 0;
  }
}
