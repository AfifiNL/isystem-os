"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ProBadge } from "@/shared/ui/pro-badge";
import { AiOperationPendingCard, PremiumInlinePending, PremiumPanelSkeleton } from "@/shared/ui/loading";
import {
    Loader2, Sparkles, X, Globe, BookOpen, Video, Languages,
    Linkedin, Twitter, Instagram, ChevronLeft, ChevronRight, ImageIcon, BarChart3, Workflow, Mail, CheckCircle2
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SUPPORTED_LOCALES, getLocaleNativeLabel } from "@/shared/lib/i18n/routing";
import type { Locale } from "@/features/templates/types";
import { AppFeedbackLoop } from "@/features/admin/ui/app-workbench";

type NarrativeStyle = "analytical" | "storytelling" | "instructional" | "persuasive" | "conversational";
type ContentLength = "short" | "medium" | "long" | "deep-dive";
type ContentType = "blog_post" | "video_script" | "social_linkedin" | "social_twitter" | "social_instagram" | "newsletter_issue";
type Geography = "global" | "us" | "europe" | "africa" | "asia" | "mena";
type GenerationStage = "brief" | "format" | "context" | "enrich";

interface FormState {
    title: string;
    keywords: string[];
    keywordInput: string;
    narrative_style: NarrativeStyle;
    length: ContentLength;
    content_types: ContentType[];
    geography: Geography;
    locale: Locale;
    generate_images: boolean;
    generate_charts: boolean;
    generate_diagrams: boolean;
    visual_density: "light" | "balanced" | "rich";
}

const CONTENT_TYPE_OPTIONS: { value: ContentType; label: string; icon: LucideIcon }[] = [
    { value: "blog_post", label: "Blog Post", icon: BookOpen },
    { value: "video_script", label: "Video Script", icon: Video },
    { value: "social_linkedin", label: "LinkedIn Posts", icon: Linkedin },
    { value: "social_twitter", label: "X / Twitter Thread", icon: Twitter },
    { value: "social_instagram", label: "Instagram Carousel", icon: Instagram },
    { value: "newsletter_issue", label: "Newsletter Issue", icon: Mail },
];

const NARRATIVE_STYLES: { value: NarrativeStyle; label: string; desc: string }[] = [
    { value: "analytical", label: "Analytical", desc: "Data-driven, logical, evidence-based" },
    { value: "storytelling", label: "Storytelling", desc: "Narrative-first, emotional, case studies" },
    { value: "instructional", label: "Instructional", desc: "Step-by-step, how-to, practical" },
    { value: "persuasive", label: "Persuasive", desc: "Opinion-led, compelling, call-to-action" },
    { value: "conversational", label: "Conversational", desc: "Casual, relatable, dialogue-like" },
];

const GEOGRAPHY_OPTIONS: { value: Geography; label: string }[] = [
    { value: "global", label: "🌍 Global" },
    { value: "us", label: "🇺🇸 United States" },
    { value: "europe", label: "🇪🇺 Europe" },
    { value: "africa", label: "🌍 Africa" },
    { value: "asia", label: "🌏 Asia" },
    { value: "mena", label: "🌐 MENA" },
];

const LENGTH_OPTIONS: { value: ContentLength; label: string; desc: string }[] = [
    { value: "short", label: "Short", desc: "500–800 words" },
    { value: "medium", label: "Medium", desc: "1000–1500 words" },
    { value: "long", label: "Long", desc: "2000–3000 words" },
    { value: "deep-dive", label: "Deep Dive", desc: "4000–6000 words" },
];

const GENERATION_STAGES: Array<{ value: GenerationStage; label: string; caption: string }> = [
    { value: "brief", label: "Brief", caption: "Intent" },
    { value: "format", label: "Format", caption: "Outputs" },
    { value: "context", label: "Context", caption: "Voice" },
    { value: "enrich", label: "Enrich", caption: "Signals" },
];

export interface DraftGeneratorInitialValues {
    title?: string;
    keywords?: string[];
    content_types?: ContentType[];
    narrative_style?: NarrativeStyle;
    length?: ContentLength;
    geography?: Geography;
    /** Source linkage. When set, /api/generate-draft will back-link the draft to this opportunity/plan. */
    opportunityId?: string;
    planId?: string;
    sourceLabel?: string;
    summary?: string | null;
}

interface DraftGeneratorFormProps {
    aiGenerationEnabled?: boolean;
    initialValues?: DraftGeneratorInitialValues | null;
    /** Workspace default locale; used as the initial value of the locale picker. */
    defaultLocale?: Locale;
}

export function DraftGeneratorForm({ aiGenerationEnabled = true, initialValues = null, defaultLocale = "en" }: DraftGeneratorFormProps) {
    const router = useRouter();
    const [, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [phase, setPhase] = useState<"idle" | "researching" | "generating" | "assets" | "saving">("idle");
    const [activeStage, setActiveStage] = useState<GenerationStage>("brief");

    const [form, setForm] = useState<FormState>({
        title: initialValues?.title ?? "",
        keywords: initialValues?.keywords ?? [],
        keywordInput: "",
        narrative_style: initialValues?.narrative_style ?? "analytical",
        length: initialValues?.length ?? "medium",
        content_types: initialValues?.content_types && initialValues.content_types.length > 0 ? initialValues.content_types : ["blog_post"],
        geography: initialValues?.geography ?? "global",
        locale: defaultLocale,
        generate_images: true,
        generate_charts: true,
        generate_diagrams: true,
        visual_density: "balanced",
    });

    const isAiLocked = !aiGenerationEnabled;
    const activeStageIndex = GENERATION_STAGES.findIndex((stage) => stage.value === activeStage);

    const moveStage = (direction: -1 | 1) => {
        const nextIndex = Math.min(Math.max(activeStageIndex + direction, 0), GENERATION_STAGES.length - 1);
        setActiveStage(GENERATION_STAGES[nextIndex]?.value ?? "brief");
    };

    const addKeyword = () => {
        const kw = form.keywordInput.trim();
        if (kw && !form.keywords.includes(kw)) {
            setForm((f) => ({ ...f, keywords: [...f.keywords, kw], keywordInput: "" }));
        }
    };

    const removeKeyword = (kw: string) => {
        setForm((f) => ({ ...f, keywords: f.keywords.filter((k) => k !== kw) }));
    };

    const toggleContentType = (type: ContentType) => {
        setForm((f) => ({
            ...f,
            content_types: f.content_types.includes(type)
                ? f.content_types.filter((t) => t !== type)
                : [...f.content_types, type],
        }));
    };

    const handleSubmit = async () => {
        if (isAiLocked) { setError("AI generation is only available on Pro workspaces."); return; }
        if (!form.title.trim()) { setError("Title is required"); return; }
        if (form.content_types.length === 0) { setError("Select at least one content type"); return; }

        setError(null);
        // Set phase immediately BEFORE any async work so React renders the loading state right away
        setPhase("researching");

        // Switch UI label to "generating" after ~25s — approximate research phase duration
        const generatingTimer = setTimeout(() => setPhase("generating"), 25000);

        try {
            const res = await fetch("/api/generate-draft", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: form.title,
                    keywords: form.keywords,
                    narrative_style: form.narrative_style,
                    length: form.length,
                    content_types: form.content_types,
                    geography: form.geography,
                    locale: form.locale,
                    generate_charts: form.generate_charts,
                    generate_diagrams: form.generate_diagrams,
                    visual_density: form.visual_density,
                    opportunity_id: initialValues?.opportunityId ?? null,
                    plan_id: initialValues?.planId ?? null,
                }),
            });

            clearTimeout(generatingTimer);
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Generation failed. Please try again.");
                setPhase("idle");
                return;
            }

            // Phase 3: Generate assets if requested
            if (form.generate_images) {
                setPhase("assets");
                try {
                    const assetRes = await fetch("/api/generate-assets", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            content_id: data.id,
                            generate_images: form.generate_images,
                        }),
                    });
                    const assetData = await assetRes.json().catch(() => null) as { error?: string } | null;
                    if (!assetRes.ok) {
                        setError(assetData?.error || "Draft saved, but featured image generation failed. Open the draft and retry asset generation.");
                    }
                } catch {
                    setError("Draft saved, but featured image generation could not be reached. Open the draft and retry asset generation.");
                }
            }

            setPhase("saving");
            startTransition(() => {
                router.push(`/dashboard/content/${data.id}`);
                router.refresh();
            });
        } catch {
            clearTimeout(generatingTimer);
            setError("Network error. Is the dev server running?");
            setPhase("idle");
        }
    };

    const isGenerating = phase !== "idle";
    const willDeriveNewsletter = form.content_types.includes("blog_post")
        && !form.content_types.includes("newsletter_issue");
    const phaseLabel = {
        idle: "Generate Content",
        researching: "Phase 1: Researching & analysing topic...",
        generating: "Phase 2: Generating formats, charts & diagrams...",
        assets: "Phase 3: Generating images...",
        saving: "Saving to your dashboard...",
    }[phase];
    const selectedStyle = NARRATIVE_STYLES.find((option) => option.value === form.narrative_style);
    const selectedLength = LENGTH_OPTIONS.find((option) => option.value === form.length);
    const selectedGeography = GEOGRAPHY_OPTIONS.find((option) => option.value === form.geography);
    const selectedContentTypes = CONTENT_TYPE_OPTIONS.filter((option) => form.content_types.includes(option.value));
    const enrichmentCount = [form.generate_images, form.generate_charts, form.generate_diagrams].filter(Boolean).length;

    return (
        <div className="mx-auto grid w-full max-w-6xl min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_17rem]">
            {isGenerating ? (
                <div className="lg:col-span-2">
                    <AiOperationPendingCard
                        title={phaseLabel}
                        description="The system is coordinating research, multi-format generation, visual enrichment, asset creation, and dashboard persistence in one workflow."
                        steps={["Research", "Generate", "Visuals", "Assets"]}
                        activeStep={phase === "researching" ? 0 : phase === "generating" ? 1 : 2}
                        tone="content"
                    />
                </div>
            ) : null}

            {initialValues?.sourceLabel ? (
                <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-[17px] lg:col-span-2">
                    <p className="font-semibold text-primary">Prefilled from {initialValues.sourceLabel}</p>
                    <p className="mt-1 text-muted-foreground">
                        Inputs below were populated from the approved recommendation. Review and adjust as needed,
                        then click Generate Draft to create the content.
                    </p>
                    {initialValues.summary ? (
                        <p className="mt-2 line-clamp-3 text-[15px] text-muted-foreground">{initialValues.summary}</p>
                    ) : null}
                </div>
            ) : null}

            <div className="lg:col-span-2 border-y border-border/55 bg-background/70 px-3 py-2" data-generate-stage-rail>
                <div className="flex min-w-0 items-center gap-3">
                    <div className="hidden shrink-0 items-center gap-2 sm:flex">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">Build path</span>
                        <span className="text-[11px] text-muted-foreground">{activeStageIndex + 1}/{GENERATION_STAGES.length}</span>
                    </div>
                    <nav className="flex min-w-0 flex-1 snap-x items-center gap-1 overflow-x-auto" aria-label="Generation stages">
                        {GENERATION_STAGES.map((stage, index) => {
                            const isActive = stage.value === activeStage;
                            const isComplete = index < activeStageIndex || (stage.value === "brief" && Boolean(form.title.trim()));
                            return (
                                <button
                                    key={stage.value}
                                    type="button"
                                    onClick={() => setActiveStage(stage.value)}
                                    disabled={isGenerating || isAiLocked}
                                    className={`group flex min-w-[92px] snap-start items-center gap-2 border-b-2 px-2.5 py-1.5 text-left transition-colors ${isActive
                                        ? "border-primary text-foreground"
                                        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                                        }`}
                                    aria-current={isActive ? "step" : undefined}
                                >
                                    <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${isActive
                                        ? "border-primary bg-primary/15 text-primary"
                                        : isComplete
                                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                                            : "border-border/70 text-muted-foreground"
                                        }`}>
                                        {isComplete && !isActive ? <CheckCircle2 className="size-3" /> : index + 1}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block truncate text-[12px] font-semibold">{stage.label}</span>
                                        <span className="block truncate text-[10px] text-muted-foreground">{stage.caption}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </div>

            <div className="lg:col-span-2">
                <AppFeedbackLoop
                    title="Generation control loop"
                    description="A short causal path keeps the brief, outputs, context, and visual intelligence aligned before the run starts."
                    stages={[
                        { label: "Brief", value: form.title.trim() ? "Ready" : "Missing", detail: form.keywords.length > 0 ? `${form.keywords.length} signals` : "add a topic", tone: form.title.trim() ? "success" : "warning" },
                        { label: "Outputs", value: form.content_types.length, detail: "formats selected", tone: form.content_types.length > 0 ? "info" : "warning" },
                        { label: "Context", value: getLocaleNativeLabel(form.locale), detail: `${selectedStyle?.label ?? form.narrative_style} voice`, tone: "info" },
                        { label: "Enrich", value: enrichmentCount, detail: "visual passes", tone: enrichmentCount > 0 ? "success" : "default" },
                    ]}
                    feedbackLabel="Review evidence after generation; the next brief should inherit what performed, not just what was produced."
                />
            </div>

            <div className="min-w-0 space-y-4">
                {activeStage === "brief" ? (
                <section className="rounded-md border border-border/60 bg-card/70 p-4 shadow-sm" data-generate-stage="brief">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                        <div>
                            <p className="text-[14px] font-semibold uppercase text-muted-foreground">Brief</p>
                            <h2 className="text-[20px] font-semibold text-foreground">Source idea</h2>
                        </div>
                        <span className="rounded-md border border-border/60 bg-background px-2.5 py-1 text-[14px] font-medium text-muted-foreground">
                            Required
                        </span>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[15px] font-semibold uppercase text-muted-foreground">
                                Content Title *
                            </label>
                            <Input
                                placeholder="e.g., Why AI Will Replace Junior Developers by 2027"
                                value={form.title}
                                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                className="h-12 text-[19px]"
                                disabled={isGenerating || isAiLocked}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[15px] font-semibold uppercase text-muted-foreground">
                                Keywords
                            </label>
                            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                                <Input
                                    placeholder="Add keyword and press Enter"
                                    value={form.keywordInput}
                                    onChange={(e) => setForm((f) => ({ ...f, keywordInput: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                                    className="min-w-0 text-[15px]"
                                    disabled={isGenerating || isAiLocked}
                                />
                                <Button type="button" variant="outline" onClick={addKeyword} disabled={isGenerating || isAiLocked} className="w-full text-[15px] sm:w-auto">
                                    Add
                                </Button>
                            </div>
                            {form.keywords.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {form.keywords.map((kw) => (
                                        <span key={kw} className="flex min-w-0 items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[15px] text-primary">
                                            {kw}
                                            <button type="button" onClick={() => removeKeyword(kw)} className="transition-colors hover:text-destructive" aria-label={`Remove ${kw}`}>
                                                <X className="h-3 w-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </section>
                ) : null}

                {activeStage === "format" ? (
                <section className="rounded-md border border-border/60 bg-card/70 p-4 shadow-sm" data-generate-stage="format">
                    <div className="mb-4 border-b border-border/60 pb-3">
                        <p className="text-[14px] font-semibold uppercase text-muted-foreground">Format</p>
                        <h2 className="text-[20px] font-semibold text-foreground">Output mix</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[15px] font-semibold uppercase text-muted-foreground">
                                Content Types *
                            </label>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {CONTENT_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => {
                                    const isSelected = form.content_types.includes(value);
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => toggleContentType(value)}
                                            disabled={isGenerating || isAiLocked}
                                            className={`flex min-w-0 items-center gap-3 rounded-md border p-3 text-left transition-all ${isSelected
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                                }`}
                                        >
                                            <Icon className="h-4 w-4 shrink-0" />
                                            <span className="min-w-0 text-[15px] font-medium">{label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[15px] font-semibold uppercase text-muted-foreground">
                                Length / Depth
                            </label>
                            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                                {LENGTH_OPTIONS.map(({ value, label, desc }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setForm((f) => ({ ...f, length: value }))}
                                        disabled={isGenerating || isAiLocked}
                                        className={`min-w-0 rounded-md border p-3 text-center transition-all ${form.length === value
                                            ? "border-primary bg-primary/10"
                                            : "border-border hover:border-primary/40"
                                            }`}
                                    >
                                        <div className="text-[15px] font-medium">{label}</div>
                                        <div className="mt-0.5 text-[15px] text-muted-foreground">{desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
                ) : null}

                {activeStage === "context" ? (
                <section className="rounded-md border border-border/60 bg-card/70 p-4 shadow-sm" data-generate-stage="context">
                    <div className="mb-4 border-b border-border/60 pb-3">
                        <p className="text-[14px] font-semibold uppercase text-muted-foreground">Voice</p>
                        <h2 className="text-[20px] font-semibold text-foreground">Narrative and market context</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[15px] font-semibold uppercase text-muted-foreground">
                                Narrative Style
                            </label>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {NARRATIVE_STYLES.map(({ value, label, desc }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setForm((f) => ({ ...f, narrative_style: value }))}
                                        disabled={isGenerating || isAiLocked}
                                        className={`min-w-0 rounded-md border p-3 text-left transition-all ${form.narrative_style === value
                                            ? "border-primary bg-primary/10"
                                            : "border-border hover:border-primary/40"
                                            }`}
                                    >
                                        <div className="text-[15px] font-medium">{label}</div>
                                        <div className="mt-0.5 text-[15px] text-muted-foreground">{desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-[15px] font-semibold uppercase text-muted-foreground">
                                    <Languages className="mr-1 inline h-3.5 w-3.5" />
                                    Content Language
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {SUPPORTED_LOCALES.map((value) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setForm((f) => ({ ...f, locale: value }))}
                                            disabled={isGenerating || isAiLocked}
                                            className={`rounded-md border px-3 py-2 text-[15px] transition-all ${form.locale === value
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                                }`}
                                        >
                                            {getLocaleNativeLabel(value)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[15px] font-semibold uppercase text-muted-foreground">
                                    <Globe className="mr-1 inline h-3.5 w-3.5" />
                                    Target Geography
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {GEOGRAPHY_OPTIONS.map(({ value, label }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setForm((f) => ({ ...f, geography: value }))}
                                            disabled={isGenerating || isAiLocked}
                                            className={`rounded-md border px-3 py-2 text-[15px] transition-all ${form.geography === value
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                                }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                ) : null}

                {activeStage === "enrich" ? (
                <section className="rounded-md border border-border/60 bg-card/70 p-4 shadow-sm" data-generate-stage="enrich">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                        <div>
                            <p className="text-[14px] font-semibold uppercase text-muted-foreground">Enrichment</p>
                            <h2 className="text-[20px] font-semibold text-foreground">Visual intelligence</h2>
                        </div>
                        {isAiLocked ? <ProBadge /> : null}
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, generate_images: !f.generate_images }))}
                            disabled={isGenerating || isAiLocked}
                            className={`flex min-w-0 items-center gap-3 rounded-md border p-3 text-left transition-all ${form.generate_images
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                }`}
                        >
                            <ImageIcon className="h-4 w-4 shrink-0" />
                            <div className="min-w-0 text-left">
                                <div className="text-[15px] font-medium">Featured Images</div>
                                <div className="text-[15px] text-muted-foreground">Blog hero, thumbnail, social graphics</div>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, generate_charts: !f.generate_charts }))}
                            disabled={isGenerating || isAiLocked}
                            className={`flex min-w-0 items-center gap-3 rounded-md border p-3 text-left transition-all ${form.generate_charts
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                }`}
                        >
                            <BarChart3 className="h-4 w-4 shrink-0" />
                            <div className="min-w-0 text-left">
                                <div className="text-[15px] font-medium">Data Charts</div>
                                <div className="text-[15px] text-muted-foreground">KPI, trend, donut and table blocks</div>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, generate_diagrams: !f.generate_diagrams }))}
                            disabled={isGenerating || isAiLocked}
                            className={`flex min-w-0 items-center gap-3 rounded-md border p-3 text-left transition-all ${form.generate_diagrams
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                }`}
                        >
                            <Workflow className="h-4 w-4 shrink-0" />
                            <div className="min-w-0 text-left">
                                <div className="text-[15px] font-medium">Systems Diagrams</div>
                                <div className="text-[15px] text-muted-foreground">Relational maps, feedback loops, archetypes and flows</div>
                            </div>
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-4">
                        {(["light", "balanced", "rich"] as const).map((density) => (
                            <button
                                key={density}
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, visual_density: density }))}
                                disabled={isGenerating || isAiLocked}
                                className={`rounded-md border px-3 py-1.5 text-[15px] font-semibold capitalize transition ${form.visual_density === density
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border text-muted-foreground hover:border-primary/50"
                                    }`}
                            >
                                {density} visual density
                            </button>
                        ))}
                    </div>
                </section>
                ) : null}

                {error && (
                    <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-[17px] font-medium text-destructive">
                        {error}
                    </div>
                )}

                {isGenerating ? (
                    <div className="grid gap-4 md:grid-cols-3">
                        <PremiumPanelSkeleton lines={3} />
                        <PremiumPanelSkeleton lines={3} />
                        <PremiumPanelSkeleton lines={3} />
                    </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/55 pt-3" data-generate-stage-actions>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => moveStage(-1)}
                        disabled={activeStageIndex === 0 || isGenerating || isAiLocked}
                        className="gap-1.5 text-[13px]"
                    >
                        <ChevronLeft className="size-3.5" />
                        Back
                    </Button>
                    <span className="text-[11px] text-muted-foreground">{GENERATION_STAGES[activeStageIndex]?.label} stage · your choices stay saved</span>
                    {activeStageIndex < GENERATION_STAGES.length - 1 ? (
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => moveStage(1)}
                            disabled={isGenerating || isAiLocked}
                            className="gap-1.5 text-[13px]"
                        >
                            Continue
                            <ChevronRight className="size-3.5" />
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleSubmit}
                            disabled={isGenerating || isAiLocked}
                            className="gap-1.5 text-[13px]"
                        >
                            <Sparkles className="size-3.5" />
                            Run generation
                        </Button>
                    )}
                </div>
            </div>

            <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start" data-generate-summary>
                <div className="rounded-md border border-border/60 bg-card/80 p-4 shadow-sm">
                    <div className="mb-4 border-b border-border/60 pb-3">
                        <p className="text-[14px] font-semibold uppercase text-muted-foreground">Generation Plan</p>
                        <h2 className="text-[20px] font-semibold text-foreground">Ready state</h2>
                    </div>

                    <dl className="space-y-3 text-[15px]">
                        <div className="flex items-start justify-between gap-3">
                            <dt className="text-muted-foreground">Formats</dt>
                            <dd className="text-right font-medium text-foreground">
                                {selectedContentTypes.length > 0 ? `${selectedContentTypes.length} selected` : "None"}
                            </dd>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                            <dt className="text-muted-foreground">Depth</dt>
                            <dd className="text-right font-medium text-foreground">{selectedLength?.label ?? form.length}</dd>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                            <dt className="text-muted-foreground">Style</dt>
                            <dd className="text-right font-medium text-foreground">{selectedStyle?.label ?? form.narrative_style}</dd>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                            <dt className="text-muted-foreground">Locale</dt>
                            <dd className="text-right font-medium text-foreground">{getLocaleNativeLabel(form.locale)}</dd>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                            <dt className="text-muted-foreground">Market</dt>
                            <dd className="text-right font-medium text-foreground">{selectedGeography?.label ?? form.geography}</dd>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                            <dt className="text-muted-foreground">Enrichment</dt>
                            <dd className="text-right font-medium text-foreground">{enrichmentCount} enabled</dd>
                        </div>
                    </dl>

                    <div className="mt-4 space-y-2 rounded-md border border-border/60 bg-background/70 p-3">
                        <p className="text-[14px] font-semibold uppercase text-muted-foreground">Selected outputs</p>
                        <div className="flex flex-wrap gap-1.5">
                            {selectedContentTypes.length > 0 ? (
                                <>
                                    {selectedContentTypes.map((option) => (
                                        <span key={option.value} className="rounded-md bg-primary/10 px-2 py-1 text-[14px] font-medium text-primary">
                                            {option.label}
                                        </span>
                                    ))}
                                    {willDeriveNewsletter ? (
                                        <span className="rounded-md bg-amber-500/10 px-2 py-1 text-[14px] font-medium text-amber-700 dark:text-amber-300">
                                            Newsletter Issue · derived from Blog Post
                                        </span>
                                    ) : null}
                                </>
                            ) : (
                                <span className="text-[15px] text-muted-foreground">Select at least one content type.</span>
                            )}
                        </div>
                    </div>

                    <Button
                        onClick={handleSubmit}
                        disabled={isGenerating || isAiLocked}
                        size="lg"
                        className="mt-4 min-h-12 h-auto w-full justify-start gap-2 whitespace-normal py-3 text-left text-[17px] shadow-lg shadow-primary/20 sm:justify-center"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                                <span className="min-w-0 flex-1 sm:flex-none">{phaseLabel}</span>
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-5 w-5 shrink-0" />
                                <span>Run current brief</span>
                                <ChevronRight className="ml-auto h-4 w-4 shrink-0" />
                            </>
                        )}
                    </Button>

                    {isGenerating && (
                        <div className="mt-4">
                            <PremiumInlinePending
                                label="30-90 second generation window"
                                description="Research, drafting, and asset passes may complete at different times"
                            />
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
}
