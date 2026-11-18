import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

const {
  setStickyModel,
  getStickyModel,
  clearStickyModel,
  copyStickyModel,
  __resetWarnedOnce,
} =
  await import("../lib/sticky-model.ts");

const GLOBAL_KEY = "__pi_sticky_model";

beforeEach(() => {
  clearStickyModel();
  __resetWarnedOnce();
});

function setRawGlobal(value) {
  globalThis[GLOBAL_KEY] = value;
}

function setRawDefault(value) {
  setRawGlobal({ __default__: value });
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
  setRawDefault({ model: "gemini-2.5-pro" });
  assert.equal(getStickyModel(), undefined);
});

test("getStickyModel returns undefined for partial state (missing model)", () => {
  clearStickyModel();
  __resetWarnedOnce();
  setRawDefault({ provider: "google" });
  assert.equal(getStickyModel(), undefined);
});

test("getStickyModel returns undefined for empty provider", () => {
  clearStickyModel();
  __resetWarnedOnce();
  setRawDefault({ provider: "", model: "gemini-2.5-pro" });
  assert.equal(getStickyModel(), undefined);
});

test("getStickyModel returns undefined for empty model", () => {
  clearStickyModel();
  __resetWarnedOnce();
  setRawDefault({ provider: "google", model: "" });
  assert.equal(getStickyModel(), undefined);
});

test("getStickyModel returns undefined for an invalid thinking level", () => {
  clearStickyModel();
  __resetWarnedOnce();
  setRawDefault({
    provider: "openai",
    model: "gpt-5.4",
    thinkingLevel: "ultra",
  });
  assert.equal(getStickyModel(), undefined);
});

test("getStickyModel returns valid ref after corrupt state is replaced", () => {
  clearStickyModel();
  __resetWarnedOnce();
  // Set corrupt, then overwrite with valid
  setRawDefault({ provider: "", model: "gemini-2.5-pro" });
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

test("session keys are isolated and the default key does not leak into named keys", () => {
  const defaultRef = { provider: "google", model: "gemini-2.5-pro" };
  const namedRef = { provider: "openai", model: "gpt-5.4" };

  setStickyModel(defaultRef);
  assert.equal(getStickyModel("session-a"), undefined);
  setStickyModel(namedRef, "session-a");

  assert.deepEqual(getStickyModel(), defaultRef);
  assert.deepEqual(getStickyModel("session-a"), namedRef);
  assert.equal(getStickyModel("session-b"), undefined);
});

test("copyStickyModel copies a valid ref independently and leaves other sessions untouched", () => {
  const sourceRef = { provider: "google", model: "gemini-2.5-pro", thinkingLevel: "high" };
  const destinationRef = { provider: "openai", model: "gpt-5.4" };
  const unrelatedRef = { provider: "anthropic", model: "claude-sonnet-4" };
  setStickyModel(sourceRef, "source");
  setStickyModel(destinationRef, "destination");
  setStickyModel(unrelatedRef, "unrelated");

  copyStickyModel("source", "destination");

  const copiedRef = getStickyModel("destination");
  assert.deepEqual(copiedRef, sourceRef);
  assert.notStrictEqual(copiedRef, sourceRef);
  assert.equal(getStickyModel("source").model, "gemini-2.5-pro");
  assert.strictEqual(getStickyModel("unrelated"), unrelatedRef);

  copiedRef.model = "changed-after-copy";
  assert.equal(getStickyModel("source").model, "gemini-2.5-pro");
  assert.equal(getStickyModel("unrelated").model, "claude-sonnet-4");
});

test("copyStickyModel preserves valid inherited and non-enumerable ref fields", () => {
  const inheritedRef = Object.create({
    provider: "google",
    model: "gemini-2.5-pro",
    thinkingLevel: "high",
  });
  const nonEnumerableRef = {};
  Object.defineProperties(nonEnumerableRef, {
    provider: { value: "openai" },
    model: { value: "gpt-5.4" },
    thinkingLevel: { value: "medium" },
  });

  for (const [sourceKey, sourceRef, expected] of [
    ["inherited", inheritedRef, { provider: "google", model: "gemini-2.5-pro", thinkingLevel: "high" }],
    ["non-enumerable", nonEnumerableRef, { provider: "openai", model: "gpt-5.4", thinkingLevel: "medium" }],
  ]) {
    const destinationRef = { provider: "anthropic", model: "claude-sonnet-4" };
    const unrelatedRef = { provider: "deepseek", model: "deepseek-v4-pro" };
    globalThis[GLOBAL_KEY] = {
      [sourceKey]: sourceRef,
      destination: destinationRef,
      unrelated: unrelatedRef,
    };

    assert.strictEqual(getStickyModel(sourceKey), sourceRef);
    copyStickyModel(sourceKey, "destination");

    const copiedRef = getStickyModel("destination");
    assert.deepEqual(copiedRef, expected);
    assert.deepEqual(Object.keys(copiedRef), ["provider", "model", "thinkingLevel"]);
    assert.notStrictEqual(copiedRef, sourceRef);
    assert.strictEqual(getStickyModel("unrelated"), unrelatedRef);
  }
});

test("copyStickyModel is a no-op when the source session is missing", () => {
  const destinationRef = { provider: "openai", model: "gpt-5.4" };
  const unrelatedRef = { provider: "anthropic", model: "claude-sonnet-4" };
  setStickyModel(destinationRef, "destination");
  setStickyModel(unrelatedRef, "unrelated");

  copyStickyModel("missing", "destination");
  copyStickyModel("missing", "new-destination");

  assert.strictEqual(getStickyModel("destination"), destinationRef);
  assert.strictEqual(getStickyModel("unrelated"), unrelatedRef);
  assert.equal(getStickyModel("new-destination"), undefined);
});

test("copyStickyModel does not copy corrupt or partial source refs or overwrite the destination", () => {
  for (const invalidRef of [
    { provider: "google" },
    { provider: "google", model: "gemini-2.5-pro", thinkingLevel: "ultra" },
  ]) {
    const destinationRef = { provider: "openai", model: "gpt-5.4" };
    const unrelatedRef = { provider: "anthropic", model: "claude-sonnet-4" };
    setRawGlobal({ source: invalidRef, destination: destinationRef, unrelated: unrelatedRef });

    copyStickyModel("source", "destination");

    assert.strictEqual(getStickyModel("destination"), destinationRef);
    assert.strictEqual(getStickyModel("unrelated"), unrelatedRef);
  }
});

test("keyed clear removes only that session", () => {
  const firstRef = { provider: "google", model: "gemini-2.5-pro" };
  const secondRef = { provider: "openai", model: "gpt-5.4" };
  setStickyModel(firstRef, "session-a");
  setStickyModel(secondRef, "session-b");

  clearStickyModel("session-a");

  assert.equal(getStickyModel("session-a"), undefined);
  assert.strictEqual(getStickyModel("session-b"), secondRef);
});

test("global clear removes all state and resets the cached state object", () => {
  setStickyModel({ provider: "google", model: "gemini-2.5-pro" }, "session-a");
  const previousState = globalThis[GLOBAL_KEY];

  clearStickyModel();

  assert.equal(Object.hasOwn(globalThis, GLOBAL_KEY), false);
  assert.equal(getStickyModel("session-a"), undefined);
  assert.notStrictEqual(globalThis[GLOBAL_KEY], previousState);
  assert.deepEqual(globalThis[GLOBAL_KEY], {});
});

test("getStickyModel rebuilds an empty state after globalThis state is deleted", () => {
  setStickyModel({ provider: "google", model: "gemini-2.5-pro" }, "session-a");
  const previousState = globalThis[GLOBAL_KEY];
  delete globalThis[GLOBAL_KEY];

  assert.doesNotThrow(() => getStickyModel("session-a"));
  assert.equal(getStickyModel("session-a"), undefined);
  assert.notStrictEqual(globalThis[GLOBAL_KEY], previousState);
  assert.deepEqual(globalThis[GLOBAL_KEY], {});
});

test("getStickyModel warns once and recovers from a non-object globalThis value", () => {
  const warnings = [];
  const origWarn = console.warn;
  console.warn = (msg) => warnings.push(msg);

  try {
    setRawGlobal(42);

    assert.equal(getStickyModel(), undefined);
    assert.equal(getStickyModel(), undefined);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Ignoring corrupt StickyModelRef state/);
    assert.deepEqual(globalThis[GLOBAL_KEY], {});

    setStickyModel({ provider: "google", model: "gemini-2.5-pro" });
    assert.deepEqual(getStickyModel(), { provider: "google", model: "gemini-2.5-pro" });
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = origWarn;
  }
});
