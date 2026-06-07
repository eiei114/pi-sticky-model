const GLOBAL_KEY = "__pi_sticky_model";

export interface StickyModelRef {
  provider: string;
  model: string;
}

/** Store a model ref in process-scoped global memory. */
export function setStickyModel(ref: StickyModelRef): void {
  (globalThis as Record<string, unknown>)[GLOBAL_KEY] = ref;
}

/** Retrieve the stored model ref, or undefined if none was set. */
export function getStickyModel(): StickyModelRef | undefined {
  return (globalThis as Record<string, unknown>)[GLOBAL_KEY] as
    | StickyModelRef
    | undefined;
}

/** Clear the stored model ref. */
export function clearStickyModel(): void {
  delete (globalThis as Record<string, unknown>)[GLOBAL_KEY];
}
