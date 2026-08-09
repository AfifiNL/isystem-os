import { getCreativeRenderProviderConfig } from "./config";
import { createFakeCreativeRenderProvider } from "./fake";
import { createHiggsfieldCreativeRenderProvider } from "./higgsfield";
import type { CreativeRenderProvider, CreativeRenderProviderId } from "./types";
import { CreativeRenderProviderError } from "./types";

export type * from "./types";
export {
    CREATIVE_RENDER_PENDING_STATUSES,
    CREATIVE_RENDER_TERMINAL_STATUSES,
    isCreativeRenderPendingStatus,
    isCreativeRenderTerminalStatus,
    normalizeCreativeRenderStatus,
} from "./status";
export {
    buildCreativeMcpProductionPack,
    HIGGSFIELD_MCP_SERVER_URL,
    MCP_MANUAL_OPERATOR_WARNING,
    normalizeCreativeManualCreditSource,
    normalizeCreativeManualProvider,
    normalizeCreativeRenderProviderMode,
    type CreativeMcpManualJobLike,
    type CreativeMcpProductionPack,
    type CreativeMcpProductionPackInput,
} from "./mcp-manual";
export { getCreativeRenderProviderConfig, getHiggsfieldDisabledReason, isCreativeRenderProviderEnabled } from "./config";
export { createFakeCreativeRenderProvider, fakeCreativeRenderProvider } from "./fake";
export { createHiggsfieldCreativeRenderProvider, HiggsfieldCreativeRenderProvider } from "./higgsfield";

export function getCreativeRenderProvider(provider: CreativeRenderProviderId): CreativeRenderProvider {
    const config = getCreativeRenderProviderConfig();
    if (provider === "fake") {
        if (!config.fakeProviderEnabled) {
            throw new CreativeRenderProviderError(
                "Creative render fake provider is disabled by CREATIVE_RENDER_FAKE_PROVIDER_ENABLED.",
                "fake_provider_disabled",
                "fake",
                false,
            );
        }
        return createFakeCreativeRenderProvider();
    }

    if (provider === "higgsfield") {
        return createHiggsfieldCreativeRenderProvider();
    }

    throw new CreativeRenderProviderError("Unsupported creative render provider.", "provider_unsupported", provider, false);
}
