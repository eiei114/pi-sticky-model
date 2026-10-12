import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  behaviorAssertions,
  EXTENSION_LOAD_ERROR_PATTERN,
  parseJsonLines,
  SDK_VERSIONS,
  UNHANDLED_ERROR_PATTERN,
  VERIFICATION_CONTRACT,
} from "./pi-sdk-smoke-contract.mjs";

const root = resolve(import.meta.dirname, "..");
const reportPath = resolve(root, "docs/verification/pi-sdk-smoke.json");
const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const installedVersions = Object.fromEntries(Object.keys(SDK_VERSIONS).map((name) => [
  name,
  readJson(resolve(root, "node_modules", name, "package.json")).version,
]));

for (const [name, expected] of Object.entries(SDK_VERSIONS)) {
  if (manifest.devDependencies?.[name] !== expected || installedVersions[name] !== expected) {
    throw new Error(`Smoke requires exact Pi SDK ${name}=${expected}; manifest=${manifest.devDependencies?.[name]}, installed=${installedVersions[name]}`);
  }
}

const codingAgent = readJson(resolve(root, "node_modules/@earendil-works/pi-coding-agent/package.json"));
const cliPath = resolve(root, "node_modules/@earendil-works/pi-coding-agent", codingAgent.bin.pi);
const extensionPath = resolve(root, "extensions");
const MAX_OUTPUT_BYTES = 1024 * 1024;
const PROBE_TIMEOUT_MS = 15_000;
const MODEL_A = { provider: "sticky-smoke", modelId: "sticky-a" };
const MODEL_B = { provider: "sticky-smoke", modelId: "sticky-b" };

function terminateOwnedChild(child) {
  if (!child.pid || child.exitCode != null || child.signalCode != null) return;
  if (process.platform === "win32") {
    const taskkill = join(process.env.SystemRoot ?? "C:/Windows", "System32", "taskkill.exe");
    spawnSync(taskkill, ["/PID", String(child.pid), "/T", "/F"], {
      encoding: "utf8",
      timeout: 750,
      windowsHide: true,
    });
    child.kill("SIGKILL");
    return;
  }
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

async function runRpcHost(scenarioRoot, hostName, commandPlan) {
  const agentDir = mkdtempSync(join(scenarioRoot, `${hostName}-agent-`));
  const sessionDir = join(agentDir, "sessions");
  mkdirSync(sessionDir, { recursive: true });
  writeFileSync(resolve(agentDir, "models.json"), `${JSON.stringify({
    providers: {
      "sticky-smoke": {
        baseUrl: "http://127.0.0.1:9/v1",
        api: "openai-completions",
        apiKey: "offline-smoke-only",
        models: [
          { id: "sticky-a", name: "Offline Sticky A", reasoning: true, input: ["text"],
            contextWindow: 16_384, maxTokens: 1_024,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } },
          { id: "sticky-b", name: "Offline Sticky B", reasoning: true, input: ["text"],
            contextWindow: 16_384, maxTokens: 1_024,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } },
        ],
      },
    },
  }, null, 2)}\n`);
  const args = [cliPath, "--offline", "--no-tools", "--no-extensions", "--no-mcp", "--no-skills",
    "--no-context-files", "--no-prompt-templates", "--session-dir", sessionDir,
    "--extension", extensionPath, "--mode", "rpc"];
  const env = { ...process.env, PI_CODING_AGENT_DIR: agentDir, PI_OFFLINE: "1" };
  const child = spawn(process.execPath, args, {
    cwd: root,
    env,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    detached: process.platform !== "win32",
  });
  const output = { stdout: "", stderr: "", rows: [] };
  let outputLimitExceeded = false;
  let timedOut = false;
  let closed = false;
  let closeInfo;
  let childError;
  let nextId = 0;
  const pending = new Map();
  const waiters = new Set();
  let scenario = {};
  let closeResolve;
  const closePromise = new Promise((resolveClose) => { closeResolve = resolveClose; });

  const append = (key, chunk) => {
    const text = chunk.toString();
    if (Buffer.byteLength(output.stdout) + Buffer.byteLength(output.stderr) + Buffer.byteLength(text) > MAX_OUTPUT_BYTES) {
      outputLimitExceeded = true;
      terminateOwnedChild(child);
      return;
    }
    output[key] += text;
  };
  const stdoutLines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  stdoutLines.on("line", (line) => {
    const rows = parseJsonLines(line);
    output.rows.push(...rows);
    for (const row of rows) {
      if (row.type !== "response" || !row.id) continue;
      const resolveResponse = pending.get(row.id);
      if (resolveResponse) {
        pending.delete(row.id);
        resolveResponse(row);
      }
    }
  });
  child.stdout.on("data", (chunk) => append("stdout", chunk));
  child.stderr.on("data", (chunk) => append("stderr", chunk));
  child.once("error", (error) => {
    childError = error;
    closeInfo = { code: null, signal: null, error };
    closed = true;
    closeResolve(closeInfo);
    for (const rejectWaiter of waiters) rejectWaiter(error);
  });
  child.once("close", (code, signal) => {
    closeInfo = { code, signal, error: childError };
    closed = true;
    closeResolve(closeInfo);
    for (const rejectWaiter of waiters) rejectWaiter(new Error(`Pi process closed before RPC response (exit=${code}, signal=${signal})`));
    waiters.clear();
  });

  const deadline = setTimeout(() => {
    timedOut = true;
    const error = new Error(`Pi RPC probe exceeded ${PROBE_TIMEOUT_MS}ms`);
    for (const rejectWaiter of waiters) rejectWaiter(error);
    waiters.clear();
    terminateOwnedChild(child);
  }, PROBE_TIMEOUT_MS);

  const request = async (type, fields = {}, id = `rpc-${++nextId}`) => {
    if (closed) throw new Error("Pi process closed before request");
    const responsePromise = new Promise((resolveResponse, rejectResponse) => {
      waiters.add(rejectResponse);
      pending.set(id, (row) => {
        waiters.delete(rejectResponse);
        resolveResponse(row);
      });
    });
    child.stdin.write(`${JSON.stringify({ id, type, ...fields })}\n`);
    const response = await responsePromise;
    if (response.command !== type) throw new Error(`Expected ${type} response; observed ${response.command}`);
    return response;
  };

  try {
    scenario = await commandPlan(request);
    child.stdin.end();
    closeInfo = await closePromise;
  } catch (error) {
    child.stdin.end();
    closeInfo = await closePromise;
    output.failure = error.message;
  } finally {
    clearTimeout(deadline);
    stdoutLines.close();
    if (!closed) {
      terminateOwnedChild(child);
      await Promise.race([closePromise, new Promise((resolveDelay) => setTimeout(resolveDelay, 1000))]);
    }
  }

  const fullOutput = `${output.stdout}${output.stderr}`;
  const responseRows = output.rows.filter((row) => row.type === "response");
  const exit_code = timedOut || closeInfo?.error || outputLimitExceeded ? null : closeInfo?.code;
  return {
    responseRows,
    fullOutput,
    exit_code,
    timedOut,
    outputLimitExceeded,
    failure: output.failure ?? closeInfo?.error?.message,
    ...scenario,
    stdout: output.stdout,
    stderr: output.stderr,
  };
}

async function runSessionScenario(scenarioRoot, hostName) {
  return runRpcHost(scenarioRoot, hostName, async (request) => {
    const initial = await request("get_state", {}, "initial-state");
    const firstSessionPath = initial.data?.sessionFile;
    if (typeof firstSessionPath !== "string") throw new Error("Pi did not create an isolated initial session file");

    await request("set_model", MODEL_A, "select-model-a");
    await request("set_thinking_level", { level: "high" }, "set-thinking-a");
    const newSession = await request("new_session", {}, "new-session");
    if (newSession.data?.cancelled !== false) throw new Error("Pi did not create the new session");
    const newState = await request("get_state", {}, "new-session-state");
    if (typeof newState.data?.sessionFile !== "string") throw new Error("Pi did not expose the new session file");

    await request("set_model", MODEL_B, "select-model-b");
    await request("set_thinking_level", { level: "low" }, "set-thinking-b");
    const resume = await request("switch_session", { sessionPath: firstSessionPath }, "resume-session-a");
    if (resume.data?.cancelled !== false) throw new Error("Pi did not resume the original session");
    await request("get_state", {}, "restored-state");
    return {
      firstSessionPath,
      newSessionPath: newState.data.sessionFile,
      sessionId: initial.data.sessionId,
    };
  });
}

function reportCase(name, result, extra = {}) {
  const assertions = behaviorAssertions(name, {
    responses: result.responseRows,
    exit_code: result.exit_code,
    fullOutput: result.fullOutput,
    expectedVersion: SDK_VERSIONS["@earendil-works/pi-coding-agent"],
    ...extra,
  });
  const hasUnhandledError = UNHANDLED_ERROR_PATTERN.test(result.fullOutput);
  const hasLoadError = EXTENSION_LOAD_ERROR_PATTERN.test(result.fullOutput) ||
    (name === "extension_load" && !assertions.every((item) => item.passed));
  const evidence = result.fullOutput.length > 12_000
    ? `${result.fullOutput.slice(0, 12_000)}\n[truncated after full-output assertions]`
    : result.fullOutput;
  return {
    name,
    command: "npm run smoke:pi",
    exit_code: result.exit_code,
    passed: result.exit_code === 0 && !result.timedOut && !result.outputLimitExceeded &&
      !result.failure && !hasUnhandledError && !hasLoadError && assertions.every((item) => item.passed),
    evidence,
    assertions,
    hasUnhandledError,
    hasLoadError,
    ...(result.failure ? { failure: result.failure } : {}),
  };
}

async function runHostShell() {
  const expectedVersion = SDK_VERSIONS["@earendil-works/pi-coding-agent"];
  let executable;
  let args;
  if (process.platform === "win32") {
    executable = join(process.env.SystemRoot ?? "C:/Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    const quote = (value) => `'${value.replaceAll("'", "''")}'`;
    args = ["-NoProfile", "-NonInteractive", "-Command",
      `& ${quote(process.execPath)} ${quote(cliPath)} --no-extensions --version; exit $LASTEXITCODE`];
  } else {
    executable = "/bin/sh";
    args = ["-c", '"$1" "$2" --no-extensions --version',
      "pi-host-shell", process.execPath, cliPath];
  }
  const child = spawn(executable, args, {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    detached: process.platform !== "win32",
  });
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  let closeInfo;
  let childError;
  let closeResolve;
  const closePromise = new Promise((resolveClose) => { closeResolve = resolveClose; });
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  child.once("error", (error) => {
    childError = error;
    closeInfo = { code: null, error };
    closeResolve(closeInfo);
  });
  child.once("close", (code, signal) => {
    closeInfo = { code, signal, error: childError };
    closeResolve(closeInfo);
  });
  const deadline = setTimeout(() => {
    timedOut = true;
    terminateOwnedChild(child);
  }, PROBE_TIMEOUT_MS);
  await closePromise;
  clearTimeout(deadline);
  return {
    fullOutput: `${stdout}${stderr}`,
    exit_code: timedOut || closeInfo?.error ? null : closeInfo?.code,
    timedOut,
    expectedVersion,
  };
}

async function main() {
  const scenarioRoot = mkdtempSync(join(tmpdir(), "pi-sticky-model-smoke-"));
  let cases = [];
  try {
    const loadResult = await runSessionScenario(scenarioRoot, "load");
    const happyResult = await runSessionScenario(scenarioRoot, "happy");
    const errorResult = await runRpcHost(scenarioRoot, "error", async (request) => {
      await request("set_model", { provider: "missing-provider", modelId: "not-installed" }, "missing-model");
      return {};
    });

    const first = await runSessionScenario(scenarioRoot, "reload-first");
    const reloaded = await runSessionScenario(scenarioRoot, "reload-second");
    const reloadResult = {
      ...reloaded,
      reloadedResponses: reloaded.responseRows,
      reloadedOutput: reloaded.fullOutput,
      firstProcessSessionId: first.sessionId,
      reloadedSessionId: reloaded.sessionId,
    };

    const shellResult = await runHostShell();
    cases = [
      reportCase("extension_load", loadResult),
      reportCase("happy_path", happyResult),
      reportCase("error_path", errorResult),
      reportCase("reload_cleanup", reloadResult, {
        reloadedResponses: reloadResult.reloadedResponses,
        reloadedOutput: reloadResult.reloadedOutput,
        firstProcessSessionId: reloadResult.firstProcessSessionId,
        reloadedSessionId: reloadResult.reloadedSessionId,
      }),
      reportCase("host_shell", shellResult),
    ];
    const report = {
      schema_version: 1,
      verification_contract: VERIFICATION_CONTRACT,
      sdk_versions: installedVersions,
      platform: process.platform,
      model_inference: "none; actual Pi RPC model/session lifecycle operations; no prompt or provider inference",
      unhandled_errors: cases.filter((item) => item.hasUnhandledError).length,
      extension_load_errors: cases.filter((item) => item.hasLoadError).length,
      cases: cases.map(({ hasUnhandledError, hasLoadError, ...item }) => item),
    };
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ verification_contract: VERIFICATION_CONTRACT, platform: process.platform,
      cases: cases.map((item) => ({ name: item.name, passed: item.passed, exit_code: item.exit_code })) }));
    if (cases.some((item) => !item.passed)) process.exitCode = 1;
  } finally {
    rmSync(scenarioRoot, { recursive: true, force: true });
  }
}

await main();
