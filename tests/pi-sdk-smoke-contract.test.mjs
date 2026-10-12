import assert from "node:assert/strict";
import test from "node:test";

import {
  behaviorAssertions,
  parseJsonLines,
  SDK_VERSIONS,
  VERIFICATION_CONTRACT,
} from "../scripts/pi-sdk-smoke-contract.mjs";

const response = (id, command, data = {}, success = true) => ({
  id,
  type: "response",
  command,
  success,
  data,
});

function featureResponses() {
  return [
    response("select-model-a", "set_model"),
    response("new-session", "new_session", { cancelled: false }),
    response("select-model-b", "set_model"),
    response("resume-session-a", "switch_session", { cancelled: false }),
    response("restored-state", "get_state", {
      model: { provider: "sticky-smoke", id: "sticky-a" },
      thinkingLevel: "high",
    }),
  ];
}

test("smoke report contract uses frozen SDK versions", () => {
  assert.equal(VERIFICATION_CONTRACT, "pi-sdk-behavior-v2");
  assert.deepEqual(SDK_VERSIONS, {
    "@earendil-works/pi-agent-core": "1.1.0",
    "@earendil-works/pi-ai": "1.1.0",
    "@earendil-works/pi-coding-agent": "1.1.0",
    "@earendil-works/pi-tui": "1.1.0",
  });
});

test("JSON line parser keeps valid RPC responses and ignores non-JSON output", () => {
  assert.deepEqual(parseJsonLines('noise\n{"type":"response","success":true}\n'), [
    { type: "response", success: true },
  ]);
});

test("positive feature response proves session restore and preserves thinking level", () => {
  const assertions = behaviorAssertions("happy_path", {
    responses: featureResponses(),
    exit_code: 0,
  });
  assert.equal(assertions[0].id, "feature_response");
  assert.equal(assertions[0].passed, true);
});

test("missing model/session response fails the positive feature assertion", () => {
  const assertions = behaviorAssertions("happy_path", {
    responses: [response("restored-state", "get_state", {
      model: { provider: "sticky-smoke", id: "sticky-b" },
      thinkingLevel: "low",
    })],
    exit_code: 0,
  });
  assert.equal(assertions[0].passed, false);
});

test("handled-error assertion rejects a missing or unexpected negative response", () => {
  const missing = behaviorAssertions("error_path", { responses: [], exit_code: 0 });
  const unexpected = behaviorAssertions("error_path", {
    responses: [response("missing-model", "set_model", {}, true)],
    exit_code: 0,
  });
  assert.equal(missing[0].passed, false);
  assert.equal(unexpected[0].passed, false);
});

test("host-shell assertion rejects a missing or incorrect pinned CLI version", () => {
  const missing = behaviorAssertions("host_shell", { responses: [], exit_code: 0, fullOutput: "" });
  const incorrect = behaviorAssertions("host_shell", {
    responses: [],
    exit_code: 0,
    fullOutput: "0.99.2\n",
  });
  assert.equal(missing[0].passed, false);
  assert.equal(incorrect[0].passed, false);
});
