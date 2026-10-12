export const VERIFICATION_CONTRACT = "pi-sdk-behavior-v2";
export const SDK_VERSIONS = {
  "@earendil-works/pi-agent-core": "1.1.0",
  "@earendil-works/pi-ai": "1.1.0",
  "@earendil-works/pi-coding-agent": "1.1.0",
  "@earendil-works/pi-tui": "1.1.0",
};

export const UNHANDLED_ERROR_PATTERN = /UnhandledPromiseRejection|uncaught (?:exception|error)|shutdown error/i;
export const EXTENSION_LOAD_ERROR_PATTERN = /Failed to load extension|Error loading extension|extension_error/i;

export function parseJsonLines(output) {
  return output.split(/\r?\n/).flatMap((line) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
}

function assertion(id, expected, observed, passed) {
  return { id, expected, observed: JSON.stringify(observed), passed: passed === true };
}

function byId(responses, id) {
  return responses.find((row) => row?.id === id && row.type === "response");
}

function isRestoredState(state, expected) {
  return state?.model?.provider === expected.provider &&
    state.model.id === expected.modelId && state.thinkingLevel === expected.thinkingLevel;
}

export function behaviorAssertions(name, evidence) {
  const { responses = [], exit_code, fullOutput = "", expectedVersion = "1.1.0" } = evidence;
  const state = byId(responses, "restored-state")?.data;
  const modelA = { provider: "sticky-smoke", modelId: "sticky-a", thinkingLevel: "high" };
  const featureObserved = {
    selectedA: byId(responses, "select-model-a") ?? null,
    createdNewSession: byId(responses, "new-session") ?? null,
    selectedB: byId(responses, "select-model-b") ?? null,
    switchedBack: byId(responses, "resume-session-a") ?? null,
    restoredState: state ?? null,
  };
  const featurePassed =
    byId(responses, "select-model-a")?.success === true &&
    byId(responses, "new-session")?.success === true &&
    byId(responses, "new-session")?.data?.cancelled === false &&
    byId(responses, "select-model-b")?.success === true &&
    byId(responses, "resume-session-a")?.success === true &&
    byId(responses, "resume-session-a")?.data?.cancelled === false &&
    isRestoredState(state, modelA);

  if (name === "extension_load") {
    return [assertion(
      "extension_registered",
      "The real Pi host loads the extension and its session_start hook restores model A and its thinking level after switching away.",
      featureObserved,
      featurePassed && !EXTENSION_LOAD_ERROR_PATTERN.test(fullOutput),
    )];
  }
  if (name === "happy_path") {
    return [assertion(
      "feature_response",
      "After selecting model A/high, creating a new session, selecting model B/low, and resuming A, actual Pi state is model A/high.",
      featureObserved,
      featurePassed,
    )];
  }
  if (name === "error_path") {
    const missingModel = byId(responses, "missing-model");
    return [assertion(
      "handled_error",
      "An unavailable model produces an explicit unsuccessful set_model RPC response while the actual Pi host remains free of unhandled and shutdown errors.",
      { response: missingModel ?? null, exit_code, unhandled: UNHANDLED_ERROR_PATTERN.test(fullOutput) },
      missingModel?.command === "set_model" && missingModel.success === false &&
        typeof missingModel.error === "string" && missingModel.error.includes("Model not found") &&
        exit_code === 0 && !UNHANDLED_ERROR_PATTERN.test(fullOutput),
    )];
  }
  if (name === "reload_cleanup") {
    const reloadedResponses = evidence.reloadedResponses ?? [];
    const reloadedState = byId(reloadedResponses, "restored-state")?.data;
    const reloadedFeature = {
      selectedA: byId(reloadedResponses, "select-model-a") ?? null,
      switchedBack: byId(reloadedResponses, "resume-session-a") ?? null,
      restoredState: reloadedState ?? null,
      firstProcessSessionId: evidence.firstProcessSessionId ?? null,
      reloadedSessionId: evidence.reloadedSessionId ?? null,
    };
    const reloadedFeaturePassed =
      byId(reloadedResponses, "select-model-a")?.success === true &&
      byId(reloadedResponses, "resume-session-a")?.success === true &&
      isRestoredState(reloadedState, modelA) &&
      typeof evidence.reloadedSessionId === "string" &&
      evidence.reloadedSessionId !== evidence.firstProcessSessionId;
    return [
      assertion(
        "reloaded_extension_registered",
        "A second isolated actual Pi process loads the extension and observes its model-selection/session lifecycle.",
        reloadedFeature,
        byId(reloadedResponses, "select-model-a")?.success === true &&
          !EXTENSION_LOAD_ERROR_PATTERN.test(evidence.reloadedOutput ?? ""),
      ),
      assertion(
        "reloaded_feature_response",
        "The second Pi process resumes the selected session and observes the extension-restored model A/high response.",
        reloadedFeature,
        reloadedFeaturePassed,
      ),
      assertion(
        "clean_shutdown",
        "The second actual Pi process exits with status zero and no unhandled exception or shutdown error.",
        { exit_code, unhandled: UNHANDLED_ERROR_PATTERN.test(fullOutput) },
        exit_code === 0 && !UNHANDLED_ERROR_PATTERN.test(fullOutput),
      ),
    ];
  }
  if (name === "host_shell") {
    return [assertion(
      "native_shell_boundary",
      "The native host shell launches the locally pinned Pi CLI and returns exactly its installed version.",
      { exit_code, output: fullOutput.trim(), expectedVersion },
      exit_code === 0 && fullOutput.trim() === expectedVersion,
    )];
  }
  throw new Error(`Unknown smoke case: ${name}`);
}
