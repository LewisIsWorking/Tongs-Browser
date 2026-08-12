/**
 * When the drag record is open, and when it must stop listening. Extracted from TongsBrowser
 * 2026-08-12.
 *
 * This is a state machine and nothing else, so the ordering rules below can be fed sequences and
 * asserted on. Every one of them was learned from a device report that described the wrong moment,
 * and each is one line that looks arbitrary and is not.
 */

/** What the caller should do with the event it just saw. */
export type CaptureVerdict =
  /** A drag begins HERE. Reset every collector, then record. */
  | { readonly kind: 'opened' }
  /** Record it. Either inside a live capture, or ordinary traffic with nothing captured. */
  | { readonly kind: 'record' }
  /** Nothing worth keeping: clear the trace first, then record. */
  | { readonly kind: 'restart' }
  /** A deliberate fresh press has retired the drag record: clear the trace, do NOT record. */
  | { readonly kind: 'retired' }
  /** The drop has been seen. Ignore this event ENTIRELY, including counting it. */
  | { readonly kind: 'frozen' };

/** The event types that end a press. Both, because Foundry acts on either. */
export function isRelease(eventType: string): boolean {
  return eventType === 'pointerup' || eventType === 'mouseup';
}

export class DragCaptureWindow {
  private capturing = false;
  private wasDragging = false;
  private sawDrop = false;

  /** Whether a drag record is currently open. Only then is a move worth counting. */
  public isCapturing(): boolean {
    return this.capturing;
  }

  /** Whether the drop that closed this record has already been seen. */
  public hasSeenDrop(): boolean {
    return this.sawDrop;
  }

  public observe(isDragging: boolean, eventType: string): CaptureVerdict {
    /*
     * Scope the record to the DRAG, not to the last pointerdown.
     *
     * ⚠️ Resetting on every pointerdown looked obviously right and destroyed the evidence every time.
     * A single tap anywhere after a drag wiped the whole drag out of the buffer, so a report came back
     * showing a clean down, up, click at one unchanging coordinate with zero PIXI moves, and it
     * described the tap rather than the drag it was asked about.
     */
    const opening = isDragging && !this.wasDragging;
    if (opening) {
      this.capturing = true;
      this.sawDrop = false;
    }
    this.wasDragging = isDragging;

    /*
     * ⚠️ FREEZE FIRST, before anything else in this method, and this position is the fix for a real
     * defect rather than a tidy-up.
     *
     * The freeze used to sit BELOW the caller's move counter, so every pointer move after the drop
     * still incremented the denominator while sampling had already stopped. That denominator is what
     * decides whether a probe was watching the gesture: `describeThinly` refuses to state a peak
     * sampled under 10% of moves. On a phone the pointer keeps moving for as long as it takes to read
     * the report, so the count ran away and every probe was declared thin. A report of "2 samples of
     * 227 moves" was counting hundreds of moves that happened after the drag it was describing.
     *
     * A measuring instrument that keeps measuring after the event does not report the event.
     */
    /*
     * A fresh press with no grab held: the drag record has served its purpose.
     *
     * ⚠️ Checked BEFORE the freeze returns, because retiring the record is a side effect that must
     * happen either way. A deliberate press is the ONE thing allowed to discard a captured drag, and
     * if it were skipped whenever the record was frozen, which is every time a drag has completed,
     * the record could never be retired at all.
     */
    const retiring = !isDragging && this.capturing && eventType === 'pointerdown';
    if (retiring) {
      this.capturing = false;
    }

    /*
     * ⚠️ The record stays closed until the next GRAB opens a new one, so this still freezes even
     * after being retired. Ordinary pointer traffic between two drags is not worth keeping, and
     * letting it back in is exactly how the aftermath overwrote the gesture in the first place.
     */
    if (!isDragging && this.sawDrop) {
      return retiring ? { kind: 'retired' } : { kind: 'frozen' };
    }

    // Nothing captured and no drag in progress: ordinary traffic, keep only the recent past.
    if (!isDragging && !this.capturing) {
      return { kind: 'restart' };
    }

    /*
     * ⚠️ Set AFTER the freeze, never before, which is an off by one that hid the single most
     * important event in the trace.
     *
     * `endDrag` clears the dragging flag before dispatching, so at the release `isDragging` is already
     * false. Marking the drop any earlier meant the freeze fired on the release ITSELF and the
     * `pointerup` was never recorded. Every device trace ended on a `pointermove`, which made a
     * released drag look identical to one still held: the exact distinction the report exists to draw.
     */
    if (this.capturing && isRelease(eventType)) {
      this.sawDrop = true;
    }

    return opening ? { kind: 'opened' } : { kind: 'record' };
  }
}
