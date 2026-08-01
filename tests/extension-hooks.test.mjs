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
    thinkingLevel: "medium",
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

test("thinking_level_select stores the active model and thinking level", async () => {
  const createExtension = await loadExtension();
  const { api, emit } = createMockAPI();
  const { ui } = createMockUI();
  const model = makeModel("openai", "gpt-5.4");
  const ctx = createMockContext({
    ui,
    model,
    modelRegistry: createMockModelRegistry([model]),
  });

  createExtension(api);
  await emit(
    "thinking_level_select",
    { type: "thinking_level_select", level: "high", previousLevel: "medium" },
    ctx,
  );

  assert.deepEqual(getStickyModel(), {
    provider: "openai",
    model: "gpt-5.4",
    thinkingLevel: "high",
  });
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

test("new session inherits its predecessor model, not another session's model", async () => {
  const createExtension = await loadExtension();
  const { setStickyModel, getStickyModel } = await import("../lib/sticky-model.ts");
  const modelA = makeModel("google", "gemini-2.5-pro");
  const modelB = makeModel("deepseek", "deepseek-v4-pro");

  clearStickyModel();
  setStickyModel({ provider: modelA.provider, model: modelA.id }, "/sessions/a.jsonl");
  setStickyModel({ provider: modelB.provider, model: modelB.id }, "/sessions/b.jsonl");

  const { api, emit, setModelCalls } = createMockAPI();
  const { ui } = createMockUI();
  const ctx = createMockContext({
    ui,
    sessionFile: "/sessions/c.jsonl",
    modelRegistry: createMockModelRegistry([modelA, modelB]),
  });
  createExtension(api);

  await emit(
    "session_start",
    {
      type: "session_start",
      reason: "new",
      previousSessionFile: "/sessions/a.jsonl",
    },
    ctx,
  );

  assert.deepEqual(setModelCalls, [modelA]);
  assert.deepEqual(getStickyModel("/sessions/c.jsonl"), {
    provider: modelA.provider,
    model: modelA.id,
  });
});

test("new session restores its predecessor thinking level after the model", async () => {
  const createExtension = await loadExtension();
  const { setStickyModel } = await import("../lib/sticky-model.ts");
  const model = makeModel("openai", "gpt-5.4");

  setStickyModel(
    { provider: model.provider, model: model.id, thinkingLevel: "high" },
    "/sessions/a.jsonl",
  );

  const { api, emit, setModelCalls, setThinkingLevelCalls, callLog } = createMockAPI();
  const { ui } = createMockUI();
  const ctx = createMockContext({
    ui,
    sessionFile: "/sessions/b.jsonl",
    modelRegistry: createMockModelRegistry([model]),
  });
  createExtension(api);

  await emit(
    "session_start",
    {
      type: "session_start",
      reason: "new",
      previousSessionFile: "/sessions/a.jsonl",
    },
    ctx,
  );

  assert.deepEqual(setModelCalls, [model]);
  assert.deepEqual(setThinkingLevelCalls, ["high"]);
  assert.deepEqual(callLog, [
    { method: "setModel", value: model },
    { method: "setThinkingLevel", value: "high" },
  ]);
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

test("session_shutdown clears sticky model state", async () => {
  const createExtension = await loadExtension();
  const { setStickyModel } = await import("../lib/sticky-model.ts");
  setStickyModel({ provider: "google", model: "gemini-2.5-pro" });

  const { api, emit } = createMockAPI();
  createExtension(api);

  await emit("session_shutdown", { type: "session_shutdown" }, {});

  assert.equal(getStickyModel(), undefined);
});

test("model_select skips UI updates when hasUI is false", async () => {
  const createExtension = await loadExtension();
  const { api, emit } = createMockAPI();
  const { ui, status } = createMockUI();
  const ctx = createMockContext({
    ui,
    modelRegistry: createMockModelRegistry(),
  });
  ctx.hasUI = false;

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
    thinkingLevel: "medium",
  });
  assert.equal(status.get("sticky-model"), undefined);
});
