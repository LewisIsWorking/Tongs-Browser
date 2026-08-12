---
'tongs-browser': patch
---

Wire in `PixiMoveProbe`, which had been extracted, covered, and then never used.

The class was written days ago, brought to 100% on all four metrics, and never imported. The
composition root kept its own inline copy of the same counting, so there were two implementations of
one thing and only one of them had tests. That is worse than either alternative: the covered version
made the whole area look done while the version that actually ran was untested.

Found by grepping for the import rather than for the file, which is the check worth remembering: a
module can exist, be correct and be covered while nothing calls it. Extraction is not finished when
the new file passes, it is finished when the old code is gone.

The inline duplicate and its five fields are deleted. `TongsBrowser.ts` is down from 1,853 to 1,563.
