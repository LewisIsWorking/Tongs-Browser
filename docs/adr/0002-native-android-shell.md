# 2. Native Android shell, phase 2

Date: 2026-08-08

Status: Proposed. Not built.

## Context

This records the design for the second half of Tongs Browser so the module can be built to coexist
with it. Nothing here has been implemented, and the design should be re-examined before it is.

One name covers both halves. The module supplies the pointer inside any browser. The app supplies a
browser purpose built to host it.

The module reaches a ceiling that no amount of JavaScript gets past:

- Every event it creates is untrusted. Mostly this does not matter. Where it does, there is no
  workaround from inside the page.
- The viewport cannot be controlled. A browser decides its own viewport width and zoom, so interface
  scaling has to be approximated with CSS transforms.
- The screen sleeps mid session, the browser chrome eats vertical space, and the back button leaves
  the game.

A WebView host controls all of these, because it owns the browser rather than living inside it.

## Decision, when it is built

An Android application wrapping a WebView pointed at the user's Foundry instance.

### Trusted pointer injection

The central mechanism. A Capacitor plugin, or a plain native bridge, dispatches `MotionEvent`s
constructed with `TOOL_TYPE_MOUSE` and `SOURCE_MOUSE` into the WebView. Chromium turns those into
genuine mouse and pointer events with `isTrusted === true`, indistinguishable from a physical mouse
because at the browser's level that is what they are.

That removes the last uncertainty in the module: any behaviour Foundry gates on trusted events starts
working, without the module needing to know or care.

### Viewport control

`WebSettings.setUseWideViewPort(true)` combined with `setInitialScale()` gives real control over the
layout viewport, rather than the CSS transform approximation the module uses. A Foundry interface
laid out at a genuine 1024px and then scaled by the compositor is materially better than one laid out
at 400px and transformed, because layout decisions such as sidebar collapse thresholds are made
against the real width.

Note for whoever builds this: `setInitialScale` genuinely does decouple device coordinates from CSS
pixels, unlike a CSS transform. That is the case `CoordinateTransform` in the module exists for, and
why it was kept despite being unnecessary for phase 1. See ADR 0003.

### Everything else the shell should carry

- `onShowFileChooser`, or uploads silently fail. Foundry uses file inputs for tokens, scenes and
  journal images, and a WebView without this handler does nothing when one is tapped.
- Cookie persistence across launches, so Forge authentication survives. `CookieManager` with
  `setAcceptThirdPartyCookies` and an explicit `flush` on pause.
- Immersive fullscreen, reclaiming the status and navigation bars.
- `FLAG_KEEP_SCREEN_ON` while a session is active.
- Back button trapping, so back navigates Foundry rather than leaving the game, with a confirm on
  exit.
- External links opened in a real browser rather than swallowed by the WebView.

## Open question, deliberately unresolved

**Should the module detect that it is running inside the app and stand its own synthesis down?**

The case for standing down: two pointers is worse than one. If the shell injects trusted events and
the module also synthesises untrusted ones, every interaction happens twice, and the module's cursor
disagrees with the system one.

The case for staying up: the module is the half that knows about gestures. Long press to right click,
tap then hold to drag, the modifier bar and the exclusion zones all live here, and none of them are
things a `MotionEvent` bridge provides on its own.

The likely shape of the answer is a split rather than a switch. The gesture layer stays, the modifier
bar stays, the UI scaling defers to the native viewport, and only the final dispatch is rerouted:
instead of constructing a `PointerEvent`, the dispatcher asks the bridge to inject a `MotionEvent`.

The module's architecture already allows this. `EventDispatcher` is the single place that constructs
and dispatches events, and every sequence is built as pure descriptors that something else carries
out. Swapping the dispatcher for a native one is a contained change, and that was a deliberate
consideration in the design rather than an accident.

The detection mechanism would be a JavaScript interface injected by the host, checked once at start
up. Do not use user agent sniffing.

## Consequences of not building it yet

Anything requiring trusted events, real viewport control, or the Android lifecycle stays out of reach.
The module is expected to be genuinely usable regardless, and whether the shell is worth building
should be decided from real play experience with the module rather than in advance.
