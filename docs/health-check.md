# Maintenance health check (2026-W33)

Baseline review for `pi-sticky-model@0.4.2` after the 0.4.2 patch release, TypeScript 7.0.2 alignment, and Pi 0.84.x devDependency refresh.

## Package completeness (pi-extension-template policy)

| Item | Status | Notes |
|------|--------|-------|
| `SECURITY.md` | ✅ | Vulnerability reporting policy present |
| `CODE_OF_CONDUCT.md` | ✅ | Contributor Covenant reference |
| `CONTRIBUTING.md` | ✅ | Dev flow, `npm run ci`, release notes |
| `LICENSE` | ✅ | MIT |
| `CHANGELOG.md` | ✅ | Entries through 0.4.2 |
| README badges | ✅ | Discord, CI, Publish, npm version/downloads, License, Pi package, Trusted Publishing |
| `docs/release.md` | ✅ | Trusted Publishing + auto-release dispatch documented |
| `package.json` `files` | ✅ | `extensions/`, `lib/`, README, LICENSE, CHANGELOG only |
| `.editorconfig` | ✅ | Present |
| `.github/dependabot.yml` | ✅ | npm + github-actions, grouped updates |

## CI pipeline

| Check | Status | Notes |
|-------|--------|-------|
| `.github/workflows/ci.yml` | ✅ | `ubuntu-latest`, Node 24, `setup-bun`, `npm ci` + `npm run ci` |
| Local `npm run ci` | ✅ | typecheck + 39 tests + `pack:check` pass |
| Latest main CI (GitHub) | ✅ | Green after 0.4.2 patch release (PR #52) |
| PR CI on recent merges | ✅ | Dependabot (#51), TypeScript 7 (#50), and maintenance PRs green before merge |

## Publish pipeline

| Check | Status | Notes |
|-------|--------|-------|
| `.github/workflows/publish.yml` | ✅ | `id-token: write`, `registry-url`, `npm publish --access public` |
| `.github/workflows/auto-release.yml` | ✅ | Tags + GitHub Release on `package.json` bump; dispatches `publish.yml` |
| Trusted Publishing docs | ✅ | No `NPM_TOKEN`; workflow filename documented |
| npm published version | ✅ | `0.4.2` published to npm |

## Test inventory

| File | Tests | Coverage |
|------|-------|----------|
| `tests/smoke.test.mjs` | 15 | Package metadata, release workflow contract, policy files, README badges, install pin, health-check baseline |
| `tests/extension-hooks.test.mjs` | 12 | `model_select`, `thinking_level_select`, `session_start`, `session_shutdown` hooks |
| `tests/sticky-model.test.mjs` | 12 | `set/get/clear` plus corrupt `globalThis` state guards |
| **Total** | **39** | **39 pass, 0 fail** |

### Coverage gaps (non-trivial)

1. **Process exit / Ctrl+C reset** — Documented as session-scoped; no test harness for process lifecycle (acceptable; manual verification only).

## Docs freshness

| Area | Status | Notes |
|------|--------|-------|
| README vs behavior | ✅ | Features match extension code (model + thinking level, session-scoped) |
| README install pins | ✅ | Example uses `@0.4.2` (guarded by smoke test) |
| `docs/release.md` vs workflows | ✅ | Auto-release dispatch path documented |
| Code comments | ✅ | Extension entrypoint documents event intent |

## Behavioral change policy

This health check introduces **no changes** to model persistence logic. Additions are documentation accuracy and smoke-test guardrails only.

## Resolved follow-ups (since W32)

- 0.4.2 patch release — shipped via PR #52 (2026-08-22 managed OSS batch)
- TypeScript 7.0.2 devDependency — merged via PR #50
- Pi 0.84.x devDependency group refresh — merged via PR #51
- Dynamic health-check test inventory guard — shipped via PR #47

## Docs drift noted (not fixed in this baseline)

- README Release section uses `git push` without `--follow-tags`; `CONTRIBUTING.md` and `docs/release.md` use `git push --follow-tags`. Auto-release on `main` still works via `package.json` push, but tag push guidance is inconsistent.
