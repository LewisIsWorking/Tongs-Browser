# tongs-browser

## 0.25.17

### Patch Changes

- [#138](https://github.com/LewisIsWorking/Tongs-Browser/pull/138) [`0b34c44`](https://github.com/LewisIsWorking/Tongs-Browser/commit/0b34c447912b63dcaaa03437429cc004e1a23e49) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Turn the touch binder's listener registration into an asserted table, `gesture/TouchListenerSpecs.ts`.
  `TouchBinder.ts` drops from 251 lines to **189, under the limit**.

  ⚠️ **Every entry encodes a bug that took a physical device to find, and each is one option flag away
  from silently not working.** A bubble phase listener still fires. A passive one still runs. Both look
  completely normal in a debugger while the behaviour they exist to prevent goes straight past them.
  That is why these are now data with assertions rather than a run of `addEventListener` calls.

  The test that earns this is the roster:

  > **`pointercancel` was missing for weeks.** A touchscreen fires it whenever the browser takes a
  > gesture over; a mouse never fires it at all; and Foundry treats it as an ABORT that discards the
  > drag origin its 10px gate measures from. Desktop could not see the gap, and nothing in the code
  > looked wrong: the three siblings were right there, and the fourth simply was not.

  Also asserted: **capture on every one, without exception**, and **passive false on exactly the four
  that call `preventDefault`**.

  Writing the table exposed a smaller problem of its own. The `because` field started out saying "the
  same" for five of the nine entries, and the test requiring a real reason failed on them. A table
  meant to be readable standalone cannot cross-reference its own rows, so each now says what it is for.

## 0.25.16

### Patch Changes

- [#136](https://github.com/LewisIsWorking/Tongs-Browser/pull/136) [`887638f`](https://github.com/LewisIsWorking/Tongs-Browser/commit/887638f07560b2df0b5181f8e184e04c986f7a2d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Split the gesture state machine's arithmetic and its two finger handling into `TouchGeometry.ts` and
  `TwoFingerTracker.ts`, both at 100% coverage.

  `GestureStateMachine.ts` drops from 429 to 368 lines, and the 381 line state machine suite stays
  green throughout, so behaviour is preserved.

  **The geometry** is three small functions that decide whether a press is a tap or a drag, whether two
  fingers are pinching or panning, and where a pinch is anchored. The state machine's own tests reach
  their edges only by accident, arriving through a sequence of touches rather than asking directly.
  Now asked directly, including the cases that matter:

  - `separation` is **zero** for fewer than two fingers, and that is the honest answer rather than a
    fallback: a pinch is judged by a RATIO taken only once two fingers are down, so one finger has no
    separation to report rather than a small one.
  - `centroid` anchors a pinch **between** the fingers. Following either one would make the map lurch
    toward whichever the browser reported first, and which one that is can change between events.

  **The two finger tracker** carries the pan-versus-zoom rule, which is deliberately either-or:
  applying both from one gesture makes the canvas lurch, because a small pinch always drags the
  centroid slightly too. Two rules now pinned that were invisible before:

  - **A ratio of 1, never Infinity.** Zero starting separation means both touches arrived at the same
    coordinate, which happens on the first move of a fast pinch. Dividing would zoom the canvas to
    nothing in a single frame.
  - **A pan updates the separation as well as the centroid.** Left stale, a slow spread during a long
    pan would measure against the gesture's start, cross the threshold all at once and jump the zoom.
    Six 8px spreads under a 10px threshold now stay pans, all the way.

  `TWO_FINGER` and `PINCHING` were near duplicates differing in one thing: whether the gesture has
  already committed to zooming. That is now an argument rather than a second copy.

## 0.25.15

### Patch Changes

- [#134](https://github.com/LewisIsWorking/Tongs-Browser/pull/134) [`bb93b79`](https://github.com/LewisIsWorking/Tongs-Browser/commit/bb93b79a255685d0a98348179fc1e1470161a373) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract the modifier bar's clamping arithmetic into `modifiers/BarClamp.ts`, at 100% coverage.

  ⚠️ **These cases were unreachable from the DOM suite.** jsdom reports `offsetWidth` as 0 for every
  element, so every clamp the bar's DOM tests ran was against a zero sized bar, where the maths
  degenerates and all four branches collapse to the same answer. 825 lines of `modifierBar.test.ts` and
  336 of `modifierBarDragHandle.test.ts` could not touch any of it. Separating the numbers from the
  element is the only way this behaviour gets checked without a real layout engine.

  What is now pinned, all of it measured on a 412px phone rather than reasoned about:

  - **Keeps out of the SIDEBAR, not merely out of the window.** Once the bar wraps it reaches the right
    edge, where Foundry's sidebar lives, and the shipped default covered the sidebar's icon column
    between y 120 and 250. Worse than covering anything else, because the sidebar is how the user
    reaches chat, actors and the rest of Foundry.
  - **Falls back to the whole window when the bar cannot fit beside the sidebar.** Trading a covered
    sidebar for a bar hanging off the left edge is not a fix. A bar wider than the room beside the
    sidebar has no correct position, so the least wrong answer is the one where all of it is reachable.
  - **The width is capped, not just the position.** The bar is `position: fixed` with only `left` set,
    so it is shrink to fit: moving it LEFT makes it WIDER and its right edge stays pinned to the
    viewport edge. Clamping x from 88 to 65 changed the width from 324 to 347 while the right edge
    stayed at 412. The cap is computed from the CLAMPED x, so one pass converges.
  - **A bar with no layout yet is left alone**, or it gets dragged to the origin by any render that
    runs before the browser has measured it.

  `BarPosition` moves to its own file, so `BarClamp` can name a position without importing the bar that
  imports it. Re-exported, so every existing importer keeps working unchanged.

## 0.25.14

### Patch Changes

- [#132](https://github.com/LewisIsWorking/Tongs-Browser/pull/132) [`8d551b0`](https://github.com/LewisIsWorking/Tongs-Browser/commit/8d551b039e42977c9c57f785d211927fc4b52079) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract everything the diagnostics report reads out of Foundry into `debug/FoundryFacts.ts`, at 100%
  coverage.

  ⚠️ Every field is now read **once**, in one pass. The report is a snapshot of a moment, and a field
  read later than its neighbours describes a different moment: Foundry resets the interaction manager
  as soon as a gesture ends, so two reads a few lines apart can straddle the very transition being
  investigated.

  The tests are about **honesty** rather than plumbing. Every field is read by somebody trying to work
  out why a drag failed on a phone they cannot see, so a field that guesses is worse than one that
  admits it does not know:

  - **No game returns null, not a blank report.** A report full of "unknown" looks like a measurement
    that came back empty. It actually means the button was pressed before the world finished loading,
    which is a different thing for the reader to do about it.
  - **`manifestVersion` is what Foundry LOADED**, not what was compiled. The two disagreeing is the
    "am I even running the version you think I am" question that cost a full round trip when a device
    reported against a stale copy.
  - **`canDrag` is Foundry's own answer or `n/a`.** If it says false, the drag was never going to work
    and nothing else in the report matters, so guessing would be worse than admitting ignorance.

  `TongsBrowser.ts` is down to 1,134 from 1,853 at the start of the day.

## 0.25.13

### Patch Changes

- [#130](https://github.com/LewisIsWorking/Tongs-Browser/pull/130) [`3d1b495`](https://github.com/LewisIsWorking/Tongs-Browser/commit/3d1b495e92edfac1a4a2dd8fad68b5609d1b02e7) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix `insideSelectedToken` reporting the wrong answer in BOTH directions, and extract the test into
  `debug/TokenHitTest.ts` at 100% coverage.

  This field separates **"the drag did not work"** from **"the drag was never aimed at anything"**, and
  those are completely different problems. It was wrong two ways at once, because the axes were guarded
  differently:

  ```
  mouse.x >= document.x && mouse.x <= document.x + (w ?? 0)      // x: guarded
  (mouse.y ?? 0) >= (document.y ?? 0) && (mouse.y ?? 0) <= ...   // y: NOT guarded
  ```

  - **A false INSIDE.** With `mouse.y` and `document.y` both absent, y evaluated `0 >= 0 && 0 <= 0`,
    which is true. Missing data reported a hit, sending somebody hunting a drag bug when the pointer
    was never on the token.
  - **A false OUTSIDE.** `w ?? 0` makes the box zero pixels wide, so only the exact left edge counted
    and every real position reported a miss, sending somebody to aim a pointer already on target.

  Now every field must be present, and missing data answers **no, never yes**. Also documented on the
  type: `w`/`h` are the RENDERED size in scene units and are **not** `document.width`, which is a size
  in GRID SQUARES. A hit test against the document's width silently tests a box one square across,
  which on a 100px grid is a 99% miss.

  `TongsBrowser.ts` is down to 1,153 from 1,853 at the start of the day.

## 0.25.12

### Patch Changes

- [#128](https://github.com/LewisIsWorking/Tongs-Browser/pull/128) [`d1eee1c`](https://github.com/LewisIsWorking/Tongs-Browser/commit/d1eee1c19954c5770b1536794ee2b45eb5ca55c9) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract when the drag record opens, freezes and retires into `debug/DragCaptureWindow.ts`, and fix a
  defect in the move counter that this made visible.

  **The diagnostic was measuring the wrong thing.** The freeze that closes the record on the drop sat
  BELOW the move counter, so every pointer move after the drop still incremented the denominator while
  sampling had already stopped. That denominator decides whether a probe was watching: `describeThinly`
  refuses to state a peak sampled under 10% of the moves. On a phone the pointer keeps moving for as
  long as it takes to read the report, so the count ran away and every probe was declared too thinly
  sampled to state. **A report of "2 samples of 227 moves" was counting hundreds of moves that happened
  after the drag it was describing.**

  A measuring instrument that keeps measuring after the event does not report the event. The counter
  now sits after the freeze.

  The state machine is now fed sequences and asserted on, at 100% including all 27 branches. The two
  rules that look arbitrary and are not:

  - **The release is RECORDED, not frozen on.** `endDrag` clears the dragging flag before dispatching,
    so at the release the window is already told `dragging: false`. Marking the drop any earlier froze
    on the release itself, and every device trace then ended on a `pointermove`, making a released drag
    look identical to one still held. That is the exact distinction the report exists to draw.
  - **A fresh press retires the record even while frozen.** Retiring is a side effect that has to happen
    either way. Skipped whenever the record was frozen, which is every time a drag has completed, it
    could never be retired at all.

  `TongsBrowser.ts` is down to 1,162 from 1,853 at the start of the day.

## 0.25.11

### Patch Changes

- [#126](https://github.com/LewisIsWorking/Tongs-Browser/pull/126) [`ea1c5e5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ea1c5e5da6b98290c6fb747b72cbf70c1a1cce69) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract the action tray's buttons into `ui/TrayActions.ts`, at 100% coverage.

  Taken as a set of handlers rather than the module itself, so the list builds and is asserted on
  without a canvas, a pointer or a Foundry. What is worth protecting is the **content**, not the
  wiring: a build catches a missing handler, and catches none of these.

  - **The pan signs read backwards on purpose.** Pressing right moves the VIEW right, which is the same
    as dragging the map LEFT, so the delta is negated. Getting it wrong gives four buttons that work
    perfectly and all go the wrong way. Now pinned per direction.
  - **Grab says DROP while held.** The regression that cost a whole round of device diagnostics: gold
    latch styling says "on", but "on" does not say the next thing to do is tap it OFF, and Foundry only
    commits a token's move on the DROP. A report came back mid drag with the token quite correctly
    sitting where it started.
  - **Zoom out is the reciprocal of zoom in**, so out-then-in lands exactly back.
  - **Momentary buttons report no active state**, since a latch on one invites an undoing tap.

  `TongsBrowser.ts` is down to 1,218 from 1,853 at the start of the day, across twelve extracted
  modules all under 200 lines and all at 100% on statements, branches, functions and lines.

## 0.25.10

### Patch Changes

- [#124](https://github.com/LewisIsWorking/Tongs-Browser/pull/124) [`cb39cf6`](https://github.com/LewisIsWorking/Tongs-Browser/commit/cb39cf6128e13d692152a4800f84e2e15b5b84b7) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Bring the last 119 type errors in the harness scripts to zero, and put `typecheck:scripts` inside
  `verify` so they cannot come back.

  Four of these were real defects rather than missing annotations, and they were all the same shape:
  an annotation that described what somebody needed three lines earlier rather than what the value is.

  - **`captureAttributedErrors` declared `string[]` and pushed objects**, then read `.stack` off them.
  - **`(o: HTMLOptionElement) => o === 'yes'`**, four times, on what are trial outcome strings. Every
    one of those comparisons was **always false** at type level.
  - **`play-probe`'s `CheckResult` was a copy of another check's shape** and did not describe a single
    row this file builds.
  - **The keyboard control's `reason` was `string | undefined`**, so the unusable branch reported its
    failure with a detail of literally `undefined`. That detail is the entire finding: "Foundry ignored
    the event" and "there is no `downKeys` to look at" are different problems with different fixes.

  Two robustness bugs fell out on the way:

  - The tap control read `tab.addEventListener` with no null guard. A missing tab threw **inside the
    page**, which took down the whole run. The one thing written to establish whose fault a failure is
    would itself have become the failure.
  - `barControls` spread a possibly null rect, so a control with no coordinates printed `at x NaN-NaN`
    in the very failure message meant to say where it had gone.

  `FoundryToken` was written twice and had already drifted: one copy knew about `nameplate` and not
  `w`/`h`, the other the reverse. Both now come from `scripts/foundry-types.ts`, so drift between
  copies is not expressible. `#board` was queried in four scripts and is now `boardBox`/`boardCentre`,
  which throw rather than returning (0, 0): a fallback there presses the corner of the window and
  produces a plausible looking FAIL for whichever behaviour was under test.

## 0.25.9

### Patch Changes

- [#122](https://github.com/LewisIsWorking/Tongs-Browser/pull/122) [`61095f2`](https://github.com/LewisIsWorking/Tongs-Browser/commit/61095f2a93522235be2c2937889d598d12228026) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract finding "my character" into `foundry/CharacterSheet.ts`, at 100% coverage.

  The order is the whole content of this, and each step earns its place: the assigned character,
  because that is what the user explicitly nominated; then a controlled token's actor, because on a
  phone selecting a token and then asking for its sheet is the natural flow and double tapping a token
  accurately is fiddly, which is the problem this module exists for; then the only actor they own.

  The test worth having guards the last step:

  > **Exactly one owned actor, never a guess between several.** A wrong sheet is worse than no sheet:
  > it looks like the button worked, so the user acts on the wrong character rather than trying again.

  Failure is reported rather than silent, so the caller can say what would fix it. Deliberately system
  agnostic: PF2e and SF2e were the worlds this was asked for, but every system renders through the same
  `Actor#sheet`, and naming one would only make it break on the next.

  `TongsBrowser.ts` is down from 1,853 to 1,315, with eleven new modules all under 200 lines and all at
  100% on statements, branches, functions and lines.

## 0.25.8

### Patch Changes

- [#120](https://github.com/LewisIsWorking/Tongs-Browser/pull/120) [`96beb77`](https://github.com/LewisIsWorking/Tongs-Browser/commit/96beb77e606113fa6ffcb3597672894646cf884f) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract pausing the world into `foundry/PauseControl.ts`, at 100% coverage.

  The hard part was never the toggle, it is **who may broadcast it**, and that is the kind of thing
  worth pinning with a test rather than a comment. Foundry's `Game#togglePause` only emits its socket
  message `if ( options.broadcast && game.user.isGM )`, so a player calling it toggles their own client
  and nobody else's. The check is on the EMIT path rather than on permissions, which is why granting a
  player ownership of a macro does not help.

  The test that matters most guards a mistake that would be invisible with one GM at the table:

  > **`activeGM`, not `isGM`.** Foundry designates the same single GM on every client,
  > deterministically. Using "am I a GM" would have EVERY connected GM answer the same relayed request,
  > flipping the pause once per GM and landing wherever the race ended. With two GMs online that is a
  > button that does nothing half the time, which is worse than one that never works at all.

  Also pinned: a macro the user is not permitted to run relays instead of being attempted, because
  trying anyway throws inside Foundry and produces nothing where the relay would have worked.

  `TongsBrowser.ts` is down from 1,853 to 1,333, with ten new modules all under 200 lines and all at
  100% on statements, branches, functions and lines.

## 0.25.7

### Patch Changes

- [#118](https://github.com/LewisIsWorking/Tongs-Browser/pull/118) [`5dffb8b`](https://github.com/LewisIsWorking/Tongs-Browser/commit/5dffb8b4ab517530ed70940136c4dd7fb710ed3c) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract how the diagnostics report reaches somebody holding a phone, at 100% coverage.

  Chat AND clipboard, not either. Reading the report off a screenshot is the slowest part of this loop
  and it TRUNCATES: a phone chat window shows about fifteen lines and silently hides the rest, which
  already cost a full round trip on the one field that mattered. The clipboard carries the whole thing
  and the chat message is what makes it visible that a report exists at all.

  One behaviour is now pinned by a test that would be very easy to get backwards: **an absent user id
  whispers to NOBODY.** Foundry treats an empty whisper array as "everyone", so defaulting the other
  way would broadcast a diagnostic to the whole table at the exact moment something is going wrong.

  `TongsBrowser.ts` is down from 1,853 to 1,361 across today's extractions, with nine new modules all
  under 200 lines and all at 100% on statements, branches, functions and lines.

## 0.25.6

### Patch Changes

- [#116](https://github.com/LewisIsWorking/Tongs-Browser/pull/116) [`694a2d2`](https://github.com/LewisIsWorking/Tongs-Browser/commit/694a2d203dce8a25b00367cfa01fa57673b538e6) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract the sidebar button's DECISION, which was wrong twice before it was right.

  `decideSidebarAction` returns what the button should do rather than doing it, so the reasoning is
  testable without a DOM and the DOM work stays where the DOM is. The ordering encodes two things a
  device taught us, and both replaced something that looked obviously correct:

  1. **Pop a tab OUT rather than expanding the docked sidebar.** Toggling `expanded` genuinely flips
     and nothing appears, because the docked sidebar is a column pinned to the right edge of a layout a
     phone browser does not place where the maths says. A popped out tab is an ordinary application
     window, which `WindowClampBinder` already keeps inside the viewport, so it is visible by
     construction rather than by luck.
  2. **Offer EVERY tab, not just the active one.** Popping out the active tab gave chat and nothing
     else, because the only way to change tabs is the docked tab strip, which is the 27px column that
     started all of this.

  Expanding the docked sidebar survives as the last resort, for a build with nothing to pop out, and
  there is a test asserting it stays last.

  `SidebarAccess.ts` is at 100% on all four metrics and `TongsBrowser.ts` is down from 1,853 to 1,377.

## 0.25.5

### Patch Changes

- [#114](https://github.com/LewisIsWorking/Tongs-Browser/pull/114) [`6a1cbc1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6a1cbc1fed1269ec97a9fdecbfcbaa28e95fe50d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract reaching Foundry's sidebar into `foundry/SidebarAccess.ts`, at 100% coverage.

  This is a real feature area rather than a tidy up. Foundry auto collapses its sidebar below about
  1024px into a strip of icons hard against the right edge, and its expander is a few pixels wide,
  which is not a realistic touch target. A device reported "no side bar" three separate times while the
  module was otherwise working, so the answer is to pop tabs OUT as windows rather than fight the
  collapsed strip: a popped out chat or actors tab is a normal Foundry window, movable and closable
  with gestures the module already provides.

  Three behaviours now have tests, and each one exists because of a way this can fail quietly:

  - **A tab whose application cannot pop out is not offered.** A button that quietly does nothing is
    worse than a shorter list: the user taps it, nothing happens, and concludes the module is broken
    rather than that the tab is unavailable.
  - **Popping out TOGGLES.** That button is the only way back, and an open chat window with no way to
    dismiss it would cover the map on a phone, which is the problem this solves rather than a new one.
  - **Failing to expand reports failure**, so the caller falls back to the tab picker instead of
    leaving the user tapping a dead control.

  Everything reads Foundry through an injected accessor rather than `globalThis`, which is what makes
  it testable: being reachable only from the composition root is exactly what made these untestable.

  `TongsBrowser.ts` is down from 1,853 to 1,436.

## 0.25.4

### Patch Changes

- [#112](https://github.com/LewisIsWorking/Tongs-Browser/pull/112) [`f81295a`](https://github.com/LewisIsWorking/Tongs-Browser/commit/f81295a3e9ccf8c075ee549f1d953635a59fedf1) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract every drag measurement into `debug/DragSampler.ts`, at 100% coverage.

  The composition root was carrying sixteen fields of sampling state and a 257 line method doing the
  arithmetic on them. They now live in one class whose design point is a single rule: **nothing leaves
  without its sample count**.

  A peak alone is not a measurement over a gesture, it is a measurement over however many samples it
  happened to get, and those are the same thing only when the sampling covers the gesture. This report
  stated a peak of `0.0px` as fact three separate times while holding two samples out of two hundred,
  and each time it sent the investigation somewhere it did not need to go. Making the count
  structurally inseparable from the reading is the fix for the class rather than the instance.

  The tests assert the distinctions that cost real time, above all this one: **a drag origin that was
  never readable and one that was readable and pinned both produce a peak of zero, and they mean
  opposite things.** There is a test that pins exactly that apart.

  `TongsBrowser.ts` is down from 1,853 to 1,457. Verified against a live Foundry after the refactor:
  `foundry-drag-check` still moves a token (600, 600) to (800, 600) with peak state DRAG.

## 0.25.3

### Patch Changes

- [#110](https://github.com/LewisIsWorking/Tongs-Browser/pull/110) [`f7cb170`](https://github.com/LewisIsWorking/Tongs-Browser/commit/f7cb170832d7bc40f799f5a7022ecbd65da16d12) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Harness type errors 293 down to 119, and the type checker found real null holes.

  `foundry-session.ts`, `foundry-touch.ts`, `foundry-drag-check.ts` and `foundry-probe.ts` typecheck
  clean; `foundry-live-check.ts` has one error left.

  The findings were not annotation noise. Three DOM queries in the live check were used without a null
  check, so a missing element produced a bare `TypeError` from the following line and told nobody what
  was actually absent. Each now says which thing was not there:

  - `no .tb-cursor in the document: the module has not drawn its pointer.`
  - `no #board in the document: Foundry has not drawn its canvas.`
  - `no [data-tool="tongs-browser"] control: the scene control was never created.`

  Every one of those is a real outcome this harness is meant to detect rather than crash on, and ADR
  0010 is about exactly this: a check that cannot say whose fault a failure is teaches you to distrust
  it. Also fixed a `record(..., moved.reason)` where the reason is optional and only the failing branch
  sets it, so a missing one would have printed `undefined` into a result line.

  Verified by running it: `foundry-live-check` still passes every assertion against a live Foundry, so
  the typing changed nothing at runtime.

## 0.25.2

### Patch Changes

- [#108](https://github.com/LewisIsWorking/Tongs-Browser/pull/108) [`3ae0207`](https://github.com/LewisIsWorking/Tongs-Browser/commit/3ae0207985dedfff8d3abe0540f606aa765df948) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Harness type errors 293 down to 132, with three files at zero.

  `foundry-session.ts`, `foundry-touch.ts` and `foundry-drag-check.ts` now typecheck clean. The first
  two are the shared modules everything else imports, so typing them stops the `any` at the boundary
  rather than letting it spread to every caller.

  Two findings worth keeping out of this:

  **Playwright's `Page` and the CDP stand in are genuinely incompatible types**, not one type wearing
  two hats. Playwright's `evaluate` carries generic overloads nothing hand written can satisfy, so a
  "common interface" for them cannot exist. The union is kept honest instead, with one documented
  adapter for evaluation and narrowing at exactly the two places a Playwright only method is required.
  That is more truthful than a shared interface that quietly lies about what either surface is.

  **`passed: null` is a SKIP and deliberately not a boolean.** Now that the check result shape has a
  name, that distinction is in the type rather than in a convention, so a skip cannot be filtered or
  read as a pass.

  Verified nothing broke: `foundry-drag-check` still PASSES against a live Foundry, moving a token
  (600, 600) to (800, 600).

## 0.25.1

### Patch Changes

- [#106](https://github.com/LewisIsWorking/Tongs-Browser/pull/106) [`0793d2d`](https://github.com/LewisIsWorking/Tongs-Browser/commit/0793d2dc01dc6d6e1d9a78be85e9d6a277330a93) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Type the harness properly: 293 script type errors down to 178, with `foundry-session.ts` at zero.

  Renaming `.mjs` to `.ts` was the easy part and left 3,795 lines of TypeScript that did not typecheck,
  which is the worst of both: the syntax without any of the guarantees. This is the start of paying
  that off, working from the shared module outward.

  - `foundry-session.ts`, which every check imports, is now **fully typed and error free**. Its entry
    points take Playwright's real `Page` rather than an implicit `any`, so the annotation propagates to
    every caller instead of stopping at the boundary.
  - The Foundry globals are declared with `var` rather than `const`, and the difference is the point: a
    `var` in a global script becomes a property of `globalThis`, so both `canvas` and `globalThis.canvas`
    typecheck. Harness code reaches them both ways, the bare form inside `page.evaluate` and the
    `globalThis.game?.ready` form in code that has to survive Foundry not being loaded yet.
  - The check harnesses share one result shape, now named. `passed: null` is a SKIP and is deliberately
    not a boolean, so a skip cannot be mistaken for a pass by a reader or by a filter.

  Verified the conversion did not break anything that matters: `check-em-dashes` runs clean and
  `foundry-drag-check` still PASSES against a live Foundry.

## 0.25.0

### Minor Changes

- [#104](https://github.com/LewisIsWorking/Tongs-Browser/pull/104) [`4aba57e`](https://github.com/LewisIsWorking/Tongs-Browser/commit/4aba57e53f57df47f74adc903d1826c77aa7566e) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - **The viewport resize hypothesis is dead**, and the report now says whether it is watching at all.

  A device on 0.24.4 reported `0 resizes during the drag` with the viewport identical at the grab and
  at the report. Foundry redraws on resize and there were no resizes, so the redraw theory is finished.
  That line was built so a zero would kill it, and it did.

  The same report exposed a worse problem, and it is the same mistake this report has now made four
  times. It said `NOTHING observed` while the drag origin was demonstrably being wiped, 2 samples out
  of 227 moves. **Those two facts cannot both be true of a watched drag.** They are trivially both true
  of an unwatched one, and nothing in the report said which it was: `installFoundryDragHooks` returns
  false when Foundry is not ready, and that answer went nowhere.

  So the line now distinguishes three states that were one:

  - **NOT WATCHING** when the observers never installed, saying outright that the line means nothing
  - **NOTHING observed, and the observers ARE installed**, which is a real finding about Foundry
  - **the MANAGER hook never installed**, which matters because a cancel arriving at `GRABBED` never
    reaches the token callbacks at all, only the manager

  The manager prototype is reached through a live controlled token, so "token hooked, manager not"
  is a normal state rather than an error, and it now has to be visible rather than inferred.

## 0.24.6

### Patch Changes

- [#102](https://github.com/LewisIsWorking/Tongs-Browser/pull/102) [`543c24b`](https://github.com/LewisIsWorking/Tongs-Browser/commit/543c24bc00df97f56de330d5ad86af8ee07f98a1) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Wire in `PixiMoveProbe`, which had been extracted, covered, and then never used.

  The class was written days ago, brought to 100% on all four metrics, and never imported. The
  composition root kept its own inline copy of the same counting, so there were two implementations of
  one thing and only one of them had tests. That is worse than either alternative: the covered version
  made the whole area look done while the version that actually ran was untested.

  Found by grepping for the import rather than for the file, which is the check worth remembering: a
  module can exist, be correct and be covered while nothing calls it. Extraction is not finished when
  the new file passes, it is finished when the old code is gone.

  The inline duplicate and its five fields are deleted. `TongsBrowser.ts` is down from 1,853 to 1,563.

## 0.24.5

### Patch Changes

- [#100](https://github.com/LewisIsWorking/Tongs-Browser/pull/100) [`e41221f`](https://github.com/LewisIsWorking/Tongs-Browser/commit/e41221f43cce2250f95e066cb38657dfff4878ab) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract the dispatch trace ring buffer, at 100% coverage.

  `debug/DispatchTrace.ts`, 80 lines. Its one piece of real behaviour, collapsing repeated lines into a
  count, exists because of a measured failure rather than tidiness: a held pointer that is not moving
  emits the same line hundreds of times, the buffer is eighteen entries long, and a moment of stillness
  at the end of a gesture therefore erased the whole gesture before it. A device produced a trace
  describing only the pause, which read as "the pointer never moved".

  That collapse now has a test which fires two hundred identical moves after one real one and asserts
  the real one survives.

  `TongsBrowser.ts` is down from 1,853 to 1,615 across today's three extractions, with 461 tests.

## 0.24.4

### Patch Changes

- [#98](https://github.com/LewisIsWorking/Tongs-Browser/pull/98) [`59e89f7`](https://github.com/LewisIsWorking/Tongs-Browser/commit/59e89f7e2a2167298752532202fb59af14b57071) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract the diagnostics report into a pure builder, at 100% coverage.

  `debug/DiagnosticsReport.ts` takes an explicit snapshot and returns lines. It reads nothing and asks
  nobody, which is what finally makes the report testable, and this report has been wrong about its own
  numbers three separate times. Each time a line stated something the code had not measured, and each
  time it sent the investigation somewhere it did not need to go.

  The tests now assert the claims that misled, rather than trusting them:

  - a peak that was never sampled says **NOT MEASURABLE**, never a confident `0.0px`
  - a peak sampled for almost none of the gesture disowns itself, with the move count as denominator
  - `needs >= 10` appears only beside a real reading, never beside a refusal
  - the explanation says the data was **WIPED**, and there is a test asserting it does not say
    "transient", which is what this claimed for three releases and was wrong: `interactionData` is a
    plain property that persists until `reset()`, so thin sampling is a finding rather than a
    measurement error

  The line ORDER is asserted too, because it is load bearing rather than cosmetic: a phone chat window
  shows roughly fifteen lines and truncates the rest silently, and an earlier report was cut off exactly
  at the field the round existed to read.

  `TongsBrowser.ts` is down from 1,853 to 1,637 across today's two extractions.

## 0.24.3

### Patch Changes

- [#96](https://github.com/LewisIsWorking/Tongs-Browser/pull/96) [`979fa03`](https://github.com/LewisIsWorking/Tongs-Browser/commit/979fa03c7618eac4688f6dd11fbd3a691eeabf82) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract the Foundry drag observers out of the composition root, at 100% coverage.

  `TongsBrowser.ts` had reached 1,853 lines against a hard 200 line limit, and these observers are the
  one part of the diagnostics with real logic rather than formatting in them. They now live in
  `debug/FoundryDragHooks.ts`, which is 151 lines and covered on all four metrics.

  Two properties are asserted that were previously untestable, and both are load bearing because this
  code runs inside somebody's live game:

  - **The wraps do not change anything.** Each calls the original with the original `this` and returns
    its result untouched. A probe that alters what it measures is worse than no probe.
  - **They survive a Foundry that is not ready.** The canvas does not exist when the module is built,
    and the interaction manager prototype is only reachable through a live token, so "hook the token
    but not the manager yet" is a real state rather than a defensive branch nobody expected.

  `TongsBrowser.ts` is down to 1,746. Still far over, and the remaining diagnostics need splitting
  across three or four files rather than moving wholesale.

## 0.24.2

### Patch Changes

- [#94](https://github.com/LewisIsWorking/Tongs-Browser/pull/94) [`9dcc714`](https://github.com/LewisIsWorking/Tongs-Browser/commit/9dcc71435e3083fb0060c27e3b9fadca52ae77e1) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Count token redraws and viewport resizes during a drag, because **redrawing a token cancels its
  interaction**.

  From Foundry's `PlaceableObject`, in both `draw()` and `destroy()`:

  ```js
  if (this.mouseInteractionManager?.state > INTERACTION_STATES.HOVER) {
    this.mouseInteractionManager.interactionData.cancelled = true;
    this.mouseInteractionManager.cancel();
  }
  ```

  Anything that redraws a token mid gesture destroys the drag, at `GRABBED`, silently, and wipes
  `interactionData` with it. That is the exact signature a device keeps reporting: the state never
  leaves `GRABBED`, the drag origin is readable for a couple of samples out of hundreds, and no ending
  callback fires because the ending callback needs `DRAG` to have been reached first.

  The suspected cause is recorded as a suspicion rather than a conclusion, and measured instead of
  argued: Foundry redraws the canvas when it resizes, and on Android the URL bar slides in and out
  during a gesture, which resizes the viewport. A desktop window does not change size mid drag, which
  would explain why every desktop run passes and every device run does not.

  So the report now carries the viewport at the grab, the viewport now, the number of resizes during
  the drag, and every `draw` or `destroy` that landed on the token while it was held. If the resize
  count is zero while redraws are not, the hypothesis is dead and the cause is elsewhere. Either way it
  stops being a guess.

## 0.24.1

### Patch Changes

- [#92](https://github.com/LewisIsWorking/Tongs-Browser/pull/92) [`e2702cb`](https://github.com/LewisIsWorking/Tongs-Browser/commit/e2702cbfc573c4ac726dad7c8286936d3216ac0e) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Hook Foundry's interaction MANAGER, not just the token, because the token's callbacks have a blind
  spot that hid the cancel.

  The `contextmenu` fix worked: the three `_onDragLeftCancel` calls are gone. What replaced them was
  `FOUNDRY'S DRAG ENDING: NEITHER ran`, with the state peaking at `GRABBED` and the drag origin
  readable for 2 samples of 164 moves. That reads as "nothing happened", and reading Foundry's source
  says otherwise.

  From `cancel()`:

  ```js
  if ( endState <= this.states.HOVER ) return ...SKIPPED
  if ( endState >= this.states.DRAG ) { this.callback(action, event) ... }
  ```

  **The cancel callback only fires once the state has reached DRAG.** A cancel arriving at `GRABBED`
  resets the interaction and calls nothing at all, so the probe watched the drag being destroyed and
  reported that neither ending ran. `reset()` sets `interactionData = {}`, which is exactly why the
  origin kept vanishing.

  Both `cancel` and `reset` are now wrapped on the manager prototype, recording the state they were
  called in and the event that caused them, so a silent cancel is no longer silent.

  Also corrects something this report has been asserting for three releases: **`interactionData` is not
  transient.** It is a plain property that persists until `reset()`. A low sample count therefore never
  meant "read at the wrong moment", it meant the data was being wiped mid gesture, and the report now
  says so.

## 0.24.0

### Minor Changes

- [#90](https://github.com/LewisIsWorking/Tongs-Browser/pull/90) [`f2751c1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/f2751c185a68f9e9c596bfddfe02c777baecd720) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - **The browser's own `contextmenu` was cancelling every drag.** Found by reading Foundry's source
  rather than guessing again.

  `client/canvas/interaction/mouse-handler.mjs`, where `MouseInteractionManager` builds its handler map:

  ```js
  contextmenu: this.#handleDragCancel.bind(this);
  ```

  A `contextmenu` aborts an in progress drag outright, and `_onDragLeftCancel` writes nothing. So the
  token stays exactly where it was while every other measurement looks healthy: the gate opens, the
  state reaches `DRAG`, a preview clone is created, and the whole thing is thrown away. A device
  reported precisely that, three cancels and not one drop, which is what pointed at the source.

  On a phone a long press produces a native `contextmenu`, and a finger dwelling mid drag is not an edge
  case, it is how people drag. A mouse only ever produces one on a deliberate right click, which is why
  no desktop run in this entire investigation saw it, including under emulated touch.

  `isTrusted` separates the two exactly: the browser's event is trusted, and the one this module
  synthesises for its own long press gesture is not. So a stray long press is swallowed and the
  deliberate right click still reaches Foundry. Excluded regions keep their menus, so a long press in
  chat still offers copy.

  ⚠️ jsdom defines `isTrusted` as a non configurable own property, so nothing dispatched inside it can
  ever be trusted and the central claim here is undispatchable there. The guard's decision is therefore
  tested by handing it the event shape directly, and the binding by dispatching. Pretending a jsdom
  event were trusted would have been testing the fake rather than the code.

## 0.23.1

### Patch Changes

- [#88](https://github.com/LewisIsWorking/Tongs-Browser/pull/88) [`205df3b`](https://github.com/LewisIsWorking/Tongs-Browser/commit/205df3b58875da916e11931e0f1fec52def3546d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Say what TRIGGERED Foundry's drag cancel, and lead the report with the build number.

  A device answered the last question outright: `_onDragLeftCancel` three times and `_onDragLeftDrop`
  never. Foundry is not failing to write the move, it is **cancelling the drag before it gets that
  far**. That is a completely different fix from a refused write, and it is the first time the two have
  been distinguishable.

  "Something aborted the drag" is not a lead, though. Foundry hands the cancel handler the event that
  caused it, so the report now prints that event's type, button, pointer type and pointer id. Those
  separate the candidates that actually differ:

  - a right click, which is how a mouse user cancels a drag on purpose
  - a second press arriving mid drag
  - a cancelled pointer
  - **no event at all**, which would mean Foundry cancelled of its own accord rather than in response to
    input, and would move the search inside Foundry rather than inside this module

  The build number is now the first line of the report rather than buried two thirds down. It is the
  sanity check every other number depends on, it is stamped by Vite at build time so it cannot go stale,
  and it is the one thing worth reading before anything else. The `manifest says` value beside it is
  Foundry's cached `module.json`, read once at server start, and a mismatch there is expected rather
  than a problem.

## 0.23.0

### Minor Changes

- [#86](https://github.com/LewisIsWorking/Tongs-Browser/pull/86) [`ea3ebdf`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ea3ebdf638ab4d8ed829af671f3cb099f2192095) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - **The drag reaches Foundry's DRAG state with a preview clone.** Stopping the raw touch stream reaching
  PIXI in 0.22.0 was the fix for that half:

  |                              | before           | after                 |
  | ---------------------------- | ---------------- | --------------------- |
  | Foundry drag origin readable | 2 samples of 235 | **454 of 454**        |
  | drag gate                    | 0.0px            | **200.9px**, needs 10 |
  | peak interaction state       | `GRABBED (3)`    | **`DRAG (4)`**        |
  | preview clones               | 0                | **1**                 |

  The token still does not move, so the failure has moved from the gate to the **ending**, and those are
  two different handlers on Foundry's Token that are indistinguishable from outside:
  `_onDragLeftDrop` reads the clones and writes the new position, `_onDragLeftCancel` destroys the
  preview and writes nothing. Both reset the state, both clear the preview, and both leave the token
  where it was. The report now says which one ran, by wrapping them: the original is called with the
  original `this` and its result returned untouched, so it observes without changing behaviour.

  Also fixes an off by one that hid the most important event in the trace. `endDrag` clears the dragging
  flag before dispatching, so at the release the recorder already saw `dragging: false`; setting the
  "saw a drop" flag before the freeze meant the freeze fired on the release itself and the `pointerup`
  was never recorded. Every device trace ended on a `pointermove`, which made a released drag look
  exactly like one still being held.

## 0.22.1

### Patch Changes

- [#83](https://github.com/LewisIsWorking/Tongs-Browser/pull/83) [`f81cc4b`](https://github.com/LewisIsWorking/Tongs-Browser/commit/f81cc4b6768189be9a80a1eba0f55de74036bd8c) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Count the moves PIXI delivers to the **token itself**, which is the only one of the three that decides
  a drag.

  Stopping the raw touch stream reaching PIXI was a real bug and was not this one: v0.22.0 changed
  nothing on the device. The report still says `PEAK state: GRABBED (3)` with a pointer that travelled
  122px.

  Foundry evaluates its 10px drag gate inside a handler bound on the **object**, and PIXI delivers to an
  object only while the pointer is over it. So the gate is checked only while the pointer is still
  standing on the token, and if it has not opened by the time the pointer leaves, it never will. Every
  PIXI count in this report so far has been of the **layer**, which is a different object entirely, and
  it was read three times as though it answered this. A layer count stays perfectly healthy while the
  token receives nothing at all.

  `PIXI moves TO THE TOKEN` now leads that section, and calls out a zero explicitly, because a zero
  means the gate was never evaluated after the press and no amount of travel could have opened it.

  Also adds `scripts/await-device-then.ts`. Chrome on Android serves its debugging socket only while
  the browser is in the foreground, which turns every device run into a rendezvous the user cannot keep:
  the way they report a result is by switching to another app to paste it. Four runs died to that, each
  looking like a different fault. The check now waits for the socket and starts itself, re-establishing
  the adb forward on each attempt since a forward survives the socket going away and then points at
  nothing.

- [#85](https://github.com/LewisIsWorking/Tongs-Browser/pull/85) [`ed1ce70`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ed1ce70bd5c1d3fea4da2b69576bc79017ff9993) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - The tooling scripts are TypeScript. They were `.mjs` and outside the typed program entirely, so 3,795
  lines of harness that drives a live Foundry had no checking at all.

  Node 26 runs TypeScript directly by stripping types, so this needs no bundler, no `tsx` and no new
  dependency: `node scripts/foundry-drag-check.ts` simply works, and the npm scripts and the release
  workflow point at `.ts` now.

  `scripts/foundry-globals.d.ts` declares Foundry's in-page globals, which removed 280 of the 591
  errors the rename exposed. They are typed as `any` on purpose. Foundry ships no types, and a hand
  written partial interface would be wrong in a specific and dangerous way: authoritative-looking,
  describing whatever subset somebody needed on the day, and drifting with every Foundry release. An
  honest `any` says "unchecked" out loud where a half accurate interface would claim otherwise.

  `npm run typecheck:scripts` checks them against `tsconfig.scripts.json`, which relaxes exactly two of
  the app's rules, `noPropertyAccessFromIndexSignature` and `exactOptionalPropertyTypes`. Both fire on
  every `process.env.FOO` and on optional fields handed to Playwright, and neither describes a defect in
  a script. `strict` still applies.

  **293 type errors remain**, all in harness files that predate this change, almost all missing
  annotations on Playwright callbacks. They are reported rather than hidden, and `typecheck:scripts` is
  deliberately not yet part of `verify`, because wiring a red check into the gate would only teach
  everyone to ignore it. Type aware lint rules are also still off for `scripts/**`: turning them on
  produces 1,895 findings, which is a migration of its own rather than something to bundle in here.

## 0.22.0

### Minor Changes

- [#81](https://github.com/LewisIsWorking/Tongs-Browser/pull/81) [`1821d84`](https://github.com/LewisIsWorking/Tongs-Browser/commit/1821d84cdb97283f1cc3adf578aac92028eab5e8) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - **The finger was driving PIXI in parallel with the virtual pointer.** That is what broke dragging.

  The touch handlers called `preventDefault()` and stopped there. That prevents scrolling and the
  browser's compatibility mouse events, and it does **nothing** about propagation. PIXI listens for
  `touchstart`, `touchmove` and `touchend` itself and normalises them into its own pointer events, so
  every real touch reached Foundry regardless of the pointer event suppression sitting next to it.

  Foundry therefore saw two interactions at once: ours, holding a button on the token, and the
  finger's, beginning wherever the finger actually was. The finger is never on the token, because
  putting the pointer somewhere the finger is not is the entire purpose of this module. The finger's
  stream destroyed the token's `interactionData`, so the drag gate had nothing to measure from, the
  state never left `GRABBED`, no preview was created and the token never moved.

  The touch listeners now bind in the **capture** phase and stop propagation there, so the raw stream
  never reaches the canvas. The gesture layer still receives every touch first, excluded regions such
  as chat keep their own scrolling and handling, and the whole thing stays behind the existing
  suppression setting for coexisting with TouchVTT.

  ## How it was finally caught

  By driving the module's own pointer against the phone over wireless adb, with no finger involved:

      Adopted 'Anthony' at (2900, 2200)
      token position : (2900, 2200) -> (3000, 2200)
      peak state     : 4 (DRAG),  drag clones: 1
      screenOrigin   : 180, pinned across all 12 steps
      PASS

  Same device, same build, same gesture. **12 origin samples of 12 without a finger, against 2 of 235
  with one.** Everything except the finger had already been eliminated by measurement, and the only way
  to see that was to run the same assertions on the hardware rather than reason about it.

## 0.21.2

### Patch Changes

- [#79](https://github.com/LewisIsWorking/Tongs-Browser/pull/79) [`f81dbe6`](https://github.com/LewisIsWorking/Tongs-Browser/commit/f81dbe68c6d6ced175606bcbbd61ce1f1a928f47) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the device drag check non destructive, and stop it hanging on a backgrounded tab.

  Three attempts to run it against the phone produced no output at all, and two of them left a probe
  actor and token behind in a live world. Both faults were in the harness.

  **It creates nothing now.** Building a probe actor and token is four document writes, and every write
  to the phone is a Foundry socket round trip measured in minutes over wireless adb. The check adopts a
  token that is already in the scene instead, restores its position afterwards, and so performs exactly
  one write: the drag itself, which is the thing under test. The user's own selected token is also a
  better subject than anything the check could invent, since it is the one they were dragging when they
  hit the bug.

  **It no longer waits on `requestAnimationFrame` alone.** rAF does not fire in a background tab, and on
  a phone that is not an edge case: the moment you switch to another app, Foundry stops painting and the
  drag loop waits forever. It is now raced against a timer, so a backgrounded tab slows the check
  instead of stopping it.

  The CDP client also names a tab that goes away mid run rather than surfacing a raw WebSocket stack
  trace followed by a confusing `ReferenceError` from cleanup running against a dead context.

## 0.21.1

### Patch Changes

- [#77](https://github.com/LewisIsWorking/Tongs-Browser/pull/77) [`87718b7`](https://github.com/LewisIsWorking/Tongs-Browser/commit/87718b7b9ea9c2b61ad9ff50dfc59238014c02b9) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the report refuse to state a number it barely sampled, and stop a lost tab reading as a crash.

  `pointercancel` was not it. v0.21.0 changed nothing on the device, and the theory is dead.

  What the same report finally revealed is a fault in the instrument. `DRAG GATE` and `ORIGIN drifted`
  both read Foundry's `interactionData`, which is **transient**: it exists while Foundry is handling an
  event and is gone afterwards, and these read it after `dispatchEvent` has returned. Measured three
  times running on a device: **2 samples**, against 55, 235 and 305 dispatched moves. Two is exactly
  the number of dispatches in a grab, `pointerdown` and `mousedown`, which is the one moment the field
  reliably exists.

  So both numbers describe the press and not the drag, and they have looked authoritative while doing
  it. `0.0px, needs >= 10` was read as "the pointer never moved" on three separate occasions and sent
  the investigation somewhere else each time. Where the sampling covers less than a tenth of the moves,
  the report now says **IGNORE THIS NUMBER** and why.

  Also: a tab that goes away mid check, because Foundry was reloaded on the phone, produced a raw
  WebSocket stack trace and a `ReferenceError: canvas is not defined` from cleanup running against a
  dead context. Both read like code faults; neither was one. The CDP client now names it.

## 0.21.0

### Minor Changes

- [#75](https://github.com/LewisIsWorking/Tongs-Browser/pull/75) [`fad9030`](https://github.com/LewisIsWorking/Tongs-Browser/commit/fad9030ade2d7289b5d9f04c16ee9a1d9072fd34) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - **A `pointercancel` from the real finger was killing every drag.** Suppressed now, like the other three.

  The native touch suppressor stopped `pointerdown`, `pointermove` and `pointerup` from reaching
  Foundry twice over, and never touched `pointercancel`. A mouse never fires one, which is exactly why
  desktop has never seen this in any configuration: not at 1600x1000, not under emulated touch, a
  mobile user agent and dpr 3, not with 1.6px micro steps matching a finger's cadence, not while the
  canvas pans underneath. All of those pass.

  A touchscreen fires `pointercancel` whenever the browser takes a gesture over: a scroll, an edge
  swipe, a second finger, a system gesture. Foundry's MouseInteractionManager treats a cancel as an
  ABORT. It resets the interaction and discards `interactionData`, including the `screenOrigin` its
  10px drag gate is measured from. So one stray cancel mid grab ends the drag silently. The state sits
  at `GRABBED` forever, no preview appears, and the token does not move however far you drag.

  The measurement that finally isolated it: **Foundry's drag origin was readable for 2 of 55 moves on
  the device, against every step of the same gesture on desktop.** Two samples is an interaction being
  destroyed almost immediately and never coming back, and the sample counts added a release earlier are
  the only reason that was visible at all.

  Our own `pointercancel` still passes through, because `VirtualPointer.cancelDrag` sends one to
  release a held button when a gesture is abandoned, and swallowing that would leave a token stuck to
  the pointer.

  Also corrected: the `PIXI moves: layer=N stage=N` counter carried a comment claiming it "separates the
  two remaining possibilities". It does not. A **working** desktop drag measures `layer=5 stage=39`,
  the same one in ten ratio as the device's `layer=8 stage=112`, so that number cannot tell a working
  drag from a broken one and never could.

## 0.20.3

### Patch Changes

- [#73](https://github.com/LewisIsWorking/Tongs-Browser/pull/73) [`c8bf5c6`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c8bf5c63a676570d8ea3faa045f45fc17bef06f3) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Start pulling the diagnostics out of the composition root, which had grown to 1,691 lines.

  The hard limit is 200 lines per file and `TongsBrowser.ts` was eight times it, almost all of it
  diagnostics added one device report at a time over a single day. That is the wrong place for them
  twice over: it is a composition root, and being a composition root is exactly what made every probe
  untestable, which is a large part of why the report spent several rounds confidently printing numbers
  it had never measured.

  Two extractions so far, both at **100% statements, branches, functions and lines**:

  - `debug/FoundryProbes.ts`, the read only questions put to Foundry and PIXI. Pure functions over
    global state rather than methods, so a test can hand them a fake `canvas`.
  - `debug/Clipboard.ts`, which has nothing to do with pointers. Its one interesting property now has
    a test: `navigator.clipboard` is secure context only, a self hosted Foundry on a LAN address is
    plain http, so on the target device the deprecated `execCommand` path is the only one that runs.

  `TongsBrowser.ts` is down to 1,538 lines. Still far over, and the remaining work is the drag recorder
  and the report builder, which need splitting into three or four files rather than moved wholesale.

## 0.20.2

### Patch Changes

- [#71](https://github.com/LewisIsWorking/Tongs-Browser/pull/71) [`21da1e3`](https://github.com/LewisIsWorking/Tongs-Browser/commit/21da1e301f68b0bdf00659ce3f984c4dfcb126e0) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Say whether the grab actually landed on the token, and stop the record describing the aftermath.

  **The drag fix works.** A device confirmed a token moving for the first time. The very next report
  showed no movement again, and it turned out to be a different thing entirely: the grab began a few
  pixels off the token. Foundry starts a drag from a pointerdown that HITS a placeable, so a press on
  empty canvas begins a selection rectangle instead, records no drag origin, and peaks at `HOVER`.
  Every number in that report was individually correct and collectively described a gesture nobody
  meant to perform.

  The report now leads with **GRABBED ON THE TOKEN**, answered at the moment of the grab, and says how
  far outside the token the pointer was when the answer is no. The old line for this,
  `insideSelectedToken`, is read at report time, long after the pointer has moved on and been used to
  tap the button that produced the report.

  Two things this also fixes:

  - **The record now FREEZES on the drop.** Scoping it to the drag stopped a later tap overwriting the
    gesture and still let the commoner case through: ordinary movement after the release. Those arrive
    by the hundred and the trace is eighteen entries long, so a device reported 305 drag moves above
    eighteen consecutive `buttons=0` moves, which describes the moment after the drag. The travel
    counters were polluted the same way.
  - `DRAG GATE: NOT MEASURABLE` earned its keep immediately. Printing the old fake `0.0px` here would
    have read as "the pointer never moved" for a third time.

## 0.20.1

### Patch Changes

- [#69](https://github.com/LewisIsWorking/Tongs-Browser/pull/69) [`25b7041`](https://github.com/LewisIsWorking/Tongs-Browser/commit/25b7041476d7861d31d750cb616dffa45c33a952) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Wait far longer for a token move to commit when the check is driving a real device.

  Measured 2026-08-11: a document write issued to the phone took **minutes** to come back through
  Foundry's socket, long enough that a desktop client deleted the same token first and the phone's call
  eventually returned `Token ... does not exist!`. Pure JavaScript evaluated on that same tab returned
  instantly, so this is not a slow device or a suspended tab, it is specifically the round trip through
  Foundry's socket over wireless adb.

  The eight second commit wait is right for a local desktop client and badly wrong there. It would have
  reported "the token did not move" about a move that was merely still in flight, which is the harness
  accusing the feature for its own reasons. That has now happened three times in this one check: it
  pressed off screen, it read a token mid animation, and this would have been the third.

## 0.20.0

### Minor Changes

- [#67](https://github.com/LewisIsWorking/Tongs-Browser/pull/67) [`26da089`](https://github.com/LewisIsWorking/Tongs-Browser/commit/26da089bf76f8c547bd176ab0bd1e604f36be610) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - **Dragging a token works.** A tap while a grab was held was destroying every drag.

  Found on hardware: a OnePlus 13 on Chrome 150 against Foundry 14.365, connected over wireless adb.
  The report that named it showed `drag moves dispatched: 197` above `DRAG GATE: 0.0px over 6 samples`,
  and a dispatch trace with a complete `pointerdown, mousedown, pointerup, mouseup, click` sitting in
  the middle of a held grab. That is a finger being lifted and read as a tap.

  Every click sequence opens with a `pointerdown`, and Foundry treats a pointerdown on a placeable as
  the START of an interaction: it records a fresh `screenOrigin` wherever the pointer is now. Its drag
  begins only once the pointer is `dragResistance` (10px) from that origin, so an origin that keeps
  being re-recorded under the pointer can never be far enough from it. The drag stalls at `GRABBED`
  forever, no preview is created, and the token does not move however far you drag. The pointer
  travelled 140.3px and Foundry's own gate never read above zero.

  Clicks are now suppressed while a grab is held. Movement, `endDrag` and `cancelDrag` are untouched,
  because moving the pointer IS the drag and swallowing a release would strand a held button.

  The guard lives in `GestureController` rather than in the state machine. The machine is pure, holds
  no reference to the pointer, and "is a button already down" is pointer state rather than gesture
  state. That separation is exactly why this survived: the machine's tap handling is correct in
  isolation and every one of its tests passes.

  `GestureController` had **no test file at all**, which is the second time on this project that the
  class carrying out the actions went untested while the pure thing choosing them was covered
  thoroughly. `CanvasController` was the first, and it was also hiding a real bug. Both
  `GestureController` and `ModifierBar` are now at 100% statements, branches, functions and lines, and
  that turned up two more untested things on the way: the bar's own drag handle, and the guard covering
  drift between `MODIFIER_CODES` and `MODIFIER_KEYS`, two lists of the same three keys maintained
  separately in two files. There is now a test asserting they agree.

## 0.19.5

### Patch Changes

- [#65](https://github.com/LewisIsWorking/Tongs-Browser/pull/65) [`480ac56`](https://github.com/LewisIsWorking/Tongs-Browser/commit/480ac56662b5a441ff3f0cdd716cee327123e74c) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Report how many samples are behind every peak in the diagnostics, and rule out canvas panning.

  A peak is not a measurement over a gesture. It is a measurement over however many samples it happened
  to get, and those are the same thing only when the sampling covers the gesture. That distinction has
  now been the same mistake three times in one investigation:

  1. a `0.0px` that had sampled **nothing**, printed beside its own threshold as though the pointer had
     stood still,
  2. a `0.0px` peak that may have sampled only the **first move**, when the pointer was still sitting on
     its own origin and zero was the correct answer to a question nobody wanted asked,
  3. and that second zero was used to conclude that Foundry's drag origin follows the pointer, which is
     a strong claim to rest on a number that might have one sample behind it.

  Every peak now reads `X px over N samples`, above a `drag moves dispatched: M` line that is the
  denominator for all of them. `0.0px over 47 samples` is evidence. `0.0px over 1 sample` is noise
  wearing the same clothes, and until now the two were indistinguishable.

  Also refuted, by measurement rather than argument: **panning the canvas during a drag does not move
  `screenOrigin`.** It stays pinned at 800 across twelve steps while the canvas moves under it. The new
  `npm run check:drag -- --pan` covers it, and it is worth keeping for a second reason: it made the
  token overshoot to 500px for a 240px drag, which the distance assertion caught. Before that assertion
  existed this check would have called that a pass.

## 0.19.4

### Patch Changes

- [#63](https://github.com/LewisIsWorking/Tongs-Browser/pull/63) [`ff4095e`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ff4095e889abd2a7d6798d07d804901033c00d57) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Measure whether Foundry's drag origin is following the pointer, and reproduce phone input on desktop.

  A device's numbers now say what the bug is, by arithmetic: the pointer travelled 139.4px, PIXI's
  pointer was 0.0px from ours, and Foundry's gate `|pixi - screenOrigin|` was 0.0px. All three can only
  hold if **`screenOrigin` travelled 139.4px too**. An origin that follows the pointer can never be
  10px away from it, which is why that device sits at `GRABBED (3)` forever, never reaches `DRAG (4)`,
  creates no preview and moves no token.

  The report now measures that drift directly rather than leaving it to a three step inference, since
  this investigation has already had two confident inferences turn out wrong.

  What it is **not**, each ruled out by measurement rather than argument:

  - Not PIXI failing to receive synthesised events on a touch device. `ours vs PIXI` measured 0.0px.
  - Not `screenOrigin` aliasing PIXI's live pointer object. Measured `false`.
  - Not touch input, a mobile user agent, or a device pixel ratio of 3. `check:drag --mobile` turns all
    three on and passes, with `screenOrigin` pinned at 683 across twelve steps.
  - Not the pointer failing to travel far enough. 139.4px against a 10px threshold.

  `--mobile` deliberately does not shrink the viewport to the phone's 360x607, because **Foundry itself
  refuses to run below 1024x768** and replaces the interface with a paragraph saying so. The press point
  guard caught that immediately and quoted it, which is the second time that guard has stopped the
  harness blaming the module. The drag check now quotes the text of whatever is in the way, not just
  its tag name.

## 0.19.3

### Patch Changes

- [#61](https://github.com/LewisIsWorking/Tongs-Browser/pull/61) [`3c580a1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/3c580a1a118a9ff3630c60928fe20a0c61440d6d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - `npm run check:drag -- --android` runs the token drag assertions against Chrome on the real device.

  Desktop passes and the same gesture fails on a phone, so desktop can no longer answer the question,
  and inferring the difference from pasted reports has cost three releases. This runs the identical
  assertions over the DevTools socket `adb` forwards.

  Two things it does differently there, both of which would otherwise make the harness blame the
  module:

  - The drag is a **third of the viewport** rather than a flat 240px. The hit tester clamps the pointer
    inside the viewport, so a 240px drag across a 360px phone runs into the edge, moves the token less
    than asked, and reports "the drag is not following the pointer" about the harness's own arithmetic.
  - It **does not close the browser** on the way out. That is the user's own Chrome with their own tabs
    in it, and a diagnostic that tidies up by closing your browser is not a good trade.

## 0.19.2

### Patch Changes

- [#59](https://github.com/LewisIsWorking/Tongs-Browser/pull/59) [`71c2ee1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/71c2ee175652ba17c5188127f66082eb29026aba) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Measure how far the pointer travelled from the grab, against nothing but ourselves.

  Three device reports came back unreadable for the same reason: every distance in them was computed
  against something Foundry owns, so when Foundry's numbers came back as zeros there was no way to tell
  which of two completely unrelated bugs was in front of us.

  - The pointer travelled a long way and Foundry's drag origin **followed it**, so its 10px gate can
    never open, or
  - the pointer only travelled 8px, Foundry is entirely right to refuse, and the real complaint is how
    far a finger has to move to get the pointer anywhere.

  Both produce `gate distance 0.0`. Both produce a token that does not move. They share no fix.

  The report now leads with **OUR pointer travelled**, measured from our own grab point using only our
  own state, and says outright which case it is. It cannot be confounded by whatever Foundry is doing,
  which is the entire point of it.

  The previous round's measurement did its job and is worth recording: `ours vs PIXI during the drag`
  came back **0.0px apart at worst**, which refutes the theory that PIXI was not receiving our
  synthesised events on a touch device. PIXI tracks the virtual pointer exactly.

## 0.19.1

### Patch Changes

- [#57](https://github.com/LewisIsWorking/Tongs-Browser/pull/57) [`0d8c404`](https://github.com/LewisIsWorking/Tongs-Browser/commit/0d8c4044823084f9ff400e172c508c24fc7b1211) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Stop the diagnostics reporting a drag gate it never measured, and measure the thing that decides it.

  A device report read `DRAG GATE: peak distance 0.0px, needs >= 10`, which says the pointer stood
  still. It says nothing of the kind. `peakDragDistance` starts at `0` and is only ever written when
  Foundry's `screenOrigin` and PIXI's pointer are both readable; the same report said `origin=n/a`, so
  the computation never ran and the **initial value was printed as though it were a measurement**. It
  now says `NOT MEASURABLE` and explains that this is not a distance of zero.

  The measurement that actually splits the problem is new: **how far our pointer got from PIXI's during
  the drag**. Foundry gates a drag on PIXI's pointer and nothing else, and derives
  `canvas.mousePosition` from it too, so when PIXI is not tracking the events we dispatch, every
  position in the report except our own is describing a different pointer while reading as if it
  described ours. That line is now labelled `canvas.mousePosition (PIXI's pointer, NOT ours)`, because
  unlabelled it invited exactly the wrong conclusion: `insideSelectedToken: false` was perfectly true
  about PIXI's pointer and silent about the virtual one.

  Sampled during the gesture, not at report time, since by then the pointer is on whichever button was
  tapped to produce the report.

  Also refuted a plausible theory cheaply, and it is worth recording because it was wrong: Foundry does
  **not** alias `screenOrigin` to PIXI's live pointer object. Measured `false` on 14.365, so the gate
  distance is a real subtraction and an exact 0.0 is a real result rather than an artefact.

## 0.19.0

### Minor Changes

- [#55](https://github.com/LewisIsWorking/Tongs-Browser/pull/55) [`6f31394`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6f313944d6049be32d57c79b30cbb8ff61071706) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - The grab button now says `DROP` while it is holding something, and the diagnostics report says
  outright whether the token moved.

  Dragging a token was reported broken three times. It is not broken. Measured against a live Foundry
  14.365 with the new `npm run check:drag`: our pointer, Foundry's recorded drag destination, the drag
  clone and the committed token document all track a 240px drag exactly, and the move commits.

  What was broken is that the grab button holds the mouse button down until it is tapped again and
  showed the same open hand either way. Foundry only commits a token move on the **drop**, so a held
  grab leaves the token precisely where it started, which from the other side of the screen is
  indistinguishable from a drag that does nothing. The latched gold styling says "on", and "on" does
  not tell you that the next thing to do is tap it off.

  The report gained two lines above everything else, because every field it had answered a question
  about events rather than the question anyone was asking:

  - **DID IT MOVE**, comparing the token's position at the grab against its position now.
  - **released during drag**, which names the trap outright when a report is taken mid gesture.

### Patch Changes

- [#55](https://github.com/LewisIsWorking/Tongs-Browser/pull/55) [`6f31394`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6f313944d6049be32d57c79b30cbb8ff61071706) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add `npm run check:drag`, which asserts that a token **moved**, against a live Foundry.

  Every existing drag test asserts on the event stream: that a move carried `buttons=1`, that the
  captured target was reused, that the right descriptors were emitted. All of it stayed green through
  three releases a real phone reported as broken, and none of it is what a drag is. jsdom makes that
  unavoidable rather than merely tempting, since there is no PIXI, no hit testing and no token there to
  assert on.

  This drives the module's own pointer through grab, move and drop and passes only if
  `token.document.x` ends up roughly where the pointer went. Three of its safeguards exist because the
  check accused the module of a bug that was in the check:

  - It waits for the position to **settle**, not to change. Foundry animates a token along its movement
    path, so the first changed value reads the token mid flight: a 240px drag measured as 17.64px.
  - It **pans to the token** before pressing. Without that it pressed at (-375, -325), hit nothing, and
    reported "the token did not move", which is true and accuses code that never ran.
  - It **refuses to give a verdict** it cannot support: a press point that is not over `canvas#board` is
    a hard error rather than a failure.

  It also traces our pointer, Foundry's drag destination and the drag clone at every step, so a failure
  says which pair disagrees. ADR 0011.

## 0.18.0

### Minor Changes

- [#53](https://github.com/LewisIsWorking/Tongs-Browser/pull/53) [`af90c44`](https://github.com/LewisIsWorking/Tongs-Browser/commit/af90c44c692f66ea0eaaa967d82a5caa1800a7bd) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Copy the diagnostics report to the clipboard, not just to chat.

  Asked for while debugging from a phone, and it removes the slowest and least reliable step in the
  loop. A chat window on a phone shows about fifteen lines and silently hides the rest, and a report
  has already been cut off exactly at the field the round existed to read, costing a full round trip.
  Reading numbers off a screenshot is also how a two token coincidence was briefly mistaken for a fix.

  ⚠️ `navigator.clipboard` is gated to secure contexts, and a self hosted Foundry on a LAN address is
  plain http, so on a phone it is simply undefined. That is exactly the setup this exists for, which
  makes the `execCommand` fallback the path that matters and the modern API the optimisation. A copy
  button that silently did nothing on the target device would be worse than no button.

  The report still goes to chat as a record, and says whether the copy succeeded rather than leaving it
  to be discovered by pasting nothing.

- [#53](https://github.com/LewisIsWorking/Tongs-Browser/pull/53) [`af90c44`](https://github.com/LewisIsWorking/Tongs-Browser/commit/af90c44c692f66ea0eaaa967d82a5caa1800a7bd) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a diagnostics button that whispers a report into chat.

  A drag failure reported from a real phone could not be reproduced on any surface available for
  testing. It works on desktop through the full gesture layer with real injected touch, and the
  emulator's Chromium 133 cannot hit test canvas objects from synthetic events at all, so it can
  neither confirm nor deny anything. Three plausible hypotheses were each disproven by measurement:
  the active tool being hijacked by this module's own scene control (measured `select` before and
  after), pause blocking the drag (only applies when not a GM), and moves not carrying the held button
  (fixed, and desktop drags 800 to 1300).

  That is the point at which guessing should stop and the device should be asked directly. The button
  reports the active tool, the controlled token and its `_canDrag`, the pointer position and drag
  state, the element under the pointer, `canvas.mousePosition` and whether it sits inside the selected
  token, the canvas and keyboard state, and the user agent.

  Chat rather than the console, deliberately: it is the one output surface a phone user already has
  open and can screenshot, where reaching devtools on Android needs a cable and a laptop. Whispered to
  self so it never lands in front of players.

- [#53](https://github.com/LewisIsWorking/Tongs-Browser/pull/53) [`af90c44`](https://github.com/LewisIsWorking/Tongs-Browser/commit/af90c44c692f66ea0eaaa967d82a5caa1800a7bd) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Report the build version and the actual event stream in diagnostics.

  A drag failure on a real device produced a report where **every static check was healthy**: `select`
  tool, `_canDrag: true`, pointer genuinely inside the selected token, canvas ready. At that point the
  setup is not the problem and the only thing left to look at is the event stream itself, which on a
  phone has no console to look at it in. The report now carries the last eighteen dispatched events
  with their `buttons` value, which is the field that decides whether a drag is a drag: it must stay
  non zero on every move between the down and the up, or Foundry reads the stream as a hover.

  ⚠️ The same report also claimed version 0.2.3 while running code from 0.9.0, and that is worth
  fixing rather than explaining away. `game.modules.get(id).version` comes from a manifest Foundry
  reads **once at server start** and caches, so replacing module files under a running server leaves it
  frozen at whatever booted. The version is now stamped into the bundle at build time and both are
  shown, so a mismatch is visible rather than misleading.

- [#53](https://github.com/LewisIsWorking/Tongs-Browser/pull/53) [`af90c44`](https://github.com/LewisIsWorking/Tongs-Browser/commit/af90c44c692f66ea0eaaa967d82a5caa1800a7bd) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a grab button so tokens can actually be dragged, and make tray buttons show their state.

  **Dragging a token was near impossible on a phone, and it was the gesture design rather than a bug.**
  A drag required tap, lift, press again inside the double tap window, hold past the long press timer
  without moving more than the tap slop, and only then move. Five things in a row, each a chance to get
  it wrong while looking at the map rather than at your thumb. It passed every test, because it does
  work; working and usable are different claims.

  The new ✋ button holds the button down at the pointer until tapped again, so dragging becomes grab,
  move the pointer normally, drop. It is also how a popped out window gets dragged, which was the other
  half of the same complaint.

  ⭐ Making that work needed a real fix, not just a button. The buttons bitmask has to stay set on every
  move of a drag or Foundry reads the stream as a hover, and only `dragBy` set it. A drag begun by the
  new button and then continued by ordinary pointer movement silently degraded into a hover: measured
  on a device, the button was held, the pointer glided over the token, and the token did not move.
  `applyMove` now routes on the drag STATE rather than on which method was called, so the two agree.
  Verified end to end: token x 800 to 1200.

  **Tray buttons now show their state.** Pause and grab are toggles whose "on" was invisible, which
  invites a second tap that undoes the first. Both now carry the same latched styling the modifier keys
  use, distinguished by border weight and colour rather than colour alone, plus `aria-pressed`. Pause
  also refreshes from Foundry's `pauseGame` hook, so it stays honest when a GM pauses from a laptop or
  another player's request arrives through the relay.

  The pan arrows are grouped into a cluster, since the bar had grown to four wrapped rows on a phone.

- [#53](https://github.com/LewisIsWorking/Tongs-Browser/pull/53) [`af90c44`](https://github.com/LewisIsWorking/Tongs-Browser/commit/af90c44c692f66ea0eaaa967d82a5caa1800a7bd) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#53](https://github.com/LewisIsWorking/Tongs-Browser/pull/53) [`af90c44`](https://github.com/LewisIsWorking/Tongs-Browser/commit/af90c44c692f66ea0eaaa967d82a5caa1800a7bd) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Let players pause the game, and reach every sidebar tab rather than just chat.

  **Players can pause.** Foundry's `Game#togglePause` only broadcasts
  `if (options.broadcast && game.user.isGM)`, so the permission check sits on the emit path and a
  player calling it toggles their own client alone. Macro ownership does not help either: `Macro#execute`
  runs the script client side as whoever pressed it, and core Foundry has **no** execute-as-GM at all,
  verified against the installed 14.365 where `executeAsGM`, `execute-as` and `asGM` appear nowhere in
  client or common. That feature comes from modules such as Advanced Macros.

  So a player now emits a request and one GM performs the toggle. The GM is chosen with Foundry's own
  `game.users.activeGM`, which picks the same single user on every client: without that, every
  connected GM would answer the same request and the pause state would flip once per GM. The request
  carries the desired state rather than the word "toggle", so two players tapping at once agree on an
  outcome instead of cancelling each other.

  **Every sidebar tab, not just the active one.** The sidebar button popped out whichever tab was
  active, which meant chat and nothing else, because the only way to change tabs is the docked strip
  that is 27px wide on a phone. It now opens a picker listing all thirteen tabs, built from our own DOM
  at 44px a row, and drops gmOnly tabs for players so nobody is offered a Scenes tab that would refuse
  to open.

  Measured on real Android at 412x783: the picker renders fully on screen, the Actors row is reachable
  by hit test, and picking it renders the Actors popout on screen.

- [#53](https://github.com/LewisIsWorking/Tongs-Browser/pull/53) [`af90c44`](https://github.com/LewisIsWorking/Tongs-Browser/commit/af90c44c692f66ea0eaaa967d82a5caa1800a7bd) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the sidebar button actually produce a sidebar, and add a pause button.

  The sidebar button expanded Foundry's docked sidebar, which is the obvious thing and was not good
  enough. Measured on real Android hardware at 412x783: the docked sidebar is **27 pixels wide**. It
  was there the whole time, and it is unusable with a thumb, which is why it read as missing. Toggling
  `expanded` flipped a real flag and changed nothing anyone could see.

  The button now pops the active sidebar tab out as an ordinary application window. Measured on the
  same device, the popout lands at 94,108 and is 225x566, fully on screen, and a second tap closes it.
  A window is kept inside the viewport by WindowClampBinder, so it is visible by construction rather
  than by luck. It falls back to the docked toggle on any build without the popout API.

  Adds a pause button. It looks for a macro named "Tongs Pause" first, so a GM can write one and grant
  players ownership, then falls back to Foundry's own toggle, broadcasting for a GM and locally
  otherwise.

  ⚠️ Worth knowing before relying on it: a macro **cannot** let a player pause the world, whatever its
  ownership. `Game#togglePause` only emits the socket message `if (options.broadcast && game.user.isGM)`,
  so the check is on the emit path rather than on macro permissions. A player running any macro toggles
  their own client alone. Letting players pause for everyone needs a GM side relay, which is separate
  work.

- [#53](https://github.com/LewisIsWorking/Tongs-Browser/pull/53) [`af90c44`](https://github.com/LewisIsWorking/Tongs-Browser/commit/af90c44c692f66ea0eaaa967d82a5caa1800a7bd) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

  Asked for after testing on a real device, where the sidebar could not be opened at all. Foundry auto
  collapses it below roughly 1024px into a narrow strip of icons hard against the right edge, and the
  expander is a few pixels wide, which is not a realistic touch target. The sidebar is the only route
  to chat, actors, journals and settings, so losing it costs most of the interface.

  The button sits on the bar and uses Foundry's own `ui.sidebar.toggleExpanded()`, so the caret,
  tooltip, accessible name and the `collapseSidebar` hook all stay correct rather than being faked by
  writing a CSS class. It is 44px, the touch target minimum, and it deliberately lives outside the
  collapsible keys area so it survives the bar being collapsed: "show me the sidebar" is most needed
  exactly when the bar has been shrunk out of the way.

  Tray actions are supplied by the caller rather than built into the bar, so the bar stays a bar of
  keys and knows nothing about Foundry's interface.

### Patch Changes

- [#53](https://github.com/LewisIsWorking/Tongs-Browser/pull/53) [`af90c44`](https://github.com/LewisIsWorking/Tongs-Browser/commit/af90c44c692f66ea0eaaa967d82a5caa1800a7bd) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

- [#53](https://github.com/LewisIsWorking/Tongs-Browser/pull/53) [`af90c44`](https://github.com/LewisIsWorking/Tongs-Browser/commit/af90c44c692f66ea0eaaa967d82a5caa1800a7bd) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Put coordinates in the event trace, and print PIXI's pointer beside Foundry's drag origin.

  A device measured Foundry's drag gate as exactly `0.0px` across eleven delivered moves. Not NaN,
  zero: from PIXI's point of view the pointer never moved, while our own cursor visibly did and
  `canvas.mousePosition` reported somewhere else entirely.

  Two possibilities remain and nothing recorded so far separates them. Either every event dispatched
  carries the same `clientX` and `clientY`, which is this module's bug, or they change and PIXI is not
  mapping them, which is not. The trace recorded type, buttons and target, which is everything except
  the field that now decides it, so it carries coordinates. The report also prints PIXI's pointer,
  Foundry's recorded origin, the canvas bounding rect PIXI maps through, and the renderer resolution,
  side by side.

- [#53](https://github.com/LewisIsWorking/Tongs-Browser/pull/53) [`af90c44`](https://github.com/LewisIsWorking/Tongs-Browser/commit/af90c44c692f66ea0eaaa967d82a5caa1800a7bd) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Measure the exact distance Foundry gates a drag on, and lead the report with it.

  A device now reports the layer genuinely receiving moves and the state still stuck:

      PEAK state: GRABBED (3), previews 0
      PIXI moves: layer=13 stage=70

  So Foundry's handler is running thirteen times and declining to start the drag. Its gate is one
  comparison in `#handlePointerMove`:

      Math.hypot(event.global.x - screenOrigin.x, event.global.y - screenOrigin.y) >= dragResistance

  with a default resistance of 10. The report now computes that same distance from Foundry's own
  `interactionData.screenOrigin` and PIXI's own pointer, and reports the peak across the gesture. Either
  it never reaches 10, or it is NaN, and `NaN >= 10` is false, which fails silently and forever.

  The decisive numbers now lead the report rather than trailing it. A phone chat window shows about
  fifteen lines, and the previous report was cut off exactly at the field the whole round existed to
  read, which costs a full round trip. Ordering a diagnostic by narrative rather than by how much each
  line discriminates is a bug in the diagnostic.

- [#53](https://github.com/LewisIsWorking/Tongs-Browser/pull/53) [`af90c44`](https://github.com/LewisIsWorking/Tongs-Browser/commit/af90c44c692f66ea0eaaa967d82a5caa1800a7bd) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix dragging failing whenever the pointer crosses any other element.

  Reported from a device and finally named by the diagnostics report: `pointermove buttons=1 -> div#`,
  where it needed to reach `canvas#board`. Every drag event was hit tested afresh, so the instant the
  pointer crossed anything at all, a chat window, the modifier bar, a character sheet, the drag was
  delivered **there** and the canvas simply stopped hearing about it. The token stopped following and
  nothing reported an error.

  A browser does not work that way: `pointerdown` implicitly **captures** the pointer to the element
  that received it, and every later move and the release go to that same element however far the
  pointer travels. The pointer now does the same.

  ⚠️ It never appeared on desktop because a drag across empty canvas never crosses anything, and the
  existing test asserted the wrong behaviour outright, being named "resolves the target afresh on each
  drag step rather than caching it". The reasoning behind that was sound and is preserved: Foundry
  re-renders applications mid interaction, so a captured element can be detached and dispatching at a
  detached element throws the event away silently. The mistake was treating "it might be detached" as a
  reason to re-resolve always rather than only when it actually is.

- [#53](https://github.com/LewisIsWorking/Tongs-Browser/pull/53) [`af90c44`](https://github.com/LewisIsWorking/Tongs-Browser/commit/af90c44c692f66ea0eaaa967d82a5caa1800a7bd) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Scope the diagnostic record to the drag, and count raw touch input.

  A pasted report came back showing a clean `pointerdown`, `mousedown`, `pointerup`, `mouseup`, `click`
  at one unchanging coordinate with zero PIXI moves. That describes a tap, not the drag it was asked
  about, because the record reset on every `pointerdown` and a single tap after the drop wiped the
  whole drag out of the buffer. The counters reset with it, which turned a previously measured 0.0px
  gate distance into a meaningless NaN.

  The window now opens when a drag begins and stays open until the next one begins, so nothing after
  the drop can overwrite what is being diagnosed.

  The report also counts raw touch input reaching the gesture layer. A trace with no `pointermove` has
  two completely different causes, the finger producing no gesture input at all or the gesture layer
  declining to move the pointer, and nothing else in the report separates them.

- [#53](https://github.com/LewisIsWorking/Tongs-Browser/pull/53) [`af90c44`](https://github.com/LewisIsWorking/Tongs-Browser/commit/af90c44c692f66ea0eaaa967d82a5caa1800a7bd) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Report Foundry's own interaction state in diagnostics, and trace a whole gesture.

  The pointer capture fix landed and the events now demonstrably reach `canvas#board` with
  `buttons=1`, and a token on a real device still does not move. Correct events arriving at the right
  element and nothing happening is a different problem from the one just fixed, and nothing visible
  distinguishes its two possible causes.

  So the report now carries Foundry's own `MouseInteractionManager` state for the selected token, which
  runs NONE, HOVER, CLICKED, GRABBED, DRAG, DROP with a 10px drag resistance, plus whether a drag
  preview object exists. If the state never leaves CLICKED or GRABBED, the moves are not reaching the
  manager. If it reaches DRAG and a preview exists, the drag is running and the drop is what fails.

  The event trace now covers a whole gesture rather than a fixed last eighteen. A drag emits a move per
  step, so the `pointerdown` that began it had already scrolled out of the window by the time the
  report was read, and whether the press and the release reached the same element is exactly the
  question being asked. Runs of identical moves are collapsed rather than filling the report.

- [#53](https://github.com/LewisIsWorking/Tongs-Browser/pull/53) [`af90c44`](https://github.com/LewisIsWorking/Tongs-Browser/commit/af90c44c692f66ea0eaaa967d82a5caa1800a7bd) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Record the peak interaction state during a gesture rather than reading it afterwards.

  The first report carrying Foundry's interaction state said `NONE (0)` with zero drag previews, which
  looks conclusive and is not: it was read when the report was written, which is after the gesture
  ended, and Foundry resets the manager to NONE once an interaction finishes. A post hoc NONE says the
  same thing whether the drag never started or ran perfectly and committed.

  The state and the drag preview count are now sampled on every dispatched event and the peak since the
  last `pointerdown` is reported. That survives the gesture ending, which is the only reason it can
  answer the question: a peak below GRABBED means the moves never reached Foundry's manager, while a
  peak of DRAG with previews means the drag ran and the drop is what failed.

  Same class of mistake as asserting a sign where a magnitude was meant. A measurement has to outlive
  the thing it measures.

- [#53](https://github.com/LewisIsWorking/Tongs-Browser/pull/53) [`af90c44`](https://github.com/LewisIsWorking/Tongs-Browser/commit/af90c44c692f66ea0eaaa967d82a5caa1800a7bd) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Count the pointermove events PIXI delivers to the token layer.

  A device peaked at `GRABBED (3)` during a drag and never reached `DRAG (4)`. That is informative
  rather than merely negative: reaching GRABBED proves `pointerdown` DID arrive at the token through
  PIXI, so PIXI delivery works for the press.

  Foundry's `MouseInteractionManager` binds the drag's move handler on the LAYER, not on the object and
  not on the DOM: `this.layer.on("pointermove", ...)`. GRABBED advances to DRAG only when moves reach
  that layer. So the report now counts how many `pointermove` events PIXI delivered to `canvas.tokens`
  and to the stage during the gesture.

  Zero at the layer means PIXI is not routing the moves there at all. A non zero count means the layer
  is receiving them and declining to act. Those need completely different fixes and nothing else
  visible tells them apart.

- [#53](https://github.com/LewisIsWorking/Tongs-Browser/pull/53) [`af90c44`](https://github.com/LewisIsWorking/Tongs-Browser/commit/af90c44c692f66ea0eaaa967d82a5caa1800a7bd) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Stop the browser's tap highlight masquerading as a button state.

  Reported from a device: the pause button appeared lit while the game was **not** paused. The orange
  was Vivaldi's own tap highlight sitting on the last button touched, and it looked exactly like the
  latched state the grab button shows when it really is on.

  A control that reports a state it does not have is worse than one that reports nothing, because it
  invites the tap that undoes what you wanted. The native highlight is now suppressed on every button
  in the bar and the tab picker, and focus gets a blue outline that cannot be mistaken for the gold
  latched styling, which changes border weight as well as colour.

## 0.17.0

### Minor Changes

- [#51](https://github.com/LewisIsWorking/Tongs-Browser/pull/51) [`c6ac5d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c6ac5d1ffa4bf3621d443b99ff7d089767cf5b9a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Copy the diagnostics report to the clipboard, not just to chat.

  Asked for while debugging from a phone, and it removes the slowest and least reliable step in the
  loop. A chat window on a phone shows about fifteen lines and silently hides the rest, and a report
  has already been cut off exactly at the field the round existed to read, costing a full round trip.
  Reading numbers off a screenshot is also how a two token coincidence was briefly mistaken for a fix.

  ⚠️ `navigator.clipboard` is gated to secure contexts, and a self hosted Foundry on a LAN address is
  plain http, so on a phone it is simply undefined. That is exactly the setup this exists for, which
  makes the `execCommand` fallback the path that matters and the modern API the optimisation. A copy
  button that silently did nothing on the target device would be worse than no button.

  The report still goes to chat as a record, and says whether the copy succeeded rather than leaving it
  to be discovered by pasting nothing.

- [#51](https://github.com/LewisIsWorking/Tongs-Browser/pull/51) [`c6ac5d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c6ac5d1ffa4bf3621d443b99ff7d089767cf5b9a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a diagnostics button that whispers a report into chat.

  A drag failure reported from a real phone could not be reproduced on any surface available for
  testing. It works on desktop through the full gesture layer with real injected touch, and the
  emulator's Chromium 133 cannot hit test canvas objects from synthetic events at all, so it can
  neither confirm nor deny anything. Three plausible hypotheses were each disproven by measurement:
  the active tool being hijacked by this module's own scene control (measured `select` before and
  after), pause blocking the drag (only applies when not a GM), and moves not carrying the held button
  (fixed, and desktop drags 800 to 1300).

  That is the point at which guessing should stop and the device should be asked directly. The button
  reports the active tool, the controlled token and its `_canDrag`, the pointer position and drag
  state, the element under the pointer, `canvas.mousePosition` and whether it sits inside the selected
  token, the canvas and keyboard state, and the user agent.

  Chat rather than the console, deliberately: it is the one output surface a phone user already has
  open and can screenshot, where reaching devtools on Android needs a cable and a laptop. Whispered to
  self so it never lands in front of players.

- [#51](https://github.com/LewisIsWorking/Tongs-Browser/pull/51) [`c6ac5d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c6ac5d1ffa4bf3621d443b99ff7d089767cf5b9a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Report the build version and the actual event stream in diagnostics.

  A drag failure on a real device produced a report where **every static check was healthy**: `select`
  tool, `_canDrag: true`, pointer genuinely inside the selected token, canvas ready. At that point the
  setup is not the problem and the only thing left to look at is the event stream itself, which on a
  phone has no console to look at it in. The report now carries the last eighteen dispatched events
  with their `buttons` value, which is the field that decides whether a drag is a drag: it must stay
  non zero on every move between the down and the up, or Foundry reads the stream as a hover.

  ⚠️ The same report also claimed version 0.2.3 while running code from 0.9.0, and that is worth
  fixing rather than explaining away. `game.modules.get(id).version` comes from a manifest Foundry
  reads **once at server start** and caches, so replacing module files under a running server leaves it
  frozen at whatever booted. The version is now stamped into the bundle at build time and both are
  shown, so a mismatch is visible rather than misleading.

- [#51](https://github.com/LewisIsWorking/Tongs-Browser/pull/51) [`c6ac5d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c6ac5d1ffa4bf3621d443b99ff7d089767cf5b9a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a grab button so tokens can actually be dragged, and make tray buttons show their state.

  **Dragging a token was near impossible on a phone, and it was the gesture design rather than a bug.**
  A drag required tap, lift, press again inside the double tap window, hold past the long press timer
  without moving more than the tap slop, and only then move. Five things in a row, each a chance to get
  it wrong while looking at the map rather than at your thumb. It passed every test, because it does
  work; working and usable are different claims.

  The new ✋ button holds the button down at the pointer until tapped again, so dragging becomes grab,
  move the pointer normally, drop. It is also how a popped out window gets dragged, which was the other
  half of the same complaint.

  ⭐ Making that work needed a real fix, not just a button. The buttons bitmask has to stay set on every
  move of a drag or Foundry reads the stream as a hover, and only `dragBy` set it. A drag begun by the
  new button and then continued by ordinary pointer movement silently degraded into a hover: measured
  on a device, the button was held, the pointer glided over the token, and the token did not move.
  `applyMove` now routes on the drag STATE rather than on which method was called, so the two agree.
  Verified end to end: token x 800 to 1200.

  **Tray buttons now show their state.** Pause and grab are toggles whose "on" was invisible, which
  invites a second tap that undoes the first. Both now carry the same latched styling the modifier keys
  use, distinguished by border weight and colour rather than colour alone, plus `aria-pressed`. Pause
  also refreshes from Foundry's `pauseGame` hook, so it stays honest when a GM pauses from a laptop or
  another player's request arrives through the relay.

  The pan arrows are grouped into a cluster, since the bar had grown to four wrapped rows on a phone.

- [#51](https://github.com/LewisIsWorking/Tongs-Browser/pull/51) [`c6ac5d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c6ac5d1ffa4bf3621d443b99ff7d089767cf5b9a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#51](https://github.com/LewisIsWorking/Tongs-Browser/pull/51) [`c6ac5d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c6ac5d1ffa4bf3621d443b99ff7d089767cf5b9a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Let players pause the game, and reach every sidebar tab rather than just chat.

  **Players can pause.** Foundry's `Game#togglePause` only broadcasts
  `if (options.broadcast && game.user.isGM)`, so the permission check sits on the emit path and a
  player calling it toggles their own client alone. Macro ownership does not help either: `Macro#execute`
  runs the script client side as whoever pressed it, and core Foundry has **no** execute-as-GM at all,
  verified against the installed 14.365 where `executeAsGM`, `execute-as` and `asGM` appear nowhere in
  client or common. That feature comes from modules such as Advanced Macros.

  So a player now emits a request and one GM performs the toggle. The GM is chosen with Foundry's own
  `game.users.activeGM`, which picks the same single user on every client: without that, every
  connected GM would answer the same request and the pause state would flip once per GM. The request
  carries the desired state rather than the word "toggle", so two players tapping at once agree on an
  outcome instead of cancelling each other.

  **Every sidebar tab, not just the active one.** The sidebar button popped out whichever tab was
  active, which meant chat and nothing else, because the only way to change tabs is the docked strip
  that is 27px wide on a phone. It now opens a picker listing all thirteen tabs, built from our own DOM
  at 44px a row, and drops gmOnly tabs for players so nobody is offered a Scenes tab that would refuse
  to open.

  Measured on real Android at 412x783: the picker renders fully on screen, the Actors row is reachable
  by hit test, and picking it renders the Actors popout on screen.

- [#51](https://github.com/LewisIsWorking/Tongs-Browser/pull/51) [`c6ac5d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c6ac5d1ffa4bf3621d443b99ff7d089767cf5b9a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the sidebar button actually produce a sidebar, and add a pause button.

  The sidebar button expanded Foundry's docked sidebar, which is the obvious thing and was not good
  enough. Measured on real Android hardware at 412x783: the docked sidebar is **27 pixels wide**. It
  was there the whole time, and it is unusable with a thumb, which is why it read as missing. Toggling
  `expanded` flipped a real flag and changed nothing anyone could see.

  The button now pops the active sidebar tab out as an ordinary application window. Measured on the
  same device, the popout lands at 94,108 and is 225x566, fully on screen, and a second tap closes it.
  A window is kept inside the viewport by WindowClampBinder, so it is visible by construction rather
  than by luck. It falls back to the docked toggle on any build without the popout API.

  Adds a pause button. It looks for a macro named "Tongs Pause" first, so a GM can write one and grant
  players ownership, then falls back to Foundry's own toggle, broadcasting for a GM and locally
  otherwise.

  ⚠️ Worth knowing before relying on it: a macro **cannot** let a player pause the world, whatever its
  ownership. `Game#togglePause` only emits the socket message `if (options.broadcast && game.user.isGM)`,
  so the check is on the emit path rather than on macro permissions. A player running any macro toggles
  their own client alone. Letting players pause for everyone needs a GM side relay, which is separate
  work.

- [#51](https://github.com/LewisIsWorking/Tongs-Browser/pull/51) [`c6ac5d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c6ac5d1ffa4bf3621d443b99ff7d089767cf5b9a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

  Asked for after testing on a real device, where the sidebar could not be opened at all. Foundry auto
  collapses it below roughly 1024px into a narrow strip of icons hard against the right edge, and the
  expander is a few pixels wide, which is not a realistic touch target. The sidebar is the only route
  to chat, actors, journals and settings, so losing it costs most of the interface.

  The button sits on the bar and uses Foundry's own `ui.sidebar.toggleExpanded()`, so the caret,
  tooltip, accessible name and the `collapseSidebar` hook all stay correct rather than being faked by
  writing a CSS class. It is 44px, the touch target minimum, and it deliberately lives outside the
  collapsible keys area so it survives the bar being collapsed: "show me the sidebar" is most needed
  exactly when the bar has been shrunk out of the way.

  Tray actions are supplied by the caller rather than built into the bar, so the bar stays a bar of
  keys and knows nothing about Foundry's interface.

### Patch Changes

- [#51](https://github.com/LewisIsWorking/Tongs-Browser/pull/51) [`c6ac5d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c6ac5d1ffa4bf3621d443b99ff7d089767cf5b9a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

- [#51](https://github.com/LewisIsWorking/Tongs-Browser/pull/51) [`c6ac5d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c6ac5d1ffa4bf3621d443b99ff7d089767cf5b9a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Put coordinates in the event trace, and print PIXI's pointer beside Foundry's drag origin.

  A device measured Foundry's drag gate as exactly `0.0px` across eleven delivered moves. Not NaN,
  zero: from PIXI's point of view the pointer never moved, while our own cursor visibly did and
  `canvas.mousePosition` reported somewhere else entirely.

  Two possibilities remain and nothing recorded so far separates them. Either every event dispatched
  carries the same `clientX` and `clientY`, which is this module's bug, or they change and PIXI is not
  mapping them, which is not. The trace recorded type, buttons and target, which is everything except
  the field that now decides it, so it carries coordinates. The report also prints PIXI's pointer,
  Foundry's recorded origin, the canvas bounding rect PIXI maps through, and the renderer resolution,
  side by side.

- [#51](https://github.com/LewisIsWorking/Tongs-Browser/pull/51) [`c6ac5d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c6ac5d1ffa4bf3621d443b99ff7d089767cf5b9a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Measure the exact distance Foundry gates a drag on, and lead the report with it.

  A device now reports the layer genuinely receiving moves and the state still stuck:

      PEAK state: GRABBED (3), previews 0
      PIXI moves: layer=13 stage=70

  So Foundry's handler is running thirteen times and declining to start the drag. Its gate is one
  comparison in `#handlePointerMove`:

      Math.hypot(event.global.x - screenOrigin.x, event.global.y - screenOrigin.y) >= dragResistance

  with a default resistance of 10. The report now computes that same distance from Foundry's own
  `interactionData.screenOrigin` and PIXI's own pointer, and reports the peak across the gesture. Either
  it never reaches 10, or it is NaN, and `NaN >= 10` is false, which fails silently and forever.

  The decisive numbers now lead the report rather than trailing it. A phone chat window shows about
  fifteen lines, and the previous report was cut off exactly at the field the whole round existed to
  read, which costs a full round trip. Ordering a diagnostic by narrative rather than by how much each
  line discriminates is a bug in the diagnostic.

- [#51](https://github.com/LewisIsWorking/Tongs-Browser/pull/51) [`c6ac5d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c6ac5d1ffa4bf3621d443b99ff7d089767cf5b9a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix dragging failing whenever the pointer crosses any other element.

  Reported from a device and finally named by the diagnostics report: `pointermove buttons=1 -> div#`,
  where it needed to reach `canvas#board`. Every drag event was hit tested afresh, so the instant the
  pointer crossed anything at all, a chat window, the modifier bar, a character sheet, the drag was
  delivered **there** and the canvas simply stopped hearing about it. The token stopped following and
  nothing reported an error.

  A browser does not work that way: `pointerdown` implicitly **captures** the pointer to the element
  that received it, and every later move and the release go to that same element however far the
  pointer travels. The pointer now does the same.

  ⚠️ It never appeared on desktop because a drag across empty canvas never crosses anything, and the
  existing test asserted the wrong behaviour outright, being named "resolves the target afresh on each
  drag step rather than caching it". The reasoning behind that was sound and is preserved: Foundry
  re-renders applications mid interaction, so a captured element can be detached and dispatching at a
  detached element throws the event away silently. The mistake was treating "it might be detached" as a
  reason to re-resolve always rather than only when it actually is.

- [#51](https://github.com/LewisIsWorking/Tongs-Browser/pull/51) [`c6ac5d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c6ac5d1ffa4bf3621d443b99ff7d089767cf5b9a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Report Foundry's own interaction state in diagnostics, and trace a whole gesture.

  The pointer capture fix landed and the events now demonstrably reach `canvas#board` with
  `buttons=1`, and a token on a real device still does not move. Correct events arriving at the right
  element and nothing happening is a different problem from the one just fixed, and nothing visible
  distinguishes its two possible causes.

  So the report now carries Foundry's own `MouseInteractionManager` state for the selected token, which
  runs NONE, HOVER, CLICKED, GRABBED, DRAG, DROP with a 10px drag resistance, plus whether a drag
  preview object exists. If the state never leaves CLICKED or GRABBED, the moves are not reaching the
  manager. If it reaches DRAG and a preview exists, the drag is running and the drop is what fails.

  The event trace now covers a whole gesture rather than a fixed last eighteen. A drag emits a move per
  step, so the `pointerdown` that began it had already scrolled out of the window by the time the
  report was read, and whether the press and the release reached the same element is exactly the
  question being asked. Runs of identical moves are collapsed rather than filling the report.

- [#51](https://github.com/LewisIsWorking/Tongs-Browser/pull/51) [`c6ac5d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c6ac5d1ffa4bf3621d443b99ff7d089767cf5b9a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Record the peak interaction state during a gesture rather than reading it afterwards.

  The first report carrying Foundry's interaction state said `NONE (0)` with zero drag previews, which
  looks conclusive and is not: it was read when the report was written, which is after the gesture
  ended, and Foundry resets the manager to NONE once an interaction finishes. A post hoc NONE says the
  same thing whether the drag never started or ran perfectly and committed.

  The state and the drag preview count are now sampled on every dispatched event and the peak since the
  last `pointerdown` is reported. That survives the gesture ending, which is the only reason it can
  answer the question: a peak below GRABBED means the moves never reached Foundry's manager, while a
  peak of DRAG with previews means the drag ran and the drop is what failed.

  Same class of mistake as asserting a sign where a magnitude was meant. A measurement has to outlive
  the thing it measures.

- [#51](https://github.com/LewisIsWorking/Tongs-Browser/pull/51) [`c6ac5d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c6ac5d1ffa4bf3621d443b99ff7d089767cf5b9a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Count the pointermove events PIXI delivers to the token layer.

  A device peaked at `GRABBED (3)` during a drag and never reached `DRAG (4)`. That is informative
  rather than merely negative: reaching GRABBED proves `pointerdown` DID arrive at the token through
  PIXI, so PIXI delivery works for the press.

  Foundry's `MouseInteractionManager` binds the drag's move handler on the LAYER, not on the object and
  not on the DOM: `this.layer.on("pointermove", ...)`. GRABBED advances to DRAG only when moves reach
  that layer. So the report now counts how many `pointermove` events PIXI delivered to `canvas.tokens`
  and to the stage during the gesture.

  Zero at the layer means PIXI is not routing the moves there at all. A non zero count means the layer
  is receiving them and declining to act. Those need completely different fixes and nothing else
  visible tells them apart.

- [#51](https://github.com/LewisIsWorking/Tongs-Browser/pull/51) [`c6ac5d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c6ac5d1ffa4bf3621d443b99ff7d089767cf5b9a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Stop the browser's tap highlight masquerading as a button state.

  Reported from a device: the pause button appeared lit while the game was **not** paused. The orange
  was Vivaldi's own tap highlight sitting on the last button touched, and it looked exactly like the
  latched state the grab button shows when it really is on.

  A control that reports a state it does not have is worse than one that reports nothing, because it
  invites the tap that undoes what you wanted. The native highlight is now suppressed on every button
  in the bar and the tab picker, and focus gets a blue outline that cannot be mistaken for the gold
  latched styling, which changes border weight as well as colour.

## 0.16.0

### Minor Changes

- [#49](https://github.com/LewisIsWorking/Tongs-Browser/pull/49) [`ac27158`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ac27158a7bab2aef5631c87376e4e063b9c67840) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a diagnostics button that whispers a report into chat.

  A drag failure reported from a real phone could not be reproduced on any surface available for
  testing. It works on desktop through the full gesture layer with real injected touch, and the
  emulator's Chromium 133 cannot hit test canvas objects from synthetic events at all, so it can
  neither confirm nor deny anything. Three plausible hypotheses were each disproven by measurement:
  the active tool being hijacked by this module's own scene control (measured `select` before and
  after), pause blocking the drag (only applies when not a GM), and moves not carrying the held button
  (fixed, and desktop drags 800 to 1300).

  That is the point at which guessing should stop and the device should be asked directly. The button
  reports the active tool, the controlled token and its `_canDrag`, the pointer position and drag
  state, the element under the pointer, `canvas.mousePosition` and whether it sits inside the selected
  token, the canvas and keyboard state, and the user agent.

  Chat rather than the console, deliberately: it is the one output surface a phone user already has
  open and can screenshot, where reaching devtools on Android needs a cable and a laptop. Whispered to
  self so it never lands in front of players.

- [#49](https://github.com/LewisIsWorking/Tongs-Browser/pull/49) [`ac27158`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ac27158a7bab2aef5631c87376e4e063b9c67840) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Report the build version and the actual event stream in diagnostics.

  A drag failure on a real device produced a report where **every static check was healthy**: `select`
  tool, `_canDrag: true`, pointer genuinely inside the selected token, canvas ready. At that point the
  setup is not the problem and the only thing left to look at is the event stream itself, which on a
  phone has no console to look at it in. The report now carries the last eighteen dispatched events
  with their `buttons` value, which is the field that decides whether a drag is a drag: it must stay
  non zero on every move between the down and the up, or Foundry reads the stream as a hover.

  ⚠️ The same report also claimed version 0.2.3 while running code from 0.9.0, and that is worth
  fixing rather than explaining away. `game.modules.get(id).version` comes from a manifest Foundry
  reads **once at server start** and caches, so replacing module files under a running server leaves it
  frozen at whatever booted. The version is now stamped into the bundle at build time and both are
  shown, so a mismatch is visible rather than misleading.

- [#49](https://github.com/LewisIsWorking/Tongs-Browser/pull/49) [`ac27158`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ac27158a7bab2aef5631c87376e4e063b9c67840) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a grab button so tokens can actually be dragged, and make tray buttons show their state.

  **Dragging a token was near impossible on a phone, and it was the gesture design rather than a bug.**
  A drag required tap, lift, press again inside the double tap window, hold past the long press timer
  without moving more than the tap slop, and only then move. Five things in a row, each a chance to get
  it wrong while looking at the map rather than at your thumb. It passed every test, because it does
  work; working and usable are different claims.

  The new ✋ button holds the button down at the pointer until tapped again, so dragging becomes grab,
  move the pointer normally, drop. It is also how a popped out window gets dragged, which was the other
  half of the same complaint.

  ⭐ Making that work needed a real fix, not just a button. The buttons bitmask has to stay set on every
  move of a drag or Foundry reads the stream as a hover, and only `dragBy` set it. A drag begun by the
  new button and then continued by ordinary pointer movement silently degraded into a hover: measured
  on a device, the button was held, the pointer glided over the token, and the token did not move.
  `applyMove` now routes on the drag STATE rather than on which method was called, so the two agree.
  Verified end to end: token x 800 to 1200.

  **Tray buttons now show their state.** Pause and grab are toggles whose "on" was invisible, which
  invites a second tap that undoes the first. Both now carry the same latched styling the modifier keys
  use, distinguished by border weight and colour rather than colour alone, plus `aria-pressed`. Pause
  also refreshes from Foundry's `pauseGame` hook, so it stays honest when a GM pauses from a laptop or
  another player's request arrives through the relay.

  The pan arrows are grouped into a cluster, since the bar had grown to four wrapped rows on a phone.

- [#49](https://github.com/LewisIsWorking/Tongs-Browser/pull/49) [`ac27158`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ac27158a7bab2aef5631c87376e4e063b9c67840) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#49](https://github.com/LewisIsWorking/Tongs-Browser/pull/49) [`ac27158`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ac27158a7bab2aef5631c87376e4e063b9c67840) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Let players pause the game, and reach every sidebar tab rather than just chat.

  **Players can pause.** Foundry's `Game#togglePause` only broadcasts
  `if (options.broadcast && game.user.isGM)`, so the permission check sits on the emit path and a
  player calling it toggles their own client alone. Macro ownership does not help either: `Macro#execute`
  runs the script client side as whoever pressed it, and core Foundry has **no** execute-as-GM at all,
  verified against the installed 14.365 where `executeAsGM`, `execute-as` and `asGM` appear nowhere in
  client or common. That feature comes from modules such as Advanced Macros.

  So a player now emits a request and one GM performs the toggle. The GM is chosen with Foundry's own
  `game.users.activeGM`, which picks the same single user on every client: without that, every
  connected GM would answer the same request and the pause state would flip once per GM. The request
  carries the desired state rather than the word "toggle", so two players tapping at once agree on an
  outcome instead of cancelling each other.

  **Every sidebar tab, not just the active one.** The sidebar button popped out whichever tab was
  active, which meant chat and nothing else, because the only way to change tabs is the docked strip
  that is 27px wide on a phone. It now opens a picker listing all thirteen tabs, built from our own DOM
  at 44px a row, and drops gmOnly tabs for players so nobody is offered a Scenes tab that would refuse
  to open.

  Measured on real Android at 412x783: the picker renders fully on screen, the Actors row is reachable
  by hit test, and picking it renders the Actors popout on screen.

- [#49](https://github.com/LewisIsWorking/Tongs-Browser/pull/49) [`ac27158`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ac27158a7bab2aef5631c87376e4e063b9c67840) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the sidebar button actually produce a sidebar, and add a pause button.

  The sidebar button expanded Foundry's docked sidebar, which is the obvious thing and was not good
  enough. Measured on real Android hardware at 412x783: the docked sidebar is **27 pixels wide**. It
  was there the whole time, and it is unusable with a thumb, which is why it read as missing. Toggling
  `expanded` flipped a real flag and changed nothing anyone could see.

  The button now pops the active sidebar tab out as an ordinary application window. Measured on the
  same device, the popout lands at 94,108 and is 225x566, fully on screen, and a second tap closes it.
  A window is kept inside the viewport by WindowClampBinder, so it is visible by construction rather
  than by luck. It falls back to the docked toggle on any build without the popout API.

  Adds a pause button. It looks for a macro named "Tongs Pause" first, so a GM can write one and grant
  players ownership, then falls back to Foundry's own toggle, broadcasting for a GM and locally
  otherwise.

  ⚠️ Worth knowing before relying on it: a macro **cannot** let a player pause the world, whatever its
  ownership. `Game#togglePause` only emits the socket message `if (options.broadcast && game.user.isGM)`,
  so the check is on the emit path rather than on macro permissions. A player running any macro toggles
  their own client alone. Letting players pause for everyone needs a GM side relay, which is separate
  work.

- [#49](https://github.com/LewisIsWorking/Tongs-Browser/pull/49) [`ac27158`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ac27158a7bab2aef5631c87376e4e063b9c67840) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

  Asked for after testing on a real device, where the sidebar could not be opened at all. Foundry auto
  collapses it below roughly 1024px into a narrow strip of icons hard against the right edge, and the
  expander is a few pixels wide, which is not a realistic touch target. The sidebar is the only route
  to chat, actors, journals and settings, so losing it costs most of the interface.

  The button sits on the bar and uses Foundry's own `ui.sidebar.toggleExpanded()`, so the caret,
  tooltip, accessible name and the `collapseSidebar` hook all stay correct rather than being faked by
  writing a CSS class. It is 44px, the touch target minimum, and it deliberately lives outside the
  collapsible keys area so it survives the bar being collapsed: "show me the sidebar" is most needed
  exactly when the bar has been shrunk out of the way.

  Tray actions are supplied by the caller rather than built into the bar, so the bar stays a bar of
  keys and knows nothing about Foundry's interface.

### Patch Changes

- [#49](https://github.com/LewisIsWorking/Tongs-Browser/pull/49) [`ac27158`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ac27158a7bab2aef5631c87376e4e063b9c67840) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

- [#49](https://github.com/LewisIsWorking/Tongs-Browser/pull/49) [`ac27158`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ac27158a7bab2aef5631c87376e4e063b9c67840) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Put coordinates in the event trace, and print PIXI's pointer beside Foundry's drag origin.

  A device measured Foundry's drag gate as exactly `0.0px` across eleven delivered moves. Not NaN,
  zero: from PIXI's point of view the pointer never moved, while our own cursor visibly did and
  `canvas.mousePosition` reported somewhere else entirely.

  Two possibilities remain and nothing recorded so far separates them. Either every event dispatched
  carries the same `clientX` and `clientY`, which is this module's bug, or they change and PIXI is not
  mapping them, which is not. The trace recorded type, buttons and target, which is everything except
  the field that now decides it, so it carries coordinates. The report also prints PIXI's pointer,
  Foundry's recorded origin, the canvas bounding rect PIXI maps through, and the renderer resolution,
  side by side.

- [#49](https://github.com/LewisIsWorking/Tongs-Browser/pull/49) [`ac27158`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ac27158a7bab2aef5631c87376e4e063b9c67840) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Measure the exact distance Foundry gates a drag on, and lead the report with it.

  A device now reports the layer genuinely receiving moves and the state still stuck:

      PEAK state: GRABBED (3), previews 0
      PIXI moves: layer=13 stage=70

  So Foundry's handler is running thirteen times and declining to start the drag. Its gate is one
  comparison in `#handlePointerMove`:

      Math.hypot(event.global.x - screenOrigin.x, event.global.y - screenOrigin.y) >= dragResistance

  with a default resistance of 10. The report now computes that same distance from Foundry's own
  `interactionData.screenOrigin` and PIXI's own pointer, and reports the peak across the gesture. Either
  it never reaches 10, or it is NaN, and `NaN >= 10` is false, which fails silently and forever.

  The decisive numbers now lead the report rather than trailing it. A phone chat window shows about
  fifteen lines, and the previous report was cut off exactly at the field the whole round existed to
  read, which costs a full round trip. Ordering a diagnostic by narrative rather than by how much each
  line discriminates is a bug in the diagnostic.

- [#49](https://github.com/LewisIsWorking/Tongs-Browser/pull/49) [`ac27158`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ac27158a7bab2aef5631c87376e4e063b9c67840) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix dragging failing whenever the pointer crosses any other element.

  Reported from a device and finally named by the diagnostics report: `pointermove buttons=1 -> div#`,
  where it needed to reach `canvas#board`. Every drag event was hit tested afresh, so the instant the
  pointer crossed anything at all, a chat window, the modifier bar, a character sheet, the drag was
  delivered **there** and the canvas simply stopped hearing about it. The token stopped following and
  nothing reported an error.

  A browser does not work that way: `pointerdown` implicitly **captures** the pointer to the element
  that received it, and every later move and the release go to that same element however far the
  pointer travels. The pointer now does the same.

  ⚠️ It never appeared on desktop because a drag across empty canvas never crosses anything, and the
  existing test asserted the wrong behaviour outright, being named "resolves the target afresh on each
  drag step rather than caching it". The reasoning behind that was sound and is preserved: Foundry
  re-renders applications mid interaction, so a captured element can be detached and dispatching at a
  detached element throws the event away silently. The mistake was treating "it might be detached" as a
  reason to re-resolve always rather than only when it actually is.

- [#49](https://github.com/LewisIsWorking/Tongs-Browser/pull/49) [`ac27158`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ac27158a7bab2aef5631c87376e4e063b9c67840) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Report Foundry's own interaction state in diagnostics, and trace a whole gesture.

  The pointer capture fix landed and the events now demonstrably reach `canvas#board` with
  `buttons=1`, and a token on a real device still does not move. Correct events arriving at the right
  element and nothing happening is a different problem from the one just fixed, and nothing visible
  distinguishes its two possible causes.

  So the report now carries Foundry's own `MouseInteractionManager` state for the selected token, which
  runs NONE, HOVER, CLICKED, GRABBED, DRAG, DROP with a 10px drag resistance, plus whether a drag
  preview object exists. If the state never leaves CLICKED or GRABBED, the moves are not reaching the
  manager. If it reaches DRAG and a preview exists, the drag is running and the drop is what fails.

  The event trace now covers a whole gesture rather than a fixed last eighteen. A drag emits a move per
  step, so the `pointerdown` that began it had already scrolled out of the window by the time the
  report was read, and whether the press and the release reached the same element is exactly the
  question being asked. Runs of identical moves are collapsed rather than filling the report.

- [#49](https://github.com/LewisIsWorking/Tongs-Browser/pull/49) [`ac27158`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ac27158a7bab2aef5631c87376e4e063b9c67840) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Record the peak interaction state during a gesture rather than reading it afterwards.

  The first report carrying Foundry's interaction state said `NONE (0)` with zero drag previews, which
  looks conclusive and is not: it was read when the report was written, which is after the gesture
  ended, and Foundry resets the manager to NONE once an interaction finishes. A post hoc NONE says the
  same thing whether the drag never started or ran perfectly and committed.

  The state and the drag preview count are now sampled on every dispatched event and the peak since the
  last `pointerdown` is reported. That survives the gesture ending, which is the only reason it can
  answer the question: a peak below GRABBED means the moves never reached Foundry's manager, while a
  peak of DRAG with previews means the drag ran and the drop is what failed.

  Same class of mistake as asserting a sign where a magnitude was meant. A measurement has to outlive
  the thing it measures.

- [#49](https://github.com/LewisIsWorking/Tongs-Browser/pull/49) [`ac27158`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ac27158a7bab2aef5631c87376e4e063b9c67840) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Count the pointermove events PIXI delivers to the token layer.

  A device peaked at `GRABBED (3)` during a drag and never reached `DRAG (4)`. That is informative
  rather than merely negative: reaching GRABBED proves `pointerdown` DID arrive at the token through
  PIXI, so PIXI delivery works for the press.

  Foundry's `MouseInteractionManager` binds the drag's move handler on the LAYER, not on the object and
  not on the DOM: `this.layer.on("pointermove", ...)`. GRABBED advances to DRAG only when moves reach
  that layer. So the report now counts how many `pointermove` events PIXI delivered to `canvas.tokens`
  and to the stage during the gesture.

  Zero at the layer means PIXI is not routing the moves there at all. A non zero count means the layer
  is receiving them and declining to act. Those need completely different fixes and nothing else
  visible tells them apart.

- [#49](https://github.com/LewisIsWorking/Tongs-Browser/pull/49) [`ac27158`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ac27158a7bab2aef5631c87376e4e063b9c67840) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Stop the browser's tap highlight masquerading as a button state.

  Reported from a device: the pause button appeared lit while the game was **not** paused. The orange
  was Vivaldi's own tap highlight sitting on the last button touched, and it looked exactly like the
  latched state the grab button shows when it really is on.

  A control that reports a state it does not have is worse than one that reports nothing, because it
  invites the tap that undoes what you wanted. The native highlight is now suppressed on every button
  in the bar and the tab picker, and focus gets a blue outline that cannot be mistaken for the gold
  latched styling, which changes border weight as well as colour.

## 0.15.0

### Minor Changes

- [#47](https://github.com/LewisIsWorking/Tongs-Browser/pull/47) [`033ff0d`](https://github.com/LewisIsWorking/Tongs-Browser/commit/033ff0d788a75e195156923d2c07f59742b15f1d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a diagnostics button that whispers a report into chat.

  A drag failure reported from a real phone could not be reproduced on any surface available for
  testing. It works on desktop through the full gesture layer with real injected touch, and the
  emulator's Chromium 133 cannot hit test canvas objects from synthetic events at all, so it can
  neither confirm nor deny anything. Three plausible hypotheses were each disproven by measurement:
  the active tool being hijacked by this module's own scene control (measured `select` before and
  after), pause blocking the drag (only applies when not a GM), and moves not carrying the held button
  (fixed, and desktop drags 800 to 1300).

  That is the point at which guessing should stop and the device should be asked directly. The button
  reports the active tool, the controlled token and its `_canDrag`, the pointer position and drag
  state, the element under the pointer, `canvas.mousePosition` and whether it sits inside the selected
  token, the canvas and keyboard state, and the user agent.

  Chat rather than the console, deliberately: it is the one output surface a phone user already has
  open and can screenshot, where reaching devtools on Android needs a cable and a laptop. Whispered to
  self so it never lands in front of players.

- [#47](https://github.com/LewisIsWorking/Tongs-Browser/pull/47) [`033ff0d`](https://github.com/LewisIsWorking/Tongs-Browser/commit/033ff0d788a75e195156923d2c07f59742b15f1d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Report the build version and the actual event stream in diagnostics.

  A drag failure on a real device produced a report where **every static check was healthy**: `select`
  tool, `_canDrag: true`, pointer genuinely inside the selected token, canvas ready. At that point the
  setup is not the problem and the only thing left to look at is the event stream itself, which on a
  phone has no console to look at it in. The report now carries the last eighteen dispatched events
  with their `buttons` value, which is the field that decides whether a drag is a drag: it must stay
  non zero on every move between the down and the up, or Foundry reads the stream as a hover.

  ⚠️ The same report also claimed version 0.2.3 while running code from 0.9.0, and that is worth
  fixing rather than explaining away. `game.modules.get(id).version` comes from a manifest Foundry
  reads **once at server start** and caches, so replacing module files under a running server leaves it
  frozen at whatever booted. The version is now stamped into the bundle at build time and both are
  shown, so a mismatch is visible rather than misleading.

- [#47](https://github.com/LewisIsWorking/Tongs-Browser/pull/47) [`033ff0d`](https://github.com/LewisIsWorking/Tongs-Browser/commit/033ff0d788a75e195156923d2c07f59742b15f1d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a grab button so tokens can actually be dragged, and make tray buttons show their state.

  **Dragging a token was near impossible on a phone, and it was the gesture design rather than a bug.**
  A drag required tap, lift, press again inside the double tap window, hold past the long press timer
  without moving more than the tap slop, and only then move. Five things in a row, each a chance to get
  it wrong while looking at the map rather than at your thumb. It passed every test, because it does
  work; working and usable are different claims.

  The new ✋ button holds the button down at the pointer until tapped again, so dragging becomes grab,
  move the pointer normally, drop. It is also how a popped out window gets dragged, which was the other
  half of the same complaint.

  ⭐ Making that work needed a real fix, not just a button. The buttons bitmask has to stay set on every
  move of a drag or Foundry reads the stream as a hover, and only `dragBy` set it. A drag begun by the
  new button and then continued by ordinary pointer movement silently degraded into a hover: measured
  on a device, the button was held, the pointer glided over the token, and the token did not move.
  `applyMove` now routes on the drag STATE rather than on which method was called, so the two agree.
  Verified end to end: token x 800 to 1200.

  **Tray buttons now show their state.** Pause and grab are toggles whose "on" was invisible, which
  invites a second tap that undoes the first. Both now carry the same latched styling the modifier keys
  use, distinguished by border weight and colour rather than colour alone, plus `aria-pressed`. Pause
  also refreshes from Foundry's `pauseGame` hook, so it stays honest when a GM pauses from a laptop or
  another player's request arrives through the relay.

  The pan arrows are grouped into a cluster, since the bar had grown to four wrapped rows on a phone.

- [#47](https://github.com/LewisIsWorking/Tongs-Browser/pull/47) [`033ff0d`](https://github.com/LewisIsWorking/Tongs-Browser/commit/033ff0d788a75e195156923d2c07f59742b15f1d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#47](https://github.com/LewisIsWorking/Tongs-Browser/pull/47) [`033ff0d`](https://github.com/LewisIsWorking/Tongs-Browser/commit/033ff0d788a75e195156923d2c07f59742b15f1d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Let players pause the game, and reach every sidebar tab rather than just chat.

  **Players can pause.** Foundry's `Game#togglePause` only broadcasts
  `if (options.broadcast && game.user.isGM)`, so the permission check sits on the emit path and a
  player calling it toggles their own client alone. Macro ownership does not help either: `Macro#execute`
  runs the script client side as whoever pressed it, and core Foundry has **no** execute-as-GM at all,
  verified against the installed 14.365 where `executeAsGM`, `execute-as` and `asGM` appear nowhere in
  client or common. That feature comes from modules such as Advanced Macros.

  So a player now emits a request and one GM performs the toggle. The GM is chosen with Foundry's own
  `game.users.activeGM`, which picks the same single user on every client: without that, every
  connected GM would answer the same request and the pause state would flip once per GM. The request
  carries the desired state rather than the word "toggle", so two players tapping at once agree on an
  outcome instead of cancelling each other.

  **Every sidebar tab, not just the active one.** The sidebar button popped out whichever tab was
  active, which meant chat and nothing else, because the only way to change tabs is the docked strip
  that is 27px wide on a phone. It now opens a picker listing all thirteen tabs, built from our own DOM
  at 44px a row, and drops gmOnly tabs for players so nobody is offered a Scenes tab that would refuse
  to open.

  Measured on real Android at 412x783: the picker renders fully on screen, the Actors row is reachable
  by hit test, and picking it renders the Actors popout on screen.

- [#47](https://github.com/LewisIsWorking/Tongs-Browser/pull/47) [`033ff0d`](https://github.com/LewisIsWorking/Tongs-Browser/commit/033ff0d788a75e195156923d2c07f59742b15f1d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the sidebar button actually produce a sidebar, and add a pause button.

  The sidebar button expanded Foundry's docked sidebar, which is the obvious thing and was not good
  enough. Measured on real Android hardware at 412x783: the docked sidebar is **27 pixels wide**. It
  was there the whole time, and it is unusable with a thumb, which is why it read as missing. Toggling
  `expanded` flipped a real flag and changed nothing anyone could see.

  The button now pops the active sidebar tab out as an ordinary application window. Measured on the
  same device, the popout lands at 94,108 and is 225x566, fully on screen, and a second tap closes it.
  A window is kept inside the viewport by WindowClampBinder, so it is visible by construction rather
  than by luck. It falls back to the docked toggle on any build without the popout API.

  Adds a pause button. It looks for a macro named "Tongs Pause" first, so a GM can write one and grant
  players ownership, then falls back to Foundry's own toggle, broadcasting for a GM and locally
  otherwise.

  ⚠️ Worth knowing before relying on it: a macro **cannot** let a player pause the world, whatever its
  ownership. `Game#togglePause` only emits the socket message `if (options.broadcast && game.user.isGM)`,
  so the check is on the emit path rather than on macro permissions. A player running any macro toggles
  their own client alone. Letting players pause for everyone needs a GM side relay, which is separate
  work.

- [#47](https://github.com/LewisIsWorking/Tongs-Browser/pull/47) [`033ff0d`](https://github.com/LewisIsWorking/Tongs-Browser/commit/033ff0d788a75e195156923d2c07f59742b15f1d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

  Asked for after testing on a real device, where the sidebar could not be opened at all. Foundry auto
  collapses it below roughly 1024px into a narrow strip of icons hard against the right edge, and the
  expander is a few pixels wide, which is not a realistic touch target. The sidebar is the only route
  to chat, actors, journals and settings, so losing it costs most of the interface.

  The button sits on the bar and uses Foundry's own `ui.sidebar.toggleExpanded()`, so the caret,
  tooltip, accessible name and the `collapseSidebar` hook all stay correct rather than being faked by
  writing a CSS class. It is 44px, the touch target minimum, and it deliberately lives outside the
  collapsible keys area so it survives the bar being collapsed: "show me the sidebar" is most needed
  exactly when the bar has been shrunk out of the way.

  Tray actions are supplied by the caller rather than built into the bar, so the bar stays a bar of
  keys and knows nothing about Foundry's interface.

### Patch Changes

- [#47](https://github.com/LewisIsWorking/Tongs-Browser/pull/47) [`033ff0d`](https://github.com/LewisIsWorking/Tongs-Browser/commit/033ff0d788a75e195156923d2c07f59742b15f1d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

- [#47](https://github.com/LewisIsWorking/Tongs-Browser/pull/47) [`033ff0d`](https://github.com/LewisIsWorking/Tongs-Browser/commit/033ff0d788a75e195156923d2c07f59742b15f1d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Measure the exact distance Foundry gates a drag on, and lead the report with it.

  A device now reports the layer genuinely receiving moves and the state still stuck:

      PEAK state: GRABBED (3), previews 0
      PIXI moves: layer=13 stage=70

  So Foundry's handler is running thirteen times and declining to start the drag. Its gate is one
  comparison in `#handlePointerMove`:

      Math.hypot(event.global.x - screenOrigin.x, event.global.y - screenOrigin.y) >= dragResistance

  with a default resistance of 10. The report now computes that same distance from Foundry's own
  `interactionData.screenOrigin` and PIXI's own pointer, and reports the peak across the gesture. Either
  it never reaches 10, or it is NaN, and `NaN >= 10` is false, which fails silently and forever.

  The decisive numbers now lead the report rather than trailing it. A phone chat window shows about
  fifteen lines, and the previous report was cut off exactly at the field the whole round existed to
  read, which costs a full round trip. Ordering a diagnostic by narrative rather than by how much each
  line discriminates is a bug in the diagnostic.

- [#47](https://github.com/LewisIsWorking/Tongs-Browser/pull/47) [`033ff0d`](https://github.com/LewisIsWorking/Tongs-Browser/commit/033ff0d788a75e195156923d2c07f59742b15f1d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix dragging failing whenever the pointer crosses any other element.

  Reported from a device and finally named by the diagnostics report: `pointermove buttons=1 -> div#`,
  where it needed to reach `canvas#board`. Every drag event was hit tested afresh, so the instant the
  pointer crossed anything at all, a chat window, the modifier bar, a character sheet, the drag was
  delivered **there** and the canvas simply stopped hearing about it. The token stopped following and
  nothing reported an error.

  A browser does not work that way: `pointerdown` implicitly **captures** the pointer to the element
  that received it, and every later move and the release go to that same element however far the
  pointer travels. The pointer now does the same.

  ⚠️ It never appeared on desktop because a drag across empty canvas never crosses anything, and the
  existing test asserted the wrong behaviour outright, being named "resolves the target afresh on each
  drag step rather than caching it". The reasoning behind that was sound and is preserved: Foundry
  re-renders applications mid interaction, so a captured element can be detached and dispatching at a
  detached element throws the event away silently. The mistake was treating "it might be detached" as a
  reason to re-resolve always rather than only when it actually is.

- [#47](https://github.com/LewisIsWorking/Tongs-Browser/pull/47) [`033ff0d`](https://github.com/LewisIsWorking/Tongs-Browser/commit/033ff0d788a75e195156923d2c07f59742b15f1d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Report Foundry's own interaction state in diagnostics, and trace a whole gesture.

  The pointer capture fix landed and the events now demonstrably reach `canvas#board` with
  `buttons=1`, and a token on a real device still does not move. Correct events arriving at the right
  element and nothing happening is a different problem from the one just fixed, and nothing visible
  distinguishes its two possible causes.

  So the report now carries Foundry's own `MouseInteractionManager` state for the selected token, which
  runs NONE, HOVER, CLICKED, GRABBED, DRAG, DROP with a 10px drag resistance, plus whether a drag
  preview object exists. If the state never leaves CLICKED or GRABBED, the moves are not reaching the
  manager. If it reaches DRAG and a preview exists, the drag is running and the drop is what fails.

  The event trace now covers a whole gesture rather than a fixed last eighteen. A drag emits a move per
  step, so the `pointerdown` that began it had already scrolled out of the window by the time the
  report was read, and whether the press and the release reached the same element is exactly the
  question being asked. Runs of identical moves are collapsed rather than filling the report.

- [#47](https://github.com/LewisIsWorking/Tongs-Browser/pull/47) [`033ff0d`](https://github.com/LewisIsWorking/Tongs-Browser/commit/033ff0d788a75e195156923d2c07f59742b15f1d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Record the peak interaction state during a gesture rather than reading it afterwards.

  The first report carrying Foundry's interaction state said `NONE (0)` with zero drag previews, which
  looks conclusive and is not: it was read when the report was written, which is after the gesture
  ended, and Foundry resets the manager to NONE once an interaction finishes. A post hoc NONE says the
  same thing whether the drag never started or ran perfectly and committed.

  The state and the drag preview count are now sampled on every dispatched event and the peak since the
  last `pointerdown` is reported. That survives the gesture ending, which is the only reason it can
  answer the question: a peak below GRABBED means the moves never reached Foundry's manager, while a
  peak of DRAG with previews means the drag ran and the drop is what failed.

  Same class of mistake as asserting a sign where a magnitude was meant. A measurement has to outlive
  the thing it measures.

- [#47](https://github.com/LewisIsWorking/Tongs-Browser/pull/47) [`033ff0d`](https://github.com/LewisIsWorking/Tongs-Browser/commit/033ff0d788a75e195156923d2c07f59742b15f1d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Count the pointermove events PIXI delivers to the token layer.

  A device peaked at `GRABBED (3)` during a drag and never reached `DRAG (4)`. That is informative
  rather than merely negative: reaching GRABBED proves `pointerdown` DID arrive at the token through
  PIXI, so PIXI delivery works for the press.

  Foundry's `MouseInteractionManager` binds the drag's move handler on the LAYER, not on the object and
  not on the DOM: `this.layer.on("pointermove", ...)`. GRABBED advances to DRAG only when moves reach
  that layer. So the report now counts how many `pointermove` events PIXI delivered to `canvas.tokens`
  and to the stage during the gesture.

  Zero at the layer means PIXI is not routing the moves there at all. A non zero count means the layer
  is receiving them and declining to act. Those need completely different fixes and nothing else
  visible tells them apart.

- [#47](https://github.com/LewisIsWorking/Tongs-Browser/pull/47) [`033ff0d`](https://github.com/LewisIsWorking/Tongs-Browser/commit/033ff0d788a75e195156923d2c07f59742b15f1d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Stop the browser's tap highlight masquerading as a button state.

  Reported from a device: the pause button appeared lit while the game was **not** paused. The orange
  was Vivaldi's own tap highlight sitting on the last button touched, and it looked exactly like the
  latched state the grab button shows when it really is on.

  A control that reports a state it does not have is worse than one that reports nothing, because it
  invites the tap that undoes what you wanted. The native highlight is now suppressed on every button
  in the bar and the tab picker, and focus gets a blue outline that cannot be mistaken for the gold
  latched styling, which changes border weight as well as colour.

## 0.14.0

### Minor Changes

- [#45](https://github.com/LewisIsWorking/Tongs-Browser/pull/45) [`05100ab`](https://github.com/LewisIsWorking/Tongs-Browser/commit/05100ab8bdd9b01a0003488bb24bb3d09f11a6d0) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a diagnostics button that whispers a report into chat.

  A drag failure reported from a real phone could not be reproduced on any surface available for
  testing. It works on desktop through the full gesture layer with real injected touch, and the
  emulator's Chromium 133 cannot hit test canvas objects from synthetic events at all, so it can
  neither confirm nor deny anything. Three plausible hypotheses were each disproven by measurement:
  the active tool being hijacked by this module's own scene control (measured `select` before and
  after), pause blocking the drag (only applies when not a GM), and moves not carrying the held button
  (fixed, and desktop drags 800 to 1300).

  That is the point at which guessing should stop and the device should be asked directly. The button
  reports the active tool, the controlled token and its `_canDrag`, the pointer position and drag
  state, the element under the pointer, `canvas.mousePosition` and whether it sits inside the selected
  token, the canvas and keyboard state, and the user agent.

  Chat rather than the console, deliberately: it is the one output surface a phone user already has
  open and can screenshot, where reaching devtools on Android needs a cable and a laptop. Whispered to
  self so it never lands in front of players.

- [#45](https://github.com/LewisIsWorking/Tongs-Browser/pull/45) [`05100ab`](https://github.com/LewisIsWorking/Tongs-Browser/commit/05100ab8bdd9b01a0003488bb24bb3d09f11a6d0) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Report the build version and the actual event stream in diagnostics.

  A drag failure on a real device produced a report where **every static check was healthy**: `select`
  tool, `_canDrag: true`, pointer genuinely inside the selected token, canvas ready. At that point the
  setup is not the problem and the only thing left to look at is the event stream itself, which on a
  phone has no console to look at it in. The report now carries the last eighteen dispatched events
  with their `buttons` value, which is the field that decides whether a drag is a drag: it must stay
  non zero on every move between the down and the up, or Foundry reads the stream as a hover.

  ⚠️ The same report also claimed version 0.2.3 while running code from 0.9.0, and that is worth
  fixing rather than explaining away. `game.modules.get(id).version` comes from a manifest Foundry
  reads **once at server start** and caches, so replacing module files under a running server leaves it
  frozen at whatever booted. The version is now stamped into the bundle at build time and both are
  shown, so a mismatch is visible rather than misleading.

- [#45](https://github.com/LewisIsWorking/Tongs-Browser/pull/45) [`05100ab`](https://github.com/LewisIsWorking/Tongs-Browser/commit/05100ab8bdd9b01a0003488bb24bb3d09f11a6d0) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a grab button so tokens can actually be dragged, and make tray buttons show their state.

  **Dragging a token was near impossible on a phone, and it was the gesture design rather than a bug.**
  A drag required tap, lift, press again inside the double tap window, hold past the long press timer
  without moving more than the tap slop, and only then move. Five things in a row, each a chance to get
  it wrong while looking at the map rather than at your thumb. It passed every test, because it does
  work; working and usable are different claims.

  The new ✋ button holds the button down at the pointer until tapped again, so dragging becomes grab,
  move the pointer normally, drop. It is also how a popped out window gets dragged, which was the other
  half of the same complaint.

  ⭐ Making that work needed a real fix, not just a button. The buttons bitmask has to stay set on every
  move of a drag or Foundry reads the stream as a hover, and only `dragBy` set it. A drag begun by the
  new button and then continued by ordinary pointer movement silently degraded into a hover: measured
  on a device, the button was held, the pointer glided over the token, and the token did not move.
  `applyMove` now routes on the drag STATE rather than on which method was called, so the two agree.
  Verified end to end: token x 800 to 1200.

  **Tray buttons now show their state.** Pause and grab are toggles whose "on" was invisible, which
  invites a second tap that undoes the first. Both now carry the same latched styling the modifier keys
  use, distinguished by border weight and colour rather than colour alone, plus `aria-pressed`. Pause
  also refreshes from Foundry's `pauseGame` hook, so it stays honest when a GM pauses from a laptop or
  another player's request arrives through the relay.

  The pan arrows are grouped into a cluster, since the bar had grown to four wrapped rows on a phone.

- [#45](https://github.com/LewisIsWorking/Tongs-Browser/pull/45) [`05100ab`](https://github.com/LewisIsWorking/Tongs-Browser/commit/05100ab8bdd9b01a0003488bb24bb3d09f11a6d0) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#45](https://github.com/LewisIsWorking/Tongs-Browser/pull/45) [`05100ab`](https://github.com/LewisIsWorking/Tongs-Browser/commit/05100ab8bdd9b01a0003488bb24bb3d09f11a6d0) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Let players pause the game, and reach every sidebar tab rather than just chat.

  **Players can pause.** Foundry's `Game#togglePause` only broadcasts
  `if (options.broadcast && game.user.isGM)`, so the permission check sits on the emit path and a
  player calling it toggles their own client alone. Macro ownership does not help either: `Macro#execute`
  runs the script client side as whoever pressed it, and core Foundry has **no** execute-as-GM at all,
  verified against the installed 14.365 where `executeAsGM`, `execute-as` and `asGM` appear nowhere in
  client or common. That feature comes from modules such as Advanced Macros.

  So a player now emits a request and one GM performs the toggle. The GM is chosen with Foundry's own
  `game.users.activeGM`, which picks the same single user on every client: without that, every
  connected GM would answer the same request and the pause state would flip once per GM. The request
  carries the desired state rather than the word "toggle", so two players tapping at once agree on an
  outcome instead of cancelling each other.

  **Every sidebar tab, not just the active one.** The sidebar button popped out whichever tab was
  active, which meant chat and nothing else, because the only way to change tabs is the docked strip
  that is 27px wide on a phone. It now opens a picker listing all thirteen tabs, built from our own DOM
  at 44px a row, and drops gmOnly tabs for players so nobody is offered a Scenes tab that would refuse
  to open.

  Measured on real Android at 412x783: the picker renders fully on screen, the Actors row is reachable
  by hit test, and picking it renders the Actors popout on screen.

- [#45](https://github.com/LewisIsWorking/Tongs-Browser/pull/45) [`05100ab`](https://github.com/LewisIsWorking/Tongs-Browser/commit/05100ab8bdd9b01a0003488bb24bb3d09f11a6d0) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the sidebar button actually produce a sidebar, and add a pause button.

  The sidebar button expanded Foundry's docked sidebar, which is the obvious thing and was not good
  enough. Measured on real Android hardware at 412x783: the docked sidebar is **27 pixels wide**. It
  was there the whole time, and it is unusable with a thumb, which is why it read as missing. Toggling
  `expanded` flipped a real flag and changed nothing anyone could see.

  The button now pops the active sidebar tab out as an ordinary application window. Measured on the
  same device, the popout lands at 94,108 and is 225x566, fully on screen, and a second tap closes it.
  A window is kept inside the viewport by WindowClampBinder, so it is visible by construction rather
  than by luck. It falls back to the docked toggle on any build without the popout API.

  Adds a pause button. It looks for a macro named "Tongs Pause" first, so a GM can write one and grant
  players ownership, then falls back to Foundry's own toggle, broadcasting for a GM and locally
  otherwise.

  ⚠️ Worth knowing before relying on it: a macro **cannot** let a player pause the world, whatever its
  ownership. `Game#togglePause` only emits the socket message `if (options.broadcast && game.user.isGM)`,
  so the check is on the emit path rather than on macro permissions. A player running any macro toggles
  their own client alone. Letting players pause for everyone needs a GM side relay, which is separate
  work.

- [#45](https://github.com/LewisIsWorking/Tongs-Browser/pull/45) [`05100ab`](https://github.com/LewisIsWorking/Tongs-Browser/commit/05100ab8bdd9b01a0003488bb24bb3d09f11a6d0) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

  Asked for after testing on a real device, where the sidebar could not be opened at all. Foundry auto
  collapses it below roughly 1024px into a narrow strip of icons hard against the right edge, and the
  expander is a few pixels wide, which is not a realistic touch target. The sidebar is the only route
  to chat, actors, journals and settings, so losing it costs most of the interface.

  The button sits on the bar and uses Foundry's own `ui.sidebar.toggleExpanded()`, so the caret,
  tooltip, accessible name and the `collapseSidebar` hook all stay correct rather than being faked by
  writing a CSS class. It is 44px, the touch target minimum, and it deliberately lives outside the
  collapsible keys area so it survives the bar being collapsed: "show me the sidebar" is most needed
  exactly when the bar has been shrunk out of the way.

  Tray actions are supplied by the caller rather than built into the bar, so the bar stays a bar of
  keys and knows nothing about Foundry's interface.

### Patch Changes

- [#45](https://github.com/LewisIsWorking/Tongs-Browser/pull/45) [`05100ab`](https://github.com/LewisIsWorking/Tongs-Browser/commit/05100ab8bdd9b01a0003488bb24bb3d09f11a6d0) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

- [#45](https://github.com/LewisIsWorking/Tongs-Browser/pull/45) [`05100ab`](https://github.com/LewisIsWorking/Tongs-Browser/commit/05100ab8bdd9b01a0003488bb24bb3d09f11a6d0) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix dragging failing whenever the pointer crosses any other element.

  Reported from a device and finally named by the diagnostics report: `pointermove buttons=1 -> div#`,
  where it needed to reach `canvas#board`. Every drag event was hit tested afresh, so the instant the
  pointer crossed anything at all, a chat window, the modifier bar, a character sheet, the drag was
  delivered **there** and the canvas simply stopped hearing about it. The token stopped following and
  nothing reported an error.

  A browser does not work that way: `pointerdown` implicitly **captures** the pointer to the element
  that received it, and every later move and the release go to that same element however far the
  pointer travels. The pointer now does the same.

  ⚠️ It never appeared on desktop because a drag across empty canvas never crosses anything, and the
  existing test asserted the wrong behaviour outright, being named "resolves the target afresh on each
  drag step rather than caching it". The reasoning behind that was sound and is preserved: Foundry
  re-renders applications mid interaction, so a captured element can be detached and dispatching at a
  detached element throws the event away silently. The mistake was treating "it might be detached" as a
  reason to re-resolve always rather than only when it actually is.

- [#45](https://github.com/LewisIsWorking/Tongs-Browser/pull/45) [`05100ab`](https://github.com/LewisIsWorking/Tongs-Browser/commit/05100ab8bdd9b01a0003488bb24bb3d09f11a6d0) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Report Foundry's own interaction state in diagnostics, and trace a whole gesture.

  The pointer capture fix landed and the events now demonstrably reach `canvas#board` with
  `buttons=1`, and a token on a real device still does not move. Correct events arriving at the right
  element and nothing happening is a different problem from the one just fixed, and nothing visible
  distinguishes its two possible causes.

  So the report now carries Foundry's own `MouseInteractionManager` state for the selected token, which
  runs NONE, HOVER, CLICKED, GRABBED, DRAG, DROP with a 10px drag resistance, plus whether a drag
  preview object exists. If the state never leaves CLICKED or GRABBED, the moves are not reaching the
  manager. If it reaches DRAG and a preview exists, the drag is running and the drop is what fails.

  The event trace now covers a whole gesture rather than a fixed last eighteen. A drag emits a move per
  step, so the `pointerdown` that began it had already scrolled out of the window by the time the
  report was read, and whether the press and the release reached the same element is exactly the
  question being asked. Runs of identical moves are collapsed rather than filling the report.

- [#45](https://github.com/LewisIsWorking/Tongs-Browser/pull/45) [`05100ab`](https://github.com/LewisIsWorking/Tongs-Browser/commit/05100ab8bdd9b01a0003488bb24bb3d09f11a6d0) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Record the peak interaction state during a gesture rather than reading it afterwards.

  The first report carrying Foundry's interaction state said `NONE (0)` with zero drag previews, which
  looks conclusive and is not: it was read when the report was written, which is after the gesture
  ended, and Foundry resets the manager to NONE once an interaction finishes. A post hoc NONE says the
  same thing whether the drag never started or ran perfectly and committed.

  The state and the drag preview count are now sampled on every dispatched event and the peak since the
  last `pointerdown` is reported. That survives the gesture ending, which is the only reason it can
  answer the question: a peak below GRABBED means the moves never reached Foundry's manager, while a
  peak of DRAG with previews means the drag ran and the drop is what failed.

  Same class of mistake as asserting a sign where a magnitude was meant. A measurement has to outlive
  the thing it measures.

- [#45](https://github.com/LewisIsWorking/Tongs-Browser/pull/45) [`05100ab`](https://github.com/LewisIsWorking/Tongs-Browser/commit/05100ab8bdd9b01a0003488bb24bb3d09f11a6d0) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Count the pointermove events PIXI delivers to the token layer.

  A device peaked at `GRABBED (3)` during a drag and never reached `DRAG (4)`. That is informative
  rather than merely negative: reaching GRABBED proves `pointerdown` DID arrive at the token through
  PIXI, so PIXI delivery works for the press.

  Foundry's `MouseInteractionManager` binds the drag's move handler on the LAYER, not on the object and
  not on the DOM: `this.layer.on("pointermove", ...)`. GRABBED advances to DRAG only when moves reach
  that layer. So the report now counts how many `pointermove` events PIXI delivered to `canvas.tokens`
  and to the stage during the gesture.

  Zero at the layer means PIXI is not routing the moves there at all. A non zero count means the layer
  is receiving them and declining to act. Those need completely different fixes and nothing else
  visible tells them apart.

- [#45](https://github.com/LewisIsWorking/Tongs-Browser/pull/45) [`05100ab`](https://github.com/LewisIsWorking/Tongs-Browser/commit/05100ab8bdd9b01a0003488bb24bb3d09f11a6d0) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Stop the browser's tap highlight masquerading as a button state.

  Reported from a device: the pause button appeared lit while the game was **not** paused. The orange
  was Vivaldi's own tap highlight sitting on the last button touched, and it looked exactly like the
  latched state the grab button shows when it really is on.

  A control that reports a state it does not have is worse than one that reports nothing, because it
  invites the tap that undoes what you wanted. The native highlight is now suppressed on every button
  in the bar and the tab picker, and focus gets a blue outline that cannot be mistaken for the gold
  latched styling, which changes border weight as well as colour.

## 0.13.0

### Minor Changes

- [#43](https://github.com/LewisIsWorking/Tongs-Browser/pull/43) [`c156f03`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c156f03f9b7d3f0f2ba0c38d5380dc8aba13ad2d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a diagnostics button that whispers a report into chat.

  A drag failure reported from a real phone could not be reproduced on any surface available for
  testing. It works on desktop through the full gesture layer with real injected touch, and the
  emulator's Chromium 133 cannot hit test canvas objects from synthetic events at all, so it can
  neither confirm nor deny anything. Three plausible hypotheses were each disproven by measurement:
  the active tool being hijacked by this module's own scene control (measured `select` before and
  after), pause blocking the drag (only applies when not a GM), and moves not carrying the held button
  (fixed, and desktop drags 800 to 1300).

  That is the point at which guessing should stop and the device should be asked directly. The button
  reports the active tool, the controlled token and its `_canDrag`, the pointer position and drag
  state, the element under the pointer, `canvas.mousePosition` and whether it sits inside the selected
  token, the canvas and keyboard state, and the user agent.

  Chat rather than the console, deliberately: it is the one output surface a phone user already has
  open and can screenshot, where reaching devtools on Android needs a cable and a laptop. Whispered to
  self so it never lands in front of players.

- [#43](https://github.com/LewisIsWorking/Tongs-Browser/pull/43) [`c156f03`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c156f03f9b7d3f0f2ba0c38d5380dc8aba13ad2d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Report the build version and the actual event stream in diagnostics.

  A drag failure on a real device produced a report where **every static check was healthy**: `select`
  tool, `_canDrag: true`, pointer genuinely inside the selected token, canvas ready. At that point the
  setup is not the problem and the only thing left to look at is the event stream itself, which on a
  phone has no console to look at it in. The report now carries the last eighteen dispatched events
  with their `buttons` value, which is the field that decides whether a drag is a drag: it must stay
  non zero on every move between the down and the up, or Foundry reads the stream as a hover.

  ⚠️ The same report also claimed version 0.2.3 while running code from 0.9.0, and that is worth
  fixing rather than explaining away. `game.modules.get(id).version` comes from a manifest Foundry
  reads **once at server start** and caches, so replacing module files under a running server leaves it
  frozen at whatever booted. The version is now stamped into the bundle at build time and both are
  shown, so a mismatch is visible rather than misleading.

- [#43](https://github.com/LewisIsWorking/Tongs-Browser/pull/43) [`c156f03`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c156f03f9b7d3f0f2ba0c38d5380dc8aba13ad2d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a grab button so tokens can actually be dragged, and make tray buttons show their state.

  **Dragging a token was near impossible on a phone, and it was the gesture design rather than a bug.**
  A drag required tap, lift, press again inside the double tap window, hold past the long press timer
  without moving more than the tap slop, and only then move. Five things in a row, each a chance to get
  it wrong while looking at the map rather than at your thumb. It passed every test, because it does
  work; working and usable are different claims.

  The new ✋ button holds the button down at the pointer until tapped again, so dragging becomes grab,
  move the pointer normally, drop. It is also how a popped out window gets dragged, which was the other
  half of the same complaint.

  ⭐ Making that work needed a real fix, not just a button. The buttons bitmask has to stay set on every
  move of a drag or Foundry reads the stream as a hover, and only `dragBy` set it. A drag begun by the
  new button and then continued by ordinary pointer movement silently degraded into a hover: measured
  on a device, the button was held, the pointer glided over the token, and the token did not move.
  `applyMove` now routes on the drag STATE rather than on which method was called, so the two agree.
  Verified end to end: token x 800 to 1200.

  **Tray buttons now show their state.** Pause and grab are toggles whose "on" was invisible, which
  invites a second tap that undoes the first. Both now carry the same latched styling the modifier keys
  use, distinguished by border weight and colour rather than colour alone, plus `aria-pressed`. Pause
  also refreshes from Foundry's `pauseGame` hook, so it stays honest when a GM pauses from a laptop or
  another player's request arrives through the relay.

  The pan arrows are grouped into a cluster, since the bar had grown to four wrapped rows on a phone.

- [#43](https://github.com/LewisIsWorking/Tongs-Browser/pull/43) [`c156f03`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c156f03f9b7d3f0f2ba0c38d5380dc8aba13ad2d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#43](https://github.com/LewisIsWorking/Tongs-Browser/pull/43) [`c156f03`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c156f03f9b7d3f0f2ba0c38d5380dc8aba13ad2d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Let players pause the game, and reach every sidebar tab rather than just chat.

  **Players can pause.** Foundry's `Game#togglePause` only broadcasts
  `if (options.broadcast && game.user.isGM)`, so the permission check sits on the emit path and a
  player calling it toggles their own client alone. Macro ownership does not help either: `Macro#execute`
  runs the script client side as whoever pressed it, and core Foundry has **no** execute-as-GM at all,
  verified against the installed 14.365 where `executeAsGM`, `execute-as` and `asGM` appear nowhere in
  client or common. That feature comes from modules such as Advanced Macros.

  So a player now emits a request and one GM performs the toggle. The GM is chosen with Foundry's own
  `game.users.activeGM`, which picks the same single user on every client: without that, every
  connected GM would answer the same request and the pause state would flip once per GM. The request
  carries the desired state rather than the word "toggle", so two players tapping at once agree on an
  outcome instead of cancelling each other.

  **Every sidebar tab, not just the active one.** The sidebar button popped out whichever tab was
  active, which meant chat and nothing else, because the only way to change tabs is the docked strip
  that is 27px wide on a phone. It now opens a picker listing all thirteen tabs, built from our own DOM
  at 44px a row, and drops gmOnly tabs for players so nobody is offered a Scenes tab that would refuse
  to open.

  Measured on real Android at 412x783: the picker renders fully on screen, the Actors row is reachable
  by hit test, and picking it renders the Actors popout on screen.

- [#43](https://github.com/LewisIsWorking/Tongs-Browser/pull/43) [`c156f03`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c156f03f9b7d3f0f2ba0c38d5380dc8aba13ad2d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the sidebar button actually produce a sidebar, and add a pause button.

  The sidebar button expanded Foundry's docked sidebar, which is the obvious thing and was not good
  enough. Measured on real Android hardware at 412x783: the docked sidebar is **27 pixels wide**. It
  was there the whole time, and it is unusable with a thumb, which is why it read as missing. Toggling
  `expanded` flipped a real flag and changed nothing anyone could see.

  The button now pops the active sidebar tab out as an ordinary application window. Measured on the
  same device, the popout lands at 94,108 and is 225x566, fully on screen, and a second tap closes it.
  A window is kept inside the viewport by WindowClampBinder, so it is visible by construction rather
  than by luck. It falls back to the docked toggle on any build without the popout API.

  Adds a pause button. It looks for a macro named "Tongs Pause" first, so a GM can write one and grant
  players ownership, then falls back to Foundry's own toggle, broadcasting for a GM and locally
  otherwise.

  ⚠️ Worth knowing before relying on it: a macro **cannot** let a player pause the world, whatever its
  ownership. `Game#togglePause` only emits the socket message `if (options.broadcast && game.user.isGM)`,
  so the check is on the emit path rather than on macro permissions. A player running any macro toggles
  their own client alone. Letting players pause for everyone needs a GM side relay, which is separate
  work.

- [#43](https://github.com/LewisIsWorking/Tongs-Browser/pull/43) [`c156f03`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c156f03f9b7d3f0f2ba0c38d5380dc8aba13ad2d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

  Asked for after testing on a real device, where the sidebar could not be opened at all. Foundry auto
  collapses it below roughly 1024px into a narrow strip of icons hard against the right edge, and the
  expander is a few pixels wide, which is not a realistic touch target. The sidebar is the only route
  to chat, actors, journals and settings, so losing it costs most of the interface.

  The button sits on the bar and uses Foundry's own `ui.sidebar.toggleExpanded()`, so the caret,
  tooltip, accessible name and the `collapseSidebar` hook all stay correct rather than being faked by
  writing a CSS class. It is 44px, the touch target minimum, and it deliberately lives outside the
  collapsible keys area so it survives the bar being collapsed: "show me the sidebar" is most needed
  exactly when the bar has been shrunk out of the way.

  Tray actions are supplied by the caller rather than built into the bar, so the bar stays a bar of
  keys and knows nothing about Foundry's interface.

### Patch Changes

- [#43](https://github.com/LewisIsWorking/Tongs-Browser/pull/43) [`c156f03`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c156f03f9b7d3f0f2ba0c38d5380dc8aba13ad2d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

- [#43](https://github.com/LewisIsWorking/Tongs-Browser/pull/43) [`c156f03`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c156f03f9b7d3f0f2ba0c38d5380dc8aba13ad2d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix dragging failing whenever the pointer crosses any other element.

  Reported from a device and finally named by the diagnostics report: `pointermove buttons=1 -> div#`,
  where it needed to reach `canvas#board`. Every drag event was hit tested afresh, so the instant the
  pointer crossed anything at all, a chat window, the modifier bar, a character sheet, the drag was
  delivered **there** and the canvas simply stopped hearing about it. The token stopped following and
  nothing reported an error.

  A browser does not work that way: `pointerdown` implicitly **captures** the pointer to the element
  that received it, and every later move and the release go to that same element however far the
  pointer travels. The pointer now does the same.

  ⚠️ It never appeared on desktop because a drag across empty canvas never crosses anything, and the
  existing test asserted the wrong behaviour outright, being named "resolves the target afresh on each
  drag step rather than caching it". The reasoning behind that was sound and is preserved: Foundry
  re-renders applications mid interaction, so a captured element can be detached and dispatching at a
  detached element throws the event away silently. The mistake was treating "it might be detached" as a
  reason to re-resolve always rather than only when it actually is.

- [#43](https://github.com/LewisIsWorking/Tongs-Browser/pull/43) [`c156f03`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c156f03f9b7d3f0f2ba0c38d5380dc8aba13ad2d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Report Foundry's own interaction state in diagnostics, and trace a whole gesture.

  The pointer capture fix landed and the events now demonstrably reach `canvas#board` with
  `buttons=1`, and a token on a real device still does not move. Correct events arriving at the right
  element and nothing happening is a different problem from the one just fixed, and nothing visible
  distinguishes its two possible causes.

  So the report now carries Foundry's own `MouseInteractionManager` state for the selected token, which
  runs NONE, HOVER, CLICKED, GRABBED, DRAG, DROP with a 10px drag resistance, plus whether a drag
  preview object exists. If the state never leaves CLICKED or GRABBED, the moves are not reaching the
  manager. If it reaches DRAG and a preview exists, the drag is running and the drop is what fails.

  The event trace now covers a whole gesture rather than a fixed last eighteen. A drag emits a move per
  step, so the `pointerdown` that began it had already scrolled out of the window by the time the
  report was read, and whether the press and the release reached the same element is exactly the
  question being asked. Runs of identical moves are collapsed rather than filling the report.

- [#43](https://github.com/LewisIsWorking/Tongs-Browser/pull/43) [`c156f03`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c156f03f9b7d3f0f2ba0c38d5380dc8aba13ad2d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Record the peak interaction state during a gesture rather than reading it afterwards.

  The first report carrying Foundry's interaction state said `NONE (0)` with zero drag previews, which
  looks conclusive and is not: it was read when the report was written, which is after the gesture
  ended, and Foundry resets the manager to NONE once an interaction finishes. A post hoc NONE says the
  same thing whether the drag never started or ran perfectly and committed.

  The state and the drag preview count are now sampled on every dispatched event and the peak since the
  last `pointerdown` is reported. That survives the gesture ending, which is the only reason it can
  answer the question: a peak below GRABBED means the moves never reached Foundry's manager, while a
  peak of DRAG with previews means the drag ran and the drop is what failed.

  Same class of mistake as asserting a sign where a magnitude was meant. A measurement has to outlive
  the thing it measures.

- [#43](https://github.com/LewisIsWorking/Tongs-Browser/pull/43) [`c156f03`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c156f03f9b7d3f0f2ba0c38d5380dc8aba13ad2d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Stop the browser's tap highlight masquerading as a button state.

  Reported from a device: the pause button appeared lit while the game was **not** paused. The orange
  was Vivaldi's own tap highlight sitting on the last button touched, and it looked exactly like the
  latched state the grab button shows when it really is on.

  A control that reports a state it does not have is worse than one that reports nothing, because it
  invites the tap that undoes what you wanted. The native highlight is now suppressed on every button
  in the bar and the tab picker, and focus gets a blue outline that cannot be mistaken for the gold
  latched styling, which changes border weight as well as colour.

## 0.12.0

### Minor Changes

- [#41](https://github.com/LewisIsWorking/Tongs-Browser/pull/41) [`d9bd732`](https://github.com/LewisIsWorking/Tongs-Browser/commit/d9bd7329ad58cd620ca8a5a68ba8079cd3cf9228) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a diagnostics button that whispers a report into chat.

  A drag failure reported from a real phone could not be reproduced on any surface available for
  testing. It works on desktop through the full gesture layer with real injected touch, and the
  emulator's Chromium 133 cannot hit test canvas objects from synthetic events at all, so it can
  neither confirm nor deny anything. Three plausible hypotheses were each disproven by measurement:
  the active tool being hijacked by this module's own scene control (measured `select` before and
  after), pause blocking the drag (only applies when not a GM), and moves not carrying the held button
  (fixed, and desktop drags 800 to 1300).

  That is the point at which guessing should stop and the device should be asked directly. The button
  reports the active tool, the controlled token and its `_canDrag`, the pointer position and drag
  state, the element under the pointer, `canvas.mousePosition` and whether it sits inside the selected
  token, the canvas and keyboard state, and the user agent.

  Chat rather than the console, deliberately: it is the one output surface a phone user already has
  open and can screenshot, where reaching devtools on Android needs a cable and a laptop. Whispered to
  self so it never lands in front of players.

- [#41](https://github.com/LewisIsWorking/Tongs-Browser/pull/41) [`d9bd732`](https://github.com/LewisIsWorking/Tongs-Browser/commit/d9bd7329ad58cd620ca8a5a68ba8079cd3cf9228) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Report the build version and the actual event stream in diagnostics.

  A drag failure on a real device produced a report where **every static check was healthy**: `select`
  tool, `_canDrag: true`, pointer genuinely inside the selected token, canvas ready. At that point the
  setup is not the problem and the only thing left to look at is the event stream itself, which on a
  phone has no console to look at it in. The report now carries the last eighteen dispatched events
  with their `buttons` value, which is the field that decides whether a drag is a drag: it must stay
  non zero on every move between the down and the up, or Foundry reads the stream as a hover.

  ⚠️ The same report also claimed version 0.2.3 while running code from 0.9.0, and that is worth
  fixing rather than explaining away. `game.modules.get(id).version` comes from a manifest Foundry
  reads **once at server start** and caches, so replacing module files under a running server leaves it
  frozen at whatever booted. The version is now stamped into the bundle at build time and both are
  shown, so a mismatch is visible rather than misleading.

- [#41](https://github.com/LewisIsWorking/Tongs-Browser/pull/41) [`d9bd732`](https://github.com/LewisIsWorking/Tongs-Browser/commit/d9bd7329ad58cd620ca8a5a68ba8079cd3cf9228) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a grab button so tokens can actually be dragged, and make tray buttons show their state.

  **Dragging a token was near impossible on a phone, and it was the gesture design rather than a bug.**
  A drag required tap, lift, press again inside the double tap window, hold past the long press timer
  without moving more than the tap slop, and only then move. Five things in a row, each a chance to get
  it wrong while looking at the map rather than at your thumb. It passed every test, because it does
  work; working and usable are different claims.

  The new ✋ button holds the button down at the pointer until tapped again, so dragging becomes grab,
  move the pointer normally, drop. It is also how a popped out window gets dragged, which was the other
  half of the same complaint.

  ⭐ Making that work needed a real fix, not just a button. The buttons bitmask has to stay set on every
  move of a drag or Foundry reads the stream as a hover, and only `dragBy` set it. A drag begun by the
  new button and then continued by ordinary pointer movement silently degraded into a hover: measured
  on a device, the button was held, the pointer glided over the token, and the token did not move.
  `applyMove` now routes on the drag STATE rather than on which method was called, so the two agree.
  Verified end to end: token x 800 to 1200.

  **Tray buttons now show their state.** Pause and grab are toggles whose "on" was invisible, which
  invites a second tap that undoes the first. Both now carry the same latched styling the modifier keys
  use, distinguished by border weight and colour rather than colour alone, plus `aria-pressed`. Pause
  also refreshes from Foundry's `pauseGame` hook, so it stays honest when a GM pauses from a laptop or
  another player's request arrives through the relay.

  The pan arrows are grouped into a cluster, since the bar had grown to four wrapped rows on a phone.

- [#41](https://github.com/LewisIsWorking/Tongs-Browser/pull/41) [`d9bd732`](https://github.com/LewisIsWorking/Tongs-Browser/commit/d9bd7329ad58cd620ca8a5a68ba8079cd3cf9228) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#41](https://github.com/LewisIsWorking/Tongs-Browser/pull/41) [`d9bd732`](https://github.com/LewisIsWorking/Tongs-Browser/commit/d9bd7329ad58cd620ca8a5a68ba8079cd3cf9228) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Let players pause the game, and reach every sidebar tab rather than just chat.

  **Players can pause.** Foundry's `Game#togglePause` only broadcasts
  `if (options.broadcast && game.user.isGM)`, so the permission check sits on the emit path and a
  player calling it toggles their own client alone. Macro ownership does not help either: `Macro#execute`
  runs the script client side as whoever pressed it, and core Foundry has **no** execute-as-GM at all,
  verified against the installed 14.365 where `executeAsGM`, `execute-as` and `asGM` appear nowhere in
  client or common. That feature comes from modules such as Advanced Macros.

  So a player now emits a request and one GM performs the toggle. The GM is chosen with Foundry's own
  `game.users.activeGM`, which picks the same single user on every client: without that, every
  connected GM would answer the same request and the pause state would flip once per GM. The request
  carries the desired state rather than the word "toggle", so two players tapping at once agree on an
  outcome instead of cancelling each other.

  **Every sidebar tab, not just the active one.** The sidebar button popped out whichever tab was
  active, which meant chat and nothing else, because the only way to change tabs is the docked strip
  that is 27px wide on a phone. It now opens a picker listing all thirteen tabs, built from our own DOM
  at 44px a row, and drops gmOnly tabs for players so nobody is offered a Scenes tab that would refuse
  to open.

  Measured on real Android at 412x783: the picker renders fully on screen, the Actors row is reachable
  by hit test, and picking it renders the Actors popout on screen.

- [#41](https://github.com/LewisIsWorking/Tongs-Browser/pull/41) [`d9bd732`](https://github.com/LewisIsWorking/Tongs-Browser/commit/d9bd7329ad58cd620ca8a5a68ba8079cd3cf9228) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the sidebar button actually produce a sidebar, and add a pause button.

  The sidebar button expanded Foundry's docked sidebar, which is the obvious thing and was not good
  enough. Measured on real Android hardware at 412x783: the docked sidebar is **27 pixels wide**. It
  was there the whole time, and it is unusable with a thumb, which is why it read as missing. Toggling
  `expanded` flipped a real flag and changed nothing anyone could see.

  The button now pops the active sidebar tab out as an ordinary application window. Measured on the
  same device, the popout lands at 94,108 and is 225x566, fully on screen, and a second tap closes it.
  A window is kept inside the viewport by WindowClampBinder, so it is visible by construction rather
  than by luck. It falls back to the docked toggle on any build without the popout API.

  Adds a pause button. It looks for a macro named "Tongs Pause" first, so a GM can write one and grant
  players ownership, then falls back to Foundry's own toggle, broadcasting for a GM and locally
  otherwise.

  ⚠️ Worth knowing before relying on it: a macro **cannot** let a player pause the world, whatever its
  ownership. `Game#togglePause` only emits the socket message `if (options.broadcast && game.user.isGM)`,
  so the check is on the emit path rather than on macro permissions. A player running any macro toggles
  their own client alone. Letting players pause for everyone needs a GM side relay, which is separate
  work.

- [#41](https://github.com/LewisIsWorking/Tongs-Browser/pull/41) [`d9bd732`](https://github.com/LewisIsWorking/Tongs-Browser/commit/d9bd7329ad58cd620ca8a5a68ba8079cd3cf9228) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

  Asked for after testing on a real device, where the sidebar could not be opened at all. Foundry auto
  collapses it below roughly 1024px into a narrow strip of icons hard against the right edge, and the
  expander is a few pixels wide, which is not a realistic touch target. The sidebar is the only route
  to chat, actors, journals and settings, so losing it costs most of the interface.

  The button sits on the bar and uses Foundry's own `ui.sidebar.toggleExpanded()`, so the caret,
  tooltip, accessible name and the `collapseSidebar` hook all stay correct rather than being faked by
  writing a CSS class. It is 44px, the touch target minimum, and it deliberately lives outside the
  collapsible keys area so it survives the bar being collapsed: "show me the sidebar" is most needed
  exactly when the bar has been shrunk out of the way.

  Tray actions are supplied by the caller rather than built into the bar, so the bar stays a bar of
  keys and knows nothing about Foundry's interface.

### Patch Changes

- [#41](https://github.com/LewisIsWorking/Tongs-Browser/pull/41) [`d9bd732`](https://github.com/LewisIsWorking/Tongs-Browser/commit/d9bd7329ad58cd620ca8a5a68ba8079cd3cf9228) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

- [#41](https://github.com/LewisIsWorking/Tongs-Browser/pull/41) [`d9bd732`](https://github.com/LewisIsWorking/Tongs-Browser/commit/d9bd7329ad58cd620ca8a5a68ba8079cd3cf9228) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix dragging failing whenever the pointer crosses any other element.

  Reported from a device and finally named by the diagnostics report: `pointermove buttons=1 -> div#`,
  where it needed to reach `canvas#board`. Every drag event was hit tested afresh, so the instant the
  pointer crossed anything at all, a chat window, the modifier bar, a character sheet, the drag was
  delivered **there** and the canvas simply stopped hearing about it. The token stopped following and
  nothing reported an error.

  A browser does not work that way: `pointerdown` implicitly **captures** the pointer to the element
  that received it, and every later move and the release go to that same element however far the
  pointer travels. The pointer now does the same.

  ⚠️ It never appeared on desktop because a drag across empty canvas never crosses anything, and the
  existing test asserted the wrong behaviour outright, being named "resolves the target afresh on each
  drag step rather than caching it". The reasoning behind that was sound and is preserved: Foundry
  re-renders applications mid interaction, so a captured element can be detached and dispatching at a
  detached element throws the event away silently. The mistake was treating "it might be detached" as a
  reason to re-resolve always rather than only when it actually is.

- [#41](https://github.com/LewisIsWorking/Tongs-Browser/pull/41) [`d9bd732`](https://github.com/LewisIsWorking/Tongs-Browser/commit/d9bd7329ad58cd620ca8a5a68ba8079cd3cf9228) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Report Foundry's own interaction state in diagnostics, and trace a whole gesture.

  The pointer capture fix landed and the events now demonstrably reach `canvas#board` with
  `buttons=1`, and a token on a real device still does not move. Correct events arriving at the right
  element and nothing happening is a different problem from the one just fixed, and nothing visible
  distinguishes its two possible causes.

  So the report now carries Foundry's own `MouseInteractionManager` state for the selected token, which
  runs NONE, HOVER, CLICKED, GRABBED, DRAG, DROP with a 10px drag resistance, plus whether a drag
  preview object exists. If the state never leaves CLICKED or GRABBED, the moves are not reaching the
  manager. If it reaches DRAG and a preview exists, the drag is running and the drop is what fails.

  The event trace now covers a whole gesture rather than a fixed last eighteen. A drag emits a move per
  step, so the `pointerdown` that began it had already scrolled out of the window by the time the
  report was read, and whether the press and the release reached the same element is exactly the
  question being asked. Runs of identical moves are collapsed rather than filling the report.

- [#41](https://github.com/LewisIsWorking/Tongs-Browser/pull/41) [`d9bd732`](https://github.com/LewisIsWorking/Tongs-Browser/commit/d9bd7329ad58cd620ca8a5a68ba8079cd3cf9228) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Stop the browser's tap highlight masquerading as a button state.

  Reported from a device: the pause button appeared lit while the game was **not** paused. The orange
  was Vivaldi's own tap highlight sitting on the last button touched, and it looked exactly like the
  latched state the grab button shows when it really is on.

  A control that reports a state it does not have is worse than one that reports nothing, because it
  invites the tap that undoes what you wanted. The native highlight is now suppressed on every button
  in the bar and the tab picker, and focus gets a blue outline that cannot be mistaken for the gold
  latched styling, which changes border weight as well as colour.

## 0.11.0

### Minor Changes

- [#39](https://github.com/LewisIsWorking/Tongs-Browser/pull/39) [`c7db4d5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c7db4d5be5addc041bb8a1764f04c82982d98009) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a diagnostics button that whispers a report into chat.

  A drag failure reported from a real phone could not be reproduced on any surface available for
  testing. It works on desktop through the full gesture layer with real injected touch, and the
  emulator's Chromium 133 cannot hit test canvas objects from synthetic events at all, so it can
  neither confirm nor deny anything. Three plausible hypotheses were each disproven by measurement:
  the active tool being hijacked by this module's own scene control (measured `select` before and
  after), pause blocking the drag (only applies when not a GM), and moves not carrying the held button
  (fixed, and desktop drags 800 to 1300).

  That is the point at which guessing should stop and the device should be asked directly. The button
  reports the active tool, the controlled token and its `_canDrag`, the pointer position and drag
  state, the element under the pointer, `canvas.mousePosition` and whether it sits inside the selected
  token, the canvas and keyboard state, and the user agent.

  Chat rather than the console, deliberately: it is the one output surface a phone user already has
  open and can screenshot, where reaching devtools on Android needs a cable and a laptop. Whispered to
  self so it never lands in front of players.

- [#39](https://github.com/LewisIsWorking/Tongs-Browser/pull/39) [`c7db4d5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c7db4d5be5addc041bb8a1764f04c82982d98009) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Report the build version and the actual event stream in diagnostics.

  A drag failure on a real device produced a report where **every static check was healthy**: `select`
  tool, `_canDrag: true`, pointer genuinely inside the selected token, canvas ready. At that point the
  setup is not the problem and the only thing left to look at is the event stream itself, which on a
  phone has no console to look at it in. The report now carries the last eighteen dispatched events
  with their `buttons` value, which is the field that decides whether a drag is a drag: it must stay
  non zero on every move between the down and the up, or Foundry reads the stream as a hover.

  ⚠️ The same report also claimed version 0.2.3 while running code from 0.9.0, and that is worth
  fixing rather than explaining away. `game.modules.get(id).version` comes from a manifest Foundry
  reads **once at server start** and caches, so replacing module files under a running server leaves it
  frozen at whatever booted. The version is now stamped into the bundle at build time and both are
  shown, so a mismatch is visible rather than misleading.

- [#39](https://github.com/LewisIsWorking/Tongs-Browser/pull/39) [`c7db4d5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c7db4d5be5addc041bb8a1764f04c82982d98009) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a grab button so tokens can actually be dragged, and make tray buttons show their state.

  **Dragging a token was near impossible on a phone, and it was the gesture design rather than a bug.**
  A drag required tap, lift, press again inside the double tap window, hold past the long press timer
  without moving more than the tap slop, and only then move. Five things in a row, each a chance to get
  it wrong while looking at the map rather than at your thumb. It passed every test, because it does
  work; working and usable are different claims.

  The new ✋ button holds the button down at the pointer until tapped again, so dragging becomes grab,
  move the pointer normally, drop. It is also how a popped out window gets dragged, which was the other
  half of the same complaint.

  ⭐ Making that work needed a real fix, not just a button. The buttons bitmask has to stay set on every
  move of a drag or Foundry reads the stream as a hover, and only `dragBy` set it. A drag begun by the
  new button and then continued by ordinary pointer movement silently degraded into a hover: measured
  on a device, the button was held, the pointer glided over the token, and the token did not move.
  `applyMove` now routes on the drag STATE rather than on which method was called, so the two agree.
  Verified end to end: token x 800 to 1200.

  **Tray buttons now show their state.** Pause and grab are toggles whose "on" was invisible, which
  invites a second tap that undoes the first. Both now carry the same latched styling the modifier keys
  use, distinguished by border weight and colour rather than colour alone, plus `aria-pressed`. Pause
  also refreshes from Foundry's `pauseGame` hook, so it stays honest when a GM pauses from a laptop or
  another player's request arrives through the relay.

  The pan arrows are grouped into a cluster, since the bar had grown to four wrapped rows on a phone.

- [#39](https://github.com/LewisIsWorking/Tongs-Browser/pull/39) [`c7db4d5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c7db4d5be5addc041bb8a1764f04c82982d98009) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#39](https://github.com/LewisIsWorking/Tongs-Browser/pull/39) [`c7db4d5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c7db4d5be5addc041bb8a1764f04c82982d98009) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Let players pause the game, and reach every sidebar tab rather than just chat.

  **Players can pause.** Foundry's `Game#togglePause` only broadcasts
  `if (options.broadcast && game.user.isGM)`, so the permission check sits on the emit path and a
  player calling it toggles their own client alone. Macro ownership does not help either: `Macro#execute`
  runs the script client side as whoever pressed it, and core Foundry has **no** execute-as-GM at all,
  verified against the installed 14.365 where `executeAsGM`, `execute-as` and `asGM` appear nowhere in
  client or common. That feature comes from modules such as Advanced Macros.

  So a player now emits a request and one GM performs the toggle. The GM is chosen with Foundry's own
  `game.users.activeGM`, which picks the same single user on every client: without that, every
  connected GM would answer the same request and the pause state would flip once per GM. The request
  carries the desired state rather than the word "toggle", so two players tapping at once agree on an
  outcome instead of cancelling each other.

  **Every sidebar tab, not just the active one.** The sidebar button popped out whichever tab was
  active, which meant chat and nothing else, because the only way to change tabs is the docked strip
  that is 27px wide on a phone. It now opens a picker listing all thirteen tabs, built from our own DOM
  at 44px a row, and drops gmOnly tabs for players so nobody is offered a Scenes tab that would refuse
  to open.

  Measured on real Android at 412x783: the picker renders fully on screen, the Actors row is reachable
  by hit test, and picking it renders the Actors popout on screen.

- [#39](https://github.com/LewisIsWorking/Tongs-Browser/pull/39) [`c7db4d5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c7db4d5be5addc041bb8a1764f04c82982d98009) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the sidebar button actually produce a sidebar, and add a pause button.

  The sidebar button expanded Foundry's docked sidebar, which is the obvious thing and was not good
  enough. Measured on real Android hardware at 412x783: the docked sidebar is **27 pixels wide**. It
  was there the whole time, and it is unusable with a thumb, which is why it read as missing. Toggling
  `expanded` flipped a real flag and changed nothing anyone could see.

  The button now pops the active sidebar tab out as an ordinary application window. Measured on the
  same device, the popout lands at 94,108 and is 225x566, fully on screen, and a second tap closes it.
  A window is kept inside the viewport by WindowClampBinder, so it is visible by construction rather
  than by luck. It falls back to the docked toggle on any build without the popout API.

  Adds a pause button. It looks for a macro named "Tongs Pause" first, so a GM can write one and grant
  players ownership, then falls back to Foundry's own toggle, broadcasting for a GM and locally
  otherwise.

  ⚠️ Worth knowing before relying on it: a macro **cannot** let a player pause the world, whatever its
  ownership. `Game#togglePause` only emits the socket message `if (options.broadcast && game.user.isGM)`,
  so the check is on the emit path rather than on macro permissions. A player running any macro toggles
  their own client alone. Letting players pause for everyone needs a GM side relay, which is separate
  work.

- [#39](https://github.com/LewisIsWorking/Tongs-Browser/pull/39) [`c7db4d5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c7db4d5be5addc041bb8a1764f04c82982d98009) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

  Asked for after testing on a real device, where the sidebar could not be opened at all. Foundry auto
  collapses it below roughly 1024px into a narrow strip of icons hard against the right edge, and the
  expander is a few pixels wide, which is not a realistic touch target. The sidebar is the only route
  to chat, actors, journals and settings, so losing it costs most of the interface.

  The button sits on the bar and uses Foundry's own `ui.sidebar.toggleExpanded()`, so the caret,
  tooltip, accessible name and the `collapseSidebar` hook all stay correct rather than being faked by
  writing a CSS class. It is 44px, the touch target minimum, and it deliberately lives outside the
  collapsible keys area so it survives the bar being collapsed: "show me the sidebar" is most needed
  exactly when the bar has been shrunk out of the way.

  Tray actions are supplied by the caller rather than built into the bar, so the bar stays a bar of
  keys and knows nothing about Foundry's interface.

### Patch Changes

- [#39](https://github.com/LewisIsWorking/Tongs-Browser/pull/39) [`c7db4d5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c7db4d5be5addc041bb8a1764f04c82982d98009) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

- [#39](https://github.com/LewisIsWorking/Tongs-Browser/pull/39) [`c7db4d5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c7db4d5be5addc041bb8a1764f04c82982d98009) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix dragging failing whenever the pointer crosses any other element.

  Reported from a device and finally named by the diagnostics report: `pointermove buttons=1 -> div#`,
  where it needed to reach `canvas#board`. Every drag event was hit tested afresh, so the instant the
  pointer crossed anything at all, a chat window, the modifier bar, a character sheet, the drag was
  delivered **there** and the canvas simply stopped hearing about it. The token stopped following and
  nothing reported an error.

  A browser does not work that way: `pointerdown` implicitly **captures** the pointer to the element
  that received it, and every later move and the release go to that same element however far the
  pointer travels. The pointer now does the same.

  ⚠️ It never appeared on desktop because a drag across empty canvas never crosses anything, and the
  existing test asserted the wrong behaviour outright, being named "resolves the target afresh on each
  drag step rather than caching it". The reasoning behind that was sound and is preserved: Foundry
  re-renders applications mid interaction, so a captured element can be detached and dispatching at a
  detached element throws the event away silently. The mistake was treating "it might be detached" as a
  reason to re-resolve always rather than only when it actually is.

- [#39](https://github.com/LewisIsWorking/Tongs-Browser/pull/39) [`c7db4d5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c7db4d5be5addc041bb8a1764f04c82982d98009) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Stop the browser's tap highlight masquerading as a button state.

  Reported from a device: the pause button appeared lit while the game was **not** paused. The orange
  was Vivaldi's own tap highlight sitting on the last button touched, and it looked exactly like the
  latched state the grab button shows when it really is on.

  A control that reports a state it does not have is worse than one that reports nothing, because it
  invites the tap that undoes what you wanted. The native highlight is now suppressed on every button
  in the bar and the tab picker, and focus gets a blue outline that cannot be mistaken for the gold
  latched styling, which changes border weight as well as colour.

## 0.10.0

### Minor Changes

- [#37](https://github.com/LewisIsWorking/Tongs-Browser/pull/37) [`6d175f3`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6d175f36d96134f7c12519ec199e70809e4975c5) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a diagnostics button that whispers a report into chat.

  A drag failure reported from a real phone could not be reproduced on any surface available for
  testing. It works on desktop through the full gesture layer with real injected touch, and the
  emulator's Chromium 133 cannot hit test canvas objects from synthetic events at all, so it can
  neither confirm nor deny anything. Three plausible hypotheses were each disproven by measurement:
  the active tool being hijacked by this module's own scene control (measured `select` before and
  after), pause blocking the drag (only applies when not a GM), and moves not carrying the held button
  (fixed, and desktop drags 800 to 1300).

  That is the point at which guessing should stop and the device should be asked directly. The button
  reports the active tool, the controlled token and its `_canDrag`, the pointer position and drag
  state, the element under the pointer, `canvas.mousePosition` and whether it sits inside the selected
  token, the canvas and keyboard state, and the user agent.

  Chat rather than the console, deliberately: it is the one output surface a phone user already has
  open and can screenshot, where reaching devtools on Android needs a cable and a laptop. Whispered to
  self so it never lands in front of players.

- [#37](https://github.com/LewisIsWorking/Tongs-Browser/pull/37) [`6d175f3`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6d175f36d96134f7c12519ec199e70809e4975c5) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Report the build version and the actual event stream in diagnostics.

  A drag failure on a real device produced a report where **every static check was healthy**: `select`
  tool, `_canDrag: true`, pointer genuinely inside the selected token, canvas ready. At that point the
  setup is not the problem and the only thing left to look at is the event stream itself, which on a
  phone has no console to look at it in. The report now carries the last eighteen dispatched events
  with their `buttons` value, which is the field that decides whether a drag is a drag: it must stay
  non zero on every move between the down and the up, or Foundry reads the stream as a hover.

  ⚠️ The same report also claimed version 0.2.3 while running code from 0.9.0, and that is worth
  fixing rather than explaining away. `game.modules.get(id).version` comes from a manifest Foundry
  reads **once at server start** and caches, so replacing module files under a running server leaves it
  frozen at whatever booted. The version is now stamped into the bundle at build time and both are
  shown, so a mismatch is visible rather than misleading.

- [#37](https://github.com/LewisIsWorking/Tongs-Browser/pull/37) [`6d175f3`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6d175f36d96134f7c12519ec199e70809e4975c5) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a grab button so tokens can actually be dragged, and make tray buttons show their state.

  **Dragging a token was near impossible on a phone, and it was the gesture design rather than a bug.**
  A drag required tap, lift, press again inside the double tap window, hold past the long press timer
  without moving more than the tap slop, and only then move. Five things in a row, each a chance to get
  it wrong while looking at the map rather than at your thumb. It passed every test, because it does
  work; working and usable are different claims.

  The new ✋ button holds the button down at the pointer until tapped again, so dragging becomes grab,
  move the pointer normally, drop. It is also how a popped out window gets dragged, which was the other
  half of the same complaint.

  ⭐ Making that work needed a real fix, not just a button. The buttons bitmask has to stay set on every
  move of a drag or Foundry reads the stream as a hover, and only `dragBy` set it. A drag begun by the
  new button and then continued by ordinary pointer movement silently degraded into a hover: measured
  on a device, the button was held, the pointer glided over the token, and the token did not move.
  `applyMove` now routes on the drag STATE rather than on which method was called, so the two agree.
  Verified end to end: token x 800 to 1200.

  **Tray buttons now show their state.** Pause and grab are toggles whose "on" was invisible, which
  invites a second tap that undoes the first. Both now carry the same latched styling the modifier keys
  use, distinguished by border weight and colour rather than colour alone, plus `aria-pressed`. Pause
  also refreshes from Foundry's `pauseGame` hook, so it stays honest when a GM pauses from a laptop or
  another player's request arrives through the relay.

  The pan arrows are grouped into a cluster, since the bar had grown to four wrapped rows on a phone.

- [#37](https://github.com/LewisIsWorking/Tongs-Browser/pull/37) [`6d175f3`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6d175f36d96134f7c12519ec199e70809e4975c5) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#37](https://github.com/LewisIsWorking/Tongs-Browser/pull/37) [`6d175f3`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6d175f36d96134f7c12519ec199e70809e4975c5) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Let players pause the game, and reach every sidebar tab rather than just chat.

  **Players can pause.** Foundry's `Game#togglePause` only broadcasts
  `if (options.broadcast && game.user.isGM)`, so the permission check sits on the emit path and a
  player calling it toggles their own client alone. Macro ownership does not help either: `Macro#execute`
  runs the script client side as whoever pressed it, and core Foundry has **no** execute-as-GM at all,
  verified against the installed 14.365 where `executeAsGM`, `execute-as` and `asGM` appear nowhere in
  client or common. That feature comes from modules such as Advanced Macros.

  So a player now emits a request and one GM performs the toggle. The GM is chosen with Foundry's own
  `game.users.activeGM`, which picks the same single user on every client: without that, every
  connected GM would answer the same request and the pause state would flip once per GM. The request
  carries the desired state rather than the word "toggle", so two players tapping at once agree on an
  outcome instead of cancelling each other.

  **Every sidebar tab, not just the active one.** The sidebar button popped out whichever tab was
  active, which meant chat and nothing else, because the only way to change tabs is the docked strip
  that is 27px wide on a phone. It now opens a picker listing all thirteen tabs, built from our own DOM
  at 44px a row, and drops gmOnly tabs for players so nobody is offered a Scenes tab that would refuse
  to open.

  Measured on real Android at 412x783: the picker renders fully on screen, the Actors row is reachable
  by hit test, and picking it renders the Actors popout on screen.

- [#37](https://github.com/LewisIsWorking/Tongs-Browser/pull/37) [`6d175f3`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6d175f36d96134f7c12519ec199e70809e4975c5) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the sidebar button actually produce a sidebar, and add a pause button.

  The sidebar button expanded Foundry's docked sidebar, which is the obvious thing and was not good
  enough. Measured on real Android hardware at 412x783: the docked sidebar is **27 pixels wide**. It
  was there the whole time, and it is unusable with a thumb, which is why it read as missing. Toggling
  `expanded` flipped a real flag and changed nothing anyone could see.

  The button now pops the active sidebar tab out as an ordinary application window. Measured on the
  same device, the popout lands at 94,108 and is 225x566, fully on screen, and a second tap closes it.
  A window is kept inside the viewport by WindowClampBinder, so it is visible by construction rather
  than by luck. It falls back to the docked toggle on any build without the popout API.

  Adds a pause button. It looks for a macro named "Tongs Pause" first, so a GM can write one and grant
  players ownership, then falls back to Foundry's own toggle, broadcasting for a GM and locally
  otherwise.

  ⚠️ Worth knowing before relying on it: a macro **cannot** let a player pause the world, whatever its
  ownership. `Game#togglePause` only emits the socket message `if (options.broadcast && game.user.isGM)`,
  so the check is on the emit path rather than on macro permissions. A player running any macro toggles
  their own client alone. Letting players pause for everyone needs a GM side relay, which is separate
  work.

- [#37](https://github.com/LewisIsWorking/Tongs-Browser/pull/37) [`6d175f3`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6d175f36d96134f7c12519ec199e70809e4975c5) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

  Asked for after testing on a real device, where the sidebar could not be opened at all. Foundry auto
  collapses it below roughly 1024px into a narrow strip of icons hard against the right edge, and the
  expander is a few pixels wide, which is not a realistic touch target. The sidebar is the only route
  to chat, actors, journals and settings, so losing it costs most of the interface.

  The button sits on the bar and uses Foundry's own `ui.sidebar.toggleExpanded()`, so the caret,
  tooltip, accessible name and the `collapseSidebar` hook all stay correct rather than being faked by
  writing a CSS class. It is 44px, the touch target minimum, and it deliberately lives outside the
  collapsible keys area so it survives the bar being collapsed: "show me the sidebar" is most needed
  exactly when the bar has been shrunk out of the way.

  Tray actions are supplied by the caller rather than built into the bar, so the bar stays a bar of
  keys and knows nothing about Foundry's interface.

### Patch Changes

- [#37](https://github.com/LewisIsWorking/Tongs-Browser/pull/37) [`6d175f3`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6d175f36d96134f7c12519ec199e70809e4975c5) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

- [#37](https://github.com/LewisIsWorking/Tongs-Browser/pull/37) [`6d175f3`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6d175f36d96134f7c12519ec199e70809e4975c5) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Stop the browser's tap highlight masquerading as a button state.

  Reported from a device: the pause button appeared lit while the game was **not** paused. The orange
  was Vivaldi's own tap highlight sitting on the last button touched, and it looked exactly like the
  latched state the grab button shows when it really is on.

  A control that reports a state it does not have is worse than one that reports nothing, because it
  invites the tap that undoes what you wanted. The native highlight is now suppressed on every button
  in the bar and the tab picker, and focus gets a blue outline that cannot be mistaken for the gold
  latched styling, which changes border weight as well as colour.

## 0.9.0

### Minor Changes

- [#35](https://github.com/LewisIsWorking/Tongs-Browser/pull/35) [`29e0357`](https://github.com/LewisIsWorking/Tongs-Browser/commit/29e03574a73dadbbd469af5d5e868d7648f4fc52) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a diagnostics button that whispers a report into chat.

  A drag failure reported from a real phone could not be reproduced on any surface available for
  testing. It works on desktop through the full gesture layer with real injected touch, and the
  emulator's Chromium 133 cannot hit test canvas objects from synthetic events at all, so it can
  neither confirm nor deny anything. Three plausible hypotheses were each disproven by measurement:
  the active tool being hijacked by this module's own scene control (measured `select` before and
  after), pause blocking the drag (only applies when not a GM), and moves not carrying the held button
  (fixed, and desktop drags 800 to 1300).

  That is the point at which guessing should stop and the device should be asked directly. The button
  reports the active tool, the controlled token and its `_canDrag`, the pointer position and drag
  state, the element under the pointer, `canvas.mousePosition` and whether it sits inside the selected
  token, the canvas and keyboard state, and the user agent.

  Chat rather than the console, deliberately: it is the one output surface a phone user already has
  open and can screenshot, where reaching devtools on Android needs a cable and a laptop. Whispered to
  self so it never lands in front of players.

- [#35](https://github.com/LewisIsWorking/Tongs-Browser/pull/35) [`29e0357`](https://github.com/LewisIsWorking/Tongs-Browser/commit/29e03574a73dadbbd469af5d5e868d7648f4fc52) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a grab button so tokens can actually be dragged, and make tray buttons show their state.

  **Dragging a token was near impossible on a phone, and it was the gesture design rather than a bug.**
  A drag required tap, lift, press again inside the double tap window, hold past the long press timer
  without moving more than the tap slop, and only then move. Five things in a row, each a chance to get
  it wrong while looking at the map rather than at your thumb. It passed every test, because it does
  work; working and usable are different claims.

  The new ✋ button holds the button down at the pointer until tapped again, so dragging becomes grab,
  move the pointer normally, drop. It is also how a popped out window gets dragged, which was the other
  half of the same complaint.

  ⭐ Making that work needed a real fix, not just a button. The buttons bitmask has to stay set on every
  move of a drag or Foundry reads the stream as a hover, and only `dragBy` set it. A drag begun by the
  new button and then continued by ordinary pointer movement silently degraded into a hover: measured
  on a device, the button was held, the pointer glided over the token, and the token did not move.
  `applyMove` now routes on the drag STATE rather than on which method was called, so the two agree.
  Verified end to end: token x 800 to 1200.

  **Tray buttons now show their state.** Pause and grab are toggles whose "on" was invisible, which
  invites a second tap that undoes the first. Both now carry the same latched styling the modifier keys
  use, distinguished by border weight and colour rather than colour alone, plus `aria-pressed`. Pause
  also refreshes from Foundry's `pauseGame` hook, so it stays honest when a GM pauses from a laptop or
  another player's request arrives through the relay.

  The pan arrows are grouped into a cluster, since the bar had grown to four wrapped rows on a phone.

- [#35](https://github.com/LewisIsWorking/Tongs-Browser/pull/35) [`29e0357`](https://github.com/LewisIsWorking/Tongs-Browser/commit/29e03574a73dadbbd469af5d5e868d7648f4fc52) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#35](https://github.com/LewisIsWorking/Tongs-Browser/pull/35) [`29e0357`](https://github.com/LewisIsWorking/Tongs-Browser/commit/29e03574a73dadbbd469af5d5e868d7648f4fc52) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Let players pause the game, and reach every sidebar tab rather than just chat.

  **Players can pause.** Foundry's `Game#togglePause` only broadcasts
  `if (options.broadcast && game.user.isGM)`, so the permission check sits on the emit path and a
  player calling it toggles their own client alone. Macro ownership does not help either: `Macro#execute`
  runs the script client side as whoever pressed it, and core Foundry has **no** execute-as-GM at all,
  verified against the installed 14.365 where `executeAsGM`, `execute-as` and `asGM` appear nowhere in
  client or common. That feature comes from modules such as Advanced Macros.

  So a player now emits a request and one GM performs the toggle. The GM is chosen with Foundry's own
  `game.users.activeGM`, which picks the same single user on every client: without that, every
  connected GM would answer the same request and the pause state would flip once per GM. The request
  carries the desired state rather than the word "toggle", so two players tapping at once agree on an
  outcome instead of cancelling each other.

  **Every sidebar tab, not just the active one.** The sidebar button popped out whichever tab was
  active, which meant chat and nothing else, because the only way to change tabs is the docked strip
  that is 27px wide on a phone. It now opens a picker listing all thirteen tabs, built from our own DOM
  at 44px a row, and drops gmOnly tabs for players so nobody is offered a Scenes tab that would refuse
  to open.

  Measured on real Android at 412x783: the picker renders fully on screen, the Actors row is reachable
  by hit test, and picking it renders the Actors popout on screen.

- [#35](https://github.com/LewisIsWorking/Tongs-Browser/pull/35) [`29e0357`](https://github.com/LewisIsWorking/Tongs-Browser/commit/29e03574a73dadbbd469af5d5e868d7648f4fc52) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the sidebar button actually produce a sidebar, and add a pause button.

  The sidebar button expanded Foundry's docked sidebar, which is the obvious thing and was not good
  enough. Measured on real Android hardware at 412x783: the docked sidebar is **27 pixels wide**. It
  was there the whole time, and it is unusable with a thumb, which is why it read as missing. Toggling
  `expanded` flipped a real flag and changed nothing anyone could see.

  The button now pops the active sidebar tab out as an ordinary application window. Measured on the
  same device, the popout lands at 94,108 and is 225x566, fully on screen, and a second tap closes it.
  A window is kept inside the viewport by WindowClampBinder, so it is visible by construction rather
  than by luck. It falls back to the docked toggle on any build without the popout API.

  Adds a pause button. It looks for a macro named "Tongs Pause" first, so a GM can write one and grant
  players ownership, then falls back to Foundry's own toggle, broadcasting for a GM and locally
  otherwise.

  ⚠️ Worth knowing before relying on it: a macro **cannot** let a player pause the world, whatever its
  ownership. `Game#togglePause` only emits the socket message `if (options.broadcast && game.user.isGM)`,
  so the check is on the emit path rather than on macro permissions. A player running any macro toggles
  their own client alone. Letting players pause for everyone needs a GM side relay, which is separate
  work.

- [#35](https://github.com/LewisIsWorking/Tongs-Browser/pull/35) [`29e0357`](https://github.com/LewisIsWorking/Tongs-Browser/commit/29e03574a73dadbbd469af5d5e868d7648f4fc52) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

  Asked for after testing on a real device, where the sidebar could not be opened at all. Foundry auto
  collapses it below roughly 1024px into a narrow strip of icons hard against the right edge, and the
  expander is a few pixels wide, which is not a realistic touch target. The sidebar is the only route
  to chat, actors, journals and settings, so losing it costs most of the interface.

  The button sits on the bar and uses Foundry's own `ui.sidebar.toggleExpanded()`, so the caret,
  tooltip, accessible name and the `collapseSidebar` hook all stay correct rather than being faked by
  writing a CSS class. It is 44px, the touch target minimum, and it deliberately lives outside the
  collapsible keys area so it survives the bar being collapsed: "show me the sidebar" is most needed
  exactly when the bar has been shrunk out of the way.

  Tray actions are supplied by the caller rather than built into the bar, so the bar stays a bar of
  keys and knows nothing about Foundry's interface.

### Patch Changes

- [#35](https://github.com/LewisIsWorking/Tongs-Browser/pull/35) [`29e0357`](https://github.com/LewisIsWorking/Tongs-Browser/commit/29e03574a73dadbbd469af5d5e868d7648f4fc52) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

- [#35](https://github.com/LewisIsWorking/Tongs-Browser/pull/35) [`29e0357`](https://github.com/LewisIsWorking/Tongs-Browser/commit/29e03574a73dadbbd469af5d5e868d7648f4fc52) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Stop the browser's tap highlight masquerading as a button state.

  Reported from a device: the pause button appeared lit while the game was **not** paused. The orange
  was Vivaldi's own tap highlight sitting on the last button touched, and it looked exactly like the
  latched state the grab button shows when it really is on.

  A control that reports a state it does not have is worse than one that reports nothing, because it
  invites the tap that undoes what you wanted. The native highlight is now suppressed on every button
  in the bar and the tab picker, and focus gets a blue outline that cannot be mistaken for the gold
  latched styling, which changes border weight as well as colour.

## 0.8.0

### Minor Changes

- [#33](https://github.com/LewisIsWorking/Tongs-Browser/pull/33) [`800e4ec`](https://github.com/LewisIsWorking/Tongs-Browser/commit/800e4ecc48190327147b2ed8782d3cb3b777c6c7) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a grab button so tokens can actually be dragged, and make tray buttons show their state.

  **Dragging a token was near impossible on a phone, and it was the gesture design rather than a bug.**
  A drag required tap, lift, press again inside the double tap window, hold past the long press timer
  without moving more than the tap slop, and only then move. Five things in a row, each a chance to get
  it wrong while looking at the map rather than at your thumb. It passed every test, because it does
  work; working and usable are different claims.

  The new ✋ button holds the button down at the pointer until tapped again, so dragging becomes grab,
  move the pointer normally, drop. It is also how a popped out window gets dragged, which was the other
  half of the same complaint.

  ⭐ Making that work needed a real fix, not just a button. The buttons bitmask has to stay set on every
  move of a drag or Foundry reads the stream as a hover, and only `dragBy` set it. A drag begun by the
  new button and then continued by ordinary pointer movement silently degraded into a hover: measured
  on a device, the button was held, the pointer glided over the token, and the token did not move.
  `applyMove` now routes on the drag STATE rather than on which method was called, so the two agree.
  Verified end to end: token x 800 to 1200.

  **Tray buttons now show their state.** Pause and grab are toggles whose "on" was invisible, which
  invites a second tap that undoes the first. Both now carry the same latched styling the modifier keys
  use, distinguished by border weight and colour rather than colour alone, plus `aria-pressed`. Pause
  also refreshes from Foundry's `pauseGame` hook, so it stays honest when a GM pauses from a laptop or
  another player's request arrives through the relay.

  The pan arrows are grouped into a cluster, since the bar had grown to four wrapped rows on a phone.

- [#33](https://github.com/LewisIsWorking/Tongs-Browser/pull/33) [`800e4ec`](https://github.com/LewisIsWorking/Tongs-Browser/commit/800e4ecc48190327147b2ed8782d3cb3b777c6c7) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#33](https://github.com/LewisIsWorking/Tongs-Browser/pull/33) [`800e4ec`](https://github.com/LewisIsWorking/Tongs-Browser/commit/800e4ecc48190327147b2ed8782d3cb3b777c6c7) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Let players pause the game, and reach every sidebar tab rather than just chat.

  **Players can pause.** Foundry's `Game#togglePause` only broadcasts
  `if (options.broadcast && game.user.isGM)`, so the permission check sits on the emit path and a
  player calling it toggles their own client alone. Macro ownership does not help either: `Macro#execute`
  runs the script client side as whoever pressed it, and core Foundry has **no** execute-as-GM at all,
  verified against the installed 14.365 where `executeAsGM`, `execute-as` and `asGM` appear nowhere in
  client or common. That feature comes from modules such as Advanced Macros.

  So a player now emits a request and one GM performs the toggle. The GM is chosen with Foundry's own
  `game.users.activeGM`, which picks the same single user on every client: without that, every
  connected GM would answer the same request and the pause state would flip once per GM. The request
  carries the desired state rather than the word "toggle", so two players tapping at once agree on an
  outcome instead of cancelling each other.

  **Every sidebar tab, not just the active one.** The sidebar button popped out whichever tab was
  active, which meant chat and nothing else, because the only way to change tabs is the docked strip
  that is 27px wide on a phone. It now opens a picker listing all thirteen tabs, built from our own DOM
  at 44px a row, and drops gmOnly tabs for players so nobody is offered a Scenes tab that would refuse
  to open.

  Measured on real Android at 412x783: the picker renders fully on screen, the Actors row is reachable
  by hit test, and picking it renders the Actors popout on screen.

- [#33](https://github.com/LewisIsWorking/Tongs-Browser/pull/33) [`800e4ec`](https://github.com/LewisIsWorking/Tongs-Browser/commit/800e4ecc48190327147b2ed8782d3cb3b777c6c7) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the sidebar button actually produce a sidebar, and add a pause button.

  The sidebar button expanded Foundry's docked sidebar, which is the obvious thing and was not good
  enough. Measured on real Android hardware at 412x783: the docked sidebar is **27 pixels wide**. It
  was there the whole time, and it is unusable with a thumb, which is why it read as missing. Toggling
  `expanded` flipped a real flag and changed nothing anyone could see.

  The button now pops the active sidebar tab out as an ordinary application window. Measured on the
  same device, the popout lands at 94,108 and is 225x566, fully on screen, and a second tap closes it.
  A window is kept inside the viewport by WindowClampBinder, so it is visible by construction rather
  than by luck. It falls back to the docked toggle on any build without the popout API.

  Adds a pause button. It looks for a macro named "Tongs Pause" first, so a GM can write one and grant
  players ownership, then falls back to Foundry's own toggle, broadcasting for a GM and locally
  otherwise.

  ⚠️ Worth knowing before relying on it: a macro **cannot** let a player pause the world, whatever its
  ownership. `Game#togglePause` only emits the socket message `if (options.broadcast && game.user.isGM)`,
  so the check is on the emit path rather than on macro permissions. A player running any macro toggles
  their own client alone. Letting players pause for everyone needs a GM side relay, which is separate
  work.

- [#33](https://github.com/LewisIsWorking/Tongs-Browser/pull/33) [`800e4ec`](https://github.com/LewisIsWorking/Tongs-Browser/commit/800e4ecc48190327147b2ed8782d3cb3b777c6c7) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

  Asked for after testing on a real device, where the sidebar could not be opened at all. Foundry auto
  collapses it below roughly 1024px into a narrow strip of icons hard against the right edge, and the
  expander is a few pixels wide, which is not a realistic touch target. The sidebar is the only route
  to chat, actors, journals and settings, so losing it costs most of the interface.

  The button sits on the bar and uses Foundry's own `ui.sidebar.toggleExpanded()`, so the caret,
  tooltip, accessible name and the `collapseSidebar` hook all stay correct rather than being faked by
  writing a CSS class. It is 44px, the touch target minimum, and it deliberately lives outside the
  collapsible keys area so it survives the bar being collapsed: "show me the sidebar" is most needed
  exactly when the bar has been shrunk out of the way.

  Tray actions are supplied by the caller rather than built into the bar, so the bar stays a bar of
  keys and knows nothing about Foundry's interface.

### Patch Changes

- [#33](https://github.com/LewisIsWorking/Tongs-Browser/pull/33) [`800e4ec`](https://github.com/LewisIsWorking/Tongs-Browser/commit/800e4ecc48190327147b2ed8782d3cb3b777c6c7) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

- [#33](https://github.com/LewisIsWorking/Tongs-Browser/pull/33) [`800e4ec`](https://github.com/LewisIsWorking/Tongs-Browser/commit/800e4ecc48190327147b2ed8782d3cb3b777c6c7) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Stop the browser's tap highlight masquerading as a button state.

  Reported from a device: the pause button appeared lit while the game was **not** paused. The orange
  was Vivaldi's own tap highlight sitting on the last button touched, and it looked exactly like the
  latched state the grab button shows when it really is on.

  A control that reports a state it does not have is worse than one that reports nothing, because it
  invites the tap that undoes what you wanted. The native highlight is now suppressed on every button
  in the bar and the tab picker, and focus gets a blue outline that cannot be mistaken for the gold
  latched styling, which changes border weight as well as colour.

## 0.7.0

### Minor Changes

- [#31](https://github.com/LewisIsWorking/Tongs-Browser/pull/31) [`a67ae01`](https://github.com/LewisIsWorking/Tongs-Browser/commit/a67ae018bf3d6cef9545b451fcefc23f468bedb3) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a grab button so tokens can actually be dragged, and make tray buttons show their state.

  **Dragging a token was near impossible on a phone, and it was the gesture design rather than a bug.**
  A drag required tap, lift, press again inside the double tap window, hold past the long press timer
  without moving more than the tap slop, and only then move. Five things in a row, each a chance to get
  it wrong while looking at the map rather than at your thumb. It passed every test, because it does
  work; working and usable are different claims.

  The new ✋ button holds the button down at the pointer until tapped again, so dragging becomes grab,
  move the pointer normally, drop. It is also how a popped out window gets dragged, which was the other
  half of the same complaint.

  ⭐ Making that work needed a real fix, not just a button. The buttons bitmask has to stay set on every
  move of a drag or Foundry reads the stream as a hover, and only `dragBy` set it. A drag begun by the
  new button and then continued by ordinary pointer movement silently degraded into a hover: measured
  on a device, the button was held, the pointer glided over the token, and the token did not move.
  `applyMove` now routes on the drag STATE rather than on which method was called, so the two agree.
  Verified end to end: token x 800 to 1200.

  **Tray buttons now show their state.** Pause and grab are toggles whose "on" was invisible, which
  invites a second tap that undoes the first. Both now carry the same latched styling the modifier keys
  use, distinguished by border weight and colour rather than colour alone, plus `aria-pressed`. Pause
  also refreshes from Foundry's `pauseGame` hook, so it stays honest when a GM pauses from a laptop or
  another player's request arrives through the relay.

  The pan arrows are grouped into a cluster, since the bar had grown to four wrapped rows on a phone.

- [#31](https://github.com/LewisIsWorking/Tongs-Browser/pull/31) [`a67ae01`](https://github.com/LewisIsWorking/Tongs-Browser/commit/a67ae018bf3d6cef9545b451fcefc23f468bedb3) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#31](https://github.com/LewisIsWorking/Tongs-Browser/pull/31) [`a67ae01`](https://github.com/LewisIsWorking/Tongs-Browser/commit/a67ae018bf3d6cef9545b451fcefc23f468bedb3) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Let players pause the game, and reach every sidebar tab rather than just chat.

  **Players can pause.** Foundry's `Game#togglePause` only broadcasts
  `if (options.broadcast && game.user.isGM)`, so the permission check sits on the emit path and a
  player calling it toggles their own client alone. Macro ownership does not help either: `Macro#execute`
  runs the script client side as whoever pressed it, and core Foundry has **no** execute-as-GM at all,
  verified against the installed 14.365 where `executeAsGM`, `execute-as` and `asGM` appear nowhere in
  client or common. That feature comes from modules such as Advanced Macros.

  So a player now emits a request and one GM performs the toggle. The GM is chosen with Foundry's own
  `game.users.activeGM`, which picks the same single user on every client: without that, every
  connected GM would answer the same request and the pause state would flip once per GM. The request
  carries the desired state rather than the word "toggle", so two players tapping at once agree on an
  outcome instead of cancelling each other.

  **Every sidebar tab, not just the active one.** The sidebar button popped out whichever tab was
  active, which meant chat and nothing else, because the only way to change tabs is the docked strip
  that is 27px wide on a phone. It now opens a picker listing all thirteen tabs, built from our own DOM
  at 44px a row, and drops gmOnly tabs for players so nobody is offered a Scenes tab that would refuse
  to open.

  Measured on real Android at 412x783: the picker renders fully on screen, the Actors row is reachable
  by hit test, and picking it renders the Actors popout on screen.

- [#31](https://github.com/LewisIsWorking/Tongs-Browser/pull/31) [`a67ae01`](https://github.com/LewisIsWorking/Tongs-Browser/commit/a67ae018bf3d6cef9545b451fcefc23f468bedb3) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the sidebar button actually produce a sidebar, and add a pause button.

  The sidebar button expanded Foundry's docked sidebar, which is the obvious thing and was not good
  enough. Measured on real Android hardware at 412x783: the docked sidebar is **27 pixels wide**. It
  was there the whole time, and it is unusable with a thumb, which is why it read as missing. Toggling
  `expanded` flipped a real flag and changed nothing anyone could see.

  The button now pops the active sidebar tab out as an ordinary application window. Measured on the
  same device, the popout lands at 94,108 and is 225x566, fully on screen, and a second tap closes it.
  A window is kept inside the viewport by WindowClampBinder, so it is visible by construction rather
  than by luck. It falls back to the docked toggle on any build without the popout API.

  Adds a pause button. It looks for a macro named "Tongs Pause" first, so a GM can write one and grant
  players ownership, then falls back to Foundry's own toggle, broadcasting for a GM and locally
  otherwise.

  ⚠️ Worth knowing before relying on it: a macro **cannot** let a player pause the world, whatever its
  ownership. `Game#togglePause` only emits the socket message `if (options.broadcast && game.user.isGM)`,
  so the check is on the emit path rather than on macro permissions. A player running any macro toggles
  their own client alone. Letting players pause for everyone needs a GM side relay, which is separate
  work.

- [#31](https://github.com/LewisIsWorking/Tongs-Browser/pull/31) [`a67ae01`](https://github.com/LewisIsWorking/Tongs-Browser/commit/a67ae018bf3d6cef9545b451fcefc23f468bedb3) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

  Asked for after testing on a real device, where the sidebar could not be opened at all. Foundry auto
  collapses it below roughly 1024px into a narrow strip of icons hard against the right edge, and the
  expander is a few pixels wide, which is not a realistic touch target. The sidebar is the only route
  to chat, actors, journals and settings, so losing it costs most of the interface.

  The button sits on the bar and uses Foundry's own `ui.sidebar.toggleExpanded()`, so the caret,
  tooltip, accessible name and the `collapseSidebar` hook all stay correct rather than being faked by
  writing a CSS class. It is 44px, the touch target minimum, and it deliberately lives outside the
  collapsible keys area so it survives the bar being collapsed: "show me the sidebar" is most needed
  exactly when the bar has been shrunk out of the way.

  Tray actions are supplied by the caller rather than built into the bar, so the bar stays a bar of
  keys and knows nothing about Foundry's interface.

### Patch Changes

- [#31](https://github.com/LewisIsWorking/Tongs-Browser/pull/31) [`a67ae01`](https://github.com/LewisIsWorking/Tongs-Browser/commit/a67ae018bf3d6cef9545b451fcefc23f468bedb3) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

## 0.6.0

### Minor Changes

- [#29](https://github.com/LewisIsWorking/Tongs-Browser/pull/29) [`ba49aa8`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ba49aa883420d6abc4b47b3c92a6e1695d3f4c88) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#29](https://github.com/LewisIsWorking/Tongs-Browser/pull/29) [`ba49aa8`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ba49aa883420d6abc4b47b3c92a6e1695d3f4c88) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Let players pause the game, and reach every sidebar tab rather than just chat.

  **Players can pause.** Foundry's `Game#togglePause` only broadcasts
  `if (options.broadcast && game.user.isGM)`, so the permission check sits on the emit path and a
  player calling it toggles their own client alone. Macro ownership does not help either: `Macro#execute`
  runs the script client side as whoever pressed it, and core Foundry has **no** execute-as-GM at all,
  verified against the installed 14.365 where `executeAsGM`, `execute-as` and `asGM` appear nowhere in
  client or common. That feature comes from modules such as Advanced Macros.

  So a player now emits a request and one GM performs the toggle. The GM is chosen with Foundry's own
  `game.users.activeGM`, which picks the same single user on every client: without that, every
  connected GM would answer the same request and the pause state would flip once per GM. The request
  carries the desired state rather than the word "toggle", so two players tapping at once agree on an
  outcome instead of cancelling each other.

  **Every sidebar tab, not just the active one.** The sidebar button popped out whichever tab was
  active, which meant chat and nothing else, because the only way to change tabs is the docked strip
  that is 27px wide on a phone. It now opens a picker listing all thirteen tabs, built from our own DOM
  at 44px a row, and drops gmOnly tabs for players so nobody is offered a Scenes tab that would refuse
  to open.

  Measured on real Android at 412x783: the picker renders fully on screen, the Actors row is reachable
  by hit test, and picking it renders the Actors popout on screen.

- [#29](https://github.com/LewisIsWorking/Tongs-Browser/pull/29) [`ba49aa8`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ba49aa883420d6abc4b47b3c92a6e1695d3f4c88) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the sidebar button actually produce a sidebar, and add a pause button.

  The sidebar button expanded Foundry's docked sidebar, which is the obvious thing and was not good
  enough. Measured on real Android hardware at 412x783: the docked sidebar is **27 pixels wide**. It
  was there the whole time, and it is unusable with a thumb, which is why it read as missing. Toggling
  `expanded` flipped a real flag and changed nothing anyone could see.

  The button now pops the active sidebar tab out as an ordinary application window. Measured on the
  same device, the popout lands at 94,108 and is 225x566, fully on screen, and a second tap closes it.
  A window is kept inside the viewport by WindowClampBinder, so it is visible by construction rather
  than by luck. It falls back to the docked toggle on any build without the popout API.

  Adds a pause button. It looks for a macro named "Tongs Pause" first, so a GM can write one and grant
  players ownership, then falls back to Foundry's own toggle, broadcasting for a GM and locally
  otherwise.

  ⚠️ Worth knowing before relying on it: a macro **cannot** let a player pause the world, whatever its
  ownership. `Game#togglePause` only emits the socket message `if (options.broadcast && game.user.isGM)`,
  so the check is on the emit path rather than on macro permissions. A player running any macro toggles
  their own client alone. Letting players pause for everyone needs a GM side relay, which is separate
  work.

- [#29](https://github.com/LewisIsWorking/Tongs-Browser/pull/29) [`ba49aa8`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ba49aa883420d6abc4b47b3c92a6e1695d3f4c88) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

  Asked for after testing on a real device, where the sidebar could not be opened at all. Foundry auto
  collapses it below roughly 1024px into a narrow strip of icons hard against the right edge, and the
  expander is a few pixels wide, which is not a realistic touch target. The sidebar is the only route
  to chat, actors, journals and settings, so losing it costs most of the interface.

  The button sits on the bar and uses Foundry's own `ui.sidebar.toggleExpanded()`, so the caret,
  tooltip, accessible name and the `collapseSidebar` hook all stay correct rather than being faked by
  writing a CSS class. It is 44px, the touch target minimum, and it deliberately lives outside the
  collapsible keys area so it survives the bar being collapsed: "show me the sidebar" is most needed
  exactly when the bar has been shrunk out of the way.

  Tray actions are supplied by the caller rather than built into the bar, so the bar stays a bar of
  keys and knows nothing about Foundry's interface.

### Patch Changes

- [#29](https://github.com/LewisIsWorking/Tongs-Browser/pull/29) [`ba49aa8`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ba49aa883420d6abc4b47b3c92a6e1695d3f4c88) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

## 0.5.0

### Minor Changes

- [#27](https://github.com/LewisIsWorking/Tongs-Browser/pull/27) [`6fd42d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6fd42d19303a494485cc4a4989ace7460dada383) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#27](https://github.com/LewisIsWorking/Tongs-Browser/pull/27) [`6fd42d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6fd42d19303a494485cc4a4989ace7460dada383) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make the sidebar button actually produce a sidebar, and add a pause button.

  The sidebar button expanded Foundry's docked sidebar, which is the obvious thing and was not good
  enough. Measured on real Android hardware at 412x783: the docked sidebar is **27 pixels wide**. It
  was there the whole time, and it is unusable with a thumb, which is why it read as missing. Toggling
  `expanded` flipped a real flag and changed nothing anyone could see.

  The button now pops the active sidebar tab out as an ordinary application window. Measured on the
  same device, the popout lands at 94,108 and is 225x566, fully on screen, and a second tap closes it.
  A window is kept inside the viewport by WindowClampBinder, so it is visible by construction rather
  than by luck. It falls back to the docked toggle on any build without the popout API.

  Adds a pause button. It looks for a macro named "Tongs Pause" first, so a GM can write one and grant
  players ownership, then falls back to Foundry's own toggle, broadcasting for a GM and locally
  otherwise.

  ⚠️ Worth knowing before relying on it: a macro **cannot** let a player pause the world, whatever its
  ownership. `Game#togglePause` only emits the socket message `if (options.broadcast && game.user.isGM)`,
  so the check is on the emit path rather than on macro permissions. A player running any macro toggles
  their own client alone. Letting players pause for everyone needs a GM side relay, which is separate
  work.

- [#27](https://github.com/LewisIsWorking/Tongs-Browser/pull/27) [`6fd42d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6fd42d19303a494485cc4a4989ace7460dada383) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

  Asked for after testing on a real device, where the sidebar could not be opened at all. Foundry auto
  collapses it below roughly 1024px into a narrow strip of icons hard against the right edge, and the
  expander is a few pixels wide, which is not a realistic touch target. The sidebar is the only route
  to chat, actors, journals and settings, so losing it costs most of the interface.

  The button sits on the bar and uses Foundry's own `ui.sidebar.toggleExpanded()`, so the caret,
  tooltip, accessible name and the `collapseSidebar` hook all stay correct rather than being faked by
  writing a CSS class. It is 44px, the touch target minimum, and it deliberately lives outside the
  collapsible keys area so it survives the bar being collapsed: "show me the sidebar" is most needed
  exactly when the bar has been shrunk out of the way.

  Tray actions are supplied by the caller rather than built into the bar, so the bar stays a bar of
  keys and knows nothing about Foundry's interface.

### Patch Changes

- [#27](https://github.com/LewisIsWorking/Tongs-Browser/pull/27) [`6fd42d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6fd42d19303a494485cc4a4989ace7460dada383) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

## 0.4.0

### Minor Changes

- [#25](https://github.com/LewisIsWorking/Tongs-Browser/pull/25) [`ad62197`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ad62197dd59d41f0796c8cedb956f3153cc7169c) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix panning, which never worked, and add navigation buttons to the bar.

  **Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
  straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
  centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
  coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
  the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
  it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
  other zoom, and a phone almost never sits at 1x.

  Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
  requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
  the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
  perfectly; it now asserts the magnitude the geometry requires.

  **New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
  out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
  two finger gesture that half works is worse than a button, since you cannot tell whether you did it
  wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

  The character sheet button tries the assigned character, then a controlled token, then the only
  actor you own. It is system agnostic rather than PF2e specific, because every system renders through
  the same `Actor#sheet`.

- [#25](https://github.com/LewisIsWorking/Tongs-Browser/pull/25) [`ad62197`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ad62197dd59d41f0796c8cedb956f3153cc7169c) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

  Asked for after testing on a real device, where the sidebar could not be opened at all. Foundry auto
  collapses it below roughly 1024px into a narrow strip of icons hard against the right edge, and the
  expander is a few pixels wide, which is not a realistic touch target. The sidebar is the only route
  to chat, actors, journals and settings, so losing it costs most of the interface.

  The button sits on the bar and uses Foundry's own `ui.sidebar.toggleExpanded()`, so the caret,
  tooltip, accessible name and the `collapseSidebar` hook all stay correct rather than being faked by
  writing a CSS class. It is 44px, the touch target minimum, and it deliberately lives outside the
  collapsible keys area so it survives the bar being collapsed: "show me the sidebar" is most needed
  exactly when the bar has been shrunk out of the way.

  Tray actions are supplied by the caller rather than built into the bar, so the bar stays a bar of
  keys and knows nothing about Foundry's interface.

### Patch Changes

- [#25](https://github.com/LewisIsWorking/Tongs-Browser/pull/25) [`ad62197`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ad62197dd59d41f0796c8cedb956f3153cc7169c) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

## 0.3.0

### Minor Changes

- [#23](https://github.com/LewisIsWorking/Tongs-Browser/pull/23) [`fa93882`](https://github.com/LewisIsWorking/Tongs-Browser/commit/fa93882a64d69b228a4ea18d67a93af4be170ba6) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add a sidebar button to the bar, so the sidebar is reachable on a phone.

  Asked for after testing on a real device, where the sidebar could not be opened at all. Foundry auto
  collapses it below roughly 1024px into a narrow strip of icons hard against the right edge, and the
  expander is a few pixels wide, which is not a realistic touch target. The sidebar is the only route
  to chat, actors, journals and settings, so losing it costs most of the interface.

  The button sits on the bar and uses Foundry's own `ui.sidebar.toggleExpanded()`, so the caret,
  tooltip, accessible name and the `collapseSidebar` hook all stay correct rather than being faked by
  writing a CSS class. It is 44px, the touch target minimum, and it deliberately lives outside the
  collapsible keys area so it survives the bar being collapsed: "show me the sidebar" is most needed
  exactly when the bar has been shrunk out of the way.

  Tray actions are supplied by the caller rather than built into the bar, so the bar stays a bar of
  keys and knows nothing about Foundry's interface.

### Patch Changes

- [#23](https://github.com/LewisIsWorking/Tongs-Browser/pull/23) [`fa93882`](https://github.com/LewisIsWorking/Tongs-Browser/commit/fa93882a64d69b228a4ea18d67a93af4be170ba6) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

## 0.2.4

### Patch Changes

- [#21](https://github.com/LewisIsWorking/Tongs-Browser/pull/21) [`bbdfa46`](https://github.com/LewisIsWorking/Tongs-Browser/commit/bbdfa469e130bbda4d71ae8858a09ecebf6aec49) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Keep the modifier bar clear of Foundry's sidebar.

  Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
  at its default position covered the sidebar's icon column, which on a phone is the only route to
  chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
  remains is a narrow strip of icons, and the bar sat on top of it.

  Two halves, and only both together work. The bar now clamps its position against the room the
  sidebar leaves rather than against the whole window, and it caps its own width: the bar is
  `position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
  right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
  wider, 324 to 347, and moved the right edge not at all.

  It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
  constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
  inside a width of zero, so it had never once run against a real size.

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
