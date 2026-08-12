/**
 * Foundry's in-page globals, for code that runs inside `page.evaluate`.
 *
 * Added 2026-08-11 when the tooling scripts moved from `.mjs` to `.ts`. They had been outside the
 * typed program entirely, so 3,795 lines of harness that drives a live Foundry had no checking at
 * all, and simply renaming them would have been the worst of both worlds: TypeScript syntax with
 * none of the guarantees.
 *
 * ⚠️ These are deliberately typed as `any`, and that is a considered choice rather than laziness.
 * Foundry ships no type definitions, its API surface here is enormous, and a hand written partial
 * interface would be WRONG in a specific and dangerous way: it would look authoritative while
 * describing whatever subset somebody happened to need on the day, and it would silently drift with
 * every Foundry release. An honest `any` says "unchecked" out loud. A half accurate interface says
 * "checked" and is not.
 *
 * What this DOES buy is the 125 "Cannot find name" errors going away, so the remaining findings in
 * these files are about the harness's own code, which is the part worth checking and the part that
 * has actually been wrong: a check that presses off screen, reads a token mid animation, or counts
 * the wrong PIXI object.
 *
 * Everything below exists only at type level. None of it is imported or bundled: the declarations
 * describe globals the page already has when Playwright or CDP evaluates code inside it.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Foundry's canvas: layers, the scene, PIXI's application and the pointer mapping helpers. */
/*
 * ⚠️ `var`, not `const`, and the difference is the point. A `var` declaration in a global script
 * becomes a property of `globalThis`, so both `canvas` and `globalThis.canvas` typecheck. A `const`
 * only provides the bare name, and harness code reaches these BOTH ways: the bare form inside
 * `page.evaluate`, and the `globalThis.game?.ready` form in code that has to survive Foundry not
 * being loaded yet.
 */
// eslint-disable-next-line no-var
declare var canvas: any;

/** The game instance: world, users, actors, scenes, settings, modules, socket. */
// eslint-disable-next-line no-var
declare var game: any;

/** Foundry's interface: sidebar, notifications, chat, controls. */
// eslint-disable-next-line no-var
declare var ui: any;

/** Foundry's constants, including TOKEN_DISPLAY_MODES and the document ownership levels. */
// eslint-disable-next-line no-var
declare var CONST: any;

/** Document classes reachable as globals inside the page. */
// eslint-disable-next-line no-var
declare var Actor: any;
// eslint-disable-next-line no-var
declare var Scene: any;
// eslint-disable-next-line no-var
declare var User: any;

/** The `foundry` namespace, home of applications, utils and the data models. */
// eslint-disable-next-line no-var
declare var foundry: any;

/*
 * The probe globals, planted in the page by a check and read back out of it. Added 2026-08-12.
 *
 * Unlike Foundry's own API these are OURS, so they get REAL types rather than `any`: every one of
 * them is a list the harness appends to inside a listener and then asserts on, and the assertion is
 * the entire point of the check. `__probeLeaked.length === 0` is the claim that native touch never
 * reaches Foundry, so a typo in the field name there would not fail, it would quietly pass by reading
 * `undefined` off an `any` and comparing it to nothing.
 *
 * ⚠️ They are also the reason these arrays are initialised inside `page.evaluate` rather than
 * declared optional: a check that reads a probe it never planted should throw, not report zero.
 */

/** Every contextmenu event seen at the document, with where it landed. */
// eslint-disable-next-line no-var
declare var __probeContextMenus: { x: number; y: number }[];

/** Native touch derived pointer events that got past the module's capture phase suppression. */
// eslint-disable-next-line no-var
declare var __probeLeaked: { id: number; type: string }[];

/**
 * Font decode failures swallowed by the Android harness's shim, one line each.
 *
 * ⚠️ Every entry here is reported as a check result rather than kept quiet. The shim works around a
 * Chromium 133 bug that stops Foundry booting, and an environment fix that hides itself would be
 * worse than the bug, because every later result would silently rest on it.
 */
// eslint-disable-next-line no-var
declare var __tbSwallowedFonts: string[];
