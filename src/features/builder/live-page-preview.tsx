"use client";

import { createUsePuck } from "@puckeditor/core";
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { TemplateProvider } from "@/features/templates/template-provider";
import { IsystemAgencyHome } from "@/features/templates/ui/theme-renderers/isystem-agency-home";
import IsystemAgencyServices from "@/features/templates/ui/theme-renderers/isystem-agency-services";
import IsystemAgencyAbout from "@/features/templates/ui/theme-renderers/isystem-agency-about";
import IsystemAgencyContact from "@/features/templates/ui/theme-renderers/isystem-agency-contact";
import type { TemplateConfig, Locale } from "@/features/templates/types";
import type { Dictionary } from "@/shared/lib/i18n/get-dictionary";
import type { SiteChromeConfig } from "@/features/site-chrome/schema";
import type { PublicBuilderData } from "@/features/builder/puck.config";
import { PublicPageRenderer } from "@/features/public-site/public-page-renderer";
import { resolvePublicPageDefinition } from "@/features/public-site/public-page-contract";
import type { PublicPagePuckDataV2 } from "@/features/public-site/public-page-contract";

// Typed selector hook. Without this `usePuck()` returns the full store and
// re-renders this component on EVERY edit, which mounts and unmounts the
// public theme tree (and its Three.js scenes) on every keystroke. With a
// scalar selector we only re-render when the page data actually changes.
const usePuckData = createUsePuck<typeof import("@/features/builder/puck.config").puckRenderConfig>();

interface LivePagePreviewProps {
    config: TemplateConfig;
    dictionary: Dictionary;
    siteName: string;
    siteDescription: string;
    siteChrome: SiteChromeConfig;
    fallback: ReactNode;
}

const SUPPORTED_LOCALES = new Set(["en", "nl", "ar"]);

function resolveLocale(value: unknown, fallback: Locale): Locale {
    if (typeof value === "string" && SUPPORTED_LOCALES.has(value)) {
        return value as Locale;
    }
    return fallback;
}

const PLACEHOLDER_WORKSPACE = {
    id: "builder-preview",
    name: "Builder preview",
    slug: "builder-preview",
    theme_id: "isystem-agency",
};

/**
 * For core iSystem pages (home / services / about / contact) the public site
 * does NOT render block-by-block via Puck; it renders one bespoke theme
 * component per page that pulls *data* out of Puck blocks and composes the
 * actual layout itself. Showing the per-block Puck previews therefore drifts
 * from the live UI by definition. This component bridges that gap by
 * rendering the same public theme component the user will see at runtime,
 * fed with the live editor state. For non-core pages the upstream caller is
 * responsible for falling back to Puck's native canvas — those pages really
 * are block-driven and their Puck render is faithful.
 */
// Debounce window for republishing the page data into the heavy theme
// preview. ~350ms is roughly the lower bound where typing into a text input
// stops feeling laggy without re-mounting the 3D scenes on every keystroke.
const PREVIEW_DEBOUNCE_MS = 350;

export function LivePagePreview({
    config,
    dictionary,
    siteName,
    siteDescription,
    siteChrome,
    fallback,
}: LivePagePreviewProps) {
    // Narrow selector — only re-render when the page payload actually
    // changes, not on UI/permissions/history mutations.
    const data = usePuckData((state) => state.appState.data) as PublicBuilderData;

    // Two-stage smoothing: useDeferredValue gives React back rendering
    // priority during typing, then a manual debounce caps the re-mount rate
    // of the 3D-heavy theme tree. Without this, dragging a slider or typing
    // a title burns through the browser's ~16 simultaneous WebGL context
    // budget and the canvas reports "Context Lost".
    const deferredData = useDeferredValue(data);
    const [debouncedData, setDebouncedData] = useState(deferredData);
    useEffect(() => {
        const handle = window.setTimeout(() => setDebouncedData(deferredData), PREVIEW_DEBOUNCE_MS);
        return () => window.clearTimeout(handle);
    }, [deferredData]);

    const rootProps = (debouncedData?.root && "props" in debouncedData.root
        ? debouncedData.root.props
        : null) as { pageKind?: string; locale?: string } | null;
    const pageKind = rootProps?.pageKind ?? "custom";
    const locale = resolveLocale(rootProps?.locale, "en");
    const isPublicPageV2 = Boolean(debouncedData && typeof debouncedData === "object" && "schemaVersion" in debouncedData && (debouncedData as { schemaVersion?: unknown }).schemaVersion === 2);

    // Memoise the theme element. This way the inner tree (and any Three.js
    // / GSAP children) only reconcile when the debounced data actually
    // changes — never on mouse movement, drag overlays, or sibling re-
    // renders coming from Puck's chrome.
    const themeBody = useMemo<ReactNode>(() => {
        const sharedProps = {
            config,
            dictionary,
            locale,
            visualLayout: debouncedData as never,
        };
        if (isPublicPageV2 && config.id === "isystem-agency") {
            const route = pageKind === "home" ? "/" : `/${pageKind}`;
            const definition = resolvePublicPageDefinition(route);
            if (definition) {
                return (
                    <PublicPageRenderer
                        definition={definition}
                        data={debouncedData as unknown as PublicPagePuckDataV2}
                        locale={locale}
                        mode="preview"
                    />
                );
            }
        }
        if (pageKind === "home") {
            return (
                <IsystemAgencyHome
                    workspace={PLACEHOLDER_WORKSPACE}
                    dictionary={dictionary as Record<string, unknown>}
                    locale={locale}
                    visualLayout={debouncedData as never}
                />
            );
        }
        if (pageKind === "services") return <IsystemAgencyServices {...sharedProps} />;
        if (pageKind === "about") return <IsystemAgencyAbout {...sharedProps} />;
        if (pageKind === "contact") return <IsystemAgencyContact {...sharedProps} />;
        return null;
    }, [pageKind, locale, debouncedData, config, dictionary, isPublicPageV2]);

    if (!themeBody) {
        // Custom / generic pages render via Puck's <Render> on the public
        // side, so Puck's default canvas already matches reality. Hand back
        // to the caller's fallback (the default Puck preview).
        return <>{fallback}</>;
    }

    return (
        <TemplateProvider
            config={config}
            locale={locale}
            dict={dictionary}
            siteName={siteName}
            siteDescription={siteDescription}
            siteChrome={siteChrome}
        >
            <div
                className="builder-live-preview"
                // Match the public layout's surface canvas so the page reads
                // identical to what the visitor will see. The theme
                // component itself sets bg-slate-950 — this is just the
                // gutter behind it.
                style={{ background: "var(--template-surface-canvas, #020617)", minHeight: "100%" }}
            >
                {themeBody}
            </div>
        </TemplateProvider>
    );
}
