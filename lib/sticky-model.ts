import type { ThinkingLevel } from "@earendil-works/pi-agent-core";

const GLOBAL_KEY = "__pi_sticky_model";
const DEFAULT_SESSION_KEY = "__default__";

const THINKING_LEVELS = new Set<ThinkingLevel>([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

export interface StickyModelRef {
  provider: string;
  model: string;
  thinkingLevel?: ThinkingLevel;
}

/** Module-level flag to log the corrupt-state warning at most once per process. */
let warnedOnce = false;

/**
 * Check whether an unknown value is a valid StickyModelRef.
 * A valid ref has `provider` and `model` as non-empty strings.
 */
function isValidStickyModelRef(value: unknown): value is StickyModelRef {
  if (typeof value !== "object" || value === null) return false;
  const ref = value as Record<string, unknown>;
  const thinkingLevel = ref.thinkingLevel;
  return (
    typeof ref.provider === "string" &&
    ref.provider.length > 0 &&
    typeof ref.model === "string" &&
    ref.model.length > 0 &&
    (thinkingLevel === undefined ||
      (typeof thinkingLevel === "string" && THINKING_LEVELS.has(thinkingLevel as ThinkingLevel)))
  );
}

/** Store a model ref in process-scoped global memory for one session. */
export function setStickyModel(ref: StickyModelRef, sessionKey = DEFAULT_SESSION_KEY): void {
  const state = getState();
  state[sessionKey] = ref;
}

/**
 * Retrieve the stored model ref, or undefined if none was set
 * or the stored value has an invalid shape (corrupt / partial ref).
 */
export function getStickyModel(sessionKey = DEFAULT_SESSION_KEY): StickyModelRef | undefined {
  const state = getState();
  const raw = state[sessionKey];
  if (raw === undefined) return undefined;
  if (!isValidStickyModelRef(raw)) {
    if (!warnedOnce) {
      console.warn(
        "[pi-sticky-model] Ignoring corrupt StickyModelRef on globalThis; treating as absent."
      );
      warnedOnce = true;
    }
    return undefined;
  }
  return raw;
}

/** Clear the stored model ref for one session, or all sessions when no key is given. */
export function clearStickyModel(sessionKey?: string): void {
  if (sessionKey === undefined) {
    delete (globalThis as Record<string, unknown>)[GLOBAL_KEY];
    return;
  }
  delete getState()[sessionKey];
}

/** Copy a session's model when creating or forking a replacement session. */
export function copyStickyModel(fromSessionKey: string, toSessionKey: string): void {
  const sticky = getStickyModel(fromSessionKey);
  if (sticky) setStickyModel(sticky, toSessionKey);
}

function getState(): Record<string, unknown> {
  const globals = globalThis as Record<string, unknown>;
  const raw = globals[GLOBAL_KEY];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (raw !== undefined && !warnedOnce) {
    console.warn(
      "[pi-sticky-model] Ignoring corrupt StickyModelRef state on globalThis; treating as absent."
    );
    warnedOnce = true;
  }
  const state: Record<string, unknown> = {};
  globals[GLOBAL_KEY] = state;
  return state;
}

/**
 * Reset the once-only warning flag. Exported for testing only.
 * @internal
 */
export function __resetWarnedOnce(): void {
  warnedOnce = false;
}
