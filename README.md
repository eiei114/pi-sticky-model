# pi-sticky-model

[![CI](https://github.com/eiei114/pi-sticky-model/actions/workflows/ci.yml/badge.svg)](https://github.com/eiei114/pi-sticky-model/actions/workflows/ci.yml)
[![Publish](https://github.com/eiei114/pi-sticky-model/actions/workflows/publish.yml/badge.svg)](https://github.com/eiei114/pi-sticky-model/actions/workflows/publish.yml)
[![npm version](https://img.shields.io/npm/v/pi-sticky-model.svg)](https://www.npmjs.com/package/pi-sticky-model)
[![npm downloads](https://img.shields.io/npm/dm/pi-sticky-model.svg)](https://www.npmjs.com/package/pi-sticky-model)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Pi package](https://img.shields.io/badge/pi-package-purple.svg)](https://pi.dev/packages)
[![Trusted Publishing](https://img.shields.io/badge/npm-Trusted%20Publishing-blue.svg)](docs/release.md)

> Keeps your `/model` selection across `/new`, `/resume`, and `/fork`. Resets on Ctrl+C — no settings.json override needed.

## What this is

Pi extension. When you switch models with `/model` or `Ctrl+P`, the selection sticks across `/new`, `/resume`, and `/fork` for the lifetime of the Pi process. Close Pi (Ctrl+C) and everything resets to your `settings.json` default.

For anyone tired of their model snapping back to the settings.json default every time they start a new conversation.

## Features

- **Sticky model**: `/model` selection persists across `/new`, `/resume`, `/fork`
- **Process-scoped**: model resets to `settings.json` default on Ctrl+C / process exit
- **Zero config**: install and it works — no YAML, no JSON, no setup
- **Reload-safe**: `/reload` preserves your current model

## Coexistence

This extension works alongside other model-switching extensions such as `pi-weighted-model-router` and `pi-scheduled-router`. Since all of them call `pi.setModel()`, the last one to fire wins. Control the priority by ordering your `packages` array in `.pi/settings.json`.

## Install

Install the published npm package with Pi:

```bash
pi install npm:pi-sticky-model
```

Pin a specific version when you want reproducible installs:

```bash
pi install npm:pi-sticky-model@0.2.1
```

Install into the current project instead of your user Pi settings:

```bash
pi install npm:pi-sticky-model -l
```

Or install from GitHub:

```bash
pi install git:github.com/eiei114/pi-sticky-model
```

Try it without permanently installing:

```bash
pi -e npm:pi-sticky-model
```

## Quick start

Try this package locally:

```bash
pi -e .
```

Then run `/model` to pick a model, then `/new` — your model stays.

## Package contents

Shipped files (see `package.json` `files` and `npm pack --dry-run`):

| Path | Purpose |
|---|---|
| `extensions/index.ts` | Pi extension entrypoint — event hooks for model persistence |
| `lib/sticky-model.ts` | Process-scoped global state for the sticky model |
| `README.md` | Package overview and install guide |
| `CHANGELOG.md` | Version history |
| `LICENSE` | MIT license |

## Development

```bash
npm install
npm run ci
```

`npm run ci` runs typecheck, tests, and `npm pack --dry-run` via `pack:check`. Confirm the published tarball any time with:

```bash
npm run pack:check
```

Short flow:

```txt
Vault notes -> PRD -> Issues -> implement -> ci/check -> release -> save learnings
```

## Release

This package is set up for npm Trusted Publishing, so no `NPM_TOKEN` is required.

```bash
npm version patch
git push
```

See [`docs/release.md`](docs/release.md) for setup details.

## Docs

- [`docs/release.md`](docs/release.md) — Trusted Publishing setup details

## Security

Pi packages can execute code with your local permissions. Review extensions before installing third-party packages.

For vulnerability reporting, see [`SECURITY.md`](SECURITY.md).

## Links

- npm: https://www.npmjs.com/package/pi-sticky-model
- GitHub: https://github.com/eiei114/pi-sticky-model
- Issues: https://github.com/eiei114/pi-sticky-model/issues

## License

MIT
