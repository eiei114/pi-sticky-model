# Changelog

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
