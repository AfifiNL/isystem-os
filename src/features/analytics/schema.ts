import { z } from "zod";
import { ANALYTICS_EVENT_TYPES } from "./taxonomy";

export { ANALYTICS_EVENT_TYPES, type AnalyticsEventType } from "./taxonomy";

export const analyticsTrackSchema = z.object({
    // Audio events fire from a player that may be embedded across many paths.
    // Path is required for page-level events but optional for audio events,
    // where episodeId in metadata is the canonical identifier.
    path: z.string().trim().min(1).max(180).optional(),
    pageSlug: z.string().trim().max(180).optional(),
    contentType: z.enum(["page", "blog", "system", "podcast"]).default("page"),
    eventType: z.enum(ANALYTICS_EVENT_TYPES),
    eventName: z.string().trim().min(1).max(160).optional(),
    visitorId: z.string().trim().max(120).optional(),
    sessionId: z.string().trim().max(120).optional(),
    referrer: z.string().trim().max(500).optional(),
    utmSource: z.string().trim().max(120).optional(),
    utmMedium: z.string().trim().max(120).optional(),
    utmCampaign: z.string().trim().max(120).optional(),
    userAgent: z.string().trim().max(300).optional(),
    // Workspace this event belongs to. The browser already knows the active
    // workspace from the rendered page (it's embedded as a public prop), so
    // requiring it here costs the client nothing and prevents the server from
    // having to guess attribution from a slug alone — slugs are not globally
    // unique across tenants, so without this the first matching content_items
    // row wins, which lets an anonymous attacker pollute another tenant's
    // analytics by replaying a guessable slug.
    workspaceId: z.string().uuid().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AnalyticsTrackPayload = z.infer<typeof analyticsTrackSchema>;
