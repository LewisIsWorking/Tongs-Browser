# 8. The escape hatch was absent, and then buried

Date: 2026-08-09

Status: Accepted

## Context

The scene control toggle exists for one reason, stated in its own class comment:

> If the pointer misbehaves mid session, opening the settings dialog to disable it means using the
> pointer to do so, which is exactly the thing that is not working.

It is the control that has to work when nothing else does. On Foundry 14.365 it did not exist at all,
for two independent reasons, and once it did exist the module's own default layout covered it.

Found by auditing what nothing had ever measured against a live Foundry, in the same sweep that
produced [ADR 0007](0007-pinch-must-build-on-the-canvas-actual-scale.md).

## Three faults, each measured

### 1. Registered too late to be heard

`main.ts` bound the `getSceneControlButtons` hook inside `Hooks.once('ready')`. Foundry's own
`scene-controls.mjs` says on `#prepareControls`:

> This is only done once when the application is first rendered. Subsequent renders reuse this data
> structure.

Measured: a listener added at `ready` fired **zero times**, including after
`ui.controls.render({ force: true })`. Fixed by binding at `init`. The callbacks read `instance` and
`store` when invoked rather than capturing them, so binding before either exists is safe.

### 2. Looking for a group that does not exist, and guessing when it failed

`findTokenGroup` looked for `token`. On 14.365 the group keys are `regions, drawings, tiles, walls,
tokens, sounds, lighting, notes`. Foundry's own documented example for this hook writes to
`controls.tokens.tools`.

Worse than the miss was the fallback: when no token group was found it took
`Object.values(record)[0]`, which is **regions**. So with the timing fixed and the name still wrong,
the escape hatch would have appeared silently in the wrong toolbar. A button in the wrong place is
worse than no button, because an absence is diagnosable and a silent relocation is not. The fallback
is gone; `findTokenGroup` now returns null rather than guessing.

A third, quieter fault sat behind both: Foundry does `control.tools ??= {}` **after** calling the
hook, so a group with no tools of its own arrives with `tools` undefined. The old
`typeof group.tools === 'object'` test is false for undefined and wrote nothing.

### 3. Then the module's own bar covered it

With the toggle finally rendering, the default modifier bar position buried it. Measured on 14.365:

|                                            | Rectangle                 |
| ------------------------------------------ | ------------------------- |
| Scene control toolbar                      | x 12 to 66, y 12 to 669   |
| Modifier bar, at the old default (16, 120) | x 16 to 462, y 120 to 174 |
| The Tongs toggle                           | x 42 to 66, y 132 to 156  |

The toggle was **entirely inside** the bar, and `elementFromPoint` at its centre returned
`button.tb-modifier-bar__collapse`. A real finger could never have reached it. The default moved to
x 88, which clears the toolbar on any viewport wide enough for Foundry to run at all.

## Also found in the same audit

`#chat-log` matched **zero** elements on 14.365. The log is `<ol class="chat-log">`; the id belongs to
the v12 markup. The exclusion behaviour survived only because `.chat-scroll` wraps the log and
`closest` found that instead, which is luck rather than design. `.chat-log` added alongside the id.

## Consequences

**The escape hatch works**, verified live: registered in `tokens`, rendered in the toolbar, not
covered by the bar, and toggling it flips the module and comes back.

**Guarded behaviourally, not by selector.** The reachability check hit tests the toggle's centre,
because that is the question a finger asks and it is the one a rectangle comparison would get subtly
wrong. The chat exclusion is checked by dragging a real finger inside the chat region and asserting
the pointer does not move, because a selector list can agree with itself while matching nothing,
which is exactly what `#chat-log` was doing.

**One limit, stated rather than glossed.** The toggle is exercised through the tool's own `onChange`,
the callback Foundry invokes, not by clicking the button: a synthetic click was measured not to
reach Foundry's `data-action="tool"` routing. That is a harness limitation. Between the reachability
hit test and the callback check, the only unproven link is Foundry's internal dispatch.

## What this says about the method

All three faults were in code with tests that passed. One test actively encoded the bug: _"falls back
to the first group when there is no token group"_ asserted the behaviour that would have hidden the
button in `regions`. A test can hold a mistake still as easily as it can hold a behaviour.
