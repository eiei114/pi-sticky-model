const GLOBAL_KEY = "__pi_sticky_model";

export interface StickyModelRef {
  provider: string;
  model: string;
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
  return (
    typeof ref.provider === "string" &&
    ref.provider.length > 0 &&
    typeof ref.model === "string" &&
    ref.model.length > 0
  );
}

/** Store a model ref in process-scoped global memory. */
export function setStickyModel(ref: StickyModelRef): void {
  (globalThis as Record<string, unknown>)[GLOBAL_KEY] = ref;
}

/**
 * Retrieve the stored model ref, or undefined if none was set
 * or the stored value has an invalid shape (corrupt / partial ref).
 */
export function getStickyModel(): StickyModelRef | undefined {
  const raw = (globalThis as Record<string, unknown>)[GLOBAL_KEY];
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

/** Clear the stored model ref. */
export function clearStickyModel(): void {
  delete (globalThis as Record<string, unknown>)[GLOBAL_KEY];
}

/**
 * Reset the once-only warning flag. Exported for testing only.
 * @internal
 */
export function __resetWarnedOnce(): void {
  warnedOnce = false;
}
