import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  setStickyModel,
  getStickyModel,
  clearStickyModel,
  copyStickyModel,
  type StickyModelRef,
} from "../lib/sticky-model.ts";

const STATUS_KEY = "sticky-model";

export default function (pi: ExtensionAPI) {
  const sessionKey = (ctx: { sessionManager?: { getSessionFile(): string | undefined } }) =>
    (typeof ctx.sessionManager?.getSessionFile === "function"
      ? ctx.sessionManager.getSessionFile()
      : undefined) ?? "__default__";

  // Capture model on explicit user selection
  pi.on("model_select", async (event, ctx) => {
    if (event.source === "restore") return; // don't re-sticky a restored model

    const ref: StickyModelRef = {
      provider: event.model.provider,
      model: event.model.id,
    };
    setStickyModel(ref, sessionKey(ctx));
    if (ctx.hasUI) {
      ctx.ui.setStatus(STATUS_KEY, `sticky: ${ref.provider}/${ref.model}`);
    }
  });

  // Restore sticky model on session transitions
  pi.on("session_start", async (event, ctx) => {
    if (event.reason === "startup") return; // respect settings.json default

    const currentSessionKey = sessionKey(ctx);
    if ((event.reason === "new" || event.reason === "fork") && event.previousSessionFile) {
      copyStickyModel(event.previousSessionFile, currentSessionKey);
    }
    const sticky = getStickyModel(currentSessionKey);
    if (!sticky) return; // no model was ever selected, nothing to restore

    // Find the model in the registry to get the full Model object
    const model = ctx.modelRegistry.find(sticky.provider, sticky.model);
    if (!model) {
      if (ctx.hasUI) {
        ctx.ui.notify(
          `pi-sticky-model: saved model ${sticky.provider}/${sticky.model} not found in registry, falling back to default.`,
          "warning",
        );
      }
      return;
    }

    const restored = await pi.setModel(model);
    if (ctx.hasUI) {
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
    }
  });

  pi.on("session_shutdown", async (event, ctx) => {
    // Keep the old session's value during /new, /resume, and /fork so the
    // replacement session can inherit only from its own predecessor.
    if (!event.reason || event.reason === "quit") {
      clearStickyModel(sessionKey(ctx));
    }
  });
}
