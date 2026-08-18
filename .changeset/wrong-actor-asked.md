---
'tongs-browser': patch
---

The play probe asked the wrong actor, and reported a working capability as broken.

"Open the character sheet by double click" had been failing on 14.366. It is not broken. `Token#_onClickLeft2`
renders `this.actor`, and for an **unlinked** token that is a synthetic delegate with its own sheet
instance, so asking the base actor returns `rendered: false` about a sheet that is open on screen.

Measured live: `sameActorObject` false, `baseActorSheetRendered` false, `tokenActorSheetRendered`
true, with a visible "Diver: [probe] synth" window in the DOM. `can("clickLeft2")` was allowed all
along, so the double click had always been recognised.

The probe now reads `token.actor ?? actor`, which keeps a linked token working unchanged. All nine
capabilities pass on a live 14.366.
