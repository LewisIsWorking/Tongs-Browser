---
'tongs-browser': patch
---

Start pulling the diagnostics out of the composition root, which had grown to 1,691 lines.

The hard limit is 200 lines per file and `TongsBrowser.ts` was eight times it, almost all of it
diagnostics added one device report at a time over a single day. That is the wrong place for them
twice over: it is a composition root, and being a composition root is exactly what made every probe
untestable, which is a large part of why the report spent several rounds confidently printing numbers
it had never measured.

Two extractions so far, both at **100% statements, branches, functions and lines**:

- `debug/FoundryProbes.ts`, the read only questions put to Foundry and PIXI. Pure functions over
  global state rather than methods, so a test can hand them a fake `canvas`.
- `debug/Clipboard.ts`, which has nothing to do with pointers. Its one interesting property now has
  a test: `navigator.clipboard` is secure context only, a self hosted Foundry on a LAN address is
  plain http, so on the target device the deprecated `execCommand` path is the only one that runs.

`TongsBrowser.ts` is down to 1,538 lines. Still far over, and the remaining work is the drag recorder
and the report builder, which need splitting into three or four files rather than moved wholesale.
