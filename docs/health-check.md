# Maintenance health check (2026-W42)

Baseline review for `pi-sticky-model@0.4.10` after Pi SDK 1.2.0 compatibility verification.

## Package completeness (pi-extension-template policy)

| Item | Status | Notes |
|------|--------|-------|
| `SECURITY.md` | ✅ | Vulnerability reporting policy present |
| `CODE_OF_CONDUCT.md` | ✅ | Contributor Covenant reference |
| `CONTRIBUTING.md` | ✅ | Dev flow, `npm run ci`, release notes |
| `LICENSE` | ✅ | MIT |
| `CHANGELOG.md` | ✅ | Entries through 0.4.10 |
| README badges | ✅ | Discord, CI, Publish, npm version/downloads, License, Pi package, Trusted Publishing |
| `docs/release.md` | ✅ | Trusted Publishing + explicitly authorized manual release documented |
| `package.json` `files` | ✅ | `extensions/`, `lib/`, README, LICENSE, CHANGELOG only |
| `.editorconfig` | ✅ | Present |
| `.github/dependabot.yml` | ✅ | npm + github-actions, grouped updates |

## CI pipeline

| Check | Status | Notes |
|-------|--------|-------|
| `.github/workflows/ci.yml` | ✅ | `ubuntu-latest`, Node 24, `setup-bun`, `npm ci` + `npm run ci` |
| Local `npm run ci` | ✅ | typecheck + 54 unit tests + actual Pi SDK 1.2.0 smoke (5/5) + `pack:check` pass |
| Latest main CI (GitHub) | ✅ | Green after 0.4.2 patch release (PR #52) |
| PR CI on recent merges | ✅ | Dependabot (#51), TypeScript 7 (#50), and maintenance PRs green before merge |

## Publish pipeline

| Check | Status | Notes |
|-------|--------|-------|
| `.github/workflows/publish.yml` | ✅ | `id-token: write`, `registry-url`, `npm publish --access public` |
| `.github/workflows/auto-release.yml` | ✅ | Manual-only; both authorization inputs default false and must be enabled to create tags/releases or dispatch `publish.yml` |
| Trusted Publishing docs | ✅ | No `NPM_TOKEN`; workflow filename documented |
| npm published version | ✅ | `0.4.2` published to npm |

## Test inventory

| File | Tests | Coverage |
|------|-------|----------|
| `tests/smoke.test.mjs` | 16 | Package metadata, release workflow contract, policy files, README badges, install pin, release command alignment, health-check baseline |
| `tests/extension-hooks.test.mjs` | 14 | `model_select`, `thinking_level_select`, `session_start`, `session_shutdown` hooks, including stale-context regression |
| `tests/sticky-model.test.mjs` | 12 | `set/get/clear` plus corrupt `globalThis` state guards |
| `tests/pi-sdk-smoke-contract.test.mjs` | 8 | Positive and deliberately missing RPC response assertions, temporary report storage, and path redaction |
| `tests/release-protection.test.mjs` | 4 | Manual-only auto-release trigger, default-off authorization gates, and stable-tag baseline selection |
| **Total** | **54** | **54 pass, 0 fail** |

### Coverage gaps (non-trivial)

1. **Provider inference** — Deliberately not exercised: smoke uses actual Pi process/model/session lifecycle calls with an offline provider and makes no paid inference request.

## Docs freshness

| Area | Status | Notes |
|------|--------|-------|
| README vs behavior | ✅ | Features match extension code (model + thinking level, session-scoped) |
| README install pins | ✅ | Example uses `@0.4.10` (guarded by smoke test) |
| `docs/release.md` vs workflows | ✅ | Manual-only, explicitly authorized auto-release path documented |
| Code comments | ✅ | Extension entrypoint documents event intent |

## Behavioral change policy

This update preserves public behavior while verifying the existing session lifecycle hooks against Pi 1.2.0. The upstream release notes describe changes to `before_agent_start` and configuration schemas; this extension does not use those APIs, so no API migration was needed.

## Resolved follow-ups (since W32)

- 0.4.2 patch release — shipped via PR #52 (2026-08-22 managed OSS batch)
- TypeScript 7.0.2 devDependency — merged via PR #50
- Pi 0.84.x devDependency group refresh — merged via PR #51
- Dynamic health-check test inventory guard — shipped via PR #47

## Resolved follow-ups (since W33)

- README release command alignment — `git push --follow-tags` documented consistently across README, CONTRIBUTING, and `docs/release.md` (2026-W35 maintenance)
