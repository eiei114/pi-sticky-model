import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { selectPreviousStableTag } from "../scripts/release-tags.mjs";

const workflow = readFileSync(new URL("../.github/workflows/auto-release.yml", import.meta.url), "utf8");

test("auto release is opt-in and requires both release permissions", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s+push:/m);
  assert.match(workflow, /release_allowed:[\s\S]*?default: false/);
  assert.match(workflow, /package_publish_expected:[\s\S]*?default: false/);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main' && inputs\.release_allowed == true && inputs\.package_publish_expected == true/);
});

test("stable baseline selects an older tag, excluding prereleases, current, and future tags", () => {
  assert.equal(selectPreviousStableTag([
    "v1.2.5", "v9.0.0-rc.1", "v1.2.4", "v1.2.3", "v1.2.2", "nightly", "1.0.0",
  ], "v1.2.4"), "v1.2.3");
  assert.equal(selectPreviousStableTag(["v1.2.5", "v1.2.4", "v1.2.4-rc.1"], "v1.2.4"), "");
});

test("stable baseline uses numeric ordering instead of Git's version-refname ordering", () => {
  assert.equal(selectPreviousStableTag([
    "v1.10.0", "v1.2.0", "v1.09.0",
  ], "v1.10.0"), "v1.09.0");
});

test("both release stages use the stable baseline after setting TAG", () => {
  assert.match(workflow, /TAG="v\$\{CURRENT_VERSION\}"\s+PREVIOUS_TAG=\$\(node scripts\/release-tags\.mjs "\$TAG"\)/);
  assert.match(workflow, /PREV_TAG=\$\(node scripts\/release-tags\.mjs "\$TAG"\)/);
  assert.doesNotMatch(workflow, /git tag --sort=-version:refname \| head -1/);
});
