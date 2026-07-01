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
