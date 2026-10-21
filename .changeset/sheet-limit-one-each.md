---
'tongs-browser': patch
---

Fix the character sheet limit: every player gets 1 sheet in each world, `/extrasheet` raises it to 2, and 2
is the most anyone can have. v0.61.0 gave everyone 2, plus 1 for each companion or familiar their sheets
granted; that was a misunderstanding and is gone, so companion and familiar classes add nothing. Companion
and familiar sheets still never count toward the limit, and Not now on the second-character offer is still
remembered. A player at 1 sheet without a grant is told to send /extrasheet in their campaign's Telegram topic.
