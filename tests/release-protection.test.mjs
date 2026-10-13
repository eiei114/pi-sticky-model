import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/auto-release.yml", import.meta.url), "utf8");

test("auto release is opt-in and requires both release permissions", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s+push:/m);
  assert.match(workflow, /release_allowed:[\s\S]*?default: false/);
  assert.match(workflow, /package_publish_expected:[\s\S]*?default: false/);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main' && inputs\.release_allowed == true && inputs\.package_publish_expected == true/);
});
