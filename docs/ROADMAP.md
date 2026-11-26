# Tongs Browser Roadmap

Owner: Tongs Browser · Status: active · Updated: 2026-11-26

## Goal

A player can run a Foundry world from a phone without losing access to hover, modifiers, dragging or
sheets, and every ComeOnOverUno call the module makes is proven against the server before it ships.

## Tracker

Owner: Tongs Browser

- [ ] Run the COO route preflight guard in pull-request and main CI (TB-ROUTE-01)
- [ ] Make the COO route guard check the HTTP verb Tongs actually uses, not either verb (TB-ROUTE-02)
- [ ] Release an active gesture when the page becomes hidden, with a DOM test (TB-INPUT-01)
- [ ] Cover the phone exclusion zones in real-browser tests: chat, sidebar, sheets and text selection (TB-BROWSER-01)
- [ ] Verify the published module manifest and zip URLs after a release (TB-RELEASE-01)
- [ ] Refresh the README and manual-testing evidence for the current release and Foundry build (TB-DOC-01)

## Later

- Physical Android phone and tablet acceptance, including haptics and real touch latency. Needs Lewis.
- Foundry package-listing submission and later version entries. Needs Lewis and a Foundry account.
- Native Android shell, after the module has proved itself on physical hardware. See ADR 0002.

## Decisions

- 2026-08-30: ship the Foundry module before a native shell. The browser is the product surface today.
- 2026-11-08: COO route checks send preflights only. They write nothing and need no sign-in.
- 2026-11-25: Tongs Browser owns its Foundry module and COO endpoints, not the PathWars roadmap's PW-* items.
- 2026-11-25: a cold-booted emulator is useful evidence, but it is not physical-device acceptance.

## Notes

- [README](../README.md) describes the user-facing behaviour and development commands.
- [Manual testing](MANUAL-TESTING.md) records measured Foundry runs and the checks that still need hardware.
- [Release checklist](RELEASE-CHECKLIST.md) records the package-listing requirements and human-only steps.
- [Architecture decision records](adr/) explain why the pointer, gesture and release surfaces are shaped this way.
- `npm run check:routes` currently proves CORS preflight for 15 quoted COO paths. It is not yet part of CI.
