# Maintenance health check (2026-W29)

Baseline review for `pi-sticky-model@0.2.2` after extension-hook tests, corrupt-state guards, template alignment, and auto-release workflow adoption.

## Package completeness (pi-extension-template policy)

| Item | Status | Notes |
|------|--------|-------|
| `SECURITY.md` | ✅ | Vulnerability reporting policy present |
| `CODE_OF_CONDUCT.md` | ✅ | Contributor Covenant reference |
| `CONTRIBUTING.md` | ✅ | Dev flow, `npm run ci`, release notes |
| `LICENSE` | ✅ | MIT |
| `CHANGELOG.md` | ✅ | Entries through 0.2.2 |
| README badges | ✅ | CI, Publish, npm version/downloads, License, Pi package, Trusted Publishing |
| `docs/release.md` | ✅ | Trusted Publishing setup documented |
| `package.json` `files` | ✅ | `extensions/`, `lib/`, README, LICENSE, CHANGELOG only |
| `.editorconfig` | ✅ | Present |
| `.github/dependabot.yml` | ✅ | npm + github-actions, grouped updates |

## CI pipeline

| Check | Status | Notes |
|-------|--------|-------|
| `.github/workflows/ci.yml` | ✅ | `ubuntu-latest`, Node 24, `setup-bun`, `npm ci` + `npm run ci` |
| Local `npm run ci` | ✅ | typecheck + 31 tests + `pack:check` pass |
| Latest main CI (GitHub) | ✅ | Success after template alignment (PR #28) |
| PR CI on recent merges | ✅ | PRs #24–#28 green before merge |

## Publish pipeline

| Check | Status | Notes |
|-------|--------|-------|
| `.github/workflows/publish.yml` | ✅ | `id-token: write`, `registry-url`, `npm publish --access public` |
| `.github/workflows/auto-release.yml` | ✅ | Tags and GitHub Release on `package.json` version bump; triggers `publish.yml` |
| Trusted Publishing docs | ✅ | No `NPM_TOKEN`; workflow filename documented |
| npm published version | ⚪ | `0.2.2` pending publish after merge |

## Test inventory

| File | Tests | Coverage |
|------|-------|----------|
| `tests/smoke.test.mjs` | 11 | Package metadata, policy files, README badges, install pin |
| `tests/extension-hooks.test.mjs` | 9 | `model_select`, `session_start`, `session_shutdown` hooks |
| `tests/sticky-model.test.mjs` | 11 | `set/get/clear` plus corrupt `globalThis` state guards |
| **Total** | **31** | **31 pass, 0 fail** |

### Coverage gaps (non-trivial)

1. **Process exit / Ctrl+C reset** — Documented as process-scoped; no test harness for process lifecycle (acceptable; manual verification only).

## Docs freshness

| Area | Status | Notes |
|------|--------|-------|
| README vs behavior | ✅ | Features match extension code |
| README install pins | ✅ | Example uses `@0.2.2` (guarded by smoke test) |
| `docs/release.md` vs workflows | ✅ | Trusted Publishing path documented |
| Code comments | ✅ | Extension entrypoint documents event intent |

## Behavioral change policy

This health check introduces **no changes** to model persistence logic. Additions are documentation accuracy and smoke-test guardrails only.

## Resolved follow-ups (since W27)

- [#19 — extension session hooks](https://github.com/eiei114/pi-sticky-model/issues/19) — closed via PR #25 (`tests/extension-hooks.test.mjs`)
- [#20 — corrupt global state validation](https://github.com/eiei114/pi-sticky-model/issues/20) — closed via PR #26 (`tests/sticky-model.test.mjs`)
