# Release

This package uses npm Trusted Publishing with GitHub Actions OIDC.

Do not add `NPM_TOKEN` or long-lived npm tokens to GitHub Secrets.

## One-time npm setup

On npmjs.com, configure Trusted Publishing for this package:

- Publisher: GitHub Actions
- Repository: this GitHub repository
- Workflow filename: `publish.yml`

## Publish

```bash
npm version patch
git push --follow-tags
```

Publishing runs when:

- A `v*.*.*` tag is pushed
- A GitHub Release is published manually
- The workflow is triggered manually with `workflow_dispatch`

`.github/workflows/auto-release.yml` is manual-only; merging a `package.json` version bump does not create a tag, GitHub Release, or publish dispatch. To use that workflow, dispatch it from `main` and explicitly set both `release_allowed` and `package_publish_expected` to `true`. Both inputs default to `false`, and the job is skipped unless both are enabled. Use this only after release and publication are authorized for the package.

The manual auto-release workflow compares the current version with the latest release tag, then creates a matching `v*.*.*` tag and GitHub Release and dispatches `publish.yml`. GitHub does not start another workflow from a tag pushed by `GITHUB_TOKEN`, so this explicit dispatch is required. `publish.yml` ignores the GitHub Actions-created release event so the auto-release path cannot publish the same version twice. The separate `publish.yml` tag and manual triggers remain unchanged.

The workflow skips `name@version` if that exact package version already exists on npm.

## GitHub Actions requirements

- `permissions: contents: read, id-token: write`
- GitHub-hosted runner
- Node.js 24, so the release job uses a current npm CLI for Trusted Publishing
- No `NPM_TOKEN`
- `npm publish` from the configured workflow file

## First release checklist

- [ ] `package.json` name is final
- [ ] `repository.url` points to the real GitHub repository
- [ ] npm Trusted Publisher is configured
- [ ] `npm run ci` passes
- [ ] `npm pack --dry-run` contains only intended files
- [ ] CHANGELOG.md has the release date
