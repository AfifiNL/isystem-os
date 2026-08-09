"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    Columns2,
    GripVertical,
    ImagePlus,
    LayoutTemplate,
    Loader2,
    Quote,
    Save,
    Search,
    Sparkles,
    Trash2,
    Type,
} from "lucide-react";
import { createContentItem, updateContentItem } from "@/features/content-engine/actions";
import { RichTextEditor } from "@/features/content-engine/ui/editor";
import { richTextHtmlToPlainText, normalizeRichTextInput } from "@/features/content-engine/lib/rich-text";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { AiOperationPendingCard, PremiumInlinePending } from "@/shared/ui/loading";

function slugify(input: string) {
    return input.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}

type SeoState = {
    title: string;
    description: string;
    keywords: string;
    canonicalUrl: string;
};

type MediaState = {
    featuredImageUrl: string;
    featuredImageAlt: string;
    ogImageUrl: string;
};

type ManualBlogTemplate = "editorial" | "insight-grid" | "case-study";
type ManualSectionType = "richText" | "image" | "quote" | "twoColumn" | "statsGrid";

type ManualBlogSection = {
    id: string;
    type: ManualSectionType;
    title?: string;
    eyebrow?: string;
    body?: string;
    imageUrl?: string;
    imageAlt?: string;
    caption?: string;
    quote?: string;
    author?: string;
    leftTitle?: string;
    leftBody?: string;
    rightTitle?: string;
    rightBody?: string;
    stats?: Array<{ label: string; value: string }>;
};

type ManualBuilderState = {
    template: ManualBlogTemplate;
    sections: ManualBlogSection[];
};

type ManualBlogInitialData = {
    id?: string;
    title?: string;
    slug?: string;
    status?: string | null;
    content_markdown?: string;
    metadata?: Record<string, unknown> | null;
};

interface ManualBlogPostBuilderProps {
    initialData?: ManualBlogInitialData | null;
    mode: "create" | "edit";
}

const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

function createSection(type: ManualSectionType): ManualBlogSection {
    switch (type) {
        case "image":
            return {
                id: createId("image"),
                type,
                title: "Image section",
                caption: "Add a short caption.",
                imageUrl: "",
                imageAlt: "",
            };
        case "quote":
            return {
                id: createId("quote"),
                type,
                quote: "Add a quote or pullout.",
                author: "Source",
            };
        case "twoColumn":
            return {
                id: createId("columns"),
                type,
                eyebrow: "Two-column block",
                leftTitle: "Left column",
                leftBody: "Add the first column.",
                rightTitle: "Right column",
                rightBody: "Add the second column.",
            };
        case "statsGrid":
            return {
                id: createId("stats"),
                type,
                title: "Highlights",
                stats: [
                    { label: "Metric", value: "72%" },
                    { label: "Metric", value: "4X" },
                    { label: "Metric", value: "12d" },
                ],
            };
        case "richText":
        default:
            return {
                id: createId("section"),
                type: "richText",
                eyebrow: "Section label",
                title: "Section heading",
                body: "Write your section.",
            };
    }
}

const TEMPLATE_PRESETS: Record<ManualBlogTemplate, { title: string; description: string; sections: ManualBlogSection[] }> = {
    editorial: {
        title: "Editorial",
        description: "Lead, quote, visual, and close.",
        sections: [
            { id: createId("section"), type: "richText", eyebrow: "Lead", title: "Open strong", body: "Set the context and hook." },
            { id: createId("quote"), type: "quote", quote: "Use one clear idea worth remembering.", author: "Editorial note" },
            { id: createId("image"), type: "image", title: "Feature image", caption: "Use a strong supporting visual." },
            { id: createId("section"), type: "richText", eyebrow: "Detail", title: "Develop the argument", body: "Expand the main point with examples." },
        ],
    },
    "insight-grid": {
        title: "Insight Grid",
        description: "Summary, metrics, and split detail.",
        sections: [
            { id: createId("section"), type: "richText", eyebrow: "Summary", title: "State the insight", body: "Give the core takeaway up front." },
            createSection("statsGrid"),
            createSection("twoColumn"),
            { id: createId("section"), type: "richText", eyebrow: "Next step", title: "Close with action", body: "Say what the reader should do next." },
        ],
    },
    "case-study": {
        title: "Case Study",
        description: "Situation, proof, image, and result.",
        sections: [
            { id: createId("section"), type: "richText", eyebrow: "Situation", title: "Describe the challenge", body: "Explain the starting point." },
            createSection("twoColumn"),
            createSection("image"),
            createSection("statsGrid"),
            { id: createId("quote"), type: "quote", quote: "Use one proof point that supports the outcome.", author: "Client proof" },
        ],
    },
};

function parseInitialBuilder(initialData?: ManualBlogInitialData | null): ManualBuilderState {
    const rawBuilder = initialData?.metadata?.manual_builder as Partial<ManualBuilderState> | undefined;
    const template = rawBuilder?.template && rawBuilder.template in TEMPLATE_PRESETS
        ? rawBuilder.template as ManualBlogTemplate
        : "editorial";
    const sections = Array.isArray(rawBuilder?.sections) && rawBuilder.sections.length > 0
        ? rawBuilder.sections as ManualBlogSection[]
        : TEMPLATE_PRESETS[template].sections;

    return { template, sections };
}

function serializeBuilderToMarkdown(sections: ManualBlogSection[]) {
    return sections.map((section) => {
        switch (section.type) {
            case "quote":
                return `> ${section.quote || ""}\n> ${section.author ? `— ${section.author}` : ""}`;
            case "image":
                return `${section.title ? `## ${section.title}\n\n` : ""}${section.caption || ""}`;
            case "twoColumn":
                return `## ${section.eyebrow || "Two-column section"}\n\n### ${section.leftTitle || "Left"}\n${richTextHtmlToPlainText(section.leftBody) || ""}\n\n### ${section.rightTitle || "Right"}\n${richTextHtmlToPlainText(section.rightBody) || ""}`;
            case "statsGrid":
                return `## ${section.title || "Highlights"}\n\n${(section.stats || []).map((stat) => `- **${stat.value}** — ${stat.label}`).join("\n")}`;
            case "richText":
            default:
                return `${section.eyebrow ? `_${section.eyebrow}_\n\n` : ""}${section.title ? `## ${section.title}\n\n` : ""}${richTextHtmlToPlainText(section.body) || ""}`;
        }
    }).join("\n\n");
}

export function ManualBlogPostBuilder({ initialData, mode }: ManualBlogPostBuilderProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [title, setTitle] = useState(initialData?.title || "");
    const [slug, setSlug] = useState(initialData?.slug || "");
    const [excerpt, setExcerpt] = useState((initialData?.metadata?.excerpt as string) || "");
    const [status, setStatus] = useState<"draft" | "published">((initialData?.status as "draft" | "published") || "draft");
    const [seo, setSeo] = useState<SeoState>({
        title: (initialData?.metadata?.seo as { title?: string } | undefined)?.title || "",
        description: (initialData?.metadata?.seo as { description?: string } | undefined)?.description || "",
        keywords: Array.isArray((initialData?.metadata?.seo as { keywords?: string[] } | undefined)?.keywords)
            ? ((initialData?.metadata?.seo as { keywords?: string[] }).keywords || []).join(", ")
            : "",
        canonicalUrl: (initialData?.metadata?.seo as { canonical_url?: string } | undefined)?.canonical_url || "",
    });
    const [media, setMedia] = useState<MediaState>({
        featuredImageUrl: (initialData?.metadata?.featured_image_url as string) || "",
        featuredImageAlt: (initialData?.metadata?.featured_image_alt as string) || "",
        ogImageUrl: (initialData?.metadata?.seo as { og_image_url?: string } | undefined)?.og_image_url || "",
    });
    const [builder, setBuilder] = useState<ManualBuilderState>(() => parseInitialBuilder(initialData));
    const [draftId, setDraftId] = useState<string | null>(initialData?.id ?? null);
    const [uploadingKey, setUploadingKey] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [draftSlugSeed] = useState("draft-post");

    const computedSlug = useMemo(() => slugify(slug || title), [slug, title]);
    const resolvedSlug = computedSlug || draftSlugSeed;

    const createOrReuseDraft = async () => {
        if (draftId) {
            return { id: draftId, error: null as string | null };
        }

        const bootstrap = await createContentItem({
            title: title.trim() || "Untitled post",
            slug: resolvedSlug,
            status: "draft",
            type: "blog",
            content_markdown: serializeBuilderToMarkdown(builder.sections) || "Draft in progress",
            metadata: {
                source: "manual",
                excerpt: excerpt.trim() || undefined,
                manual_builder: builder,
            },
        });

        if (bootstrap.error || !bootstrap.data?.id) {
            return { id: null, error: bootstrap.error || "Failed to prepare draft" };
        }

        setDraftId(bootstrap.data.id);
        return { id: bootstrap.data.id, error: null as string | null };
    };

    const uploadAsset = async (file: File, target: { type: "featured" } | { type: "section"; sectionId: string }) => {
        setUploadingKey(target.type === "featured" ? "featured" : target.sectionId);
        setError(null);

        try {
            const draft = await createOrReuseDraft();

            if (draft.error || !draft.id) {
                throw new Error(draft.error || "Failed to prepare draft for upload");
            }

            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(`/api/content/${draft.id}/assets/upload`, {
                method: "POST",
                body: formData,
            });

            const payload = await response.json();

            if (!response.ok || !payload.asset?.url) {
                throw new Error(payload.error || "Failed to upload image");
            }

            if (target.type === "featured") {
                setMedia((prev) => ({
                    ...prev,
                    featuredImageUrl: payload.asset.url,
                    ogImageUrl: prev.ogImageUrl || payload.asset.url,
                }));
            } else {
                setBuilder((prev) => ({
                    ...prev,
                    sections: prev.sections.map((section) =>
                        section.id === target.sectionId
                            ? { ...section, imageUrl: payload.asset.url, imageAlt: section.imageAlt || file.name.replace(/\.[^.]+$/, "") }
                            : section,
                    ),
                }));
            }
        } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : "Failed to upload image");
        } finally {
            setUploadingKey(null);
        }
    };

    const handleSave = () => {
        if (!title.trim()) {
            setError("Title is required");
            return;
        }

        if (builder.sections.length === 0) {
            setError("Add at least one section");
            return;
        }

        setError(null);

        startTransition(async () => {
            const payload = {
                title: title.trim(),
                slug: resolvedSlug,
                status,
                type: "blog",
                content_markdown: serializeBuilderToMarkdown(builder.sections),
                metadata: {
                    source: "manual",
                    excerpt: excerpt.trim() || undefined,
                    featured_image_url: media.featuredImageUrl.trim() || undefined,
                    featured_image_alt: media.featuredImageAlt.trim() || undefined,
                    manual_builder: builder,
                    seo: {
                        title: seo.title.trim() || undefined,
                        description: seo.description.trim() || undefined,
                        keywords: seo.keywords.split(",").map((entry) => entry.trim()).filter(Boolean),
                        canonical_url: seo.canonicalUrl.trim() || undefined,
                        og_image_url: media.ogImageUrl.trim() || media.featuredImageUrl.trim() || undefined,
                    },
                },
            };

            const result = draftId
                ? await updateContentItem(draftId, payload)
                : await createContentItem(payload);

            if (result.error) {
                setError(result.error);
                return;
            }

            router.push(`/dashboard/content/manual/${result.data.id}`);
            router.refresh();
        });
    };

    const moveSection = (sectionId: string, direction: -1 | 1) => {
        setBuilder((prev) => {
            const index = prev.sections.findIndex((section) => section.id === sectionId);
            const targetIndex = index + direction;

            if (index < 0 || targetIndex < 0 || targetIndex >= prev.sections.length) {
                return prev;
            }

            const nextSections = [...prev.sections];
            const [current] = nextSections.splice(index, 1);
            nextSections.splice(targetIndex, 0, current);

            return { ...prev, sections: nextSections };
        });
    };

    const updateSection = (sectionId: string, updater: (section: ManualBlogSection) => ManualBlogSection) => {
        setBuilder((prev) => ({
            ...prev,
            sections: prev.sections.map((section) => section.id === sectionId ? updater(section) : section),
        }));
    };

    const templateCards = (Object.keys(TEMPLATE_PRESETS) as ManualBlogTemplate[]).map((templateKey) => {
        const preset = TEMPLATE_PRESETS[templateKey];
        const isSelected = builder.template === templateKey;

        return (
            <button
                key={templateKey}
                type="button"
                onClick={() => setBuilder({
                    template: templateKey,
                    sections: preset.sections.map((section) => ({ ...section, id: createId(section.type) })),
                })}
                className={`rounded-md border p-4 text-left transition ${isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border/60 bg-background hover:border-primary/30"}`}
            >
                <div className="flex items-center gap-2 text-[17px] font-semibold text-foreground">
                    <LayoutTemplate className="h-4 w-4 text-primary" />
                    {preset.title}
                </div>
                <p className="mt-2 text-[17px] text-muted-foreground">{preset.description}</p>
            </button>
        );
    });

    const sectionButtons: Array<{ type: ManualSectionType; label: string; icon: typeof Type }> = [
        { type: "richText", label: "Text", icon: Type },
        { type: "image", label: "Image", icon: ImagePlus },
        { type: "quote", label: "Quote", icon: Quote },
        { type: "twoColumn", label: "Grid", icon: Columns2 },
        { type: "statsGrid", label: "Stats", icon: Sparkles },
    ];

    return (
        <div className="mx-auto w-full max-w-[1680px] min-w-0 space-y-6 pb-10 sm:space-y-8">
            <div className="flex min-w-0 flex-col gap-4 rounded-md border border-border/50 bg-card p-4 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-2">
                    <Link href="/dashboard/content" className="inline-flex items-center text-[17px] font-medium text-muted-foreground transition hover:text-foreground">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to library
                    </Link>
                    <div>
                        <h1 className="text-[27px] font-bold tracking-tight text-foreground sm:text-4xl">
                            {mode === "create" ? "Manual Blog Builder" : "Edit Manual Post"}
                        </h1>
                        <p className="mt-1 text-[17px] text-muted-foreground">
                            Write, arrange, publish.
                        </p>
                    </div>
                </div>

                <div className="flex min-w-0 flex-col items-stretch gap-3 lg:items-end">
                    {isPending ? <PremiumInlinePending label={status === "published" ? "Publishing manual post" : "Saving manual draft"} description="Persisting sections, SEO, and media references" /> : null}
                    <Button onClick={handleSave} disabled={isPending} className="w-full min-w-0 lg:w-auto lg:min-w-[170px] lg:self-auto">
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {status === "published" ? "Publish" : "Save draft"}
                    </Button>
                </div>
            </div>

            {isPending ? (
                <AiOperationPendingCard
                    title={status === "published" ? "Publishing manual content" : "Saving manual content"}
                    description="We are packaging your layout structure, featured media, and SEO metadata into the content library with the same premium feedback used across AI-assisted flows."
                    steps={["Validate structure", "Sync media", "Persist draft"]}
                    activeStep={1}
                    tone="content"
                />
            ) : null}

            {error ? (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-[17px] text-destructive">
                    {error}
                </div>
            ) : null}

            <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1.4fr)_420px]">
                <div className="min-w-0 space-y-6">
                    <div className="rounded-md border border-border/50 bg-card p-4 shadow-sm sm:p-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[15px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Title</label>
                                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter the post title" className="h-14 text-[23px] font-bold sm:text-[27px]" />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-[15px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Slug</label>
                                    <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="optional-custom-slug" />
                                    <p className="text-[15px] text-muted-foreground">/blog/{resolvedSlug}</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[15px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Status</label>
                                    <select value={status} onChange={(e) => setStatus(e.target.value as "draft" | "published")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[17px]">
                                        <option value="draft">Draft</option>
                                        <option value="published">Published</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-5 rounded-md border border-border/50 bg-card p-4 shadow-sm sm:p-6">
                        <div>
                            <h2 className="text-[21px] font-semibold text-foreground">Templates</h2>
                            <p className="text-[17px] text-muted-foreground">Pick a starting point.</p>
                        </div>
                        <div className="grid gap-4 lg:grid-cols-3">
                            {templateCards}
                        </div>
                    </div>

                    <div className="space-y-5 rounded-md border border-border/50 bg-card p-4 shadow-sm sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-[21px] font-semibold text-foreground">Builder</h2>
                                <p className="text-[17px] text-muted-foreground">Add and order sections.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 min-[390px]:grid-cols-3 sm:flex sm:flex-wrap">
                                {sectionButtons.map(({ type, label, icon: Icon }) => (
                                    <Button key={type} type="button" variant="outline" size="sm" onClick={() => setBuilder((prev) => ({ ...prev, sections: [...prev.sections, createSection(type)] }))} className="w-full sm:w-auto">
                                        <Icon className="mr-2 h-4 w-4" />
                                        {label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            {builder.sections.map((section, index) => (
                                <div key={section.id} className="min-w-0 rounded-md border border-border/60 bg-background p-4 shadow-sm sm:p-5">
                                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-md bg-muted p-2 text-muted-foreground">
                                                <GripVertical className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="text-[17px] font-semibold text-foreground">{section.type}</p>
                                                <p className="text-[15px] text-muted-foreground">#{index + 1}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                                            <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => moveSection(section.id, -1)}>Up</Button>
                                            <Button type="button" variant="outline" size="sm" disabled={index === builder.sections.length - 1} onClick={() => moveSection(section.id, 1)}>Down</Button>
                                            <Button type="button" variant="destructive" size="sm" className="col-span-2 sm:col-span-1" onClick={() => setBuilder((prev) => ({ ...prev, sections: prev.sections.filter((entry) => entry.id !== section.id) }))}>
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Remove
                                            </Button>
                                        </div>
                                    </div>

                                    {section.type === "richText" ? (
                                        <div className="space-y-3">
                                            <Input value={section.eyebrow || ""} onChange={(e) => updateSection(section.id, (entry) => ({ ...entry, eyebrow: e.target.value }))} placeholder="Label" />
                                            <Input value={section.title || ""} onChange={(e) => updateSection(section.id, (entry) => ({ ...entry, title: e.target.value }))} placeholder="Heading" />
                                            <RichTextEditor
                                                content={normalizeRichTextInput(section.body)}
                                                onChange={(value) => updateSection(section.id, (entry) => ({ ...entry, body: value }))}
                                            />
                                        </div>
                                    ) : null}

                                    {section.type === "image" ? (
                                        <div className="space-y-3">
                                            <Input value={section.title || ""} onChange={(e) => updateSection(section.id, (entry) => ({ ...entry, title: e.target.value }))} placeholder="Image heading" />
                                            <div className="rounded-md border border-dashed border-border/70 bg-muted/20 p-4">
                                                <label className="mb-2 block text-[15px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Upload image</label>
                                                <Input type="file" accept="image/*" disabled={uploadingKey === section.id || isPending} onChange={(event) => {
                                                    const file = event.target.files?.[0];
                                                    if (file) {
                                                        void uploadAsset(file, { type: "section", sectionId: section.id });
                                                    }
                                                }} />
                                                <div className="mt-2">
                                                    {uploadingKey === section.id ? (
                                                        <PremiumInlinePending label="Uploading section image" description="Optimizing and attaching media" />
                                                    ) : (
                                                        <p className="text-[15px] text-muted-foreground">Upload from your device.</p>
                                                    )}
                                                </div>
                                            </div>
                                            {section.imageUrl ? <img src={section.imageUrl} alt={section.imageAlt || section.title || "Uploaded section image"} className="h-56 w-full rounded-md border border-border/60 object-cover" /> : null}
                                            <Input value={section.imageAlt || ""} onChange={(e) => updateSection(section.id, (entry) => ({ ...entry, imageAlt: e.target.value }))} placeholder="Alt text" />
                                            <Textarea value={section.caption || ""} onChange={(e) => updateSection(section.id, (entry) => ({ ...entry, caption: e.target.value }))} placeholder="Caption" className="min-h-24" />
                                        </div>
                                    ) : null}

                                    {section.type === "quote" ? (
                                        <div className="space-y-3">
                                            <Textarea value={section.quote || ""} onChange={(e) => updateSection(section.id, (entry) => ({ ...entry, quote: e.target.value }))} placeholder="Quote" className="min-h-32" />
                                            <Input value={section.author || ""} onChange={(e) => updateSection(section.id, (entry) => ({ ...entry, author: e.target.value }))} placeholder="Author" />
                                        </div>
                                    ) : null}

                                    {section.type === "twoColumn" ? (
                                        <div className="space-y-3">
                                            <Input value={section.eyebrow || ""} onChange={(e) => updateSection(section.id, (entry) => ({ ...entry, eyebrow: e.target.value }))} placeholder="Section label" />
                                            <div className="grid gap-4 lg:grid-cols-2">
                                                <div className="min-w-0 space-y-3 rounded-md border border-border/60 p-3 sm:p-4">
                                                    <Input value={section.leftTitle || ""} onChange={(e) => updateSection(section.id, (entry) => ({ ...entry, leftTitle: e.target.value }))} placeholder="Left title" />
                                                    <RichTextEditor
                                                        content={normalizeRichTextInput(section.leftBody)}
                                                        onChange={(value) => updateSection(section.id, (entry) => ({ ...entry, leftBody: value }))}
                                                    />
                                                </div>
                                                <div className="min-w-0 space-y-3 rounded-md border border-border/60 p-3 sm:p-4">
                                                    <Input value={section.rightTitle || ""} onChange={(e) => updateSection(section.id, (entry) => ({ ...entry, rightTitle: e.target.value }))} placeholder="Right title" />
                                                    <RichTextEditor
                                                        content={normalizeRichTextInput(section.rightBody)}
                                                        onChange={(value) => updateSection(section.id, (entry) => ({ ...entry, rightBody: value }))}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}

                                    {section.type === "statsGrid" ? (
                                        <div className="space-y-3">
                                            <Input value={section.title || ""} onChange={(e) => updateSection(section.id, (entry) => ({ ...entry, title: e.target.value }))} placeholder="Stats heading" />
                                            <div className="grid gap-3 md:grid-cols-3">
                                                {(section.stats || []).map((stat, statIndex) => (
                                                    <div key={`${section.id}-${statIndex}`} className="rounded-md border border-border/60 p-4 space-y-2">
                                                        <Input value={stat.value} onChange={(e) => updateSection(section.id, (entry) => ({ ...entry, stats: (entry.stats || []).map((item, idx) => idx === statIndex ? { ...item, value: e.target.value } : item) }))} placeholder="72%" />
                                                        <Input value={stat.label} onChange={(e) => updateSection(section.id, (entry) => ({ ...entry, stats: (entry.stats || []).map((item, idx) => idx === statIndex ? { ...item, label: e.target.value } : item) }))} placeholder="Label" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="min-w-0 space-y-6">
                    <div className="space-y-4 rounded-md border border-border/50 bg-card p-4 shadow-sm sm:p-5 2xl:sticky 2xl:top-6">
                        <h3 className="flex items-center gap-2 text-[17px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                            <Search className="h-4 w-4" />
                            SEO & media
                        </h3>
                        <div className="space-y-3">
                            <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Excerpt" className="min-h-24" />
                            <Input value={seo.title} onChange={(e) => setSeo((prev) => ({ ...prev, title: e.target.value }))} placeholder="SEO title" />
                            <Textarea value={seo.description} onChange={(e) => setSeo((prev) => ({ ...prev, description: e.target.value }))} placeholder="SEO description" className="min-h-24" />
                            <Input value={seo.keywords} onChange={(e) => setSeo((prev) => ({ ...prev, keywords: e.target.value }))} placeholder="Keywords" />
                            <Input value={seo.canonicalUrl} onChange={(e) => setSeo((prev) => ({ ...prev, canonicalUrl: e.target.value }))} placeholder="Canonical URL" />
                        </div>

                        <div className="space-y-3 border-t border-border/60 pt-4">
                            <h4 className="flex items-center gap-2 text-[17px] font-semibold text-foreground">
                                <ImagePlus className="h-4 w-4 text-primary" />
                                Featured image
                            </h4>
                            <div className="rounded-md border border-dashed border-border/70 bg-muted/20 p-4">
                                <label className="mb-2 block text-[15px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Upload image</label>
                                <Input type="file" accept="image/*" disabled={uploadingKey === "featured" || isPending} onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) {
                                        void uploadAsset(file, { type: "featured" });
                                    }
                                }} />
                                <div className="mt-2">
                                    {uploadingKey === "featured" ? (
                                        <PremiumInlinePending label="Uploading featured image" description="Preparing primary blog media" />
                                    ) : (
                                        <p className="text-[15px] text-muted-foreground">Upload from your device.</p>
                                    )}
                                </div>
                            </div>
                            {media.featuredImageUrl ? <img src={media.featuredImageUrl} alt={media.featuredImageAlt || title || "Featured image"} className="h-52 w-full rounded-md border border-border/60 object-cover" /> : null}
                            <Input value={media.featuredImageAlt} onChange={(e) => setMedia((prev) => ({ ...prev, featuredImageAlt: e.target.value }))} placeholder="Alt text" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
