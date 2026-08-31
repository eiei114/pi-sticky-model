# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning.

## Unreleased

### Fixed

- Align README release instructions with `CONTRIBUTING.md` and `docs/release.md` by documenting `git push --follow-tags`.

## [0.4.2] - 2026-08-22

### Changed

- Merge the 2026-08-22 managed OSS dependency and maintenance PR batch.

### Added

- Persist the selected thinking level alongside the model across `/new`, `/resume`, and `/fork`.

### Changed

- Store sticky model state per session file instead of sharing one process-wide model.
- Inherit only the previous session model for `/new` and `/fork`, and restore the target session model for `/resume`.
- Clear only the current session state on Ctrl+C or session shutdown.
- Bump package version to `0.4.0` for the next minor release.

## [0.2.2] - 2026-07-04

### Added

- Add `session_shutdown` handler to clear sticky model state on session exit.
- Add Buy Me a Coffee sponsor button to README and native GitHub funding link via `.github/FUNDING.yml`.

### Changed

- Align package metadata with `pi-extension-template` 0.80.x baseline: add `@earendil-works/pi-agent-core` peer dependency, pin Pi devDependencies to `^0.80.6`, and add `protobufjs` override.
- Guard all `ctx.ui` calls with `ctx.hasUI` for headless/RPC sessions.

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
