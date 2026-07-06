import assert from "node:assert/strict";
import test from "node:test";

import {
  createMockAPI,
  createMockContext,
  createMockModelRegistry,
  createMockUI,
  loadExtension,
  makeModel,
} from "./helpers/extension-harness.mjs";

const { clearStickyModel, getStickyModel } = await import("../lib/sticky-model.ts");

test.beforeEach(() => {
  clearStickyModel();
});

test("model_select stores provider/model and updates status", async () => {
  const createExtension = await loadExtension();
  const { api, emit } = createMockAPI();
  const { ui, status } = createMockUI();
  const ctx = createMockContext({
    ui,
    modelRegistry: createMockModelRegistry(),
  });

  createExtension(api);

  await emit(
    "model_select",
    {
      type: "model_select",
      model: makeModel("google", "gemini-2.5-pro"),
      previousModel: undefined,
      source: "set",
    },
    ctx,
  );

  assert.deepEqual(getStickyModel(), {
    provider: "google",
    model: "gemini-2.5-pro",
  });
  assert.equal(status.get("sticky-model"), "sticky: google/gemini-2.5-pro");
});

test("model_select skips sticky update when source is restore", async () => {
  const createExtension = await loadExtension();
  const { api, emit } = createMockAPI();
  const { ui, status, notifications } = createMockUI();
  const ctx = createMockContext({
    ui,
    modelRegistry: createMockModelRegistry(),
  });

  createExtension(api);

  await emit(
    "model_select",
    {
      type: "model_select",
      model: makeModel("google", "gemini-2.5-pro"),
      previousModel: undefined,
      source: "restore",
    },
    ctx,
  );

  assert.equal(getStickyModel(), undefined);
  assert.equal(status.get("sticky-model"), undefined);
  assert.equal(notifications.length, 0);
});

test("session_start restores sticky model on new, resume, and fork", async () => {
  const createExtension = await loadExtension();
  const sticky = { provider: "google", model: "gemini-2.5-pro" };
  const registryModel = makeModel(sticky.provider, sticky.model);

  for (const reason of ["new", "resume", "fork"]) {
    clearStickyModel();
    const { setStickyModel } = await import("../lib/sticky-model.ts");
    setStickyModel(sticky);

    const { api, emit, setModelCalls } = createMockAPI();
    const { ui, status, notifications } = createMockUI();
    const ctx = createMockContext({
      ui,
      modelRegistry: createMockModelRegistry([registryModel]),
    });

    createExtension(api);

    await emit(
      "session_start",
      { type: "session_start", reason },
      ctx,
    );

    assert.deepEqual(setModelCalls, [registryModel], `reason=${reason}`);
    assert.equal(status.get("sticky-model"), "sticky: google/gemini-2.5-pro");
    assert.equal(
      notifications.some(
        (n) =>
          n.type === "info" &&
          n.message === "Restored sticky model: google/gemini-2.5-pro",
      ),
      true,
      `reason=${reason}`,
    );
  }
});

test("session_start skips restore on startup", async () => {
  const createExtension = await loadExtension();
  const { setStickyModel } = await import("../lib/sticky-model.ts");
  setStickyModel({ provider: "google", model: "gemini-2.5-pro" });

  const { api, emit, setModelCalls } = createMockAPI();
  const { ui, notifications } = createMockUI();
  const ctx = createMockContext({
    ui,
    modelRegistry: createMockModelRegistry([
      makeModel("google", "gemini-2.5-pro"),
    ]),
  });

  createExtension(api);

  await emit(
    "session_start",
    { type: "session_start", reason: "startup" },
    ctx,
  );

  assert.deepEqual(setModelCalls, []);
  assert.equal(notifications.length, 0);
});

test("session_start warns when saved model is missing from registry", async () => {
  const createExtension = await loadExtension();
  const { setStickyModel } = await import("../lib/sticky-model.ts");
  setStickyModel({ provider: "google", model: "gemini-2.5-pro" });

  const { api, emit, setModelCalls } = createMockAPI();
  const { ui, notifications } = createMockUI();
  const ctx = createMockContext({
    ui,
    modelRegistry: createMockModelRegistry(),
  });

  createExtension(api);

  await emit(
    "session_start",
    { type: "session_start", reason: "new" },
    ctx,
  );

  assert.deepEqual(setModelCalls, []);
  assert.deepEqual(notifications, [
    {
      message:
        "pi-sticky-model: saved model google/gemini-2.5-pro not found in registry, falling back to default.",
      type: "warning",
    },
  ]);
});

test("session_start warns when pi.setModel returns false", async () => {
  const createExtension = await loadExtension();
  const { setStickyModel } = await import("../lib/sticky-model.ts");
  setStickyModel({ provider: "google", model: "gemini-2.5-pro" });

  const registryModel = makeModel("google", "gemini-2.5-pro");
  const { api, emit, setModelCalls } = createMockAPI({ setModelResult: false });
  const { ui, notifications } = createMockUI();
  const ctx = createMockContext({
    ui,
    modelRegistry: createMockModelRegistry([registryModel]),
  });

  createExtension(api);

  await emit(
    "session_start",
    { type: "session_start", reason: "resume" },
    ctx,
  );

  assert.deepEqual(setModelCalls, [registryModel]);
  assert.deepEqual(notifications, [
    {
      message: "pi-sticky-model: failed to restore google/gemini-2.5-pro",
      type: "warning",
    },
  ]);
});

test("session_start does nothing when no sticky model was set", async () => {
  const createExtension = await loadExtension();
  const { api, emit, setModelCalls } = createMockAPI();
  const { ui, notifications } = createMockUI();
  const ctx = createMockContext({
    ui,
    modelRegistry: createMockModelRegistry([
      makeModel("google", "gemini-2.5-pro"),
    ]),
  });

  createExtension(api);

  await emit(
    "session_start",
    { type: "session_start", reason: "fork" },
    ctx,
  );

  assert.deepEqual(setModelCalls, []);
  assert.equal(notifications.length, 0);
});
