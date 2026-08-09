"use client";

import { Render } from "@puckeditor/core";
import {
    isPublicBuilderData,
    normalizePublicBuilderData,
    puckRenderConfig,
    type PublicBuilderData,
} from "@/features/builder/puck.config";
import type { Json } from "@/shared/lib/supabase/database.types";
import type { Locale } from "@/features/templates/types";

/**
 * Block types each iSystem core-page theme renderer composes itself.
 * Anything outside this set is treated as "extra" and rendered through Puck
 * after the bespoke composition. This lets authors append new layout blocks
 * (insights grids, FAQ accordions, pricing tiers, etc.) without rewriting
 * the bespoke hero / stats / methodology sections each theme defines.
 */
const CORE_CONSUMED_BLOCKS: Record<"home" | "services" | "about" | "contact", ReadonlySet<string>> = {
    home: new Set([
        "HeroBlock",
        "StatsBlock",
        "FoundationBlock",
        "AboutBlock",
        "ServicesShowcaseBlock",
        "MethodologyBlock",
        "SeoSupportBlock",
    ]),
    services: new Set([
        "ServicesShowcaseBlock",
        "MethodologyBlock",
        "SeoSupportBlock",
    ]),
    about: new Set([
        "AboutBlock",
        "CommitmentBlock",
        "SeoSupportBlock",
    ]),
    contact: new Set([
        "ContactBlock",
        "SeoSupportBlock",
    ]),
};

interface ExtraBlocksTailProps {
    pageKind: keyof typeof CORE_CONSUMED_BLOCKS;
    visualLayout?: Json | null;
    locale: Locale;
}

/**
 * Render the unrecognised blocks at the end of an iSystem core page.
 *
 * Renders nothing when there are no extras (typical case), so the visual
 * layout of legacy pages is unchanged. Reuses puckRenderConfig so the
 * markup is identical to what /[slug] custom pages produce — no parallel
 * theming, no drift.
 */
export function ExtraBlocksTail({ pageKind, visualLayout, locale }: ExtraBlocksTailProps) {
    if (!isPublicBuilderData(visualLayout)) return null;

    const normalized = normalizePublicBuilderData(visualLayout, pageKind);
    if (!normalized || !Array.isArray(normalized.content) || normalized.content.length === 0) {
        return null;
    }

    const consumed = CORE_CONSUMED_BLOCKS[pageKind];
    const extras = normalized.content.filter((block) => block && !consumed.has(block.type));
    if (extras.length === 0) return null;

    const extrasData: PublicBuilderData = {
        ...normalized,
        content: extras,
    };

    return (
        <section className="overflow-hidden [background:var(--template-surface-canvas)] text-[var(--template-text-primary)]">
            <Render config={puckRenderConfig} data={extrasData as never} metadata={{ locale }} />
        </section>
    );
}
