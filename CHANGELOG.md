# tongs-browser

## 0.2.3

### Patch Changes

- [#18](https://github.com/LewisIsWorking/Tongs-Browser/pull/18) [`1481d59`](https://github.com/LewisIsWorking/Tongs-Browser/commit/1481d598d42c090a94905f3fcfe687b8db7fcd8c) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix the modifier bar being wider than the phone it is built for.

  On a 412px Android viewport the bar rendered 444px wide, leaving Esc, Enter and Tab entirely off
  screen with no way to reach them, and no position could have helped because 444 does not fit into 412. The bar now wraps and is bounded by the viewport, keeping the 44px touch targets rather than
  shrinking them. It is also clamped inside the viewport for the first time, so it can no longer be
  dragged off screen or stranded by a rotation.

  Found by `npm run check:android`, a new harness that drives Chrome on a real Android device over the
  DevTools socket adb forwards, rather than a desktop browser pretending to be one.

## 0.2.2

### Patch Changes

- [#17](https://github.com/LewisIsWorking/Tongs-Browser/pull/17) [`c2824fc`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c2824fc2fbecdf25f7ca90792f6412693f66c4d8) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the scene control toggle exist, and be reachable.

  The one control that has to work when the pointer is misbehaving did not exist at all on Foundry 14,
  for two independent reasons. The `getSceneControlButtons` hook was bound at `ready`, but Foundry
  builds the scene controls exactly once before that, so the listener fired zero times even after a
  forced re-render; it now binds at `init`. And the group is called `tokens` on v14 while the code
  looked for `token`, with a fallback that would have put the button silently into `regions`, which is
  worse than not appearing. The fallback is gone: it returns null rather than guessing.

  With the toggle finally rendering, the module's own modifier bar covered it. The scene control
  toolbar occupies x 12 to 66, and the bar defaulted to x 16, so the toggle at x 42 to 66 sat entirely
  underneath it and `elementFromPoint` returned the bar's collapse button. The default moved to x 88.

  Also adds `.chat-log` to the exclusion zones. `#chat-log` matched nothing on 14.365, since the log is
  a class there and the id is v12 markup; the behaviour had survived only because `.chat-scroll` wraps
  it. ADR 0008.

- [#14](https://github.com/LewisIsWorking/Tongs-Browser/pull/14) [`5f14d19`](https://github.com/LewisIsWorking/Tongs-Browser/commit/5f14d196ef002205aab46ac72f28f3a919866071) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Exercise the gesture machine with real, trusted touch input.

  `npm run check:touch` injects touch through Chrome DevTools Protocol, so the events carry
  `isTrusted: true` and the browser emits its own compatibility pointer and mouse events alongside them
  exactly as a tablet does. That last part cannot be reproduced by a hand built `TouchEvent`, and it is
  precisely what the native touch suppressor exists to handle.

  Five checks, all passing on 14.365. The important one is that a tap clicks at the pointer rather than
  under the finger: the pointer is parked on a sidebar tab, the finger taps far away over the canvas,
  and the tab changes. Recorded in ADR 0006, which closes the touch gap ADR 0005 left open. Multi touch
  is still uncovered.

- [#16](https://github.com/LewisIsWorking/Tongs-Browser/pull/16) [`f78f326`](https://github.com/LewisIsWorking/Tongs-Browser/commit/f78f32633d806995bb9ad50449f0eb5d9271c78f) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix the first pinch of every session jumping the canvas.

  `CanvasController` kept its own scale, seeded to 1, and corrected it through a `syncScale` method
  that nothing ever called. Foundry fits a scene to the viewport on load, so the canvas almost never
  starts at 1, and `canvas.pan({ scale })` is an absolute setter. Measured against a real Foundry: a
  scene sitting at 0.5 took a 1.6x pinch and landed on 1.6 rather than 0.8, a 3.2x lurch. The error is
  exactly 1/initialScale, so it was worst on the large scenes a tablet user is most likely to pinch.
  It also fired whenever anything else changed the zoom, including Foundry's own controls.

  The live scale is now read from the canvas on every zoom, and supplying it is a required option
  rather than an optional one, since an optional callback is exactly what a call site can forget.
  ADR 0007.

  Also adds `npm run check:multitouch`, the two finger harness that found it. It asserts the ratio
  between before and after rather than an absolute scale, because an absolute assertion would have
  passed while the canvas jumped.

- [#11](https://github.com/LewisIsWorking/Tongs-Browser/pull/11) [`01da078`](https://github.com/LewisIsWorking/Tongs-Browser/commit/01da07820b761e9957ebacb2ae7ae2918f22da93) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add browser tests against real Chromium, covering what jsdom structurally cannot.

  jsdom has no layout engine, so it cannot answer the questions carrying the most risk in this
  module: whether the cursor overlay stays out of its own hit tests, whether hover resolves the
  element the cursor is visually over, and whether either survives a CSS transform. Those are checked
  against the built bundle in a real browser now, rather than being discovered on a tablet.

  The suite empirically confirms the decision recorded in ADR 0003: clicks land on the correct
  element at 100, 75 and 50 percent interface scale with no coordinate conversion applied. It also
  confirms that the event view is set in a real browser, which the jsdom tests could not exercise at
  all.

- [#12](https://github.com/LewisIsWorking/Tongs-Browser/pull/12) [`8f8df7c`](https://github.com/LewisIsWorking/Tongs-Browser/commit/8f8df7c147bdc3937636874886b1630205d98375) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a local development setup guide.

  Covers wiring a checkout into a local Foundry with a symlink, which reduces the test loop from
  build, zip, release and reinstall down to save and reload, plus attaching an Android device over USB
  so its console can be read from desktop Chrome.

- [#13](https://github.com/LewisIsWorking/Tongs-Browser/pull/13) [`839098a`](https://github.com/LewisIsWorking/Tongs-Browser/commit/839098a35f40b91c2eb5c17614bcfcb376e6d924) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Answer the keyboard strategy question, and make a clean Windows clone verify.

  `npm run probe:foundry` drives a headless browser into a running Foundry, enables the module and
  measures whether synthesised keyboard events are honoured, taking its own independent reading rather
  than trusting the module's self report. On 14.365 the answer is `events`, so the modifier bar works
  as designed and the internals-touching fallback is dead code. Recorded in ADR 0004.

  Also adds `.gitattributes` with `* text=auto eol=lf`. Without it a Windows clone checks out CRLF,
  Prettier is pinned to LF, and `npm run verify` failed on a clean clone with all 76 files reported as
  badly formatted. CI runs on Linux and could never see it.

- [#13](https://github.com/LewisIsWorking/Tongs-Browser/pull/13) [`839098a`](https://github.com/LewisIsWorking/Tongs-Browser/commit/839098a35f40b91c2eb5c17614bcfcb376e6d924) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Verify both Foundry interaction surfaces accept the virtual pointer.

  `npm run check:foundry` drives a real Foundry and asserts against Foundry's own state rather than
  against appearances: a synthesised click is judged by `ui.sidebar.tabGroups`, and a synthesised
  pointer move by `canvas.mousePosition`. Both pass on 14.365, which measures the central risk ADR 0003
  was written to manage. Recorded in ADR 0005.

  The session handling shared by both Foundry tools is extracted into `scripts/foundry-session.mjs`,
  since a second copy of a login is a second thing to get subtly wrong in a way that hangs rather than
  errors.

## 0.2.1

### Patch Changes

- [#9](https://github.com/LewisIsWorking/Tongs-Browser/pull/9) [`0811faa`](https://github.com/LewisIsWorking/Tongs-Browser/commit/0811faa90f12db75628e50e9e3600f11f093a89e) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix the release pipeline so module.zip is actually attached to the release.

  A tag pushed using GITHUB_TOKEN does not trigger any workflow, which GitHub blocks deliberately to
  prevent recursive runs. The previous pipeline relied on a tag trigger to build and attach the
  release asset, so v0.2.0 was published with no module.zip and the manifest download URL returned
  404, leaving the module uninstallable.

  Packaging now happens in the same job that creates the tag. A manual workflow dispatch is also
  available for attaching the asset to a tag that already exists.

## 0.2.0

### Minor Changes

- [#5](https://github.com/LewisIsWorking/Tongs-Browser/pull/5) [`cf6dfd4`](https://github.com/LewisIsWorking/Tongs-Browser/commit/cf6dfd4d1b48d568642a66f2a633d90e85aa0633) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add interface scaling and application window clamping.

  Foundry's HTML chrome is scaled by a single CSS custom property, between 50 and 100 percent in five
  percent steps, with each region anchored to the edge it is pinned to. The canvas is never scaled.
  Application windows are clamped into the viewport for both the legacy and ApplicationV2 systems,
  since a sheet opening off screen on a touch device takes its close button with it and cannot be
  recovered.

  Also corrects a premise carried from the original design: browser hit testing is transform aware,
  so the pointer must keep using raw viewport coordinates while the interface is scaled. Verified
  against Chromium. A test pins the decision so the UI scale cannot later be wired into the hit
  tester, which would break a case that currently works.

- [#3](https://github.com/LewisIsWorking/Tongs-Browser/pull/3) [`686561e`](https://github.com/LewisIsWorking/Tongs-Browser/commit/686561e52f3b1934dc4648a308da673563a2efd0) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add the gesture layer and wire the module up so it runs.

  A finite state machine with explicit named states translates touches into pointer actions: tap to
  click at the pointer rather than at the finger, long press to right click, double tap, tap then hold
  to begin a drag, two finger pan, and pinch to zoom. The machine is pure, taking timestamps as input
  and requesting timers as actions, so every transition is tested without a DOM or a clock.

  Text inputs, contenteditable regions, the chat log and the sidebar are excluded, so typing and
  native scrolling keep working. Real touch derived pointer events are suppressed at the capture
  phase, behind its own toggle since that is the most likely source of conflict with another module.

- [#1](https://github.com/LewisIsWorking/Tongs-Browser/pull/1) [`b83c47f`](https://github.com/LewisIsWorking/Tongs-Browser/commit/b83c47fa297acb597ac4475214175e8f62ecf1d4) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add the project scaffold: TypeScript 6 in strict mode, Vite library build producing
  `dist/tongs-browser.js` and `dist/tongs-browser.css`, Vitest split into a DOM free unit project and
  a jsdom project, ESLint with type aware rules, Prettier, an em dash check covering every tracked
  file, the Foundry manifest, hand written Foundry ambient types, and CI covering lint, typecheck,
  test, build and tagged releases.

- [#4](https://github.com/LewisIsWorking/Tongs-Browser/pull/4) [`5ed5eeb`](https://github.com/LewisIsWorking/Tongs-Browser/commit/5ed5eeb60dc5d62bd75988705fe4f5b35788f3ad) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add the sticky modifier key bar.

  A floating, draggable, collapsible bar offering Ctrl, Shift, Alt, Space, Delete, Escape, Enter and
  Tab. Modifiers latch on tap, lock on a second tap, and release on a third. Latched keys clear after
  one action while locked ones stay held. Events are dispatched by `code`, which is what Foundry's
  keybinding system matches on.

  Includes a startup probe that measures whether this Foundry build honours synthesised keyboard
  events, falling back to writing the keyboard manager's held key set directly, with a warning, when
  it does not.

- [#2](https://github.com/LewisIsWorking/Tongs-Browser/pull/2) [`f25481a`](https://github.com/LewisIsWorking/Tongs-Browser/commit/f25481a7e842f9564fcaab4a43778b7497860343) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add the pointer core: the event synthesis engine behind the virtual mouse.

  Event sequences are pure functions returning ordered descriptors, dispatched by a separate thin
  dispatcher, so the ordering logic is tested in plain node with no DOM. Covers hover transitions on
  target change, left and right click, double click, dragging with the buttons bitmask held across
  the move stream, and pixel mode wheel events. Both PointerEvent and legacy MouseEvent are emitted.

  Includes the coordinate transform that converts between drawn and hit tested space, without which
  clicks land somewhere other than where the cursor appears once the interface is scaled.

- [#6](https://github.com/LewisIsWorking/Tongs-Browser/pull/6) [`984c090`](https://github.com/LewisIsWorking/Tongs-Browser/commit/984c0902b9698c4fb3f4383541c6e0656597879a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add client settings and a scene control toggle.

  All eleven settings from the design are registered as client scope, so each player configures their
  own device, and every one applies live rather than needing a reload. Values are validated and
  clamped on read rather than cast, so a setting written by an older version or edited by hand cannot
  reach the gesture config as a NaN.

  The scene control button matters more than convenience suggests: if the pointer misbehaves mid
  session, reaching the settings dialog to disable it means using the pointer to do so.

  Also adds the debug overlay, which outlines the element the pointer currently resolves to and logs
  every synthesised event.

### Patch Changes

- [#7](https://github.com/LewisIsWorking/Tongs-Browser/pull/7) [`076f2d9`](https://github.com/LewisIsWorking/Tongs-Browser/commit/076f2d919aae85973a415e6a7ae5f5f5e802711c) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add the README, the architecture decision records and the manual testing checklist.

  ADR 0003 records what was empirically verified about PIXI, hit testing and CSS transforms, including
  the two places where the original design assumptions turned out to be wrong: Foundry runs PIXI v7
  rather than v8, and browser hit testing is transform aware so no coordinate conversion is needed.
