# Releasing to the Foundry package listing

Written 2026-08-30, against v0.25.68.

## The goal is ONE listing, not two

Free packages on the official Foundry listing are installed through **The Bazaar** on The Forge
automatically. There is no separate Forge submission for a free module. Getting listed by Foundry is
the whole job; The Forge follows.

## Blocking, and it is not a code problem

> **No physical Android device has ever run this module.**

`adb devices` was empty on 2026-08-30. Everything measured so far went through headless desktop
Chromium synthesising touch events against a live Foundry 14.366. That validates the logic. It does
not validate the thing a user does.

For a module whose entire premise is Android, this is the one gap that should not be waved through.
`docs/MANUAL-TESTING.md` line 3 says it plainly: everything there needs a real device.

What closes it:

1. Connect the tablet, confirm `adb devices` lists it.
2. `npm run check:android` - runs the touch shapes against Chrome on the device.
3. Work `docs/MANUAL-TESTING.md` by hand. Its unchecked boxes are the real acceptance criteria; the
   long-press haptic and the Chrome-150 token report are called out there as device-only.
4. Record the device, Android version and Chrome version in that doc, **with the date**. A
   measurement written into prose has no expiry unless it carries one.

## Already satisfied

| Requirement                             | State                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `id` matches the submitted package name | `tongs-browser`                                                        |
| Package URL                             | the GitHub repo                                                        |
| Manifest is valid and complete          | title, description, authors, compatibility, url, readme, bugs, license |
| `module.zip` attached to each release   | since v0.2.1                                                           |
| `module.json` attached to each release  | **since v0.25.68 only** - see below                                    |
| Update path works                       | **since v0.25.68 only** - see below                                    |
| Licence file present                    | MIT                                                                    |

### ⚠️ What was broken until v0.25.68

Foundry polls the installed manifest's `manifest` URL and compares the `version` it finds there
against the installed one. That field pointed at `raw.githubusercontent.com/.../main/module.json`,
and the copy on `main` is deliberately pinned at the `0.1.0` placeholder because only the copy inside
`module.zip` is stamped.

Measured against the live URLs on 2026-08-30:

- the shipped v0.25.67 zip reported `0.25.67`
- the URL that zip told Foundry to poll reported `0.1.0`

So every install was frozen at whatever version it first received. Twenty-five releases, tags,
changelogs and zips all built correctly, and the update they existed to deliver could never fire.

There was also no `module.json` release asset at all, which the submission form requires.

Both are fixed, and `scripts/stamp-manifest.ts` now refuses to stamp a manifest whose poll URL points
at an unstamped source, so the shape cannot ship again.

**This does not unstick copies already installed.** Their on-disk manifest still names the old poll
URL, so they will keep asking `main` and keep hearing `0.1.0`. Those need a manual reinstall. The
module was never publicly listed, so the practical blast radius is the developer's own checkout.

## The submission itself

⚠️ **A human action.** It needs a Foundry account and a form; an agent cannot and should not do it.

1. Go to the Package Submission Form, linked at the bottom of the Systems and Modules page on
   foundryvtt.com.
2. Package Name: `tongs-browser` - must match `id` in the manifest exactly.
3. Package Title: `Tongs Browser`.
4. Package URL: `https://github.com/LewisIsWorking/Tongs-Browser`.
5. Manifest URL: the **specific release** asset, not the `latest` alias. Right-click the `module.json`
   attached to the release and copy the address. For v0.25.68 that is:

   ```
   https://github.com/LewisIsWorking/Tongs-Browser/releases/download/v0.25.68/module.json
   ```

   Verified HTTP 200 on 2026-08-30. Before submitting, re-check it for whatever version is current -
   the form silently accepts a URL that 404s later.

6. Foundry staff review, typically a few days, then grant access to the package admin pages.
7. For every release after that, add a new Package Version in the admin page with the version number
   and that version's manifest asset URL.

Note that the `manifest` field **inside** the module points at `releases/latest/download/module.json`
so that update polling resolves to the newest release. That is a different URL from the one pasted
into the form, and both are correct for their own purpose.

## Before submitting

- [ ] Device testing done and recorded, per the section above.
- [ ] `npm run verify` green.
- [ ] `npm run test:browser` green.
- [ ] The current release's `module.json` asset returns 200.
- [ ] `releases/latest/download/module.json` reports the current version, not `0.1.0`.
- [ ] README status line reflects what has actually been measured, and is dated.
- [ ] `compatibility.verified` names the Foundry build actually tested against.

## Sources

- <https://foundryvtt.com/article/package-management/>
- <https://foundryvtt.wiki/en/development/guides/local-to-repo>
