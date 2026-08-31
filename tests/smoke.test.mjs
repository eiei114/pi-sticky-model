import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
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

async function countInventoryTests() {
  const testDir = new URL(".", import.meta.url);
  const perFile = {};
  let total = 0;

  for (const file of await readdir(testDir)) {
    if (!file.endsWith(".test.mjs")) continue;
    const content = await readFile(new URL(file, testDir), "utf8");
    let count = 0;
    for (const line of content.split("\n")) {
      if (/^test\(/.test(line)) count++;
    }
    const policyMatch = content.match(/const POLICY_FILES = \[([\s\S]*?)\];/);
    if (policyMatch) {
      count += (policyMatch[1].match(/"[^"]+"/g) ?? []).length;
    }
    perFile[file] = count;
    total += count;
  }

  return { total, perFile };
}

function parseHealthCheckTestInventory(healthCheck) {
  const documented = {};
  const inventorySection = healthCheck.split("## Test inventory")[1]?.split(/^## /m)[0] ?? "";
  for (const line of inventorySection.split("\n")) {
    const match = line.match(/^\| `tests\/([^`]+)` \| (\d+) \|/);
    if (match) {
      const file = match[1];
      if (Object.prototype.hasOwnProperty.call(documented, file)) {
        throw new Error(`Duplicate test inventory entry: tests/${file}`);
      }
      documented[file] = Number(match[2]);
    }
  }
  return documented;
}

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
  assert.match(autoReleaseWorkflow, /actions:\s*write/);
  assert.match(autoReleaseWorkflow, /git push origin "\$TAG"/);
  assert.match(autoReleaseWorkflow, /gh release create "\$TAG"/);
  assert.match(autoReleaseWorkflow, /gh workflow run publish\.yml --ref main -f ref="\$TAG"/);
  assert.match(publishWorkflow, /github\.event_name != 'release' \|\| github\.actor != 'github-actions\[bot\]'/);
});

test("docs/release.md matches publish workflow triggers", () => {
  assert.match(releaseDoc, /`package\.json` changes on `main`/);
  assert.match(releaseDoc, /`\.github\/workflows\/auto-release\.yml`: it creates a matching `v\*\.\*\.\*` tag and GitHub Release/);
  assert.match(releaseDoc, /explicitly dispatches `publish\.yml` with that tag/);
  assert.match(releaseDoc, /tag pushed by `GITHUB_TOKEN`/);
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

test("README release command matches CONTRIBUTING and docs/release.md", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const contributing = await readFile(new URL("../CONTRIBUTING.md", import.meta.url), "utf8");
  assert.match(readme, /git push --follow-tags/);
  assert.match(contributing, /git push --follow-tags/);
  assert.match(releaseDoc, /git push --follow-tags/);
});

test("docs/health-check.md baseline matches package version and test inventory", async () => {
  const healthCheck = await readFile(new URL("../docs/health-check.md", import.meta.url), "utf8");
  const version = packageJson.version;
  const { total, perFile } = await countInventoryTests();

  assert.match(healthCheck, /# Maintenance health check \(2026-W35\)/);
  assert.match(healthCheck, new RegExp(`pi-sticky-model@${version.replace(/\./g, "\\.")}`));
  assert.match(healthCheck, new RegExp(`Entries through ${version.replace(/\./g, "\\.")}`));
  assert.ok(healthCheck.includes(`| Local \`npm run ci\` | ✅ | typecheck + ${total} tests + \`pack:check\` pass |`));
  assert.ok(healthCheck.includes(`| **Total** | **${total}** | **${total} pass, 0 fail** |`));

  const documented = parseHealthCheckTestInventory(healthCheck);
  assert.deepEqual(
    Object.keys(documented).sort(),
    Object.keys(perFile).sort(),
    "health-check.md test inventory must list every .test.mjs file",
  );
  for (const [file, count] of Object.entries(perFile)) {
    assert.equal(documented[file], count, `health-check.md must document tests/${file} with count ${count}`);
  }
});
