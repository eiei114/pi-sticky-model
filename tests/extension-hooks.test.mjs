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
const priorStatus = "sticky: anthropic/claude-sonnet-4-6";

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

test("a fork restores the model and thinking level captured by a thinking-only change", async () => {
  const createExtension = await loadExtension();
  const { setStickyModel } = await import("../lib/sticky-model.ts");
  const predecessorFile = "/sessions/predecessor.jsonl";
  const forkFile = "/sessions/fork.jsonl";
  const independentFile = "/sessions/independent.jsonl";
  const model = makeModel("openai", "gpt-5.4");
  const independentModel = makeModel("google", "gemini-2.5-pro");
  setStickyModel(
    { provider: independentModel.provider, model: independentModel.id, thinkingLevel: "low" },
    independentFile,
  );
  const modelRegistry = createMockModelRegistry([model, independentModel]);
  const predecessor = createMockAPI();
  createExtension(predecessor.api);

  await predecessor.emit(
    "thinking_level_select",
    { type: "thinking_level_select", level: "high", previousLevel: "medium" },
    createMockContext({ ui: createMockUI().ui, modelRegistry, sessionFile: predecessorFile, model }),
  );

  const fork = createMockAPI();
  createExtension(fork.api);
  await fork.emit(
    "session_start",
    { type: "session_start", reason: "fork", previousSessionFile: predecessorFile },
    createMockContext({ ui: createMockUI().ui, modelRegistry, sessionFile: forkFile }),
  );

  assert.deepEqual(fork.callLog, [
    { method: "setModel", value: model },
    { method: "setThinkingLevel", value: "high" },
  ]);
  assert.deepEqual(getStickyModel(forkFile), {
    provider: model.provider,
    model: model.id,
    thinkingLevel: "high",
  });
  assert.deepEqual(getStickyModel(independentFile), {
    provider: independentModel.provider,
    model: independentModel.id,
    thinkingLevel: "low",
  });
});

test("thinking_level_select does not store anything when there is no active model", async () => {
  const createExtension = await loadExtension();
  const { api, emit } = createMockAPI();
  const { ui } = createMockUI();
  const ctx = createMockContext({
    ui,
    modelRegistry: createMockModelRegistry(),
  });

  createExtension(api);
  await emit(
    "thinking_level_select",
    { type: "thinking_level_select", level: "high", previousLevel: "medium" },
    ctx,
  );

  assert.equal(getStickyModel(), undefined);
});

test("events without a session manager share the __default__ sticky model", async () => {
  const createExtension = await loadExtension();
  const { api, emit } = createMockAPI();
  const { ui } = createMockUI();
  const model = makeModel("openai", "gpt-5.4");
  const ctx = createMockContext({
    ui,
    model,
    modelRegistry: createMockModelRegistry([model]),
    omitSessionManager: true,
  });

  createExtension(api);
  await emit(
    "model_select",
    {
      type: "model_select",
      model,
      previousModel: undefined,
      source: "set",
    },
    ctx,
  );
  await emit(
    "thinking_level_select",
    { type: "thinking_level_select", level: "high", previousLevel: "medium" },
    ctx,
  );

  assert.deepEqual(getStickyModel("__default__"), {
    provider: model.provider,
    model: model.id,
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
    status.set("sticky-model", priorStatus);
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

test("resume restores only the target session's saved model and thinking level", async () => {
  const createExtension = await loadExtension();
  const { setStickyModel } = await import("../lib/sticky-model.ts");
  const outgoingFile = "/sessions/outgoing.jsonl";
  const targetFile = "/sessions/target.jsonl";
  const outgoingModel = makeModel("google", "gemini-2.5-pro");
  const targetModel = makeModel("openai", "gpt-5.4");
  const outgoingSticky = { provider: outgoingModel.provider, model: outgoingModel.id, thinkingLevel: "low" };
  const targetSticky = { provider: targetModel.provider, model: targetModel.id, thinkingLevel: "high" };
  setStickyModel({ ...outgoingSticky }, outgoingFile);
  setStickyModel({ ...targetSticky }, targetFile);

  const { api, emit, callLog } = createMockAPI();
  createExtension(api);
  await emit(
    "session_start",
    { type: "session_start", reason: "resume", previousSessionFile: outgoingFile },
    createMockContext({
      ui: createMockUI().ui,
      modelRegistry: createMockModelRegistry([outgoingModel, targetModel]),
      sessionFile: targetFile,
    }),
  );

  assert.deepEqual(callLog, [
    { method: "setModel", value: targetModel },
    { method: "setThinkingLevel", value: "high" },
  ]);
  assert.deepEqual(getStickyModel(outgoingFile), outgoingSticky);
  assert.deepEqual(getStickyModel(targetFile), targetSticky);
});

test("resume without a saved selection does not inherit the outgoing session's selection", async () => {
  const createExtension = await loadExtension();
  const { setStickyModel } = await import("../lib/sticky-model.ts");
  const outgoingFile = "/sessions/outgoing.jsonl";
  const targetFile = "/sessions/target.jsonl";
  const outgoingModel = makeModel("google", "gemini-2.5-pro");
  const outgoingSticky = { provider: outgoingModel.provider, model: outgoingModel.id, thinkingLevel: "low" };
  setStickyModel({ ...outgoingSticky }, outgoingFile);

  const { api, emit, callLog } = createMockAPI();
  createExtension(api);
  await emit(
    "session_start",
    { type: "session_start", reason: "resume", previousSessionFile: outgoingFile },
    createMockContext({
      ui: createMockUI().ui,
      modelRegistry: createMockModelRegistry([outgoingModel]),
      sessionFile: targetFile,
    }),
  );

  assert.deepEqual(callLog, []);
  assert.equal(getStickyModel(targetFile), undefined);
  assert.deepEqual(getStickyModel(outgoingFile), outgoingSticky);
});

test("session_start restores the current model on reload", async () => {
  const createExtension = await loadExtension();
  const { setStickyModel } = await import("../lib/sticky-model.ts");
  const model = makeModel("google", "gemini-2.5-pro");
  const sessionFile = "/sessions/reloaded.jsonl";
  setStickyModel(
    { provider: model.provider, model: model.id, thinkingLevel: "high" },
    sessionFile,
  );

  const { api, emit, setModelCalls, setThinkingLevelCalls } = createMockAPI();
  const { ui, status, notifications } = createMockUI();
  const ctx = createMockContext({
    ui,
    sessionFile,
    modelRegistry: createMockModelRegistry([model]),
  });

  createExtension(api);
  await emit("session_start", { type: "session_start", reason: "reload" }, ctx);

  assert.deepEqual(setModelCalls, [model]);
  assert.deepEqual(setThinkingLevelCalls, ["high"]);
  assert.equal(status.get("sticky-model"), "sticky: google/gemini-2.5-pro");
  assert.equal(
    notifications.some((n) => n.message === "Restored sticky model: google/gemini-2.5-pro"),
    true,
  );
});

test("session_start restores in-memory new and fork sessions without a previous session file", async () => {
  const createExtension = await loadExtension();
  const { setStickyModel } = await import("../lib/sticky-model.ts");
  const model = makeModel("openai", "gpt-5.4");
  const sticky = { provider: model.provider, model: model.id, thinkingLevel: "high" };
  setStickyModel(sticky, "__default__");

  for (const reason of ["new", "fork"]) {
    const { api, emit, setModelCalls, setThinkingLevelCalls } = createMockAPI();
    const { ui } = createMockUI();
    const ctx = createMockContext({
      ui,
      modelRegistry: createMockModelRegistry([model]),
      omitSessionManager: true,
    });

    createExtension(api);
    await emit(
      "session_start",
      { type: "session_start", reason, previousSessionFile: undefined },
      ctx,
    );

    assert.deepEqual(setModelCalls, [model], `reason=${reason}`);
    assert.deepEqual(setThinkingLevelCalls, ["high"], `reason=${reason}`);
    assert.deepEqual(getStickyModel("__default__"), sticky, `reason=${reason}`);
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
  const { ui, status, notifications } = createMockUI();
  status.set("sticky-model", priorStatus);
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
  assert.equal(status.get("sticky-model"), undefined);
  assert.deepEqual(getStickyModel(), { provider: "google", model: "gemini-2.5-pro" });
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
  const { ui, status, notifications } = createMockUI();
  status.set("sticky-model", priorStatus);
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
  assert.equal(status.get("sticky-model"), undefined);
  assert.deepEqual(notifications, [
    {
      message: "pi-sticky-model: failed to restore google/gemini-2.5-pro",
      type: "warning",
    },
  ]);
});

test("session_start warns and retries when pi.setModel rejects", async () => {
  const createExtension = await loadExtension();
  const { setStickyModel } = await import("../lib/sticky-model.ts");
  const sticky = {
    provider: "google",
    model: "gemini-2.5-pro",
    thinkingLevel: "high",
  };
  setStickyModel(sticky);

  const registryModel = makeModel(sticky.provider, sticky.model);
  let attempts = 0;
  const { api, emit, setModelCalls, setThinkingLevelCalls } = createMockAPI({
    setModelResult: () => {
      if (attempts++ === 0) return Promise.reject(new Error("restore failed"));
      return true;
    },
  });
  const { ui, status, notifications } = createMockUI();
  status.set("sticky-model", priorStatus);
  const ctx = createMockContext({
    ui,
    modelRegistry: createMockModelRegistry([registryModel]),
  });

  createExtension(api);

  await emit("session_start", { type: "session_start", reason: "resume" }, ctx);

  assert.deepEqual(setModelCalls, [registryModel]);
  assert.deepEqual(setThinkingLevelCalls, []);
  assert.deepEqual(getStickyModel(), sticky);
  assert.equal(status.get("sticky-model"), undefined);
  assert.deepEqual(notifications, [
    {
      message: "pi-sticky-model: failed to restore google/gemini-2.5-pro",
      type: "warning",
    },
  ]);

  await emit("session_start", { type: "session_start", reason: "resume" }, ctx);

  assert.deepEqual(setModelCalls, [registryModel, registryModel]);
  assert.deepEqual(setThinkingLevelCalls, ["high"]);
  assert.deepEqual(getStickyModel(), sticky);
  assert.equal(status.get("sticky-model"), "sticky: google/gemini-2.5-pro");
  assert.equal(
    notifications.some(
      (notification) =>
        notification.message === "Restored sticky model: google/gemini-2.5-pro",
    ),
    true,
  );
});

test("session_start does not update UI on success or rejection without UI", async () => {
  const createExtension = await loadExtension();
  const { setStickyModel } = await import("../lib/sticky-model.ts");
  const sticky = { provider: "google", model: "gemini-2.5-pro" };
  setStickyModel(sticky);

  const registryModel = makeModel(sticky.provider, sticky.model);
  for (const setModelResult of [true, () => Promise.reject(new Error("restore failed"))]) {
    const { api, emit, setModelCalls } = createMockAPI({ setModelResult });
    const { ui, status, notifications } = createMockUI();
    status.set("sticky-model", priorStatus);
    const ctx = createMockContext({
      ui,
      modelRegistry: createMockModelRegistry([registryModel]),
    });
    ctx.hasUI = false;

    createExtension(api);

    await emit("session_start", { type: "session_start", reason: "resume" }, ctx);

    assert.deepEqual(setModelCalls, [registryModel]);
    assert.deepEqual(getStickyModel(), sticky);
    assert.equal(status.get("sticky-model"), priorStatus);
    assert.deepEqual(notifications, []);
  }
});

test("session_start skips thinking restore after failure and keeps the value for retry", async () => {
  const createExtension = await loadExtension();
  const { setStickyModel } = await import("../lib/sticky-model.ts");
  const sticky = {
    provider: "google",
    model: "gemini-2.5-pro",
    thinkingLevel: "high",
  };
  setStickyModel(sticky);

  const registryModel = makeModel(sticky.provider, sticky.model);
  const results = [false, true];
  const { api, emit, setModelCalls, setThinkingLevelCalls } = createMockAPI({
    setModelResult: () => results.shift() ?? true,
  });
  const { ui, notifications } = createMockUI();
  const ctx = createMockContext({
    ui,
    modelRegistry: createMockModelRegistry([registryModel]),
  });

  createExtension(api);

  await emit("session_start", { type: "session_start", reason: "resume" }, ctx);

  assert.deepEqual(setModelCalls, [registryModel]);
  assert.deepEqual(setThinkingLevelCalls, []);
  assert.deepEqual(getStickyModel(), sticky);
  assert.deepEqual(notifications, [
    {
      message: "pi-sticky-model: failed to restore google/gemini-2.5-pro",
      type: "warning",
    },
  ]);

  await emit("session_start", { type: "session_start", reason: "resume" }, ctx);

  assert.deepEqual(setModelCalls, [registryModel, registryModel]);
  assert.deepEqual(setThinkingLevelCalls, ["high"]);
  assert.deepEqual(getStickyModel(), sticky);
});

test("session_start clears the status without restoring when no sticky model was set", async () => {
  const createExtension = await loadExtension();
  const { api, emit, setModelCalls } = createMockAPI();
  const { ui, status, notifications } = createMockUI();
  status.set("sticky-model", priorStatus);
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
  assert.equal(status.get("sticky-model"), undefined);
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

test("restore-source model selection captures the active key for shutdown without storing", async () => {
  const createExtension = await loadExtension();
  const { setStickyModel } = await import("../lib/sticky-model.ts");
  const restoredSessionFile = "/sessions/restored.jsonl";
  const otherSessionFile = "/sessions/other.jsonl";
  const restoredSticky = { provider: "google", model: "gemini-2.5-pro" };
  const otherSticky = { provider: "openai", model: "gpt-5.4" };
  setStickyModel(restoredSticky, restoredSessionFile);
  setStickyModel(otherSticky, otherSessionFile);

  const { api, emit } = createMockAPI();
  const { ui } = createMockUI();
  const ctx = createMockContext({
    ui,
    sessionFile: restoredSessionFile,
    modelRegistry: createMockModelRegistry(),
  });
  createExtension(api);

  await emit(
    "model_select",
    {
      type: "model_select",
      model: makeModel(restoredSticky.provider, restoredSticky.model),
      previousModel: undefined,
      source: "restore",
    },
    ctx,
  );

  assert.deepEqual(getStickyModel(restoredSessionFile), restoredSticky);
  await emit(
    "session_shutdown",
    { type: "session_shutdown", reason: "quit" },
    createMockContext({
      ui,
      sessionFile: otherSessionFile,
      modelRegistry: createMockModelRegistry(),
    }),
  );

  assert.equal(getStickyModel(restoredSessionFile), undefined);
  assert.deepEqual(getStickyModel(otherSessionFile), otherSticky);
});

test("session_shutdown clears the active session without reading stale context", async () => {
  const createExtension = await loadExtension();
  const { api, emit } = createMockAPI();
  createExtension(api);

  const sessionFile = "/sessions/active.jsonl";
  const { setStickyModel } = await import("../lib/sticky-model.ts");
  setStickyModel({ provider: "google", model: "gemini-2.5-pro" }, sessionFile);
  await emit("session_start", { type: "session_start", reason: "startup" }, {
    sessionManager: { getSessionFile: () => sessionFile },
  });

  const staleContext = new Proxy({}, {
    get() {
      throw new Error("stale context was accessed");
    },
  });
  await emit("session_shutdown", { type: "session_shutdown", reason: "quit" }, staleContext);

  assert.equal(getStickyModel(sessionFile), undefined);
});

test("session replacement shutdown preserves the outgoing session state", async () => {
  const createExtension = await loadExtension();
  const { api, emit } = createMockAPI();
  createExtension(api);

  const sessionFile = "/sessions/outgoing.jsonl";
  const { setStickyModel } = await import("../lib/sticky-model.ts");
  const sticky = { provider: "google", model: "gemini-2.5-pro" };
  setStickyModel(sticky, sessionFile);
  await emit("session_start", { type: "session_start", reason: "startup" }, {
    sessionManager: { getSessionFile: () => sessionFile },
  });
  await emit("session_shutdown", { type: "session_shutdown", reason: "new" }, {});

  assert.deepEqual(getStickyModel(sessionFile), sticky);
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
