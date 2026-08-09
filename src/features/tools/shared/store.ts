import type { ToolLocale, ToolRequestContext, ToolSlug } from "./types";
import type { Json } from "@/shared/lib/supabase/database.types";
import { getToolsServiceClient } from "./service-client";
import { generateShareToken } from "./rate-limit";

export interface SaveToolLeadInput {
    tool: ToolSlug;
    payload: Record<string, unknown>;
    result: Record<string, unknown>;
    email?: string | null;
    context: ToolRequestContext;
    locale?: ToolLocale;
    /** When true, mint and return a share token. */
    shareable?: boolean;
}

export interface SavedToolLead {
    id: string;
    shareToken: string | null;
}

export async function saveToolLead(input: SaveToolLeadInput): Promise<SavedToolLead | null> {
    const supabase = getToolsServiceClient();
    if (!supabase) return null;

    const shareToken = input.shareable ? generateShareToken() : null;

    const { data, error } = await supabase
        .from("tool_leads")
        .insert({
            tool_slug: input.tool,
            email: input.email ?? null,
            payload: input.payload as Json,
            result: input.result as Json,
            share_token: shareToken,
            ip_hash: input.context.ipHash,
            user_agent_hash: input.context.userAgentHash,
            locale: input.locale ?? input.context.locale,
            referrer: input.context.referrer,
            utm: input.context.utm as Json,
        })
        .select("id,share_token")
        .single();

    if (error || !data) {
        console.error("[tools.store] saveToolLead failed", error?.message);
        return null;
    }

    return { id: data.id, shareToken: data.share_token };
}

export interface AttachedLeadContext {
    leadId: string;
    email: string;
    tool: ToolSlug;
    locale: ToolLocale;
    payload: unknown;
    result: unknown;
    referrer: string | null;
    utm: Record<string, unknown> | null;
    shareToken: string | null;
}

export async function attachEmailToLead(
    leadId: string,
    email: string,
): Promise<{ ok: boolean; error?: string; context?: AttachedLeadContext }> {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return { ok: false, error: "Invalid email." };
    }
    const supabase = getToolsServiceClient();
    if (!supabase) return { ok: false, error: "Service unavailable." };

    const { data, error } = await supabase
        .from("tool_leads")
        .update({ email: trimmed })
        .eq("id", leadId)
        .select("id,tool_slug,locale,payload,result,referrer,utm,share_token")
        .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Could not save email." };

    return {
        ok: true,
        context: {
            leadId: data.id,
            email: trimmed,
            tool: data.tool_slug as ToolSlug,
            locale: ((data.locale as ToolLocale) ?? "en"),
            payload: data.payload,
            result: data.result,
            referrer: data.referrer,
            utm: data.utm && typeof data.utm === "object" && !Array.isArray(data.utm)
                ? data.utm as Record<string, unknown>
                : null,
            shareToken: data.share_token,
        },
    };
}

export interface FetchedLead {
    tool: ToolSlug;
    payload: unknown;
    result: unknown;
    locale: ToolLocale;
    createdAt: string;
}

export async function fetchLeadByShareToken(token: string): Promise<FetchedLead | null> {
    const supabase = getToolsServiceClient();
    if (!supabase) return null;
    const { data, error } = await supabase
        .from("tool_leads")
        .select("tool_slug,payload,result,locale,created_at")
        .eq("share_token", token)
        .maybeSingle();
    if (error || !data) return null;
    return {
        tool: data.tool_slug as ToolSlug,
        payload: data.payload,
        result: data.result,
        locale: ((data.locale as ToolLocale) ?? "en"),
        createdAt: data.created_at,
    };
}

export interface ScanCacheEntry<T> {
    result: T;
    fetchedAt: string;
}

export async function getScanCache<T>(
    tool: ToolSlug,
    cacheKey: string,
): Promise<ScanCacheEntry<T> | null> {
    const supabase = getToolsServiceClient();
    if (!supabase) return null;
    const { data, error } = await supabase
        .from("tool_scan_cache")
        .select("result,fetched_at")
        .eq("tool_slug", tool)
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
    if (error || !data) return null;
    return { result: data.result as T, fetchedAt: data.fetched_at };
}

export async function setScanCache<T>(params: {
    tool: ToolSlug;
    cacheKey: string;
    result: T;
    ttlMinutes: number;
}): Promise<void> {
    const supabase = getToolsServiceClient();
    if (!supabase) return;
    const expiresAt = new Date(Date.now() + params.ttlMinutes * 60 * 1000).toISOString();
    const { error } = await supabase.from("tool_scan_cache").upsert(
        {
            tool_slug: params.tool,
            cache_key: params.cacheKey,
            result: params.result as Json,
            fetched_at: new Date().toISOString(),
            expires_at: expiresAt,
        },
        { onConflict: "tool_slug,cache_key" },
    );
    if (error) {
        console.error("[tools.store] setScanCache failed", error.message);
    }
}
