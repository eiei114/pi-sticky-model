import assert from "node:assert/strict";
import test from "node:test";

const { setStickyModel, getStickyModel, clearStickyModel } = await import(
  "../lib/sticky-model.ts"
);

test("getStickyModel returns undefined before any set", () => {
  clearStickyModel(); // ensure clean slate
  assert.equal(getStickyModel(), undefined);
});

test("setStickyModel stores the value", () => {
  clearStickyModel();
  setStickyModel({ provider: "google", model: "gemini-2.5-pro" });
  assert.deepEqual(getStickyModel(), {
    provider: "google",
    model: "gemini-2.5-pro",
  });
});

test("setStickyModel overwrites previous value", () => {
  clearStickyModel();
  setStickyModel({ provider: "google", model: "gemini-2.5-pro" });
  setStickyModel({ provider: "deepseek", model: "deepseek-v4-pro" });
  assert.deepEqual(getStickyModel(), {
    provider: "deepseek",
    model: "deepseek-v4-pro",
  });
});

test("clearStickyModel removes the stored value", () => {
  setStickyModel({ provider: "google", model: "gemini-2.5-pro" });
  clearStickyModel();
  assert.equal(getStickyModel(), undefined);
});
