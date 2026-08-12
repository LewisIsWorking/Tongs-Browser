---
'tongs-browser': patch
---

Fix the diagnostics report reading the PIXI move counters at four different moments, and extract
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
