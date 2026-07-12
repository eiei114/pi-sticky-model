# Changelog

## Unreleased

- Align package metadata with `pi-extension-template` 0.80.x baseline: add `@earendil-works/pi-agent-core` peer dependency, pin Pi devDependencies to `^0.80.6`, and add `protobufjs` override.
- Guard all `ctx.ui` calls with `ctx.hasUI` for headless/RPC sessions.
- Add `session_shutdown` handler to clear sticky model state on session exit.
- Add Buy Me a Coffee sponsor button to README and native GitHub funding link via `.github/FUNDING.yml`.

All notable changes to this project will be documented in this file.

This project follows semantic versioning.

## [0.2.1] - 2026-06-27

### Changed

- README aligned with the current Pi OSS extension template: npm version/downloads badges, shipped `Package contents`, and explicit `npm pack --dry-run` guidance via `npm run pack:check`.

## [0.2.0] - 2026-06-08

### Added

- Initial pi-sticky-model implementation:
  - `lib/sticky-model.ts` — process-scoped global state for model persistence
  - `extensions/index.ts` — `model_select` and `session_start` event hooks
  - Model selection persists across `/new`, `/resume`, `/fork`
  - Model resets to `settings.json` default on Ctrl+C / process exit

