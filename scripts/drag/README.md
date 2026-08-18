# scripts/drag

Driving a token drag through the module's own pointer API and measuring what Foundry did about it.
This is the check that diagnoses the bug the whole module exists for: a long press on a tablet that
grabs a token and then loses it.

| File            | What it is                                                                    |
| --------------- | ----------------------------------------------------------------------------- |
| `DragToken.ts`  | The drag itself, run inside the page, returning a trace rather than a verdict |
| `EvaluateOn.ts` | The one call Playwright's `Page` and the raw CDP client agree on              |
| `Options.ts`    | Distance, steps, timeout, pan, and `HOLD_MS`                                  |

## Why `DragToken.ts` is allowed over 200 lines

It is the last file in the repo over the limit, and it is held at its **exact** current length by
`scripts/file-size-ratchet.json`, so it cannot grow. This is not an exemption anybody is comfortable
with, so here is the whole reason, to save the next person deriving it.

The body is a single function handed to `evaluate`, which **serialises** it and runs the source in
the browser. Nothing it calls can be an import, so every helper has to be defined inside the one
function that uses it. That is what makes the file long.

`scripts/foundry-play-probe.ts` had exactly this problem at 572 lines and was split on 2026-08-18 by
installing its helpers with `page.addInitScript` and meeting at a single `window` namespace (see
`scripts/probe/PlayRuntime.ts`). **That solution does not transfer here**, for two independent
reasons:

1. `CdpPage` implements `evaluate` and nothing else. It is a hand written CDP client whose entire
   purpose is driving a phone over adb, and it has no `addInitScript`.
2. Adding one would not help. On the device path the harness **attaches to a tab that is already
   open** and never navigates, and a script registered to run on new documents never fires.

What remains are `eval`-family tricks that inject helper source as a string argument. Those would
work on both surfaces, at the cost of making the most diagnostic-dense file in the repo harder to
read, to satisfy a line count, on a code path that **cannot be tested without a tablet attached**.
That was declined on 2026-08-18 with `adb devices` empty.

The file is roughly half comment, and the comments are the asset: most paragraphs record a
measurement that took a physical device to make, including several that explain why an earlier
version of this check reported a confident number that was wrong. Trimming them to reach 200 would
delete the expensive part and keep the cheap part.

### What would change the answer

Any one of these, in rough order of likelihood:

- **A second surface needs the same drag.** Duplication would then be the forcing function, and the
  need would pick the mechanism rather than a line count picking it.
- **A tablet is attached and `npm run check:android` can run.** The `eval`-injection split becomes
  verifiable on both paths, and verifiable is the bar this repo holds harness changes to.
- **`CdpPage` grows a real init-script path** that works against an already-open tab, at which point
  the play probe's namespace approach transfers directly.

Until then: do not trim it, and do not raise its ceiling. `node scripts/check-file-sizes.ts --update`
will record any genuine reduction.

> Flags go through `node`, not `npm run ... --`. npm 12 parses unknown flags itself even after the
> `--` separator, so `npm run check:drag -- --hold=700` fails before the script starts. Use
> `node scripts/foundry-drag-check.ts --hold=700`.
