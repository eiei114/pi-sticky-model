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
- A GitHub Release is published
- `package.json` changes on `main` (via `.github/workflows/publish.yml`)
- The workflow is triggered manually with `workflow_dispatch`

The workflow skips `name@version` if that exact package version already exists on npm.

## GitHub Actions requirements

- `permissions: id-token: write`
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
