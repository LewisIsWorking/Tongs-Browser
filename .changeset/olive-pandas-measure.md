---
'tongs-browser': patch
---

Answer the keyboard strategy question, and make a clean Windows clone verify.

`npm run probe:foundry` drives a headless browser into a running Foundry, enables the module and
measures whether synthesised keyboard events are honoured, taking its own independent reading rather
than trusting the module's self report. On 14.365 the answer is `events`, so the modifier bar works
as designed and the internals-touching fallback is dead code. Recorded in ADR 0004.

Also adds `.gitattributes` with `* text=auto eol=lf`. Without it a Windows clone checks out CRLF,
Prettier is pinned to LF, and `npm run verify` failed on a clean clone with all 76 files reported as
badly formatted. CI runs on Linux and could never see it.
