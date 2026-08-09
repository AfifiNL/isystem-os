"use client";

import { useCallback, useMemo, useState, useTransition, type ReactNode } from "react";
import { Puck } from "@puckeditor/core";
import "@/features/builder/puck-no-external.css";
import "@/features/builder/puck-theme.css";
import { AlertTriangle, Eye, Loader2, Pencil, Save } from "lucide-react";
import { puckRenderConfig, defaultPuckData, type PublicBuilderData } from "@/features/builder/puck.config";
import { PuckEditorShell } from "@/features/builder/puck-editor-shell";
import { LivePagePreview } from "@/features/builder/live-page-preview";
import { Button } from "@/shared/ui/button";
import { PremiumInlinePending } from "@/shared/ui/loading";
import type { TemplateConfig } from "@/features/templates/types";
import type { Dictionary } from "@/shared/lib/i18n/get-dictionary";
import type { SiteChromeConfig } from "@/features/site-chrome/schema";
import type { SupportedLocale } from "@/features/builder/facility-services-page-data";
import type { PublicPagePuckDataV2 } from "@/features/public-site/public-page-contract";

type BuilderPageData = PublicBuilderData | PublicPagePuckDataV2;

interface PuckEditorProps {
    contentId: string;
    initialData: BuilderPageData | null;
    initialStatus: string | null;
    onSaveAction: (payload: BuilderPageData, status: string) => Promise<{ error?: string | null }>;
    // Public-page rendering context. Forwarded into LivePagePreview so the
    // builder canvas can render the exact theme component the visitor sees
    // for core pages (home/services/about/contact). Optional so non-iSystem
    // builders keep working with the default block-by-block Puck canvas.
    templateConfig?: TemplateConfig;
    dictionary?: Dictionary;
    siteName?: string;
    siteDescription?: string;
    siteChrome?: SiteChromeConfig;
}

const SUPPORTED_LOCALES = new Set<SupportedLocale>(["en", "nl", "ar"]);

function resolveEditorLocale(data: BuilderPageData): SupportedLocale {
    const value = data.root?.props?.locale;
    return SUPPORTED_LOCALES.has(value as SupportedLocale) ? (value as SupportedLocale) : "en";
}

const PAGE_STATUS_OPTIONS = [
    { value: "draft", label: "Draft (Hidden)" },
    { value: "review", label: "In Review (Internal Only)" },
    { value: "ready", label: "Ready (Awaiting Publish)" },
    { value: "published", label: "Published (Public)" },
] as const;

interface HeaderActionsProps {
    children?: ReactNode;
    status: string;
    isPending: boolean;
    publishError: string | null;
    onStatusChange: (nextStatus: string) => void;
    onSave: () => void;
    previewMode: PreviewMode;
    onPreviewModeChange: (next: PreviewMode) => void;
    livePreviewAvailable: boolean;
}

function HeaderActions({
    children,
    status,
    isPending,
    publishError,
    onStatusChange,
    onSave,
    previewMode,
    onPreviewModeChange,
    livePreviewAvailable,
}: HeaderActionsProps) {
    return (
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {livePreviewAvailable ? (
                <div className="inline-flex max-w-full items-center overflow-x-auto rounded-full border border-border bg-background p-0.5 text-xs">
                    <button
                        type="button"
                        onClick={() => onPreviewModeChange("edit")}
                        className={`inline-flex h-7 items-center gap-1 rounded-full px-3 font-medium transition-colors ${
                            previewMode === "edit"
                                ? "bg-foreground text-background"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                        aria-pressed={previewMode === "edit"}
                    >
                        <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                        type="button"
                        onClick={() => onPreviewModeChange("preview")}
                        className={`inline-flex h-7 items-center gap-1 rounded-full px-3 font-medium transition-colors ${
                            previewMode === "preview"
                                ? "bg-foreground text-background"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                        aria-pressed={previewMode === "preview"}
                    >
                        <Eye className="h-3 w-3" /> Live preview
                    </button>
                </div>
            ) : null}
            <select
                value={status}
                onChange={(event) => onStatusChange(event.target.value)}
                className="h-9 min-w-0 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                disabled={isPending}
            >
                {PAGE_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {publishError ? <span className="text-sm font-medium text-red-600">{publishError}</span> : null}
            <Button
                type="button"
                size="sm"
                disabled={isPending}
                className="min-w-0 bg-[#002f58] text-white hover:bg-[#0b3f6d]"
                onClick={onSave}
            >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isPending ? "Saving..." : `Save layout · ${status}`}
            </Button>
            {children}
        </div>
    );
}

type PreviewMode = "edit" | "preview";

export function PuckEditor({
    contentId,
    initialData,
    initialStatus,
    onSaveAction,
    templateConfig,
    dictionary,
    siteName,
    siteDescription,
    siteChrome,
}: PuckEditorProps) {
    const [data, setData] = useState<BuilderPageData>(initialData ?? defaultPuckData);
    const [publishError, setPublishError] = useState<string | null>(null);
    const [status, setStatus] = useState(initialStatus ?? "draft");
    const [isPending, startTransition] = useTransition();
    // Default to Edit mode so authors can interact with Puck's selectable
    // canvas as soon as the page loads. Live preview is opt-in via the
    // header toggle — it's read-only by design (the public theme tree has
    // no Puck overlays) so we don't trap users in it.
    const [previewMode, setPreviewMode] = useState<PreviewMode>("edit");

    const headerTitle = useMemo(() => `Page Builder · ${contentId}`, [contentId]);
    const livePreviewAvailable = Boolean(templateConfig && dictionary && siteChrome);
    const editorLocale = useMemo(() => resolveEditorLocale(data), [data]);

    const preservePublicSchemaVersion = useCallback((nextData: PublicBuilderData): BuilderPageData => {
        if ("schemaVersion" in data && (data as { schemaVersion?: unknown }).schemaVersion === 2) {
            return { ...(nextData as unknown as PublicPagePuckDataV2), schemaVersion: 2 };
        }
        return nextData;
    }, [data]);

    const saveLayout = useCallback(() => {
        setPublishError(null);
        startTransition(async () => {
            const result = await onSaveAction(data, status);
            if (result?.error) {
                setPublishError(result.error);
            }
        });
    }, [data, onSaveAction, status]);

    const puckOverrides = useMemo(
        () => ({
            headerActions: ({ children }: { children?: ReactNode }) => (
                <HeaderActions
                    status={status}
                    isPending={isPending}
                    publishError={publishError}
                    onStatusChange={setStatus}
                    onSave={saveLayout}
                    previewMode={previewMode}
                    onPreviewModeChange={setPreviewMode}
                    livePreviewAvailable={livePreviewAvailable}
                >
                    {children}
                </HeaderActions>
            ),
            // Only override Puck's canvas when the user explicitly opts
            // into live preview. In Edit mode we hand control back to
            // Puck so block selection, drag/drop, and inline editing
            // behave normally — without this branch the public theme
            // tree (which has no Puck overlays) would block all editing.
            ...(previewMode === "preview" && livePreviewAvailable && templateConfig && dictionary && siteChrome
                ? {
                    preview: ({ children }: { children: ReactNode }) => (
                        <LivePagePreview
                            config={templateConfig}
                            dictionary={dictionary}
                            siteName={siteName ?? templateConfig.name}
                            siteDescription={siteDescription ?? ""}
                            siteChrome={siteChrome}
                            fallback={children}
                        />
                    ),
                }
                : {}),
        }),
        [
            isPending,
            publishError,
            saveLayout,
            status,
            previewMode,
            livePreviewAvailable,
            templateConfig,
            dictionary,
            siteChrome,
            siteName,
            siteDescription,
        ],
    );

    const pendingBanner = isPending ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
            <PremiumInlinePending label="Saving builder layout" description="Persisting visual blocks, status, and live-preview metadata" />
        </div>
    ) : publishError ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <div>
                    <p className="font-medium">Save blocked</p>
                    <p className="mt-1 text-xs leading-6 text-rose-100/80">{publishError}</p>
                </div>
            </div>
        </div>
    ) : null;

    return (
        <PuckEditorShell
            saveState={pendingBanner}
            editor={
                <Puck
                    config={puckRenderConfig}
                    data={data as PublicBuilderData}
                    metadata={{ locale: editorLocale }}
                    headerTitle={headerTitle}
                    overrides={puckOverrides}
                    // Render the canvas in the parent document instead of an
                    // iframe so heavy components (Three.js / Spline / GSAP
                    // ScrollTrigger) share the page's WebGL context budget
                    // and cookies. Inside Puck's default iframe these would
                    // bump into the browser's ~16-context limit and emit
                    // "WebGLRenderer: Context Lost" within a few re-renders.
                    iframe={{ enabled: false }}
                    onChange={(nextData) => {
                        setData(preservePublicSchemaVersion(nextData));
                        setPublishError(null);
                    }}
                    onPublish={(nextData) => {
                        setPublishError(null);
                        startTransition(async () => {
                            const result = await onSaveAction(preservePublicSchemaVersion(nextData), status);
                            if (result?.error) {
                                setPublishError(result.error);
                            }
                        });
                    }}
                />
            }
        />
    );
}
