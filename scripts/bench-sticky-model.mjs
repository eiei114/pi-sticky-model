/**
 * Micro-benchmark for lib/sticky-model.ts hot paths.
 * Run: node scripts/bench-sticky-model.mjs
 */
import { performance } from "node:perf_hooks";
import {
  setStickyModel,
  getStickyModel,
  clearStickyModel,
  copyStickyModel,
} from "../lib/sticky-model.ts";

const ITER = 2_000_000;
const ref = { provider: "google", model: "gemini-2.5-pro", thinkingLevel: "medium" };

function bench(label, fn) {
  clearStickyModel();
  setStickyModel(ref);
  const t0 = performance.now();
  for (let i = 0; i < ITER; i++) fn();
  const ms = performance.now() - t0;
  const opsPerSec = (ITER / ms) * 1000;
  console.log(`${label}: ${ms.toFixed(1)}ms (${(opsPerSec / 1e6).toFixed(2)}M ops/s)`);
}

bench("getStickyModel", () => getStickyModel());
bench("setStickyModel", () => setStickyModel(ref));
bench("get+set roundtrip", () => {
  getStickyModel();
  setStickyModel(ref);
});

clearStickyModel();
setStickyModel(ref, "from");
const t0 = performance.now();
for (let i = 0; i < ITER; i++) copyStickyModel("from", "to");
const copyMs = performance.now() - t0;
console.log(`copyStickyModel: ${copyMs.toFixed(1)}ms (${((ITER / copyMs) * 1000 / 1e6).toFixed(2)}M ops/s)`);
