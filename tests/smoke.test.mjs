import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import test from "node:test";

const POLICY_FILES = [
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "CHANGELOG.md",
];

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const publishWorkflow = await readFile(new URL("../.github/workflows/publish.yml", import.meta.url), "utf8");
const autoReleaseWorkflow = await readFile(new URL("../.github/workflows/auto-release.yml", import.meta.url), "utf8");
const releaseDoc = await readFile(new URL("../docs/release.md", import.meta.url), "utf8");

test("package declares extension entrypoint", () => {
  assert.deepEqual(packageJson.pi.extensions, ["./extensions"]);
});

test("package is discoverable as a Pi package", () => {
  assert.ok(packageJson.keywords.includes("pi-package"));
});

test("package uses public publish config", () => {
  assert.equal(packageJson.publishConfig.access, "public");
});

test("package includes npm release workflow handoff", () => {
  assert.match(publishWorkflow, /id-token:\s*write/);
  assert.match(publishWorkflow, /workflow_dispatch:/);
  assert.match(publishWorkflow, /npm publish --access public/);
});

test("publish workflow trigger contract avoids direct main package.json pushes", () => {
  assert.match(publishWorkflow, /push:\s*\n\s*tags:\s*\n\s*- ['"]v\*\.\*\.\*['"]/);
  assert.match(publishWorkflow, /release:\s*\n\s*types:\s*\[published\]/);
  assert.match(publishWorkflow, /workflow_dispatch:/);
  assert.doesNotMatch(
    publishWorkflow,
    /branches:\s*(?:\[[^\]]*['"]?main['"]?[^\]]*\]|\n\s*- ['"]?main['"]?)/,
  );
});

test("auto-release version bumps publish exactly once", () => {
  assert.match(autoReleaseWorkflow, /push:\s*\n\s*branches:\s*\[main\]\s*\n\s*paths:\s*\n\s*- package\.json/);
  assert.match(autoReleaseWorkflow, /git push origin "\$TAG"/);
  assert.match(autoReleaseWorkflow, /gh release create "\$TAG"/);
  assert.doesNotMatch(autoReleaseWorkflow, /gh workflow run publish\.yml/);
  assert.match(publishWorkflow, /github\.event_name != 'release' \|\| github\.actor != 'github-actions\[bot\]'/);
});

test("docs/release.md matches publish workflow triggers", () => {
  assert.match(releaseDoc, /`package\.json` changes on `main`/);
  assert.match(releaseDoc, /`\.github\/workflows\/auto-release\.yml`: it creates a matching `v\*\.\*\.\*` tag and GitHub Release/);
  assert.match(releaseDoc, /`publish\.yml` publishes once from the tag push/);
});

for (const file of POLICY_FILES) {
  test(`policy file exists: ${file}`, async () => {
    await access(new URL(`../${file}`, import.meta.url));
  });
}

test("README includes expected OSS badges", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /actions\/workflows\/ci\.yml\/badge\.svg/);
  assert.match(readme, /actions\/workflows\/publish\.yml\/badge\.svg/);
  assert.match(readme, /img\.shields\.io\/npm\/v\/pi-sticky-model/);
  assert.match(readme, /License-MIT/);
});

test("README install pin matches package.json version", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const pin = `pi install npm:pi-sticky-model@${packageJson.version}`;
  assert.match(readme, new RegExp(pin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
