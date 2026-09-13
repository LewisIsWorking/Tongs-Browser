---
'tongs-browser': patch
---

Bring the first-install checklist up to date for 0.28.0.

It still told a first install to expect version 0.26.0, and said sheet creation had only been read
from `sf2e` and should be treated as unverified. Both are out of date: 0.28.0 is the version a new
install receives, and the GM creation path was verified live on real PF2e 8.5.0 on 2026-09-13.

It now also says plainly that creating a sheet threw on every real Foundry before 0.28.0, with the
error text, so an older install is recognisable rather than looking like a new bug. The player path is
still marked as tested at the desk only.
