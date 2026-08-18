# src/debug

Finding out what Foundry actually did, on a device you cannot attach a debugger to.

This is the largest folder in the module, and that is not accidental. Most failures here are
**silent**: the token does not move, nothing throws, and the console says nothing. Everything below
exists to turn one of those silences into a sentence.

| File                     | What it is                                                   |
| ------------------------ | ------------------------------------------------------------ |
| `DragDiagnostics.ts`     | The coordinator the rest hangs off                           |
| `DragObservers.ts`       | Attaching the observers to Foundry and PIXI                  |
| `FoundryDragHooks.ts`    | Wrapping `draw`, `destroy` and friends to see when they fire |
| `PixiMoveProbe.ts`       | Counting moves delivered to the token layer versus the stage |
| `DragRecorder.ts`        | Collecting observations in order                             |
| `DragSampler.ts`         | Reading the three positions that must agree                  |
| `DragMeasurements.ts`    | Turning samples into numbers                                 |
| `DragCallSite.ts`        | Who started this drag                                        |
| `DragCaptureWindow.ts`   | The window in which a capture is valid                       |
| `DragPermissions.ts`     | Whether Foundry would even allow the drag                    |
| `DragEndingSummary.ts`   | Why the drag ended, decided by outcome                       |
| `TokenMovement.ts`       | Did the token move, in one computation                       |
| `TokenHitTest.ts`        | Was the press on the token at all                            |
| `RedrawEffect.ts`        | Whether a redraw cancelled the interaction                   |
| `InteractionSample.ts`   | One reading of the interaction manager                       |
| `Peak.ts`                | The furthest state a drag reached                            |
| `DispatchTrace.ts`       | Every event we dispatched, in order                          |
| `FoundryProbes.ts`       | Point questions about Foundry's state                        |
| `FoundryFacts.ts`        | Version, system, and what is enabled                         |
| `DiagnosticsReport.ts`   | Assembling the report                                        |
| `DiagnosticsDelivery.ts` | Getting it off the device                                    |
| `DebugJournal.ts`        | Writing it into a journal entry                              |
| `JournalSection.ts`      | One section of that                                          |
| `DebugOverlay.ts`        | Showing it on screen                                         |
| `ChatTargets.ts`         | Sending it to chat                                           |
| `Clipboard.ts`           | Copying it                                                   |

## Report the outcome, then the mechanism

`DragEndingSummary.ts` decides its verdict from **what happened to the token**, and only then explains
by mechanism. The reverse order produced a report that contradicted itself: it announced a cancelled
interaction in one line and a moved token in the next, because it had found a `cancel` in the
observations and stopped looking.

Related: the cancel observations are matched by **method-name prefix**, not by the word "cancel"
appearing anywhere. Matching the bare word matched the harmless note "did not cancel anything".

## Three answers, not two

`RedrawEffect.ts` returns _cancelled_, _at or below HOVER_, or **no manager to read**. That third
answer is the one that matters: collapsing it into "did not cancel" claims a clean reading of
something that was never read. The same discipline appears in `serverAbsence.ts` and in the README
guard, and it is the single most repeated lesson in this repository.

## Wrapping is a read-modify-write

`FoundryDragHooks.ts` monkey-patches Foundry prototypes. `proto.draw = wrap(proto.draw)` run twice
does not replace the wrapper, it **composes** it: diagnostics were once ~150 layers deep, so a single
call announced itself 150 times and cost real time in the live game.

The fix is a marker on the wrapper, using `Symbol.for` rather than a plain symbol, so that two copies
of the bundle recognise each other's work.

## A comment is not a caller

When checking whether a duplicate still exists, strip comments first. A grep for a symbol matched the
word inside a docblock and reported the mutation as unapplied.

## The instrument is usually the thing that is wrong

Four times now, this suite has reported a capability broken that was working. Every one was the
instrument: a probe placed before the damage, a counter on a callback bound at construction, a report
read at several moments, and a read of the wrong actor. Before believing a diagnosis from this folder,
ask what it would print if the module were fine.
