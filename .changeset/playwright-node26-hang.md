---
'tongs-browser': patch
---

Document that `playwright install` hangs forever on Node 26, and give the Node 24 workaround. The
download reaches 100%, then the out-of-process helper extracts two files and freezes with zero CPU
and zero disk I/O, so it reads as a slow download rather than a hang. Three attempts were lost to it
before the cause was found. Only the installer is affected, so the fix is to run that one command
under Node 24 rather than to move the toolchain. Also drops the hardcoded "Fourteen tests" from the
same section, which had drifted to fifteen.
