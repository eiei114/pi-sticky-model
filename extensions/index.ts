import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  setStickyModel,
  getStickyModel,
  type StickyModelRef,
} from "../lib/sticky-model.ts";

const STATUS_KEY = "sticky-model";

export default function (pi: ExtensionAPI) {
  // Capture model on explicit user selection
  pi.on("model_select", async (event, ctx) => {
    if (event.source === "restore") return; // don't re-sticky a restored model

    const ref: StickyModelRef = {
      provider: event.model.provider,
      model: event.model.id,
    };
    setStickyModel(ref);
    ctx.ui.setStatus(STATUS_KEY, `sticky: ${ref.provider}/${ref.model}`);
  });

  // Restore sticky model on session transitions
  pi.on("session_start", async (event, ctx) => {
    if (event.reason === "startup") return; // respect settings.json default

    const sticky = getStickyModel();
    if (!sticky) return; // no model was ever selected, nothing to restore

    // Find the model in the registry to get the full Model object
    const model = ctx.modelRegistry.find(sticky.provider, sticky.model);
    if (!model) {
      ctx.ui.notify(
        `pi-sticky-model: saved model ${sticky.provider}/${sticky.model} not found in registry, falling back to default.`,
        "warning",
      );
      return;
    }

    const restored = await pi.setModel(model);
    if (restored) {
      ctx.ui.setStatus(STATUS_KEY, `sticky: ${sticky.provider}/${sticky.model}`);
      ctx.ui.notify(
        `Restored sticky model: ${sticky.provider}/${sticky.model}`,
        "info",
      );
    } else {
      ctx.ui.notify(
        `pi-sticky-model: failed to restore ${sticky.provider}/${sticky.model}`,
        "warning",
      );
    }
  });
}
