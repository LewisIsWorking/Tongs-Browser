---
'tongs-browser': patch
---

Extract dragging the bar by its handle into `modifiers/BarDragHandle.ts` at 100% coverage.
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
