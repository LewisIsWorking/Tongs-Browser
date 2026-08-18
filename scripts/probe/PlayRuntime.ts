/**
 * The shape the play probe installs into the PAGE. Extracted from foundry-play-probe 2026-08-18.
 *
 * ⚠️ WHY THIS FILE EXISTS AT ALL, because "just split the file" does not work here and the reason is
 * worth stating once. `page.evaluate(fn)` SERIALISES `fn` and runs the source in the browser, so the
 * callback cannot reach anything this Node process imported. That is why the probe was a single 572
 * line function: every helper had to be defined inside the one callback that used it.
 *
 * `page.addInitScript(fn)` serialises the same way but installs its result on `window` before the
 * page's own scripts run, and survives the navigations and reloads that joining a world performs. So
 * the pieces can live in separate modules after all, as long as each one is SELF CONTAINED at
 * runtime: no cross-module references inside a callback, only through this namespace.
 *
 * Types are the exception and are free: they are erased before serialisation, so `import type` across
 * these files costs nothing at runtime.
 */
import type {
  CapabilityRow,
  ClientAt,
  TrialContext,
  TrialOutcome,
  TrialPath,
  TrialRead,
} from './Trials.ts';

/** Where the pointer was aimed, and whether it actually arrived. */
export interface AimResult {
  readonly at: ClientAt;
  readonly landed: boolean;
}

/** Aiming at a DOM element also reports what is on top, which is what names the obstruction. */
export interface ElementAimResult {
  readonly at: ClientAt | null;
  readonly landed: boolean;
  readonly topmost: string;
}

/**
 * Everything a capability needs, built once per run against a ready world.
 *
 * `results` is shared and appended to, so a capability that throws still leaves every row measured
 * before it. An exception inside the page aborts the whole evaluate, and losing eight good rows to
 * the ninth one's bug is a bad trade.
 */
export interface PlayKit {
  readonly trials: number;
  readonly results: CapabilityRow[];
  readonly home: { x: number; y: number };
  wait(ms: number): Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly pointer: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly view: any;
  withFixture<T>(run: (fixture: TrialContext) => Promise<T>): Promise<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aim(token: any): Promise<AimResult>;
  aimAtElement(element: Element | null | undefined): Promise<ElementAimResult>;
  pointerEvent(type: string, at: ClientAt | undefined, extra?: PointerEventInit): PointerEvent;
  mouseEvent(type: string, at: ClientAt | undefined, extra?: MouseEventInit): MouseEvent;
  requireAt(at: ClientAt | undefined, type: string): ClientAt;
  run(path: TrialPath, read: TrialRead, needsToken?: boolean): Promise<TrialOutcome[]>;
  capability(
    name: string,
    viaPointer: TrialPath,
    viaNative: TrialPath | null,
    read: TrialRead,
    needsToken?: boolean
  ): Promise<void>;
}

/** The three event builders, composed into the kit at runtime from PlayEvents.ts. */
export interface PlayEvents {
  requireAt(at: ClientAt | undefined, type: string): ClientAt;
  pointerEvent(type: string, at: ClientAt | undefined, extra?: PointerEventInit): PointerEvent;
  mouseEvent(type: string, at: ClientAt | undefined, extra?: MouseEventInit): MouseEvent;
}

/**
 * The single global the probe installs. One name, so nothing else has to be coordinated.
 *
 * Every member is optional because each is installed by a separate `addInitScript` and the page could
 * in principle be missing one. The probe checks for `makeKit` and fails loudly rather than running a
 * subset of the capabilities and reporting the result as if it were the whole picture.
 */
export interface PlayNamespace {
  makeEvents?: () => PlayEvents;
  makeKit?: (trials: number) => PlayKit;
  canvasChecks?: (kit: PlayKit) => Promise<void>;
  createActorCheck?: (kit: PlayKit) => Promise<void>;
  sidebarChecks?: (kit: PlayKit) => Promise<void>;
}

export const PLAY_GLOBAL = '__tongsPlay';

/** Typed access to the namespace from inside a serialised callback. */
export type PlayWindow = Window & { [PLAY_GLOBAL]?: PlayNamespace };
