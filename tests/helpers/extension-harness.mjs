/** Lightweight mock ExtensionAPI / context harness for extension hook tests. */

/**
 * @param {{ setModelResult?: boolean, thinkingLevel?: string }} [options]
 */
export function createMockAPI(options = {}) {
  const { setModelResult = true, thinkingLevel = "medium" } = options;
  /** @type {Map<string, Array<(event: unknown, ctx: unknown) => unknown>>} */
  const handlers = new Map();
  /** @type {unknown[]} */
  const setModelCalls = [];
  /** @type {string[]} */
  const setThinkingLevelCalls = [];

  const api = {
    on(event, handler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    async setModel(model) {
      setModelCalls.push(model);
      return setModelResult;
    },
    getThinkingLevel() {
      return thinkingLevel;
    },
    setThinkingLevel(level) {
      setThinkingLevelCalls.push(level);
    },
  };

  async function emit(eventName, event, ctx) {
    for (const handler of handlers.get(eventName) ?? []) {
      await handler(event, ctx);
    }
  }

  return { api, handlers, emit, setModelCalls, setThinkingLevelCalls };
}

export function createMockUI() {
  /** @type {Map<string, string | undefined>} */
  const status = new Map();
  /** @type {Array<{ message: string, type?: string }>} */
  const notifications = [];

  const ui = {
    setStatus(key, text) {
      status.set(key, text);
    },
    notify(message, type) {
      notifications.push({ message, type });
    },
  };

  return { ui, status, notifications };
}

/**
 * @param {Array<{ provider: string, id: string }>} [models]
 */
export function createMockModelRegistry(models = []) {
  const byKey = new Map(models.map((model) => [`${model.provider}:${model.id}`, model]));

  return {
    find(provider, modelId) {
      return byKey.get(`${provider}:${modelId}`);
    },
  };
}

/**
 * @param {{ ui: object, modelRegistry: object, sessionFile?: string }} params
 */
export function createMockContext({ ui, modelRegistry, sessionFile, model }) {
  return {
    ui,
    hasUI: true,
    cwd: "/tmp",
    sessionManager: sessionFile === undefined ? {} : { getSessionFile: () => sessionFile },
    modelRegistry,
    model,
    isIdle: () => true,
    signal: undefined,
    abort: () => {},
    hasPendingMessages: () => false,
    shutdown: () => {},
    getContextUsage: () => undefined,
    compact: () => {},
    getSystemPrompt: () => "",
  };
}

/**
 * @param {string} provider
 * @param {string} id
 */
export function makeModel(provider, id) {
  return { provider, id };
}

export async function loadExtension() {
  const module = await import("../../extensions/index.ts");
  return module.default;
}
