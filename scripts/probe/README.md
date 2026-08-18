# scripts/probe

Can someone holding only the virtual pointer actually **play the game**? The `check:` scripts answer
"did the event arrive" and "did Foundry's state change". This folder answers the blunter question:
select a token, open a sheet, drag a figure, open the HUD, zoom, roll dice, make an actor.

| File                      | What it is                                                                   |
| ------------------------- | ---------------------------------------------------------------------------- |
| `PlayRuntime.ts`          | The shape installed into the page, and **why** it has to be installed at all |
| `PlayKit.ts`              | Fixtures, aiming, trials, and the pointer-versus-control comparison          |
| `PlayEvents.ts`           | Building the DOM events a native control path dispatches                     |
| `PlayFixture.ts`          | A fresh actor and token per trial, torn down again afterwards                |
| `PlayCanvasChecks.ts`     | The six capabilities on the board                                            |
| `PlayCreateActorCheck.ts` | Creating an actor from the sidebar, end to end through the pointer           |
| `PlaySidebarChecks.ts`    | Ownership, and dragging an actor onto the map                                |
| `GrabButtonProbe.ts`      | The grab button path, used by `check:grab`                                   |
| `Trials.ts`               | What a trial is and what it concludes                                        |
| `Report.ts`               | Turning rows into the table a human reads                                    |

## Read `PlayRuntime.ts` first

`page.evaluate` **serialises** its callback and runs the source in the browser, so nothing it calls
can be an import. That is why the probe was a single 572 line function for months, and it is not a
style choice you can undo by splitting files.

`page.addInitScript` serialises the same way but installs onto `window` before the page's own scripts
run, and survives the navigations and reloads that joining a world performs. So these pieces can be
separate modules, **as long as each is self contained at runtime**: no cross-module references inside
a callback, only through the one namespace. Types are free, since they are erased before
serialisation.

The installs must happen **before** joining, because `addInitScript` applies to future navigations.

## The four corrections this probe carries

Two earlier versions reported confident capability gaps that did not exist. Every failure they found
survived isolation intact: the module was fine and the instrument was not.

1. **The control runs from the same fresh state as the subject.** A control that runs second, from
   the wreckage the subject's failure left, is a sequel rather than a control.
2. **Every path runs three times.** A capability that works once and not again is _flaky_, which is
   its own finding and used to be reported as a pass.
3. **Every trial builds its own actor and token.** All seven capabilities once shared one actor, one
   token and one accumulating world. A probe that reuses a fixture across cases measures history.
4. **`AIM` is a third outcome and not a failure.** It means the pointer never reached the target, so
   the trial says nothing about the capability. Folding it into `no` reports "this feature is broken"
   for what is actually "the test could not be performed", and those lead to different work.

That fourth rule paid for itself on 2026-08-18: "create an actor from the sidebar" reported `AIM`
rather than a false `no`, because the sidebar starts collapsed and `changeTab` does not expand it, so
every sidebar button had a layout box with its centre off screen. The kit's `openTab` expands it now.

## Running it

```
PROBE_TRIALS=1 node scripts/foundry-play-probe.ts
```

⚠️ It **writes to a live world**: a `[probe]` scene if there is none, plus a `[probe]` actor and token
per trial. All removed as it goes, and the scene in the `finally`.
