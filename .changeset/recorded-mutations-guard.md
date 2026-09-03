---
'tongs-browser': patch
---

Add `npm run check:mutations`, a guard that applies recorded defects to the real source and requires
the tests to catch them. It closes a gap the coverage ratchet cannot see: coverage asks whether a
line ran, not whether a wrong version of it would be noticed. The first recorded mutation passed
eleven tests at 100% coverage of the line it changed.
