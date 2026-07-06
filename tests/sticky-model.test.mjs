import assert from "node:assert/strict";
import test from "node:test";

const { setStickyModel, getStickyModel, clearStickyModel, __resetWarnedOnce } =
  await import("../lib/sticky-model.ts");

const GLOBAL_KEY = "__pi_sticky_model";

function setRawGlobal(value) {
  globalThis[GLOBAL_KEY] = value;
}

test("getStickyModel returns undefined before any set", () => {
  clearStickyModel();
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

// --- Shape validation tests ---

test("getStickyModel returns undefined for non-object corrupt state", () => {
  clearStickyModel();
  __resetWarnedOnce();
  setRawGlobal(42);
  assert.equal(getStickyModel(), undefined);
  setRawGlobal("corrupt string");
  assert.equal(getStickyModel(), undefined);
  setRawGlobal(null);
  assert.equal(getStickyModel(), undefined);
  setRawGlobal(true);
  assert.equal(getStickyModel(), undefined);
});

test("getStickyModel returns undefined for partial state (missing provider)", () => {
  clearStickyModel();
  __resetWarnedOnce();
  setRawGlobal({ model: "gemini-2.5-pro" });
  assert.equal(getStickyModel(), undefined);
});

test("getStickyModel returns undefined for partial state (missing model)", () => {
  clearStickyModel();
  __resetWarnedOnce();
  setRawGlobal({ provider: "google" });
  assert.equal(getStickyModel(), undefined);
});

test("getStickyModel returns undefined for empty provider", () => {
  clearStickyModel();
  __resetWarnedOnce();
  setRawGlobal({ provider: "", model: "gemini-2.5-pro" });
  assert.equal(getStickyModel(), undefined);
});

test("getStickyModel returns undefined for empty model", () => {
  clearStickyModel();
  __resetWarnedOnce();
  setRawGlobal({ provider: "google", model: "" });
  assert.equal(getStickyModel(), undefined);
});

test("getStickyModel returns valid ref after corrupt state is replaced", () => {
  clearStickyModel();
  __resetWarnedOnce();
  // Set corrupt, then overwrite with valid
  setRawGlobal({ provider: "", model: "gemini-2.5-pro" });
  assert.equal(getStickyModel(), undefined);
  setStickyModel({ provider: "google", model: "gemini-2.5-pro" });
  assert.deepEqual(getStickyModel(), {
    provider: "google",
    model: "gemini-2.5-pro",
  });
});

test("getStickyModel warns only once for multiple corrupt reads", () => {
  clearStickyModel();
  __resetWarnedOnce();

  const warnings = [];
  const origWarn = console.warn;
  console.warn = (msg) => {
    warnings.push(msg);
  };

  try {
    setRawGlobal(99);
    getStickyModel(); // first corrupt read → warns
    getStickyModel(); // second corrupt read → silent
    getStickyModel(); // third corrupt read → silent
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Ignoring corrupt StickyModelRef/);
  } finally {
    console.warn = origWarn;
  }
});
