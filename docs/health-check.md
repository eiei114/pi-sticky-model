# Maintenance health check (2026-W27)

Baseline review for `pi-sticky-model@0.2.1` after nine implementation issues and no prior maintenance cycle.

## Package completeness (pi-extension-template policy)

| Item | Status | Notes |
|------|--------|-------|
| `SECURITY.md` | ✅ | Vulnerability reporting policy present |
| `CODE_OF_CONDUCT.md` | ✅ | Contributor Covenant reference |
| `CONTRIBUTING.md` | ✅ | Dev flow, `npm run ci`, release notes |
| `LICENSE` | ✅ | MIT |
| `CHANGELOG.md` | ✅ | Entries through 0.2.1 |
| README badges | ✅ | CI, Publish, npm version/downloads, License, Pi package, Trusted Publishing |
| `docs/release.md` | ✅ | Trusted Publishing setup documented |
| `package.json` `files` | ✅ | `extensions/`, `lib/`, README, LICENSE, CHANGELOG only |
| `.editorconfig` | ✅ | Present |
| `.github/dependabot.yml` | ✅ | npm + github-actions, grouped updates |

## CI pipeline

| Check | Status | Notes |
|-------|--------|-------|
| `.github/workflows/ci.yml` | ✅ | `ubuntu-latest`, Node 24, `npm ci` + `npm run ci` |
| Local `npm run ci` | ✅ | typecheck + 8 tests + `pack:check` pass |
| Latest main CI (GitHub) | ✅ | Success on 2026-06-27 (`28275095200`) |
| PR CI on recent merges | ✅ | PRs #16, #17 green before merge |

## Publish pipeline

| Check | Status | Notes |
|-------|--------|-------|
| `.github/workflows/publish.yml` | ✅ | `id-token: write`, `registry-url`, `npm publish --access public` |
| Trusted Publishing docs | ✅ | No `NPM_TOKEN`; workflow filename documented |
| npm published version | ✅ | `0.2.1` on registry |
| `auto-release.yml` | ⚪ N/A | Not used; release flow relies on tags, releases, and `package.json` pushes on `main` (documented in `docs/release.md`) |

## Test inventory

| File | Tests | Coverage |
|------|-------|----------|
| `tests/smoke.test.mjs` | 4 | Package metadata, publish workflow handoff |
| `tests/sticky-model.test.mjs` | 4 | `set/get/clear` on `lib/sticky-model.ts` |
| **Total** | **8** | **8 pass, 0 fail** |

### Coverage gaps (non-trivial)

1. **Extension hooks untested** — `extensions/index.ts` handlers (`model_select`, `session_start`) have no unit or integration tests. Persistence across `/new`, `/resume`, `/fork` is documented but not automated.
2. **Edge cases untested** — `source === "restore"` skip, `reason === "startup"` skip, missing registry model fallback, `pi.setModel` failure path, corrupt `globalThis` state shape.
3. **Process exit / Ctrl+C reset** — Documented as process-scoped; no test harness for process lifecycle (acceptable for now; manual verification only).

## Docs freshness

| Area | Status | Notes |
|------|--------|-------|
| README vs behavior | ✅ | Features match extension code |
| README install pins | ✅ | Example uses `@0.2.1` |
| `docs/release.md` vs workflows | ✅ | Aligned after DOT-304 (no stale `auto-release.yml` references) |
| Code comments | ✅ | Extension entrypoint documents event intent |

## Behavioral change policy

This health check introduces **no changes** to model persistence logic. Additions are documentation and smoke-test guardrails only.

## Follow-up issues filed

- [#19 — test: add integration tests for extension session hooks](https://github.com/eiei114/pi-sticky-model/issues/19)
- [#20 — test: validate sticky model ref shape and corrupt global state](https://github.com/eiei114/pi-sticky-model/issues/20)
