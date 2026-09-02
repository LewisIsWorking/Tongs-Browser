# tongs-browser

## 0.25.91

### Patch Changes

- [#320](https://github.com/LewisIsWorking/Tongs-Browser/pull/320) [`4bb21ec`](https://github.com/LewisIsWorking/Tongs-Browser/commit/4bb21ec70268c4ac3e75000c5128c61384a0de43) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add sheet creation: create the actor already owned, then put it in the party.

  Ownership is set in the CREATE rather than by a follow-up update, which is a measured decision.
  Foundry treats the two paths differently: an update naming another user throws, while a create
  silently deletes the entry and proceeds. Creating it already owned also means there is never a moment
  where the sheet belongs to nobody, which on a phone would read as the button having failed.

  A failed party join is a THIRD outcome rather than a failure. The sheet exists and is owned correctly;
  only the membership write failed. Calling that a failure invites a second attempt and a duplicate,
  when the action a user needs is to put it in the party.

  Ownership names only the intended owner and never `default`, which would widen what every other user
  in the world can see of that sheet.

## 0.25.90

### Patch Changes

- [#318](https://github.com/LewisIsWorking/Tongs-Browser/pull/318) [`6e3d816`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6e3d8160dd221a21a67f41dfdacdeb1582101105) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add `PartyAccess`, the one module allowed to list Foundry documents.

  It reads parties and users and filters in the same breath, which is the obligation that comes with
  being the boundary `check:documents` enforces. A party is kept only when the viewer has at least
  LIMITED on it, which is the level at which Foundry considers a name fit to show.

  It fails closed: an actor that cannot answer whether it may be seen is excluded. Foundry would not
  normally send such a document, which is exactly why the permissive version would pass every test
  anybody thought to run by hand.

  Users are deliberately not permission filtered, and that is asserted so nobody removes it: Foundry
  shows every player's name in its own interface, and who may be OFFERED is decided by
  `assignableUsers`.

## 0.25.89

### Patch Changes

- [#316](https://github.com/LewisIsWorking/Tongs-Browser/pull/316) [`ab32cb0`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ab32cb01119a73fefdd7a515803630b96eb337c8) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add the decision layer for character sheet creation: who may create, where, and for whom.

  Pure and separate from anything that touches Foundry, so the rules can be tested without standing up
  a world. `PartyAccess` will do the reaching; this is a function of its arguments.

  A GM may create in any party they can see. A player may create only where the per-party flag is on,
  and ownership of a party deliberately does not substitute for it, so "may edit this party" and "may
  add characters to it" stay separate questions.

  A player may assign only to themselves. That is measured rather than chosen: Foundry silently deletes
  an ownership entry naming anyone else when a document is created, so offering other users would look
  like it worked and hand the sheet to nobody.

  "No parties exist" and "you are not allowed" are kept distinct, because the first invites making a
  party and the second tells a player to ask their GM.

## 0.25.88

### Patch Changes

- [#314](https://github.com/LewisIsWorking/Tongs-Browser/pull/314) [`f0c08de`](https://github.com/LewisIsWorking/Tongs-Browser/commit/f0c08deeb3ea04a22257bacd3839269f06abc806) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Record how a party stores its members, read from the sf2e system's own bundle.

  Members live at `system.details.members` as `{ uuid }` entries, and `party.members` resolves them with
  `fromUuidSync`, which silently drops anything this client never received. A picker built on that
  inherits the "never show what the user cannot see" rule rather than having to implement it.

  ⚠️ `addMembers` sets `folder: null` on each new character or npc member. Joining a party takes an
  actor out of its folder, so "create the sheet, choose a party, and file it in a folder" is not
  something the system supports.

  Also removes the browser permissions probe, which never ran: reading Foundry's shipped source answered
  the same questions better, and an unrun script in `scripts/` reads as evidence somebody gathered.

## 0.25.87

### Patch Changes

- [#312](https://github.com/LewisIsWorking/Tongs-Browser/pull/312) [`3053f07`](https://github.com/LewisIsWorking/Tongs-Browser/commit/3053f07ad49a937c4e629b5f6e3496af0dc23d81) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Record what Foundry 14.366 actually enforces about ownership, read from its own server code.

  `sanitizeDocumentOwnershipField` allows a non-GM to own what they create, refuses any entry naming a
  different user, and the two refusals differ: an update throws, while a CREATE silently deletes the
  offending entry and proceeds.

  That silent path is the feature's central operation failing in the one way nothing reports. A
  player-side create assigning a sheet to somebody else would look like it worked every time, and
  surface days later as "why can't I open my character".

## 0.25.86

### Patch Changes

- [#310](https://github.com/LewisIsWorking/Tongs-Browser/pull/310) [`f07d994`](https://github.com/LewisIsWorking/Tongs-Browser/commit/f07d994bfa4a326ddc115eb6e37802c7f868f4c1) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add `check:documents`, so every listing of Foundry documents goes through one boundary.

  Groundwork for the character sheet creation feature, whose pickers will be the first place this module
  has ever listed documents. Listing is the only thing it does that can leak a name the user has no
  permission to see; everything else is about a pointer.

  The guard found something a hand grep had missed: `FoundryActions.openCharacterSheet` enumerates
  `game.actors`, and the audit that preceded it searched for `game.actors` with an unescaped dot, which
  cannot match `game?.actors`. That code is correct and is allowlisted rather than changed: it filters
  to `isOwner === true` immediately and opens a sheet only when exactly one survives.

  Also adds `docs/CHARACTER-SHEET-CREATION.md` and a read-only permissions probe.

## 0.25.85

### Patch Changes

- [#308](https://github.com/LewisIsWorking/Tongs-Browser/pull/308) [`4b0fe8e`](https://github.com/LewisIsWorking/Tongs-Browser/commit/4b0fe8e5a8087fd21dcc849399035b87390f467d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Test what the one sidebar button does in each shape of Foundry.

  `decideSidebarAction` returns five kinds and only three were ever dispatched by a test: the decision
  was covered and the carrying out was not. A phone has room for one button, so that button has to
  serve several tabs, exactly one, none with a docked sidebar, and no sidebar at all.

  A kind dispatched to the wrong branch is a button that does nothing in one configuration, and nobody
  notices until somebody plays in that configuration. Mutation checked: each of the four branches kills
  a different test.

  Project coverage to 98.39 statements and 96.71 branches.

## 0.25.84

### Patch Changes

- [#306](https://github.com/LewisIsWorking/Tongs-Browser/pull/306) [`744a241`](https://github.com/LewisIsWorking/Tongs-Browser/commit/744a241548e0131c7e43e7d43e7220dd9d49fb6a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make `describeCallSite` testable, and test what it does with an unexpected stack.

  It read its own stack, which left every fallback unreachable from a test: an absent stack, a frame the
  pattern cannot parse, and a stack with no foreign frames at all. The stack is now a defaulted
  parameter, so production is unchanged and the parsing is a pure function of its input.

  Those fallbacks are worth pinning because this function has already spent two releases reporting
  nothing useful. It filtered by source file name, and after bundling no stack contains one, so the
  filter matched nothing and it reported `at describeCallSite` - itself. It answered every time, so
  nothing looked broken, and the answer was always the same useless one.

  Mutation checked: removing the bundle filter, narrowing to one frame, dropping the unknown-caller
  fallback, or discarding an unparseable frame each fails.

  `DragCallSite` goes 70% to 90.9% of branches and 100% of statements; project branches to 96.51.

## 0.25.83

### Patch Changes

- [#304](https://github.com/LewisIsWorking/Tongs-Browser/pull/304) [`ffeab59`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ffeab59da4c4089c66eab8020fe373d16bea2e68) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Test tapping a row in the sidebar picker.

  The row handler does two things and only one is visible where the menu is built: it closes the picker
  and then pops the tab out. Losing the close leaves our own menu sitting on top of the thing it was
  asked to open, on a screen where the picker covers most of the width. Nothing throws, the tab really
  does open underneath, and the tap looks like it did nothing.

  That picker exists because Foundry's own tab strip is unusable at phone width, so these rows are the
  only route to chat, actors and the rest.

  Mutation checked: dropping the close, the pop-out, or the underlying call each fails a distinct test.

  `FoundryActions` reaches 100% of functions; project coverage to 98.19 statements and 98.52 functions.

## 0.25.82

### Patch Changes

- [#302](https://github.com/LewisIsWorking/Tongs-Browser/pull/302) [`7b81191`](https://github.com/LewisIsWorking/Tongs-Browser/commit/7b811918d894f953cb2c59f08b343d85f5d94e1c) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Remove `CanvasController.isAvailable()`, which nothing called.

  It was the worst remaining function-coverage gap, and the reason was that no caller existed anywhere
  in src, tests or scripts. It read `getCanvas()?.ready ?? false`, the same check `panBy` and `zoomBy`
  each already make inline, so keeping it meant two statements of one rule with only one of them
  reachable.

  Writing a test for it would have raised the number and locked dead code in place, which is the
  failure mode the coverage gate exists to avoid rather than cause.

  Project coverage to 98.03 statements and 98.16 functions, by deletion rather than by test.

## 0.25.81

### Patch Changes

- [#300](https://github.com/LewisIsWorking/Tongs-Browser/pull/300) [`2e2633e`](https://github.com/LewisIsWorking/Tongs-Browser/commit/2e2633ec479a097abf3db118e9854a9fdcc97abd) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Test the haptic thunk, the last uncalled wiring in `ModuleParts`.

  It has the longest chain of any of them: a touch starts a timer, the timer fires a long press, the
  long press emits a vibrate action, the controller calls the thunk, and the thunk feature-detects
  `navigator.vibrate`. Every link is somewhere else, which is why no focused suite reached it.

  The feature detection is the point rather than a formality. `lib.dom` declares `navigator.vibrate` as
  always present and it is absent on iOS entirely, so an unguarded call would throw inside the long
  press handler on every iOS hold - a broken gesture, not a missing buzz. Both the wiring and the guard
  fail when mutated.

  Also records the 2026-09-01 Android re-run: 16 passed, 3 skipped, 0 failed on a cold booted emulator,
  confirming no regression across seven released versions.

  `ModuleParts` reaches 95.45% of functions; project coverage to 97.98 statements and 97.98 functions.

## 0.25.80

### Patch Changes

- [#298](https://github.com/LewisIsWorking/Tongs-Browser/pull/298) [`564b24d`](https://github.com/LewisIsWorking/Tongs-Browser/commit/564b24d4b4c22d32c05cf3beef88b3518b4d43ac) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Test the zoom limit thunk, reached only by a pinch.

  `getZoomLimits` was the last of the four `ModuleParts` canvas thunks with no caller: the pan suite
  reaches the other three, and only `zoomBy` asks for the limits. The clamp it feeds is what stops a
  pinch driving the scale to a value Foundry refuses, after which the canvas ignores zoom entirely
  until the scene is reloaded.

  Asserts the ceiling, the floor, and that both are read from Foundry's published config rather than
  carried as constants: two runs with different maxima must land on different ceilings. Hardcoding the
  limits fails three of the four tests.

  `ModuleParts` goes to 90.9% of functions; project coverage to 97.93 statements and 96.12 branches.

## 0.25.79

### Patch Changes

- [#296](https://github.com/LewisIsWorking/Tongs-Browser/pull/296) [`4346f24`](https://github.com/LewisIsWorking/Tongs-Browser/commit/4346f24f9c4eb472e538db1de2580f10a81e8a6a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Test what a later `attach` must not undo in the drag observers.

  `attach` retries until Foundry exists, so it runs against a Foundry that is sometimes there and
  sometimes not. Without the early return in `hookDragEndings`, a later attach re-runs the installer
  against whatever is present now and assigns that over `hooksInstalled`: a scene change or a
  deselected token is enough to make it false, and the report would then state the hooks were never
  installed while they were installed and working.

  The guard is also deliberately narrow, firing only when both are installed, because the manager
  prototype is unreachable until a token has been selected. Mutation checked: removing the guard fails,
  and widening it to `||` fails the partial-install case.

  Project coverage to 97.88 statements and 96.02 branches.

## 0.25.78

### Patch Changes

- [#294](https://github.com/LewisIsWorking/Tongs-Browser/pull/294) [`f34430f`](https://github.com/LewisIsWorking/Tongs-Browser/commit/f34430f7e13504a2ac963d1ed5c97533f8643362) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Cover the two worst branch gaps, both of which hide something silently.

  The timeline heading only says how many entries it dropped on one side of a ternary, and that side
  was never taken. A trimmed timeline that does not say so reads as a complete account of the gesture,
  so the reader concludes a button press never happened rather than that it scrolled off.

  `maskForButton` never took its MIDDLE case. `button` counts LEFT 0, MIDDLE 1, RIGHT 2 while the
  `buttons` bitmask is LEFT 1, RIGHT 2, MIDDLE 4, so the obvious `1 << button` swaps middle and right
  invisibly for anyone testing with a left click. The table is pinned, along with an assertion that the
  mapping is not a bit shift.

  Project coverage to 97.83 statements and 95.82 branches.

## 0.25.77

### Patch Changes

- [#292](https://github.com/LewisIsWorking/Tongs-Browser/pull/292) [`b8a6b72`](https://github.com/LewisIsWorking/Tongs-Browser/commit/b8a6b721bb7b8bcd1188526f1ad93f1e4658c556) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Cover three accessors by asserting the state they observe.

  `UiScaler.isApplied` gates whether `setScale` writes to the document at all, which is what lets the
  module leave Foundry's layout untouched while it is switched off. `ExclusionZones.getSelector` now
  pins a live audit finding: `#chat-log` matched nothing on 14.365 because the log is a class in that
  markup, and the class form reads as a redundant duplicate without a test saying otherwise.
  `CursorOverlay.setVisible` hides rather than rebuilds, so re-showing does not move the pointer to a
  stale coordinate.

  Mutation checked: all four mutations kill a test.

  Project coverage to 97.77 statements and 97.61 functions.

## 0.25.76

### Patch Changes

- [#290](https://github.com/LewisIsWorking/Tongs-Browser/pull/290) [`19875e9`](https://github.com/LewisIsWorking/Tongs-Browser/commit/19875e954cedb054d0c8eba11c9ca5a821137e8c) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Test binding and unbinding the scene control, which the injection suite never exercised.

  The existing suite calls `inject` directly, so every question about the button's content was answered
  and none about whether it is ever asked for. Foundry builds the scene controls exactly once, so a
  hook registered late has already missed the only call it will get: measured on 14.365, a listener
  added at `ready` fired zero times and the button never existed.

  Unbinding is asserted by id as well as hook name, because passing the wrong id silently leaves the
  listener installed. Mutation checked: all five mutations kill a test.

  `SceneControlToggle` reaches 100% of statements, functions and lines; project coverage to 97.57
  statements and 96.88 functions.

## 0.25.75

### Patch Changes

- [#288](https://github.com/LewisIsWorking/Tongs-Browser/pull/288) [`b2f34c9`](https://github.com/LewisIsWorking/Tongs-Browser/commit/b2f34c953521c6b2866e2201388d4e7a3fbbbf97) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Test the two `DragDiagnostics` callbacks, both of which lose a diagnostic silently when unwired.

  `onObservation` carries what Foundry did into the journal, which is the one place a Foundry action
  sits beside the button press that caused it. `fallback` is the last resort when there is no chat to
  whisper into, and chat is the only diagnostic channel a phone has.

  The report renders either way, so a lost input looks exactly like a quiet session. Mutation checked:
  dropping either callback, or the no-game guard, fails.

  `DragDiagnostics` reaches 100% of statements, functions and lines; project coverage to 97.26
  statements and 96.51 functions.

## 0.25.74

### Patch Changes

- [#286](https://github.com/LewisIsWorking/Tongs-Browser/pull/286) [`ae7dde9`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ae7dde9d7df160bb7fe4f5fc676edf72f4e1b57d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Test a two finger pan all the way from touch to `canvas.pan`.

  The four canvas thunks in `ModuleParts` were never called by any test. They are the last link in the
  pan chain, and the controller they feed records a measured failure on a live 14.365 where a +120,+120
  drag put the pivot at (-1940, -980), with the warning that "leaving either conversion out breaks it
  in a way that still looks plausible".

  Both conversions are now asserted through a real touch sequence: panning relative to the pivot rather
  than the origin, and dividing the screen delta by the live scale, the latter by comparing two runs so
  that half the scale must move the pivot twice as far. Dropping either conversion, or nulling either
  thunk, fails.

  `ModuleParts` goes 77.27% to 86.36% of functions; project coverage to 97.15 statements, 96.14
  functions.

## 0.25.73

### Patch Changes

- [#283](https://github.com/LewisIsWorking/Tongs-Browser/pull/283) [`4fc1fa8`](https://github.com/LewisIsWorking/Tongs-Browser/commit/4fc1fa8931ccaea0470862ebbb7cffed658e1adf) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Test that the window clamp binder actually binds.

  The existing suite covers `clampAll` thoroughly and calls it by hand every time. In a real session
  nothing does: Foundry renders a window and the render hook is the only thing that notices. The
  clamping was covered and the binding was not, and a binder that clamps perfectly but never runs is
  indistinguishable from no binder at all.

  Asserts registration for both application generations, clamping of what is already on screen and of
  what renders later, the double-bind guard, and that unbinding leaves it able to bind again. Mutation
  checked: all six mutations kill a test.

  The two window helpers moved into a shared fixture rather than being copied, since the jsdom layout
  workaround they carry is load bearing.

- [#285](https://github.com/LewisIsWorking/Tongs-Browser/pull/285) [`71032d1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/71032d1d8288aaeccbf2a6640e8d1358fffb8ae6) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Record that a warm emulator fails the tap check on a correct module.

  Re-running `check:android` a day after the first successful run produced a failure on the module's
  central premise: tap clicks at the pointer rather than under the finger. It was reproducible, four
  times.

  It is not a regression, and that was established rather than argued: `v0.25.68`, the exact build that
  had passed, was checked out, rebuilt and re-run, and failed identically. Cold booting the emulator
  fixed it outright, twice in a row, with nothing else changed.

  Cold boot the emulator before any run whose result you intend to record. A warm one manufactures a
  false failure on the most important check in the suite, which is the kind of red that gets a correct
  module "fixed".

## 0.25.72

### Patch Changes

- [#281](https://github.com/LewisIsWorking/Tongs-Browser/pull/281) [`17f17f7`](https://github.com/LewisIsWorking/Tongs-Browser/commit/17f17f784520a50f28e10cfbe7e2cf6453cf1a6a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Test the three callbacks `main.ts` hands out and nothing invoked.

  All three are read live rather than captured, which is what lets a setting take effect without a
  reload, and is also why none of them ran at startup and none was reached by a test that only booted
  the module.

  The suppressor's `enabled` predicate is an AND of two settings, and getting it wrong is not cosmetic:
  suppressing while the module is OFF eats touch events Foundry needs, for a user who most likely
  switched it off because something was misbehaving. The truth table is now asserted in full, and
  `&&` becoming `||` fails.

  `main.ts` goes 50% to 90% of functions, project coverage to 96.84 statements and 95.41 functions.

## 0.25.71

### Patch Changes

- [#279](https://github.com/LewisIsWorking/Tongs-Browser/pull/279) [`933e1a9`](https://github.com/LewisIsWorking/Tongs-Browser/commit/933e1a96ecf3d5a9bd9610344fb6a80e24a13f91) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix a scene control toggle that could not be switched off before `ready`.

  `isActive` fell back to the stored setting; `onToggle` did not. So before `ready` builds the instance,
  the button reported ON from the store and a tap computed `!(undefined ?? false)` and wrote `true`
  again. The two callbacks disagreed about where the truth lives. Behaviour is identical once the
  instance exists, which is how it survived.

  Found by invoking the callback rather than asserting the hook was registered, which is all the
  existing suite did.

  Also corrects date stamps written earlier in this session. Work done on 2026-08-30 was stamped
  2026-08-22 across fifteen files, including the record of the first Android run. A dated measurement
  is only worth having if the date is right.

## 0.25.70

### Patch Changes

- [#277](https://github.com/LewisIsWorking/Tongs-Browser/pull/277) [`41fc199`](https://github.com/LewisIsWorking/Tongs-Browser/commit/41fc1997c4d7e1f516c82f4bd34a60978ab3c351) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Test the settings surface, which no test called.

  `main.ts` registers a Foundry setting for each of `setUiScale`, `setCursorSize`, `setDebugOverlay`,
  `setModifierBarVisible`, `updateGestureConfig`, `refreshTray` and `getKeyboardStrategy`, and nothing
  else calls them. An unexercised one is a setting that silently does nothing, or does half of what it
  says.

  Half was the real risk: `setUiScale` also re-clamps because a scale change moves where every window
  sits, and `setModifierBarVisible` also probes the keyboard on show and releases held modifiers on
  hide. A test checking only the obvious effect would pass with the second one deleted.

  Mutation checked line by line: dropping the re-clamp, the probe, the attach, the detach, the cursor
  resize or the scale apply each kills a test.

  Project coverage 96.12 to 96.59 statements, 93.57 to 94.49 functions.

## 0.25.69

### Patch Changes

- [#274](https://github.com/LewisIsWorking/Tongs-Browser/pull/274) [`045d9d7`](https://github.com/LewisIsWorking/Tongs-Browser/commit/045d9d7c425f31a25ef6ceeb725223816745a69c) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Make coverage a gate, and record the first harnessed Android run.

  Coverage was measured and never enforced. `test:coverage` existed and neither `verify` nor CI ran it,
  so the figure appeared only when somebody typed the command. Thresholds are now on with
  `autoUpdate`, which makes them a ratchet: they rise when coverage rises and fail when it falls. The
  target is 100%; the seeded mark is 95.66% statements, 93.21% functions.

  `npm run check:android` ran against real Android for the first time, on an emulator: 16 passed, 3
  skipped, 0 failed. Foundry honours synthesised keyboard events on Android (`events`), measured twice
  independently. Tap-clicks-at-the-pointer verified on real touch hardware. The three skips are hover,
  which Chrome 133 cannot express from any scripted event, module bypassed or not.

- [#276](https://github.com/LewisIsWorking/Tongs-Browser/pull/276) [`6bd3c4d`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6bd3c4d479d3e12af0eec94bd74d105bd39d6e65) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Test the wiring thunks in `buildModuleParts`, which nothing called.

  `ModuleParts`' own docblock says every reference a part takes back to the module is a thunk, and that
  taking one eagerly captures `undefined` and fails at the first tap. Seven of those thunks were never
  invoked by any test, so the claim was documented and unverified.

  The new suite exercises the binder's fan-out to both the diagnostics counter and the gesture layer,
  the pointer stack's dispatch fan-out to both recorders, and the default native-touch suppression that
  every other test overrides. Mutation checked: dropping each of the three wires kills a test.

  Coverage of `ModuleParts` goes 68.18% to 77.27% of functions, and the project ratchet tightens to
  96.12/94.03/93.57/96.08.

## 0.25.68

### Patch Changes

- [#270](https://github.com/LewisIsWorking/Tongs-Browser/pull/270) [`c2c3e24`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c2c3e24c4650443235da2cfecb8ed2b58161c9e5) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - `check:support` could not see a fixture that had just been written, and now no guard can regress that
  way unnoticed.

  `git ls-files` reports tracked files only, so a file created moments ago is invisible until staged.
  That is exactly the case this guard exists for: the moment somebody is most likely to extract a
  fixture and forget to adopt it is the moment they have just written it. Demonstrated before fixing,
  an unadopted fixture sitting in `tests/dom/support/` produced "All 9 shared test fixture(s) are
  imported somewhere".

  The blind spot was found in `check:sizes` on 2026-08-18 and fixed in two guards, and the lesson was
  written down as "a blind spot found in one guard is worth looking for in every guard that shares the
  technique". It was not acted on, and `check:support` still had it four days later. A lesson recorded
  in prose did not survive, so it is now a test: every guard must be able to see an unstaged file, and
  one that calls `git ls-files` directly has to ask for `--others --exclude-standard`.

  ⚠️ That test failed on its first run against two guards which only MENTION `ls-files` in a comment
  about this very blind spot. A comment is not a caller, which is also already written down. It strips
  comments first now.

- [#271](https://github.com/LewisIsWorking/Tongs-Browser/pull/271) [`55811d0`](https://github.com/LewisIsWorking/Tongs-Browser/commit/55811d0b267a9dc8db66d8e603eac9de997c65c5) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Run the self-tests that two guards had implemented but nothing invoked.

  `check-orphaned-docblocks.ts` and `check-scripts-load.ts` both shipped a `--self-test`, and neither
  `npm run verify` nor CI ever passed the flag. The docblock guard went further and claimed
  "PROVEN: `npm run lint:docblocks -- --self-test`", a proof that only existed in the commit that
  wrote it.

  Measured with the docblock predicate stubbed to `return []`: unwired it printed "No orphaned
  docblocks across 319 files" and exited 0. Wired, it exits 1.

  `tests/unit/guardSelfTests.test.ts` now requires that a guard implementing a self-test has an npm
  script that runs it, and that the script still runs the guard against the repo afterwards - the
  self-test exits 0 on its own, so wiring it in alone would be worse than not wiring it at all.

- [#272](https://github.com/LewisIsWorking/Tongs-Browser/pull/272) [`f5f0e32`](https://github.com/LewisIsWorking/Tongs-Browser/commit/f5f0e323f7d1512f8037750217dde09c0a85364c) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix the update path, which could never have fired.

  The manifest's `manifest` field pointed at `raw.githubusercontent.com/.../main/module.json`. Foundry
  polls that URL and compares its `version` against the installed one, and the copy on `main` is
  deliberately left at the `0.1.0` placeholder because only the copy inside `module.zip` is stamped.
  Every install since v0.2.1 has therefore polled a file that says `0.1.0` and concluded there was
  nothing newer.

  Measured 2026-08-30 against the live URLs: the shipped zip reported `0.25.67`, its own manifest URL
  reported `0.1.0`.

  - `manifest` now points at `releases/latest/download/module.json`.
  - The release workflow attaches the stamped `module.json` as an asset, in both the release job and
    the manual attach job. Without that asset the new URL would 404.
  - `stamp-manifest.ts` refuses to stamp a manifest whose poll URL points at an unstamped source.
  - The README's install URL pointed at the same placeholder file, and its status line claimed the
    module had never been run against a real Foundry instance, which stopped being true on 2026-08-20.

- [#268](https://github.com/LewisIsWorking/Tongs-Browser/pull/268) [`03f75c1`](https://github.com/LewisIsWorking/Tongs-Browser/commit/03f75c1e88e2b9be194a7ca8407cd40a39b14c8c) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Switching the module off has ordering rules, and now they are asserted.

  Disabling is not "stop listening". Foundry keeps whatever state the module put it in, so a drag in
  progress, a latched modifier and a scaled interface all outlive the module unless teardown deals with
  them. Each is invisible afterwards, because the module is off and there is nothing left to blame.

  Now covered: a drag in progress is abandoned rather than left with Foundry believing a button is
  still held, and the interface is given back by removing the scale property rather than overriding it
  with a 1 that merely looks the same. Both fail when broken.

  ⚠️ Removing `disable`'s early return fails nothing, and that is recorded in the test rather than
  chased. Every teardown step is already idempotent, so the guard changes nothing observable: an
  equivalent mutant rather than a hole. The test beside it still earns its place, because it fails if
  `disable` stops clearing its own flag, which would leave the module unable to be switched back on.

  `TongsBrowser.ts` 82.5% to 84.2% statements and 75% to 83.3% of branches; the project reaches 95.7%.

## 0.25.67

### Patch Changes

- [#265](https://github.com/LewisIsWorking/Tongs-Browser/pull/265) [`f831f42`](https://github.com/LewisIsWorking/Tongs-Browser/commit/f831f423095bda1a702e2c50bf32c3856a01e892) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - `ExclusionZones` answers three questions about an element, and only one of them had tests.

  `isExcluded` says "not ours to touch". `isOwnInterface` says "this is our own furniture".
  `needsNativePointerEvents` says "ours, and it still needs the browser's real events". They are not
  opposites and they do not nest in the obvious way: chat is excluded and is not ours, the bar is ours
  and is also excluded, and the drag handle is all three.

  Treating any two as one has produced a real bug each time, and both edges of the narrowest one
  shipped. Suppression over our own bar is what makes tapping DROP work at all, because a finger's
  `pointerup` reaching PIXI ends in `#handleDragCancel` and throws away a held drag. But the suppressor
  stops events at the window, so "PIXI must not see it" became "nobody sees it" and the bar's own drag
  handle stopped receiving the `pointerdown` it is built on, reported as "I can't move the tongs toolbox
  now".

  So the carve-out has to be exactly the handle: any wider and DROP breaks, any narrower and the bar
  cannot be moved. Both directions now fail a test, along with collapsing "ours" into "excluded".

  `ExclusionZones.ts` 78.6% to 92.9% statements and 100% branches; the project reaches 95.5%.

- [#267](https://github.com/LewisIsWorking/Tongs-Browser/pull/267) [`f0db3a8`](https://github.com/LewisIsWorking/Tongs-Browser/commit/f0db3a8f309b94b5949287311227bb56fbc79e6d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - The bar's collapsed state is written back to settings and read at startup, and now a test says so.

  `onCollapsedChanged` was once typed on the options with nothing joining it to the settings store, so
  the state was applied at startup and then silently forgotten. Changing a default is not finished when
  the value changes; it is finished when the value survives a reload.

  The bar reporting a change was already covered. What was not covered is `main.ts` writing that report
  to the store and reading it back on the next launch, which is exactly the half that went missing.
  Deleting either direction now fails a test.

  `main.ts` 83.3% to 86.1% statements and 40% to 50% of functions; the project reaches 95.6%.

## 0.25.66

### Patch Changes

- [#262](https://github.com/LewisIsWorking/Tongs-Browser/pull/262) [`c8f5e15`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c8f5e1500ebdbd4519e781d9415edd6b07a956d2) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - `DragDiagnostics` was 73% covered with 50% of branches, and the untested part was the wiring between
  its three pieces rather than any of the pieces themselves.

  The journal that records causes, the recorder that measures, and the observers that watch Foundry are
  each covered on their own. Nothing covered whether they are connected correctly, which is where a
  silent failure lives: every component stays green while the report loses the entries that make it
  worth reading.

  Now asserted: a dispatch reaches both the measurements and the timeline, raw gesture input reaches the
  timeline, and a tray press is recorded. That last one matters most, because a control the user touched
  is the single most useful entry in the whole report and it is the one class of entry a snapshot can
  never reconstruct. Also that reporting with no Foundry present returns quietly instead of throwing,
  since it runs on a phone at the moment somebody is already investigating a failure.

  ⚠️ One test was removed before it was ever committed. It ended in `expect(...).toBeDefined()`, which
  cannot fail, because this class exposes no way to read the observers' resize count without a live
  Foundry to build a report against. The rule it would have covered is asserted where it can actually be
  checked, in the observers' own suite. A second weaker version here would have added a passing line and
  no protection.

  `src/debug` reaches 98.9% statements and 96.5% branches; the project 95.1% to 95.4%.

## 0.25.65

### Patch Changes

- [#260](https://github.com/LewisIsWorking/Tongs-Browser/pull/260) [`2b2fb4b`](https://github.com/LewisIsWorking/Tongs-Browser/commit/2b2fb4b54b4491c01b2021221686688e70b6415f) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - `DragRecorder` was 81% covered with 55% of branches, and the untested part was the denominator every
  other number in a drag report is judged against.

  `describeThinly` refuses to state a peak sampled under 10% of the moves dispatched, so if that count
  is wrong every probe is declared thin and the whole report becomes unusable. A report of "2 samples
  of 227 moves" was once counting hundreds of moves that happened after the drag it described.

  Now asserted: moves are counted during a drag, not after it ends, and not when no drag has started at
  all. Also that a missing token records no grab position rather than a misleading zero, that raw touch
  counts accumulate rather than reset, and that the movement verdict compares the grab position against
  the position now.

  ⚠️ The most important test did not work on the first attempt, and mutation checking is the only
  reason that is known. "Stops counting once the drag has ended" passed with the guard deleted, because
  after a drop the capture window freezes and the recorder returns early, so that path never reaches
  the counter. The case where the guard is load bearing is a move with no drag ever started, which is
  constant on a phone between gestures. That case is now covered and the mutation fails.

  `DragRecorder.ts` 81% to 96.9% statements and 55% to 95% branches; the project 94.9% to 95.1%.

## 0.25.64

### Patch Changes

- [#258](https://github.com/LewisIsWorking/Tongs-Browser/pull/258) [`4e1101a`](https://github.com/LewisIsWorking/Tongs-Browser/commit/4e1101a71a14d58d4c37f4529b15d60d522273d9) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - `DragObservers` was 75% covered with 33% of branches, and the untested half was the counting rules
  rather than the wiring. Those rules decide whether the numbers in a diagnostic report describe the
  drag being investigated or the one before it.

  Now asserted: resizes are counted only while a drag is open, the listener is already running before
  any drag begins (one added at the grab would miss a resize caused by the grab, which is the case
  under suspicion), and every counter is cleared when a fresh drag opens. Attaching before Foundry
  exists reports the hooks as not installed rather than claiming success, and can be retried, which is
  the normal case.

  ⚠️ One test was rewritten after mutation checking showed it could not fail. "Starts with no drag
  endings recorded" asserted an empty list on a fresh observer, which is empty whether or not
  `beginDrag` clears anything. It now produces a real ending first by installing the hooks against a
  stand-in Foundry, which also proves the wrapping reaches its observation sink at all.

  `DragObservers.ts` 75% to 96.6%, `src/debug` to 97%, the project 94.6% to 94.9%.

## 0.25.63

### Patch Changes

- [#257](https://github.com/LewisIsWorking/Tongs-Browser/pull/257) [`a7f90e3`](https://github.com/LewisIsWorking/Tongs-Browser/commit/a7f90e310bb8388d8f0ee19f04edd5eaf5a84443) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - `DebugOverlay` was 40% covered, and it is a probe, so the untested half mattered more than usual.

  It draws an outline around whatever the pointer resolved to, because when a tap does nothing there is
  no way to tell from the screen whether the pointer resolved the wrong element, resolved the right one
  and the event was ignored, or never dispatched at all.

  The tests are about it not changing what it measures. It must not be hit testable, or it becomes the
  answer to every hit test the moment it is drawn and the thing being diagnosed stops working while
  being diagnosed. It must draw and log nothing while switched off. And it must never leave a stale
  rectangle pointing at an element the pointer has since left, which quietly contradicts the pointer
  during exactly the investigation it exists to help.

  Each of those turns a test red when broken.

  ⚠️ A fourth test was written and then deleted. Mutation checking showed "enabling twice does not
  attach two outlines" passed with the guard removed, because `append` moves an element already in the
  document rather than duplicating it, so a second outline is impossible either way. A test that cannot
  fail still counts, still runs and still reads like protection, so its absence is now recorded in the
  file instead.

  `DebugOverlay.ts` 40% to 97.6%, `src/debug` to 95.7%, the project 93.1% to 94.6%.

- [#256](https://github.com/LewisIsWorking/Tongs-Browser/pull/256) [`3a9fd24`](https://github.com/LewisIsWorking/Tongs-Browser/commit/3a9fd2418e9beab7b3e9908e2af0af282b50d3f3) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Six dead exports removed, and a guard so they cannot accumulate again.

  Three files in a row were opened because coverage was low, and each time the uncovered part was an
  exported value nothing called. Coverage was the only thing pointing at any of it, and it answers the
  wrong question: "untested" and "unreachable" need completely different work.

  A sweep found ten. Six were unreachable and are gone (`findKey`, `hasAnyModifier`, `withButtons`,
  `isButtonHeld`, `withButtonHeld`, and `ALL_KEYS`, which the typechecker exposed as dead by cascade
  once `findKey` went). Four were live but over-exported and simply lost the `export` keyword.

  `check:exports` now fails on an exported value nothing outside its file mentions, and distinguishes
  the two cases, because "delete it" and "drop the export" are different fixes. It judges `src/` only,
  and values only: including types produced 64 findings of which most were correct code, since an
  `Options` interface is normally named only in its own file. Restricting to values produced 10, and
  all 10 were real.

  Proved by feeding it the bug: putting `isButtonHeld` back is reported by name with the right remedy.
  The module bundle is 0.4 kB smaller.

  Also: `check:readmes` now sees untracked folders. The size guard had this blind spot fixed a day
  earlier and this one was left behind, so a folder created moments before passed locally and failed in
  CI. A blind spot found in one guard is worth looking for in every guard that shares the technique.

- [#253](https://github.com/LewisIsWorking/Tongs-Browser/pull/253) [`e7301e4`](https://github.com/LewisIsWorking/Tongs-Browser/commit/e7301e470dd2691d329d6328da56d09627e0a880) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - `FoundryAccess` was 54% covered, and the uncovered half was the whole point of the file.

  Every method opens with `typeof x === 'undefined'`, and its docblock claims that is not redundant with
  the declared type: a global Foundry has never defined throws a **ReferenceError** on plain access, and
  an optional chain does not help, because the reference itself is what throws.

  That claim is now proven rather than asserted. Replacing the guard with the tidier-looking
  `game?.keyboard ?? null` turns a test red with exactly the predicted
  `ReferenceError: game is not defined`. Without that, the guards read as defensive clutter and the
  obvious tidy-up compiles, looks cleaner, and throws anywhere Foundry has not booted.

  The tests `delete` the globals rather than setting them to undefined, because those are different
  states: a declared-but-undefined global is safe to reference, an undeclared one throws, and only the
  second reproduces what the guards exist for.

  `FoundryAccess.ts` 54% to 100% statements, `src/foundry` to 90.3%, the project 92.3% to 92.6%.

- [#255](https://github.com/LewisIsWorking/Tongs-Browser/pull/255) [`1f34640`](https://github.com/LewisIsWorking/Tongs-Browser/commit/1f34640a0f7d4fc5460fafd65f106d9c172a8654) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - `FoundryActions` was 60% covered, and the untested part was the wiring rather than the decisions.

  Every decision the tray buttons make already lives in its own tested module. What nothing covered was
  whether each decision reaches the effect it names, which is exactly where a regression is silent: the
  decision modules stay green while the button does nothing, or does the wrong thing.

  Three mutations, each a plausible edit, now turn a test red:

  - dropping the relay branch, which makes a player's pause button do nothing at all. Foundry's
    `Game#togglePause` only emits `if (options.broadcast && game.user.isGM)`, so a player toggling
    locally changes nobody else's client, and macro ownership cannot fix it because the check is on the
    emit path.
  - letting `closeMenu` fall through to `openMenu`, which leaves a picker that cannot be dismissed. On a
    phone there is no click elsewhere to close it.
  - replacing the designated-GM check with "am I a GM", which has every connected GM act on one relayed
    request, flipping the pause once per GM and landing wherever the race ends.

  `src/foundry` goes to 95.8% statements and 97.1% branches; the project 92.6% to 93.1%.

  Also: the size guard could not see the file that broke it. It listed tracked files only, so a newly
  written file was invisible until staged, and `npm run verify` gave a false green on precisely the
  case the limit exists for. It now includes untracked, non-ignored files, proven by feeding it a 210
  line file that had never been added to git. That change immediately caught the guard itself at 203
  lines, so its file listing is now its own module.

## 0.25.62

### Patch Changes

- [#251](https://github.com/LewisIsWorking/Tongs-Browser/pull/251) [`553333d`](https://github.com/LewisIsWorking/Tongs-Browser/commit/553333dc9722e9d85e18b249b60abc82c69cc568) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Five guards were not running in CI, including the 200 line limit.

  The CI job ran `lint`, `typecheck`, `test` and `build`. It did not run `check:sizes`,
  `check:readmes`, `check:scripts`, `check:support` or `typecheck:scripts`, all of which exist only
  inside `npm run verify` and were therefore enforced nowhere except a developer's memory. A 232 line
  test file merged green, which is how it was noticed.

  CI now runs `npm run verify`, naming the composite script rather than re-listing its parts, so a
  guard added to `verify` is a guard CI runs.

  Also removes `onNativePointer` from `TouchBinder`, which could never fire: it was in the handler
  union, implemented, and wired into `bind()`'s lookup table, but no listener spec named it, so it was
  never registered. The suppression it appeared to perform genuinely lives in `NativePointerSuppressor`,
  bound on the window because PIXI binds there first. A test now asserts the handler names and the specs
  match in both directions.

  Coverage: `SettledStates.ts` 61% to 88.9% statements and 50% to 90% branches, covering the
  interruptions a tablet produces rather than the ordinary path; `TouchBinder.ts` 76% to 92.7%; the
  project 91.3% to 92.3%.

## 0.25.61

### Patch Changes

- [#248](https://github.com/LewisIsWorking/Tongs-Browser/pull/248) [`8766fba`](https://github.com/LewisIsWorking/Tongs-Browser/commit/8766fba56218375e19cff7838a7fea8d4d93a451) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - The play probe's native control could not select a token, and nothing could have noticed.

  The control is what decides whether a pointer failure reads as "the module is broken" or "cannot
  tell". It only runs when a pointer path is unreliable, so with every pointer path passing it had not
  executed in months. Exercised by hand it failed outright: it pressed with Foundry's interaction
  manager still at `NONE`, because it never moved the pointer first, and
  `MouseInteractionManager#handleLeftDown` returns unless the state is at least `HOVER`.

  A broken control turns every real regression into `inconclusive`. The safety net had a hole in exactly
  the place it would be needed.

  Measured by bisection on a live 14.366: click alone leaves state 0 and selects nothing; one plain
  `pointermove` first takes state to 1 and selects. `pressure`, `width`, `height` and a reserved
  `pointerId` make no difference, though they were the obvious suspects.

  `PROBE_FORCE_CONTROL=1` now runs both paths every time, so the control is observable on demand rather
  than only in the moment it is being relied upon. Using it immediately exposed a second defect:
  `describeControl` announced `reliable -> OUR GAP` from the control alone, assuming a control had only
  run because the pointer failed, so five rows with a working pointer and a working control were all
  labelled our gap. `findGaps` checks both halves and was always right, so the exit code never lied.

  A test had been pinning that behaviour: its name said "the pointer was not reliable" while it handed
  over three passing pointer trials.

- [#250](https://github.com/LewisIsWorking/Tongs-Browser/pull/250) [`3b53dc5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/3b53dc5f2e30e98b9e05f5c886049f5ace3d7c51) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - The entry point had no tests at all.

  `src/main.ts` was at 0% coverage, and it is the file that decides whether the module loads. Every
  failure it can have is silent and total: no settings, no scene control, no API, and a console that
  says nothing unusual. Nothing short of a live run would have caught one.

  Nine tests now cover it, asserting outcomes a regression would break rather than that particular
  functions were called. The most valuable is a regression test for a bug that shipped: the scene
  control must be bound at `init`, not `ready`, because Foundry builds its controls exactly once and a
  listener added later has already missed it. Measured on 14.365, the button simply never existed and
  nothing logged.

  Every test was mutation checked. Moving `toggle.bind()` to `ready`, dropping `moduleEntry.api`,
  inverting the enabled check, and cutting the settings change off from the instance each turn a test
  red. `main.ts` goes from 0% to 80.6%, `src/` from 65% to 84%, the project from 89.7% to 91.3%.

## 0.25.60

### Patch Changes

- [#247](https://github.com/LewisIsWorking/Tongs-Browser/pull/247) [`61ca1c4`](https://github.com/LewisIsWorking/Tongs-Browser/commit/61ca1c4e08393774bcc8b51f31033cecfc549914) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Every source folder is now documented: 26 of 26, backlog empty.

  The last seven are `src`, `scripts`, `tests/unit`, `tests/dom`, `tests/browser`, and the two
  `support/` folders. Each names its own files, so the guard accepts them, and each records why the
  folder is arranged the way it is rather than listing what is in it: why the composition root is
  separate from the parts, why flags go through `node` rather than `npm run ... --`, what jsdom can and
  cannot tell you, and why shared fixtures have their adoption enforced.

  The backlog mechanism stays in place. It can only shrink, so a new folder cannot be born onto it, and
  `node scripts/check-folder-readmes.ts` now reports `0 still on the backlog` rather than a count that
  needed working through.

- [#241](https://github.com/LewisIsWorking/Tongs-Browser/pull/241) [`2083b06`](https://github.com/LewisIsWorking/Tongs-Browser/commit/2083b069c130e21115488642bb38a3c3cbf30d60) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Every folder holding source has to say what it is for, and boilerplate does not count.

  `check:readmes` requires each source folder to carry a README that **names at least one file that
  genuinely lives in it**. Existence alone was deliberately not the rule: a guard that checks only for
  the file asks twenty-six folders for one and gets twenty-six files saying "This folder contains
  helpers", after which the check is green forever and nobody has learned anything. Naming a file is
  cheap to satisfy honestly and impossible to satisfy with boilerplate, because the filenames differ per
  folder.

  Proved by feeding it the bug: a filler README replacing `scripts/probe`'s is rejected by name, and the
  same rule is covered by unit tests and by a self test wired into the command so it actually runs.

  Folders not yet documented sit in a backlog that can only shrink, the same discipline as the file size
  ratchet and for the same reason: the rule arrived long after the code, and demanding twenty-five
  READMEs in one commit is how filler gets written. Six of twenty-six are done, starting with the ones
  whose lessons were expensive: `scripts/foundry`, `scripts/probe`, `scripts/sizes`, `scripts/readmes`,
  `scripts/drag` and `src/gesture`.

  Seeding it found a bug in the guard itself. A root level file has no `/`, and `slice(0, -1)` shaves a
  character off rather than returning an empty string, so the first backlog listed three folders named
  `playwright.config.t`, `vite.config.t` and `vitest.config.t`.

- [#244](https://github.com/LewisIsWorking/Tongs-Browser/pull/244) [`860a7a5`](https://github.com/LewisIsWorking/Tongs-Browser/commit/860a7a5550d6b1564f66cd3ff4b636deb0db8bd4) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Five more folders documented: `src/foundry`, `src/core`, `scripts/touch`, `scripts/live`,
  `scripts/android`. Fifteen of twenty-six now carry a README that names its own files.

  Each records why the folder is shaped as it is: why the Foundry dependency surface is a folder rather
  than scattered `game.` references, why the long press guard must be armed after the sequence rather
  than before, why the touch checks and the drag check deliberately cover different halves, why the
  scene control is asserted as registered, rendered and reachable separately, and why the device path
  is a different surface rather than a smaller one.

- [#246](https://github.com/LewisIsWorking/Tongs-Browser/pull/246) [`3627365`](https://github.com/LewisIsWorking/Tongs-Browser/commit/36273659b9a5970cc93e7b13e3b54fe131af6082) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Four more folders documented: `src/debug`, `src/pointer/sequences`, `src/ui`, `src/relay`. Nineteen
  of twenty-six now carry a README that names its own files; seven remain.

  `src/debug` is the largest folder in the module and its README says why: most failures there are
  silent, so everything in it exists to turn a silence into a sentence. It records the four rules that
  suite runs on, including the one it keeps having to relearn - that when this folder reports a
  capability broken, the instrument is usually the thing that is wrong.

- [#242](https://github.com/LewisIsWorking/Tongs-Browser/pull/242) [`354ab9a`](https://github.com/LewisIsWorking/Tongs-Browser/commit/354ab9ab13f9963aaff1839b722e2d1e2ae5c978) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Four more folders documented: `src/pointer`, `src/modifiers`, `src/settings`, `src/scaling`. Ten of
  twenty-six now carry a README that names its own files; sixteen remain on the backlog.

  These record the measurements rather than indexing the files: why `button` and `buttons` are
  different fields and getting it wrong produces events Foundry quietly ignores, why the keyboard
  strategy probe decides whether the modifier bar works at all, why the exhaustive switch in
  `ApplySetting.ts` has no default branch, and why scaling the whole document would move the one thing
  that must not move.

- [#245](https://github.com/LewisIsWorking/Tongs-Browser/pull/245) [`dcffe0a`](https://github.com/LewisIsWorking/Tongs-Browser/commit/dcffe0a181d5a2c7cc7b3067af2c66f902396b5b) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - The play probe asked the wrong actor, and reported a working capability as broken.

  "Open the character sheet by double click" had been failing on 14.366. It is not broken. `Token#_onClickLeft2`
  renders `this.actor`, and for an **unlinked** token that is a synthetic delegate with its own sheet
  instance, so asking the base actor returns `rendered: false` about a sheet that is open on screen.

  Measured live: `sameActorObject` false, `baseActorSheetRendered` false, `tokenActorSheetRendered`
  true, with a visible "Diver: [probe] synth" window in the DOM. `can("clickLeft2")` was allowed all
  along, so the double click had always been recognised.

  The probe now reads `token.actor ?? actor`, which keeps a linked token working unchanged. All nine
  capabilities pass on a live 14.366.

## 0.25.59

### Patch Changes

- [#237](https://github.com/LewisIsWorking/Tongs-Browser/pull/237) [`00b30cc`](https://github.com/LewisIsWorking/Tongs-Browser/commit/00b30ccbd726c1bef90b3c4d84001e2484a230eb) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - The play probe never opened the sidebar, and could not be split until now.

  "Create an actor from the sidebar" had been reporting AIM with "create button blocked by the element
  does not exist" against a live 14.366. The button exists and still carries `data-action="createEntry"`;
  what it lacks is a centre inside the viewport, because `ui.sidebar.expanded` is false after
  `game.ready` and `changeTab` does not open it. Measured with `hasTouch` both false and true, so it is
  the collapse rather than the touch surface. It now expands the drawer, and the capability passes end
  to end through the pointer on a real world: AIM to YES.

  The file was 572 lines because `page.evaluate` serialises its callback, so every helper had to be
  defined inside the one function that used it. `page.addInitScript` serialises the same way but
  installs onto `window` before the page's scripts run and survives the navigations joining performs,
  so the pieces are now seven modules meeting at one namespace, the largest 200 lines and the entry
  point 107. Proven by running the probe against a live world, not by typechecking.

  Two smaller fixes found while doing it:

  - The size guard printed a remedy that cannot be executed. npm 12 parses unknown flags itself even
    after `--`, so `npm run check:sizes -- --update` dies with `Invalid abbreviated flag "--update"`.
    It now prints the `node scripts/...` form that works. The same npm behaviour eats `--hold=` on
    `check:drag`.
  - `findNeighbourServers` takes its port list as an argument. It always probes Foundry's default
    30000, so the test asserting "reports nothing when nothing is listening" passed only while no
    Foundry was running, and failed the moment one started. It was measuring the machine.

## 0.25.58

### Patch Changes

- [#235](https://github.com/LewisIsWorking/Tongs-Browser/pull/235) [`fad37ae`](https://github.com/LewisIsWorking/Tongs-Browser/commit/fad37ae591ff2e5ee731bd2cb23102a0eb3cb2cd) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - The file size ratchet only enforced half of what it promised.

  Its docblock says the ceiling is each file's current length, and warns that "a ratchet parked at a
  comfortable margin is a high water mark". The code checked `lines > ceiling` only, so a file that
  SHRANK kept its old ceiling until somebody remembered to run `--update` - and could then silently
  regrow every line it had lost, with the check green throughout. The margin it warns about could open
  up on its own.

  Slack now fails the check, with the one command that records it, and a different message from the one
  shown for growth: "extract a responsibility" is the right advice for a file that grew and precisely
  the wrong advice for one that shrank. `--update` still runs while slack is outstanding, since
  recording the reduction is its entire purpose.

  Proved by feeding the guard the bug: an inflated ceiling of 300 against a 284 line file reported
  green before and now exits 1.

  Also, `--self-test` now actually runs. It was reachable only by hand and appeared in no npm script and
  no workflow, so the guard's own proof had never executed in CI. `check:sizes` runs it first, and the
  same rules are now covered by ordinary unit tests as well.

## 0.25.57

### Patch Changes

- [#232](https://github.com/LewisIsWorking/Tongs-Browser/pull/232) [`1c73fdd`](https://github.com/LewisIsWorking/Tongs-Browser/commit/1c73fdd9dee3dff67c11422a90f68b704f74ffea) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Harness: say why nothing is answering, instead of only that nothing is.

  `requireActiveWorld` reported `nothing is answering on http://localhost:30000. Start Foundry and
launch a world.` for every kind of silence. On 2026-08-15 that sentence was true and sent the reader
  somewhere useless twice: a stale `Config/options.json.lock` directory left by a server that exited
  without unwinding, which makes the next launch die with "already locked by another process" about a
  process that does not exist; and a perfectly healthy Foundry answering one port over on a separate
  dataPath, which the message let read as "Foundry is down".

  It now checks both and names them, with a third answer for a lock it could not check rather than
  implying a clean check it never ran. Proven against the live fault, which found the real lock path
  and the real neighbouring world unaided.

  Also documents the 14.366 entry point rename (`main.mjs` to `main.js`), and `--noupnp`: `upnp`
  defaults to true, so a world left up overnight collected join-page sessions from five external
  addresses.

- [#234](https://github.com/LewisIsWorking/Tongs-Browser/pull/234) [`7996909`](https://github.com/LewisIsWorking/Tongs-Browser/commit/7996909940aca2e53d067ac4138317b3f4c346bf) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix: a finger resting in the sidebar counted as half of a two finger gesture.

  `TouchEvent.touches` holds every finger on the screen, not the fingers on the event's target.
  `TouchBinder` correctly ignores an event whose target is excluded, so a finger landing in the sidebar
  reported nothing to the state machine - and then the next canvas `touchmove` carried that finger in
  its own `touches` list, where `SingleFingerStates` counted it, because two-fingerness is decided by
  `input.touches.length >= 2`.

  So the machine never heard the finger arrive and counted it regardless. One finger dragging a token
  became a pan or a pinch because the other hand was holding the tablet with a thumb over the sidebar,
  which is how a tablet is held.

  Fixed at the single boundary where events become gesture input, in the new `ActionableTouches`, so the
  four `>= 2` checks across three downstream files did not each have to learn about exclusion zones. Two
  fingers on the board still pan, and a touch whose `target` cannot be read is kept rather than dropped,
  since silently disabling pan and zoom on an engine that omits it would be the worse bug.

  Also collapses three byte-identical touch handlers that sat beside a fourth quietly omitting
  `preventDefault`, with nothing saying whether that was a decision. It is one, and now says so.

## 0.25.56

### Patch Changes

- [#229](https://github.com/LewisIsWorking/Tongs-Browser/pull/229) [`bd5fa70`](https://github.com/LewisIsWorking/Tongs-Browser/commit/bd5fa70ce1461b96cc2734e658d31ce09d2429b6) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Declare compatibility with Foundry 14.366.

  `compatibility.maximum` was already `14`, so the module loaded on 14.366 regardless; this updates
  `verified` so the package browser stops offering it as an untested pairing.

  Nothing in the module's own surface is touched by that release. The changes are to package
  installation, the Windows installer location and the world login page, none of which the module
  reaches into. The README now separates the declared version from the measured one, because every
  `14.365` reference elsewhere in this repo is a dated measurement and rewriting those would falsify
  the record.

## 0.25.55

### Patch Changes

- [#223](https://github.com/LewisIsWorking/Tongs-Browser/pull/223) [`6c87561`](https://github.com/LewisIsWorking/Tongs-Browser/commit/6c87561aef69b3c017dbe1c0d34cc2236583937d) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Remember whether the modifier bar was left collapsed.

  `ModifierBar` has fired `onCollapsedChanged` since it was written, and a test has asserted exactly
  that all along. The matching option was declared on `TongsBrowserOptions`, correctly typed, and
  forwarded by nobody: `BuildModifierBar` passed the position pair and omitted the collapsed pair. So
  the bar announced every collapse to no one, and the state was discarded on every reload.

  Every part correct, every part covered, and the seam between them empty. It stayed invisible for as
  long as the bar opened expanded, and became a complaint within an hour of it opening collapsed.

  The state now persists to a client setting, so expanding the bar survives a reload. The setting's
  default is imported from `BarDefaults` rather than repeated, because a default that disagrees between
  the register call and the read path is the classic settings bug.

## 0.25.54

### Patch Changes

- [#221](https://github.com/LewisIsWorking/Tongs-Browser/pull/221) [`025e5c7`](https://github.com/LewisIsWorking/Tongs-Browser/commit/025e5c71fbcc8b06e7c64601a5542607ad2bd769) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Let the bar be dragged again, and open it collapsed.

  The drag handle stopped receiving anything in 0.25.52. Suppressing our own interface's pointer
  events is done with `stopImmediatePropagation` on the window in the capture phase, which is upstream
  of every listener in the document, so "PIXI must not see this" was implemented as "nothing may see
  this" - and the handle is built entirely out of the four pointer events bound on itself.

  The suppression itself is measured and stays: a finger's `pointerup` reaching PIXI runs
  `#handlePointerUp`, which ends in `#handleDragCancel` and throws away a held token drag, which is
  what makes tapping DROP work at the end of a drag. So the fix is a narrow carve-out rather than a
  revert. Only the drag handle carries the new marker; a tray button beside it is still suppressed.

  The bar now opens partially collapsed. Expanded it is the full key grid plus the tray and covers
  roughly a quarter of a 360x607 phone viewport, on top of the map. Collapsing keeps the tray, so the
  hand, drop, pause and diagnose buttons stay put, and `<` brings the modifier keys back in one tap.

## 0.25.53

### Patch Changes

- [#219](https://github.com/LewisIsWorking/Tongs-Browser/pull/219) [`db2d01c`](https://github.com/LewisIsWorking/Tongs-Browser/commit/db2d01c4292333fcd99bd9b4c283232a67eda781) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Stop the drag diagnostics stacking themselves, and stop them blaming a drag that worked.

  The observers were re-wrapped on every dispatched event, because the caller retries until the
  interaction manager appears and the manager is unreachable until a token is controlled. Each retry
  wrapped the already-wrapped Token prototype, so one real `_onDragLeftStart` announced itself once per
  layer: a device reported ~150 drag starts and ~150 redraws for a drag that had exactly one of each,
  and every token redraw in that session ran through ~150 frames of a probe that promises not to change
  what it measures. Wrappers now carry a registry symbol and are installed at most once.

  The report's verdict is now decided by the OUTCOME. It printed "a REDRAW cancelled the interaction,
  which is why nothing was written" directly beneath "DID IT MOVE: YES (3100,2000 -> 3000,2200)": the
  redraw branch was tested before the drop branch so it shadowed everything, and the claim about
  writing was inferred from the mechanism rather than passed in. `describeTokenMovement` now returns a
  verdict alongside its sentence, and the summary requires it.

  Redraw notes read Foundry's actual cancel condition (`state > HOVER`) instead of asserting it, so an
  ordinary redraw is no longer accused of destroying a drag it never touched.

## 0.25.52

### Patch Changes

- [#215](https://github.com/LewisIsWorking/Tongs-Browser/pull/215) [`4e8ca5c`](https://github.com/LewisIsWorking/Tongs-Browser/commit/4e8ca5c14a3485421ac97956297b8d096e4c960f) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Stop the diagnostics report warning the player, and cover the grab-then-drag path end to end.

  `describeDragPermissions` asked `dragLeftStart` through `MouseInteractionManager#can`, which offers
  no way to pass Foundry's `notify: false`. Every refusal path inside `_canDragLeftStart` calls
  `ui.notifications.warn`, so a player pressing the diagnose button could get a toast on screen. It
  now asks the placeable directly and silently, and carries the one field the check was measured to
  read.

  The grab button's real path had no check at all: the drag harness drives the pointer from
  JavaScript and never touches the bar, and the touch harness touches the bar but never drags a token.
  `check:grab` now performs the whole sequence with a finger, including the 700ms pause that a person
  takes and that Foundry reads as a long press.

## 0.25.51

### Patch Changes

- [#214](https://github.com/LewisIsWorking/Tongs-Browser/pull/214) [`9101a53`](https://github.com/LewisIsWorking/Tongs-Browser/commit/9101a5385b7791f1be58dcdfe78a1319ea1f738f) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Stop Foundry cancelling a held drag as if it were a long press.

  Foundry arms a 500ms timer on every pointerdown and clears it only when a drag actually starts,
  which needs the pointer 10px from where it went down. Past that, `ControlsLayer._onLongPress` pings
  the canvas and cancels the drag workflow.

  That is a sound inference for a finger and the wrong one for this module. Dragging with the touch
  gesture beats the timer because the finger is already moving. Dragging with the grab button does
  not: you tap the button, lift, reposition, and only then move, which is comfortably longer than half
  a second. Foundry then cancels a drag the user is in the middle of, and `_onDragLeftCancel` writes
  nothing, so the token snaps back while every other measurement looks healthy.

  The pointer now disarms that timer immediately after the opening pointerdown. The ping is untouched
  for a genuine long press, because the timer is re-armed by the next pointerdown.

- [#213](https://github.com/LewisIsWorking/Tongs-Browser/pull/213) [`9564901`](https://github.com/LewisIsWorking/Tongs-Browser/commit/956490154552d0a41ef97cf56d6723ca05e21324) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Stop the module's own bar leaking pointer events onto Foundry's canvas.

  Tapping the grab button with a finger put four events on the window that PIXI listens for, all at
  the button's own coordinates: a touch `pointerdown` and `pointerup`, and the browser's touch
  compatibility `mousedown` and `mouseup`. PIXI maps events onto the canvas BY COORDINATE rather than
  by DOM target, and the bar sits over the canvas, so Foundry received a pointerup it was never meant
  to see. `MouseInteractionManager#handlePointerUp` ends with `#handleDragCancel`.

  The bar was an excluded region, which is correct for the gesture layer and wrong here. Those are two
  different questions about the same element: the gesture layer must keep away from our bar, and our
  bar must never reach the canvas. The suppressor now decides this itself rather than by composing
  predicates at the call site.

  Measured before and after against a live Foundry with a real finger: four leaked events, then none,
  with the button still working because `click` is deliberately untouched.

## 0.25.50

### Patch Changes

- [#204](https://github.com/LewisIsWorking/Tongs-Browser/pull/204) [`bc1858f`](https://github.com/LewisIsWorking/Tongs-Browser/commit/bc1858f8ad0e00d7ec35d1d4e923f458f52da1e5) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Record a timeline of causes as well as effects in the diagnostics report.

  Four device round trips were spent on a drag failure that a user diagnosed themselves by
  experiment: dragging works with the grab button off and breaks with it on. The report could not
  have said that, because nothing in it recorded that a button had been pressed at all. Every line
  described the end state of a gesture and none described what the user did to start it.

  The report now carries a timeline interleaving tray button presses, gestures, synthesised
  dispatches and Foundry's own callbacks, with the gap before each entry. A cancel two milliseconds
  after a tap and a cancel five hundred milliseconds after one are a dispatch bug and Foundry's long
  press timeout respectively, and nothing in the previous report could tell them apart.

  Also: the drag cancel call site now names three frames rather than one, filtered by bundle URL
  rather than by source file names that do not survive bundling, and a permission check that cannot
  be asked reports the reason instead of the bare word `unaskable`.

## 0.25.49

### Patch Changes

- [#202](https://github.com/LewisIsWorking/Tongs-Browser/pull/202) [`275fd08`](https://github.com/LewisIsWorking/Tongs-Browser/commit/275fd08aaa659520d01413d331cc630980fb2fee) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - **Fix six harness checks that could not be loaded at all**, and add `check:scripts` so a green
  typecheck can never mean that again.

  Found by trying to run the drag check rather than reasoning about it. Two separate failures, both
  invisible to `tsc`:

  ⚠️ **27 import specifiers ended `.js`.** These scripts run through Node's type stripping, which
  resolves the REAL file, so a specifier must end `.ts`. TypeScript maps `./Thing.js` back to
  `./Thing.ts` and says nothing; Node then cannot find `./Thing.js`, because no such file exists.
  Splitting one harness into seven modules introduced all 27 in a single commit, and
  `typecheck:scripts` reported zero errors on every one.

  ⚠️ **`foundry-touch.ts` used parameter properties.** Node STRIPS types rather than compiling them, so
  anything that emits code is rejected outright and the whole file fails with
  `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`. A parameter property is ordinary TypeScript and `tsc` is
  perfectly happy with it. The touch, multitouch and Android checks have not been runnable since the
  scripts were converted from `.mjs`.

  The guard checks both, statically. It deliberately does **not** import anything: importing runs the
  script, and these launch browsers and write to a live world. It uses `module.stripTypeScriptTypes`,
  which is the exact transform Node applies, and resolves the specifiers itself.

  Two things it got wrong first, both now recorded beside the code:

  - **A guard that contains EXAMPLES of what it detects will detect itself.** Its self test samples are
    string literals holding `'./b.js'` and a parameter property, so it flagged its own source. It skips
    its own file; the self test covers it instead, which is the better guarantee anyway.
  - **A negative case has to be negative for EVERY check.** The "sound file" sample imported a made up
    path, so the existence check fired and the self test failed for the right reason on the wrong input.

## 0.25.48

### Patch Changes

- [#200](https://github.com/LewisIsWorking/Tongs-Browser/pull/200) [`9e4dded`](https://github.com/LewisIsWorking/Tongs-Browser/commit/9e4dded1f753d613f2537e083b0b3d8f4bbcf845) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix the call site naming itself, and ask Foundry directly whether it will allow a drag.

  ⚠️ **The call site reported `MouseInteractionManager.wrapped`, which is OUR OWN wrapper.** It is
  assigned onto `MouseInteractionManager.prototype`, so its stack frame reads
  `MouseInteractionManager.wrapped` and matched the search before any real frame did. The previous
  release added a comment saying "naming the wrapper says only that the observer observed" and then
  shipped code that did exactly that. Our frames are now filtered out before the search, not only in
  the fallback.

  **And the report now asks the manager instead of inferring.** `#handleDragStart` is the one cancel
  path that fires on something other than a pointerup:

  ```
  if ( !this.can(action, event) ) {
    this.#debug(action, event, this.handlerOutcomes.DISALLOWED);
    this.cancel(event);
    return;
  }
  ```

  A refused `dragLeftStart` cancels the whole interaction, and nothing else in the report would say so:
  the state, the gate and the origin all look exactly as they do for any other cancel. `clickLeft`,
  `dragStart` and `dragLeftStart` are now printed beside the interaction state. `dragStart` matters
  separately because `#handleClickLeft` only reaches GRABBED and binds the drag handlers when it
  passes, so one false and the other true are two different failures.

  Reading a stack frame was the indirect way to answer this. The manager has a method that answers it
  outright.

## 0.25.47

### Patch Changes

- [#198](https://github.com/LewisIsWorking/Tongs-Browser/pull/198) [`bf02233`](https://github.com/LewisIsWorking/Tongs-Browser/commit/bf02233ed3469bb91503c057fb6145998944591b) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Name WHICH of Foundry's cancel sites fired, from the call stack.

  ⚠️ **The event alone cannot answer this, and three rounds of diagnosis assumed it could.** Foundry
  reaches `cancel` from several places, and one of them is a long press TIMEOUT whose closure still
  holds the original `pointerdown`. So a cancel stamped `pointerdown` may have happened half a second
  later, from a timer, and reading it as "the pointerdown caused it" is wrong in a way nothing else in
  the report contradicts.

  The three paths are three different bugs with three different fixes, and they are indistinguishable
  without this:

  - `#handleDragStart` refusing at `can("dragLeftStart")`, which cancels outright
  - `#handleDragCancel` from a pointerup
  - the long press timer

  Our own frames are skipped: naming the wrapper that records the observation says only "the observer
  observed", which is the kind of true and useless line this report already has too many of.

  The test matches the call site loosely on purpose. Which frame appears depends on the runtime, and
  pinning the exact string would make it a test of Node's stack format rather than of the report.

## 0.25.46

### Patch Changes

- [#196](https://github.com/LewisIsWorking/Tongs-Browser/pull/196) [`a7bcf04`](https://github.com/LewisIsWorking/Tongs-Browser/commit/a7bcf044e58936eab3fc431136a15da4fb4676cf) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - **Suppress the browser's own touch pointer events where PIXI can actually be beaten to them.** This
  is the cause of the drag failure, named from a device report for the first time.

  The report showed roughly two hundred `_onDragLeftCancel` calls, every one triggered by an event
  with `pointerType: 'touch'`, while the gesture layer was already "suppressing" exactly those. Reading
  PIXI's own registration in Foundry 14.365, `@pixi/events/lib/EventSystem.mjs`:

  ```
  globalThis.document.addEventListener('pointermove', this.onPointerMove, true)
  this.domElement.addEventListener('pointerover',  this.onPointerOverOut, true)
  globalThis.addEventListener('pointerup',   this.onPointerUp, true)
  ```

  ⚠️ **`pointerup` is registered on the WINDOW.** In the capture phase the window fires BEFORE the
  document, so a document listener cannot stop it however carefully it is written. Foundry's
  `#handlePointerUp` ends with `this.#handleDragCancel(event)`, so **any** pointerup that reaches the
  manager cancels the drag, and `_onDragLeftCancel` writes nothing: the token returns to where it
  started while every other measurement looks healthy.

  Three things had to change together, and any one of them alone leaves it broken:

  1. **Bind on the window**, not the document, because that is where PIXI is.
  2. **Bind at `init`**, before Foundry builds the canvas. Two capture listeners on one node fire in
     REGISTRATION ORDER, so anything bound at `ready` is already behind PIXI.
  3. **`stopImmediatePropagation`**, not `stopPropagation`. PIXI's listener is on the same node, and
     plain propagation does not stop those.

  Also: **`pointerover` and `pointerout` were never suppressed at all.** Foundry's
  `MouseInteractionManager` binds both, and the device report opens with
  `manager.cancel at GRABBED [pointerover ... touch]`.

  ⚠️ Not yet confirmed on hardware. Every previous hypothesis in this investigation was disproven by a
  device, and this one is read from Foundry's and PIXI's source plus one report rather than measured on
  the phone.

## 0.25.45

### Patch Changes

- [#194](https://github.com/LewisIsWorking/Tongs-Browser/pull/194) [`077ccf6`](https://github.com/LewisIsWorking/Tongs-Browser/commit/077ccf61d2129251feb7b69c0bedb708d939d964) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - **Fix the module failing to start.** `new TongsBrowser(...)` threw on Foundry's `ready` hook, so no
  cursor and no modifier bar ever appeared. The scene control button still showed, because it is
  registered on `init`, which is why the module looked present and did nothing.

  `ModuleParts` reached BACK through the module for parts the factory had not returned yet. The bar was
  the trigger: `new ModifierBar(...)` calls `refreshActions()` at the end of its constructor, the grab
  button is asked whether a drag is in progress, and the pointer it asked was still `undefined`.

  The factory holds every one of those as a local. It now uses them directly, and `ModuleSelf` is down
  to the single thing only the module knows: whether it is enabled.

  ⚠️ **This shipped because I merged thirty refactoring PRs on unit tests alone.** Every focused suite
  stayed green while the composition root could not be constructed, which is exactly what
  `PreMergeTestingPolicy` exists to prevent and exactly the gap it names.

  `tests/dom/moduleConstruction.test.ts` is the missing test, and it reproduced the failure in one run:
  it builds the module with the options `main.ts` passes, enables it, and taps **every** tray button.
  Nothing in it asserts behaviour a focused suite does not already own. What it asserts is that the
  pieces go together at all.

  `eventView` becomes an option, threaded the same way `PointerStack` already threads it, so a suite
  that constructs the whole module can omit it: vitest's jsdom window is not a branded `Window` and
  `new PointerEvent({ view })` rejects it.

## 0.25.44

### Patch Changes

- [#192](https://github.com/LewisIsWorking/Tongs-Browser/pull/192) [`5c6fb67`](https://github.com/LewisIsWorking/Tongs-Browser/commit/5c6fb6739140b04f1777a4c12223e2ebd6dfe9a6) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Split `gestureStateMachine.test.ts` (407) and `sequences.test.ts` (297) into focused suites with
  shared harnesses. 766 tests green, the same 766 as before.

  Two mistakes worth recording, because both produced a GREEN suite with tests missing:

  ⚠️ **The splitter deleted a file it had just written.** One output filename is the input path, and
  the `unlink` at the end removed it. The suite went from 766 tests to 754 and still reported "78 files
  passed": a deleted test file is not a failing test file. The count is the only thing that catches it,
  and it is not something a green tick tells you.

  ⚠️ **`prune:imports` correctly removed imports the harness held only to re-export.** They are
  genuinely unused BY that module. The fix is order, not an exception: build the re-exports first, then
  prune. The reason is now written where the re-exports are.

  Also fixed: `verbatimModuleSyntax` requires `export type` for a re-exported type, which is a separate
  list from the values.

## 0.25.43

### Patch Changes

- [#190](https://github.com/LewisIsWorking/Tongs-Browser/pull/190) [`24e457d`](https://github.com/LewisIsWorking/Tongs-Browser/commit/24e457dddf02a30e4985157a990e4a7f7dd988cd) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Split `tests/dom/gestureLayer.test.ts` (498) into four suites, and add `npm run prune:imports`, a
  tool that removes unused imports by asking the compiler rather than guessing.

  **The tool exists because splitting one file into four cost four rounds of hand pruning.** A regex
  looking for the identifier in the body gets it wrong in both directions: it counts a name inside a
  `describe('VirtualPointer hover', ...)` TITLE as a use, and it counts one inside a comment. Both
  happened today, and both left an import the compiler then rejected. TypeScript already knows the
  answer exactly, so the tool asks it and edits what it points at.

  Two things it got wrong first, both now recorded beside the code:

  - **`TS6192` names nothing**, because the whole declaration is unused. Handling only `TS6133` left
    three files behind while the tool reported success.
  - **An empty name has to short circuit.** Without that branch the name based path runs with an empty
    string, `includes('')` is true, and the replacements match at position zero and corrupt the
    statement rather than removing it.

  `makeTouchEvent` moves to `tests/dom/support/touchEvents.ts`, where the reason it exists is written
  down: it is a plain `Event` with `touches` defined ON it, not a `TouchEvent`, because jsdom
  implements neither `TouchEvent` nor `TouchList` and constructing one throws.

## 0.25.42

### Patch Changes

- [#188](https://github.com/LewisIsWorking/Tongs-Browser/pull/188) [`44afcdd`](https://github.com/LewisIsWorking/Tongs-Browser/commit/44afcdda3ec67cfbffdbebd5871351fbec01925e) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Split `tests/dom/virtualPointer.test.ts` (512) into six suites plus a shared harness. 766 tests
  green, none changed in meaning.

  ⚠️ **The same trap as the modifier bar split, caught the same way.** Several tests clear `recorded`
  MID TEST to isolate a phase: move, clear, move again, then assert only the second move's events. The
  harness originally exported it as a `let` that tests reassigned, and a reassignment **cannot cross a
  module boundary**: the importing suite keeps the old array and asserts on events it meant to discard.
  It is now a `const` emptied in place.

  That is the second time today a shared-array reset has nearly broken a split, and the failure is
  loud both times only because the suite runs. The rule is worth stating: **a mid test reset is doing
  real work and reads exactly like redundant setup.**

  The harness also records why `elementFromPoint` is injected rather than reached for: jsdom does not
  implement it at all, and that injection is what lets a test place elements BY COORDINATE instead of
  by layout, which is the only way to test hit testing without a layout engine.

## 0.25.41

### Patch Changes

- [#186](https://github.com/LewisIsWorking/Tongs-Browser/pull/186) [`3de88c4`](https://github.com/LewisIsWorking/Tongs-Browser/commit/3de88c4ae4efb534ab546b0dcc75e726557d7c15) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix the capability probe reporting an **unmeasured** run as a confirmed gap, and extract its
  reporting into `scripts/probe/Report.ts` at 100% coverage.

  The filter read `!pointerTrials.some(o => o === 'yes')`, which is "not a yes" rather than "a no". A
  trial can also be **`AIM`**, meaning the pointer never REACHED the target, so nothing about the
  capability was measured at all. A run of pure aim failures therefore passed the filter and was
  reported as:

  > `N capability gap(s): the pointer failed every trial and a native control succeeded in every trial.`

  That sentence was untrue, and it is the line the exit code is set from. It would have sent somebody
  to fix a capability that had never been exercised.

  ⚠️ **`verdict` already made exactly this distinction** and had a comment explaining why: "a run that
  never reached its target is not a flaky capability, it is an unmeasured one." The two functions
  disagreed about the same three-valued outcome, in the same file, one of them documented. Extracting
  them side by side is what made it visible.

  Also fixed while writing the tests: `every` is vacuously true on an empty run, so a capability with
  no trials at all would have been reported as a proven gap.

  `foundry-play-probe.ts` drops from 650 to 571. ⚠️ The rest of that file is a single `page.evaluate`
  body, which cannot be split by extraction: Playwright serialises only the function's own source, so
  an imported helper does not exist in the page. Splitting it properly means installing the harness
  helpers with `addInitScript` first, which needs a live Foundry to verify and is not something a
  typecheck can stand in for.

## 0.25.40

### Patch Changes

- [#184](https://github.com/LewisIsWorking/Tongs-Browser/pull/184) [`ba45801`](https://github.com/LewisIsWorking/Tongs-Browser/commit/ba4580136f41714eb2121512078c8ecf89aa339a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Split `foundry-drag-check.ts`, at 775 the second largest file, into seven modules under
  `scripts/drag/`. The runner drops to 265. Zero script type errors, 750 tests green.

  - **`Options`** is every flag, with the reasoning kept BESIDE the flag rather than in a README nobody
    opens while a check is failing. Each one exists because a run answered one question and raised
    another.
  - **`Surface`** opens whichever surface was asked for. ⚠️ Playwright's `Page` and the raw CDP client
    are two genuinely different surfaces, not one type with two shapes: they agree on exactly one call
    and nothing else, which is what lets the same assertions run against desktop Chromium or against a
    phone over adb without the checks knowing which.
  - **`EvaluateOn`** is that one call, named.
  - **`ProbeToken`** creates the token to drag and removes it whatever happens.
  - **`DragToken`** drives one drag and watches every step. ⚠️ It waits for the token's position to
    **settle**, not merely to change: Foundry animates a commit, and a position read mid animation is
    neither where it started nor where it is going.
  - **`Report`** says what the drag did in terms somebody can act on.

  The pan flag is now an argument rather than a global the drag reaches for, so the same function can
  be asked either question rather than reading its answer from module scope.

## 0.25.39

### Patch Changes

- [#182](https://github.com/LewisIsWorking/Tongs-Browser/pull/182) [`2711603`](https://github.com/LewisIsWorking/Tongs-Browser/commit/27116030ff007ba0ae816ec55a9948731e7eb7a0) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Split `tests/dom/modifierBar.test.ts`, at 825 the largest test file, into focused suites with a
  shared recording harness. 750 tests green, none changed in meaning.

  The recording helpers were the reason the file kept growing: every suite that touches a modifier key
  needs the same keyboard listener, the same `recorded` array and the same bar factory. They now live
  in `tests/dom/support/keyboardRecording.ts`, shared rather than copied, because five copies of a
  listener appending to a module level array is five chances for one of them to forget to reset it.

  ⚠️ **One thing the split nearly broke, and it is worth recording.** Several tests clear `recorded`
  MID TEST, not just in `beforeEach`, to isolate a phase: press, clear, release, then assert only the
  keyup arrived. A first pass treated those as duplicates of the setup and removed them, which left six
  tests asserting on the press as well as the release. They are conversions, not deletions: the shared
  array is emptied in place rather than reassigned.

  `createBar` throws rather than returning null for a missing key, because a missing key is a broken
  bar and not an empty assertion.

## 0.25.38

### Patch Changes

- [#180](https://github.com/LewisIsWorking/Tongs-Browser/pull/180) [`fd1e685`](https://github.com/LewisIsWorking/Tongs-Browser/commit/fd1e68514017ffc441958e586872971013ce2297) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Split the Android harness, the largest file in the repo. **`foundry-android-check.ts` goes from 927
  to 182**, into nine focused modules under `scripts/android/`. Zero script type errors, 750 tests
  green.

  The split follows what each part is FOR rather than what order it happened to be written in:

  - **`CheckResults`** records what a check found, and keeps a skip separate from a pass.
  - **`PageObservers`** watch the page: its errors with their stacks, its logs, and the font decode
    shim.
  - **`Geometry`** measures the things a user has to be able to hit.
  - **`CheckKeyboard`**, **`CheckHover`**, **`CheckTap`**: one file per question asked.
  - **`HoverDriver`** drives the pointer onto a token and reports what Foundry saw.
  - **`ProbeTokens`** creates the two tokens a hover needs and removes them whatever happens.
  - **`CanvasChecks`** runs everything that needs a canvas, and hands back what it created so the
    caller can clean up. ⚠️ Tokens BEFORE the scene: deleting the scene first orphans the token delete,
    and a `[probe]` actor left in a real world reads as a mysterious NPC rather than harness debris.
  - **`BarSetting`** puts the bar where it ships and back again. ⚠️ The geometry checks must judge the
    SHIPPED DEFAULT, not wherever the bar was last dragged to: a world used for testing has its bar
    somewhere convenient, so running against it measures a position nobody will see on a fresh install,
    which is the only position the default can be wrong at. The restore reports failure and swallows
    it, because it runs in a `finally` and a throw there would replace whatever the checks found with a
    cleanup error.

## 0.25.37

### Patch Changes

- [#178](https://github.com/LewisIsWorking/Tongs-Browser/pull/178) [`4ab4cdb`](https://github.com/LewisIsWorking/Tongs-Browser/commit/4ab4cdb82893d6e47a1b3c184c4fe20f7d71d190) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - **Every file in `src/` is now under 200 lines.** `TongsBrowser.ts` finishes at 197, from 1,853 this
  morning. 750 tests green.

  The last four extractions:

  - **`ModuleParts`** builds every part the module is made of. ⚠️ Every reference a part takes BACK to
    the module is a **thunk**, and that is what makes one builder possible at all: the parts are built
    in an order, and several need a sibling that does not exist yet. The tray needs the pointer while
    the bar is still being constructed, the relay needs the actions, the binder needs the gestures.
    Taken eagerly, each captures `undefined` and fails at the first tap, long after the code that
    caused it has finished running. That is the third instance of this shape today.
  - **`TongsBrowserOptions`** becomes the contract, so `ModuleParts` can name it without importing the
    class it builds.
  - **`Vibrate`** is feature detected at the CALL SITE rather than trusted from the type: `lib.dom`
    declares `navigator.vibrate` as always present, it is absent on iOS entirely, and on Android it is
    silently ignored until the page has been interacted with, so a haptic that never fires is
    indistinguishable from one that fired and was not felt.
  - **`SidebarMenu`** builds the picker from our own rows rather than Foundry's tab strip, which is
    27px wide on a phone. Reusing that strip to CHOOSE a tab would inherit exactly the problem being
    solved.

  Both new modules are at 100%, as is everything extracted today.

## 0.25.36

### Patch Changes

- [#176](https://github.com/LewisIsWorking/Tongs-Browser/pull/176) [`eb72ede`](https://github.com/LewisIsWorking/Tongs-Browser/commit/eb72ededb670e10d6011142329be50bc34a3d17a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract `foundry/FoundryAccess.ts` and `TrayWiring.ts`. **`TongsBrowser.ts` drops from 422 to 314.**
  742 tests green.

  **`FoundryAccess`** collects every reach for a Foundry global into one place, and records why each one
  opens the way it does:

  > ⚠️ **The `typeof` guard is NOT redundant with the declared type.** A global Foundry has never
  > defined at all throws a `ReferenceError` on plain access, and `typeof` is the only way to survive
  > it. An optional chain does not help, because the reference ITSELF is what throws.

  The arithmetic behind those answers already lives in `CanvasReaders` and `AvailableWidth`, tested
  without a browser. This is the impure half, collected so the rest can stay pure.

  **`TrayWiring`** connects the tray buttons to what they drive, and pins one hazard:

  > ⚠️ **The pointer arrives as a THUNK rather than a reference.** The tray is built while the modifier
  > bar is being constructed, which happens before the pointer field has been assigned. Taking the
  > pointer eagerly captures `undefined`, and every tray button that touches it fails at the first tap,
  > long after the code that caused it has finished running.

  That is the same class as the `KeyButtons` field initialiser caught earlier today: a constructor
  reading something that is not assigned yet, where the symptom appears far from the cause.

## 0.25.35

### Patch Changes

- [#174](https://github.com/LewisIsWorking/Tongs-Browser/pull/174) [`297fb1c`](https://github.com/LewisIsWorking/Tongs-Browser/commit/297fb1cb3b8b8aed11dde5fb958e454beedf7926) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract what the tray buttons do to Foundry into `foundry/FoundryActions.ts`.
  **`TongsBrowser.ts` drops from 593 to 422.** 742 tests green.

  Every decision here already lives in a module of its own, tested: `PauseControl`, `SidebarAccess`,
  `CharacterSheet`. This is the layer that reaches for the globals and carries those decisions out, and
  keeping it apart from the composition root means the root wires things together and nothing else.

  It also puts the reaching-for-globals in **one place** rather than scattered through a class that
  also builds a pointer, a gesture layer and a modifier bar.

  Two things worth keeping visible, now that they sit beside the code they explain:

  - **The sidebar picker is 44px rows in an element this module owns.** Foundry's own tab strip is 27px
    wide on a phone, which is what made the sidebar unreachable in the first place, so reusing it to
    choose a tab would inherit exactly the problem being solved.
  - **A macro cannot let a player pause the WORLD.** Foundry's `Game#togglePause` only emits its socket
    message `if (options.broadcast && game.user.isGM)`, so a player running any macro toggles their own
    client and nobody else's. The check is on the EMIT path, not on macro permissions, which is why
    granting ownership looks like it should solve it and does not.

## 0.25.34

### Patch Changes

- [#172](https://github.com/LewisIsWorking/Tongs-Browser/pull/172) [`d838f8c`](https://github.com/LewisIsWorking/Tongs-Browser/commit/d838f8cdaf6baad1ece084d891d04915b91883e1) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract the whole diagnostics apparatus out of the composition root, into `DragObservers`,
  `DragRecorder` and `DragDiagnostics`. **`TongsBrowser.ts` drops from 941 to 593.** 742 tests green.

  The split follows the one distinction this entire investigation turned on:

  - **`DragObservers`** are the listeners that watch a drag happen. All three are installed ONCE and
    left in place, never per gesture: a set per gesture leaks them across a scene change, and a
    diagnostic that has to be installed during the bug is a diagnostic nobody has when the bug happens.
  - **`DragRecorder`** captures what is only knowable DURING the gesture. Foundry resets its
    interaction state the moment a drag ends, so anything read when the report is written describes the
    aftermath: the manager says NONE whether the drag never started or ran perfectly and committed.
  - **`DragDiagnostics`** assembles and whispers the report, and reads only what the recorder already
    caught.

  ⚠️ **Recording and reporting being separate is the lesson of the whole session**, and it is now
  structural rather than remembered. Five of the six defects found today were readings taken at the
  wrong moment. The observers now expose ONE `snapshot()` rather than letting the reporter reach in
  field by field, which is what made the four-reads-of-`getCounts` bug possible in the first place.

  `SingleFingerPort` also moves to its own file, so the two halves of the gesture split can name it
  without importing each other.

## 0.25.33

### Patch Changes

- [#170](https://github.com/LewisIsWorking/Tongs-Browser/pull/170) [`7dea18b`](https://github.com/LewisIsWorking/Tongs-Browser/commit/7dea18bcd2df5d21de518f41895aeb1549d0176a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Teach the orphaned docblock guard about ONE LINE blocks, which it was walking straight past, and
  clear the three it then found.

  ⚠️ **The guard had a gap of exactly the kind it exists to catch.** A multi line block closes on a
  line of its own, so a check for a lone closing marker finds it. A one line block, `/** ... */`,
  closes on the same line it opens, and the check skipped every one of them. Two had been sitting in
  `TongsBrowser` since an earlier extraction, documenting fields that had moved into `DragSampler`, and
  the guard reported the file clean.

  The self test now has its own case for the one line shape, so the same gap cannot reopen.

  What the three were:

  - Two field descriptions whose fields moved to `DragSampler`, now beside them there.
  - A duplicate left when `describeTokenMovement` was extracted: the newer block says the same thing
    and names the module it moved to.

  This is the third time today that a guard or a test proved to be structurally incapable of catching
  what it named, after the jsdom clamp tests that could only ever run against a zero sized bar, and the
  reset test that passed with and without the line it claimed to guard. The pattern is worth stating
  plainly: **a check that has never been shown to fail is a claim, not a guard.**

## 0.25.32

### Patch Changes

- [#168](https://github.com/LewisIsWorking/Tongs-Browser/pull/168) [`7e510df`](https://github.com/LewisIsWorking/Tongs-Browser/commit/7e510df5d67375833d9b96e49eb20141944615a2) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Split the gesture machine into `SingleFingerStates` and `SettledStates`.
  **`GestureStateMachine.ts` drops from 330 to 146**, and every gesture file is now under the limit.
  742 tests green, including the 381 line state machine suite.

  The split follows what the states actually share rather than their order in the file:

  - **The machine** keeps the dispatch, the config and the two finger states.
  - **`SingleFingerStates`** keeps the two states where the gesture's identity is still being decided,
    which need five fields between them: where the touch began, when, whether it follows a previous
    tap, and what that tap was.
  - **`SettledStates`** keeps the two where it is already decided, which need only the last position.
    TRACKING means the finger is moving the pointer and the release must NOT produce a click; DRAGGING
    means a button is held and every move carries it.

  A class holding both sets is a class where any handler can reach any field.

  ⚠️ **A correction, because I claimed something and then disproved it.** Moving the position out
  dropped a line from `reset`, and I described that as a real gap the suite had missed. It is not: a
  stale last position is unobservable, because every fresh gesture starts at a `touchstart` and
  `fromIdle` writes the position before any move can read it. Removing the line leaves the whole suite
  green, which was checked by removing it rather than assumed. The line stays for hygiene, the comment
  now says so, and the test that came out of it was rewritten to pin the outcome a user would notice
  rather than to claim a guard it does not provide.

  Production files over 200 lines: **five this morning, one now**.

## 0.25.31

### Patch Changes

- [#166](https://github.com/LewisIsWorking/Tongs-Browser/pull/166) [`9b3dca6`](https://github.com/LewisIsWorking/Tongs-Browser/commit/9b3dca6ba4ede6acc57aea92403fb2834e468f5e) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Split `ModifierBar` into `BarChrome`, `BarAttachment`, `ModifierBarOptions` and a re-homed
  `DEFAULT_POSITION`. **`ModifierBar.ts` drops from 270 to 193, under the limit.** 741 tests green.

  **`BarChrome`** builds the bar's furniture, and separating it lets the one load bearing line be
  asserted rather than merely commented:

  > **`data-tongs-browser="ignore"`, without which the bar cannot work at all.** Every touch on the
  > page is routed through the virtual pointer, so a tap on a modifier key would become a pointer event
  > delivered wherever the pointer happens to be. The key would modify a click somewhere else on the
  > map rather than latching, which is the exact opposite of its job.

  Also now asserted: `pointercancel` goes to the SAME handler as `pointerup`, because the browser
  cancels a pointer whenever it takes a gesture over and a bar that never hears about it is left
  believing a finger is still down, so the next unrelated move drags it across the screen.

  **`BarAttachment`** owns the two moments that are easy to get wrong:

  > **The clamp runs AFTER the element is in the document**, which is the first moment it has a size. A
  > constructor clamp cannot possibly succeed: an element not in the DOM reports `offsetWidth` 0, every
  > position fits inside a width of zero, and the clamp is a no op BY CONSTRUCTION. Measured on a 412px
  > phone, the bar still opened across the sidebar, because opening is not dragging.

  > **Held modifiers are released BEFORE the bar vanishes**, or Foundry is left believing shift is down
  > with no visible way for the user to clear it: the bar that would have shown it is gone.

  Production files over 200 lines: **five this morning, two now**.

## 0.25.30

### Patch Changes

- [#164](https://github.com/LewisIsWorking/Tongs-Browser/pull/164) [`c882256`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c8822566bf78b9b8df7b1544dae1f3e37f4b1796) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract `pointer/DragController.ts` at 100% coverage. **`VirtualPointer.ts` drops from 237 to 199,
  under the limit**, and 725 tests stay green including the 512 line pointer suite.

  The three parts move as one: whether a button is held, WHICH button, and which element owns the
  gesture. Splitting them is how a drag ends up half released, with Foundry still believing a button is
  down and a token stuck to the pointer.

  What the new suite pins, none of it visible to a build:

  - **The capture is claimed AFTER the press is dispatched**, because the press is what resolves the
    element. Claiming before would capture whatever the previous gesture left behind.
  - **The release goes to the element that received the press, not where the drag ended.** The target
    is resolved before the held flag is cleared; resolving after takes the fallback path and hit tests
    at the pointer, which by then is wherever the finger stopped.
  - **Any movement during a held drag is a drag move**, dispatched at the captured element. The buttons
    bitmask has to stay set on every move between the down and the up, or Foundry reads the stream as a
    hover and nothing follows the pointer.
  - **`moveStep` reports whether it handled the move**, so the caller falls through to ordinary hover
    handling rather than the two paths each deciding separately what state they are in.
  - **A detached capture falls back to a hit test.** Foundry re-renders applications mid interaction,
    and dispatching at a detached element throws the event away silently.

  Production files over 200 lines: **five this morning, three now**.

## 0.25.29

### Patch Changes

- [#162](https://github.com/LewisIsWorking/Tongs-Browser/pull/162) [`61cdd8a`](https://github.com/LewisIsWorking/Tongs-Browser/commit/61cdd8a4a5a4ccc175bed6642e9cb7d406b71f4c) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add `lint:docblocks`, a guard for comments that document nothing, and clear the last three.
  `TongsBrowser.ts` 970 to 944.

  **A comment is anchored to the declaration BELOW it.** Move that declaration during a refactor and
  the comment does not move with it: it silently re-anchors to whatever is next and goes on reading as
  documentation of a field it has nothing to do with. Worse, if the extraction did not carry the
  reasoning across, the orphan is the ONLY copy and the next person to tidy it deletes it.

  Found by hand after eight blocks had accumulated in `TongsBrowser` across today's extractions. The
  guard fires on an indented docblock immediately followed by another, which is the signature.

  Three things worth recording about building it:

  - **The self test failed on the first run**, correctly. A file level docblock closes with ONE space
    of indent and a block inside a class body with three, so matching a single space flagged every file
    header in the repo followed by its first export. That is the ordinary and correct shape, and the
    guard would have had to be turned off rather than trusted.
  - **The first real run caught an orphan created ten minutes earlier**, by this same change, when a
    rescued block was placed above a method that already had one.
  - **That block was not unique after all.** The check for "does this content exist elsewhere" used an
    exact phrase, `leak them into`, and the existing copy said `leak them across`. An exact phrase grep
    cannot detect a reworded duplicate, and only the guard found it.

## 0.25.28

### Patch Changes

- [#160](https://github.com/LewisIsWorking/Tongs-Browser/pull/160) [`fe31417`](https://github.com/LewisIsWorking/Tongs-Browser/commit/fe31417f94bef843d8657ceabc3a759f40a0bd48) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Re-home five orphaned docblocks onto the fields they actually describe, and split `debug/Peak.ts` and
  `debug/DragMeasurements.ts` out of the sampler.

  ⚠️ **The rationale did not survive an earlier extraction.** When the drag measurements moved into
  `DragSampler`, the field declarations went and the comments did not. Five large blocks were left in
  `TongsBrowser` with nothing beneath them, so they had drifted to sit above an unrelated field and read
  as documenting it. They were also the ONLY copy: none of that reasoning existed anywhere else.

  What they record, now beside the fields they belong to:

  - **A zero that measured nothing looks exactly like a zero that measured a still pointer.** The gate
    peak starts at 0 and is only written when both Foundry's `screenOrigin` and PIXI's pointer are
    readable, so a report printed "peak distance 0.0px, needs >= 10" for a measurement that never ran.
  - **`0.0px over 47 samples` is evidence; `0.0px over 1 sample` is noise wearing the same clothes.**
    This mistake was made three times in one investigation.
  - **Two completely different bugs both produce `gate distance 0.0` and a token that does not move**,
    and their fixes share no code. Measuring our own travel against our own grab point touches no
    Foundry state, so it cannot be confounded by whatever Foundry is doing.
  - **`screenOrigin` is PINNED on desktop and under emulated touch**: 800 across twelve steps, 683
    across twelve more. So an origin that follows the pointer is not something the module does in the
    ordinary case.

  `TongsBrowser.ts` is under 1,000 for the first time, at 970 from 1,853 this morning. Moving the
  comments took `DragSampler` over the limit, so `Peak` and the sampler's input and output contracts
  now have their own files and it is back to 190, under.

## 0.25.27

### Patch Changes

- [#158](https://github.com/LewisIsWorking/Tongs-Browser/pull/158) [`e58f934`](https://github.com/LewisIsWorking/Tongs-Browser/commit/e58f934d697074a7502cee45bb4d529110a42e91) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix the drag sampler reading the controlled token TWICE per sample, and extract
  `debug/InteractionSample.ts` at 100% coverage. `TongsBrowser.ts` 1,078 to 1,051.

  The sample reached `canvas.tokens.controlled[0]` once for the interaction state and again, a dozen
  lines later, for the drag origin. Between those two reads a selection can change or a token can be
  released, and the sample would then pair **one token's interaction state with another token's drag
  origin**: a reading that describes no moment that ever existed, and which looks entirely ordinary in
  the report.

  The token is now resolved once and every field read off that one reference. A test proves it by
  handing the reader a `controlled` array whose element changes on each access and asserting it is
  touched exactly once.

  **This is the fifth instance today of a single family**, and the fourth in the diagnostic itself: a
  snapshot assembled from readings taken at different moments. The others were the move denominator
  counting past the drop, Foundry's state read at several points, PIXI's pivot handed back live rather
  than copied, and the PIXI counters read four times.

  Also documented where it belongs: this is sampled **as it happens** rather than when the report is
  written, because Foundry resets the manager to NONE the moment an interaction ends, so a reading
  taken afterwards says NONE whether the drag never started or ran perfectly and committed.

## 0.25.26

### Patch Changes

- [#156](https://github.com/LewisIsWorking/Tongs-Browser/pull/156) [`b33f0ac`](https://github.com/LewisIsWorking/Tongs-Browser/commit/b33f0acd6705f0b1b3eb979ffb79577d06e2ff87) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Fix the diagnostics report reading the PIXI move counters at four different moments, and extract
  `debug/ChatTargets.ts` at 100% coverage.

  **The report could disagree with itself about a single gesture.** `getCounts()` returns a fresh
  object on every call, and it was being called four separate times while assembling the payload:

  ```
  moves: {
    token: this.pixiProbe.getCounts().token,
    layer: this.pixiProbe.getCounts().layer,
    stage: this.pixiProbe.getCounts().stage,
  },
  ...
  probeAttached: this.pixiProbe.getCounts().attached,
  ```

  The PIXI listeners behind those numbers fire continuously while the pointer moves, which it may well
  still be doing as the report is built, so the four fields were four different moments. Read once now,
  the same rule already applied to `readFoundryFacts`. This is the fourth instance today of the same
  family: a snapshot assembled from readings taken at different times.

  **Chat targets** are now read in one place, as separate optional chains rather than one guard over
  both, because they fail INDEPENDENTLY: a world can have chat while the notification banner is
  unavailable, and a client can have notifications up before chat exists. Treating them as one thing
  loses the report entirely whenever either is missing, and the whole point of this report is that it
  reaches somebody holding a phone with no devtools.

## 0.25.25

### Patch Changes

- [#154](https://github.com/LewisIsWorking/Tongs-Browser/pull/154) [`690c406`](https://github.com/LewisIsWorking/Tongs-Browser/commit/690c406b4756929d4ec7bccf9d123fc24190a1f1) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract `debug/TokenMovement.ts` at 100% coverage, and give the diagnostics report's most important
  line a test of its own.

  ⚠️ **This is the only field in the report that answers the question anybody actually asked.** Every
  other field describes EVENTS: what was dispatched, what state Foundry reached, how far the pointer
  travelled. All of those can look perfectly healthy while the token sits exactly where it started,
  which is precisely what happened for three rounds of diagnosis.

  The distinction now pinned, which had never been asserted:

  > **The two "cannot say" answers are DIFFERENT strings, and neither is a NO.** "No grab recorded"
  > means the button was never pressed, so the report is about nothing. "No token selected now" means
  > the selection was lost between the grab and the report, which is itself a finding: a token that
  > deselects mid drag is one of the ways a drag silently ends.
  >
  > Collapsing either into NO would report a failure that was never measured.

  Also recorded: both coordinates print whatever the answer, because a bare NO leaves open whether it
  was even the same token; the comparison is exact rather than tolerant, since Foundry snaps a dropped
  token to the grid so a committed move is always a whole square; and a coordinate of zero is a real
  position rather than a missing one.

  `TongsBrowser.ts` 1,080 to 1,075. 700 tests.

## 0.25.24

### Patch Changes

- [#152](https://github.com/LewisIsWorking/Tongs-Browser/pull/152) [`7237b39`](https://github.com/LewisIsWorking/Tongs-Browser/commit/7237b39e9a81c4c945110bcb320f800672fcc1dc) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract the pointer wiring into `PointerStack.ts` at 100% coverage. `TongsBrowser.ts` 1,101 to 1,080.

  The cursor, hit tester, dispatcher and pointer are one unit: none is useful alone, and the couple of
  decisions in how they are joined are the sort a build cannot check and that read as arbitrary until
  something breaks. Three now have tests rather than only comments:

  - **The pointer starts in the MIDDLE of the viewport.** Anywhere else and the first thing a user does
    is drag it out of a corner, and a pointer at (0, 0) is easy to mistake for one that never appeared.
  - **`elementFromPoint` is reached through the document, not passed as a bare reference.** It throws if
    it loses its receiver, and `elementFromPoint: doc.elementFromPoint` looks like a shorter way to say
    the same thing and is a TypeError at the first hit test. The test stubs a version that reads `this`,
    so a lost receiver fails there exactly as it would in a browser.
  - **Every dispatched event reaches the caller.** That callback is the seam the debug overlay and the
    drag record both hang off, and a pointer wired without it looks completely normal and reports
    nothing.

  Separating `eventView` from `window` is a real distinction rather than a test accommodation, and the
  existing pointer suite had already found it: vitest's jsdom window is not a BRANDED Window, so
  `new PointerEvent({ view })` rejects it with "member view is not of type Window". The viewport size
  still has to be read from somewhere, so the two are now separate fields with the reason written down.

## 0.25.23

### Patch Changes

- [#150](https://github.com/LewisIsWorking/Tongs-Browser/pull/150) [`76bb8fb`](https://github.com/LewisIsWorking/Tongs-Browser/commit/76bb8fbe04c4ec7e6fd57846a3767fe73c0ff12b) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract `foundry/AvailableWidth.ts` and `foundry/CanvasReaders.ts`, both at 100% coverage.
  `TongsBrowser.ts` 1,134 to 1,101.

  **Available width** is the other half of the sidebar avoidance in `BarClamp`: that one decides where
  the bar goes given a width, this one decides what the width is. Three separate ways the sidebar can
  be present in the DOM and still not be in the way, all now tested:

  1. **Zero width.** Foundry COLLAPSES the sidebar rather than removing it, so a collapsed sidebar is
     still an element with a box. Treating it as an obstacle shrinks the bar to nothing for a user who
     deliberately made room.
  2. **Entirely off the right edge**, mid animation or on a layout wider than the window.
  3. **Entirely off the left edge.**

  Plus: never negative, since a negative available width makes every clamp downstream nonsense.

  **The canvas readers** all read FRESH rather than caching, which is the point of gathering them.
  Foundry fits a scene to the viewport on load, the user can zoom with the wheel or Foundry's own
  controls, and a scene change replaces the stage outright. A stale scale silently multiplies into
  every pinch that follows.

  The pivot reader now has a test for something that was true and unstated: **it copies rather than
  handing back PIXI's live object**, which mutates in place on every pan. Returning the live one gives
  the caller a value that changes underneath it, so a "before" reading taken for comparison silently
  becomes the "after" one and every delta measures zero. That is exactly the failure the drag
  diagnostics have been chasing all week.

  `readZoomLimits` falls back **per bound** rather than all or nothing, because these have moved
  between Foundry versions and a missing one produces NaN scales, which render as a blank canvas with
  no error anywhere.

  Also removes an orphaned duplicate docblock left in `TongsBrowser` by the earlier `SidebarAccess`
  extraction. Its content already lives in that file; two stacked docblocks was a leftover from that
  edit, not a second explanation.

## 0.25.22

### Patch Changes

- [#148](https://github.com/LewisIsWorking/Tongs-Browser/pull/148) [`984216b`](https://github.com/LewisIsWorking/Tongs-Browser/commit/984216bd57e06088e37dbf66cd601d0b2da75285) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract two pure gesture decisions out of the state machine, both at 100% coverage:
  `gesture/PointerTranslation.ts` and `gesture/TapWindow.ts`. `GestureStateMachine.ts` 368 to 330.

  **Pointer translation** is the two modes, which exist because a phone and a tablet want different
  things and neither is a compromise for the other. Trackpad applies a RELATIVE delta so the pointer
  stays where it was left and sensitivity multiplies reach, which is what lets a thumb cover a screen
  wider than it can span. Offset places the pointer a fixed distance ABOVE the finger so the finger
  never covers the target, which suits a tablet where reach is not the problem.

  The case worth having a test for:

  > **Trackpad mode emits NOTHING when there is no previous position.** Without one the only available
  > origin is the origin, so a first move would fling the pointer by the full distance from the top
  > left corner of the screen to the finger. Offset mode has no such gap, because it is absolute, and
  > that difference is now asserted rather than implied.

  **The tap window** answers whether a new touch belongs to the tap before it, and it deliberately does
  **not** decide between a double tap and a tap then hold drag. Both begin identically: a tap, a lift,
  and a second touch soon after and close by. Only the DURATION of the second touch tells them apart,
  so the same state covers both and the timer decides.

  Both a time and a distance are required, and both now have tests saying why: time alone would join a
  tap here to a tap across the screen a moment later, which is two separate intentions; distance alone
  would join a tap to one in the same place a minute later, which is somebody returning to a control
  they already used. The slop is a radius rather than a bounding box, so 15px on each axis correctly
  falls outside a 20px slop.

## 0.25.21

### Patch Changes

- [#146](https://github.com/LewisIsWorking/Tongs-Browser/pull/146) [`a7664de`](https://github.com/LewisIsWorking/Tongs-Browser/commit/a7664def688f8afe688d586043211d9e5a70c631) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract the modifier keys into `modifiers/KeyButtons.ts` at 100% coverage. `ModifierBar.ts` drops
  from 391 to 270, and is now a bar that arranges things rather than one that also implements them.

  A key here has **three** states rather than two, which is the whole design: off, latched for the next
  action only, and locked until tapped off. Sticky keys are how a one finger user reaches shift-click
  at all, and two states would force a choice between "cannot chord" and "silently still held ten
  minutes later".

  The new suite pins the parts that only a test can see:

  - **`data-latch` as well as the class.** `aria-pressed` is a boolean and cannot say which of latched
    or locked a key is in, and those differ in exactly the thing a user needs to predict: one survives
    the next action and one does not.
  - **Diffing rather than replaying.** Re-pressing an already held key sends a duplicate keydown, and
    Foundry reads a repeated keydown as auto repeat, so a held Shift would arrive as a stream of
    repeats. The latched to locked step now provably presses nothing.
  - **A momentary key consumes LATCHED and leaves LOCKED held**, which is what those two words mean.

  The compiler caught a real hazard during the move: `KeyButtons` was first written as a field
  initialiser reading `this.options`, and **field initialisers run before a constructor's parameter
  properties are assigned**, so it would have read undefined. It is now built in the constructor body,
  with a note saying why. The equivalent in `BarDragHandle` happens to be safe only because it reads
  its options lazily from inside a closure.

  Two tests were reaching into `ModifierBar`'s privates for state that has now moved. Both were
  retargeted at the class that owns it, including the key list drift guard, which is the one that stops
  a modifier latching in the UI while Foundry never hears about it.

## 0.25.20

### Patch Changes

- [#144](https://github.com/LewisIsWorking/Tongs-Browser/pull/144) [`d12072e`](https://github.com/LewisIsWorking/Tongs-Browser/commit/d12072e2cd803a6e81da3192589e6c0b4335d7fd) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract dragging the bar by its handle into `modifiers/BarDragHandle.ts` at 100% coverage.
  `ModifierBar.ts` drops from 427 to 391.

  The bar has to be movable because there is nowhere on a phone screen that is out of the way of
  everything: whatever the default, some scene, sheet or dialog will sit under it.

  What the new suite pins, none of which a build can check:

  - **The grab point stays under the finger.** Without the recorded offset the bar's CORNER jumps to
    the finger on the first move, which reads as the bar being snatched rather than dragged.
  - **One pointer id, checked by every handler.** A second finger landing anywhere would otherwise
    deliver its moves here too and the bar would jump between the two. On a phone that is not rare: it
    is what happens when somebody steadies the device with their other hand.
  - **Pointer capture is feature detected, not trusted from the type.** `lib.dom` declares it as always
    present on `Element`, but jsdom does not implement it, so calling it blind throws in every test
    that presses this handle. There is now a test that IS that case.
  - **`preventDefault` on the press and on every move**, or the browser scrolls the page while the bar
    is being dragged and the two move together.

  634 tests green, including the existing 336 line drag handle DOM suite, so behaviour is preserved.

## 0.25.19

### Patch Changes

- [#142](https://github.com/LewisIsWorking/Tongs-Browser/pull/142) [`c066007`](https://github.com/LewisIsWorking/Tongs-Browser/commit/c066007ce8553e062bd1f51fa1ffb1c7f0e61cd6) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract the bar's utility buttons into `modifiers/ActionButtons.ts` at 100% coverage.
  `ModifierBar.ts` drops from 514 to 427.

  These sit **outside** the keys container on purpose, so they survive the bar being collapsed:
  collapsing hides the modifier keys, which is the point of collapsing, but an action like "show the
  sidebar" is most needed exactly when the bar has been shrunk out of the way.

  What the new suite pins:

  - **Grouped buttons share one container**, so related controls cluster rather than wrap apart. Four
    pan arrows split across a line break stop reading as a d-pad and become four unrelated arrows.
  - **The label is refreshed as well as the latch.** A latched button whose label never changes cost a
    whole round of device diagnostics: the gold styling says "on", but "on" does not tell you the next
    thing to do is tap it OFF.
  - **`aria-pressed` as well as the class**, because a latch that is only a colour is invisible to a
    screen reader and to anyone who cannot tell this gold from this grey.
  - **A refresh runs immediately after an action**, so a button that reports state is never a tap
    behind the truth.

  Two existing tests reached **two levels** into `ModifierBar`'s privates to delete an entry from its
  action map. That map now belongs to `ActionButtons`, so those cases moved to a suite on the class
  that owns it, where the missing button case is a legitimate thing to describe rather than a coverage
  manoeuvre. `TrayAction` moves to its own file so `ActionButtons` can describe one without importing
  the bar that imports it, and is re-exported so every existing importer keeps working.

## 0.25.18

### Patch Changes

- [#140](https://github.com/LewisIsWorking/Tongs-Browser/pull/140) [`61d4772`](https://github.com/LewisIsWorking/Tongs-Browser/commit/61d47724bb1ea01f62ebed568f899ce6e388a34c) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Extract pointer capture into `pointer/DragCapture.ts` at 100% coverage, and remove two duplications
  in `VirtualPointer` that were each a drift risk. 259 lines down to 237.

  **The capture** is the browser's implicit pointer capture, reimplemented, because a synthesised
  pointer does not get it for free. It carries the bug behind "dragging a token does nothing" on a real
  phone: VirtualPointer used to hit test afresh on every step, so the moment the pointer crossed a chat
  window, the modifier bar or a sheet, the drag events went THERE and the canvas stopped hearing about
  the drag. Measured on a device as `pointermove buttons=1 -> div#` when it needed `canvas#board`.
  Never seen on desktop, because a drag across empty canvas never crosses anything.

  The original reason for re-resolving was real and is preserved and now tested: Foundry re-renders
  applications mid interaction, so a captured element can be **detached**, and dispatching at a
  detached element throws the event away silently.

  **Two duplications removed**, both the same shape as the two finger states earlier today: near
  identical code differing by one value.

  - `endDrag` and `cancelDrag` differed only in the sequence sent. Now one path with a parameter, with
    the target resolved BEFORE the flag is cleared, since resolving after would take the fallback path
    and hit test at wherever the drag ended rather than at whatever received the press.
  - `dragBy` was a second copy of `applyMove`'s drag branch, and it is now routed through it. That is
    precisely what the comment in `applyMove` argues for: the copy in `moveTo`/`moveBy` was the one
    that forgot to keep the buttons bitmask set, which silently degraded a held grab into a hover.
    Routing on the drag STATE rather than on which method was called is what stops them drifting again.

  613 tests green throughout, including the 512 line pointer suite, so behaviour is preserved. The
  cursor now follows the CLAMPED position during a drag rather than the requested one, which is a small
  improvement that fell out of the dedup.

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
