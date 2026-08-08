# Tongs Browser

A Foundry VTT module that makes Foundry genuinely usable on an Android phone or tablet.

Foundry assumes a mouse. Touch devices do not have one, so hover states never fire, small targets
sit under your fingertip, and modifier held actions are unreachable. Tongs Browser synthesises a
persistent virtual mouse pointer driven by your finger, adds a sticky modifier key bar, and scales
the interface for small screens.

Status: early development. Not yet released.

## Development

Requires Node 22 or newer.

```
npm ci
npm run verify     # lint, typecheck, test, build
```

Individual steps: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
Use `npm run dev` for a watching build while working against a live Foundry instance.

### Releases

Versioning runs on [Changesets](https://github.com/changesets/changesets). Every pull request that
changes behaviour should include one:

```
npm run changeset
```

Merging to `main` opens a "Version Packages" pull request that bumps the version and writes
`CHANGELOG.md`. Merging that creates a `v*` tag, which triggers CI to build `module.zip`, stamp the
matching version and download URL into `module.json`, and publish a GitHub release.

## License

MIT. See [LICENSE](LICENSE).
