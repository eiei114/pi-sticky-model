# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning.

## [Unreleased]

### Added

- Initial pi-sticky-model implementation:
  - `lib/sticky-model.ts` — process-scoped global state for model persistence
  - `extensions/index.ts` — `model_select` and `session_start` event hooks
  - Model selection persists across `/new`, `/resume`, `/fork`
  - Model resets to `settings.json` default on Ctrl+C / process exit
