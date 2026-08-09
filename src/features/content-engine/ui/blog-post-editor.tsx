"use client";

import { useState, useTransition, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MarkdownSectionEditor } from "./markdown-section-editor";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { updateContentItem } from "../actions";
import { Save, Loader2, ImagePlus, Globe, RefreshCw, Eye, EyeOff, ExternalLink, BookOpen, ShieldCheck, AlertTriangle, ListChecks, Plus, Youtube, UploadCloud, Film, X, CheckCircle2, Sparkles } from "lucide-react";
import { PremiumInlinePending, PremiumPanelSkeleton } from "@/shared/ui/loading";
import { BlogSeoEnhanceButton } from "./blog-seo-enhance-button";
import { BlogRegenerateButton } from "./blog-regenerate-button";
import { HumanizeBlogButton } from "./humanize-blog-button";
import { ContentFreshnessBadge } from "./content-freshness-badge";
import { RepairEditorialButton } from "./repair-editorial-button";
import { BLOG_EDITORIAL_PUBLICATION_SCORE_FLOOR } from "../lib/blog-editorial-policy";
import { canonicalBlogHref } from "@/features/blog/urls";
import type { ContentVerificationStatus } from "@/features/content-engine/verify-freshness";
import { createUrlVideoShortcode, createYouTubeVideoShortcode, extractYouTubeVideoId } from "@/features/content-engine/lib/video-shortcodes";
import { getVisualEnrichment } from "@/features/content-engine/visual-enrichment";

interface StorageAsset {
    id: string;
    name: string;
    url: string;
    metadata: {
        size?: number;
        mimetype?: string;
    } | null;
    created_at: string;
}

interface BlogPostEditorNodeProps {
    initialData: {
        id: string;
        title: string;
        content_markdown: string;
        workspace_id?: string | null;
        status?: string;
        slug?: string;
        metadata?: Record<string, unknown>;
    };
}

interface EditorialDiagnosticsSummary {
    valid: boolean;
    issueCount: number;
    errorCount: number;
    warningCount: number;
    repairAttempts: number;
    repaired: boolean;
    overallScore: number | null;
    issues: Array<{
        code: string;
        severity: string;
        message: string;
    }>;
}

const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

type MediaDialog = "youtube" | "upload" | null;

function extractLastFreshnessCheck(metadata: Record<string, unknown> | undefined): {
    checked_at: string;
    verification_status: ContentVerificationStatus;
    stale_indicators?: string[];
} | null {
    const provenance = metadata?.provenance as Record<string, unknown> | undefined;
    const check = provenance?.last_freshness_check as
        | {
              checked_at: string;
              verification_status: ContentVerificationStatus;
              stale_indicators?: string[];
          }
        | undefined;
    if (!check?.checked_at || !check?.verification_status) return null;
    return check;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function extractEditorialDiagnostics(metadata: Record<string, unknown> | undefined): EditorialDiagnosticsSummary | null {
    const enrichment = asRecord(metadata?.enrichment);
    const validation = asRecord(enrichment?.editorial_validation);
    const scorecard = asRecord(enrichment?.editorial_scorecard);
    if (!validation && !scorecard) return null;

    const rawIssues = Array.isArray(validation?.issues) ? validation.issues : [];
    const issues = rawIssues
        .map((issue) => asRecord(issue))
        .filter((issue): issue is Record<string, unknown> => Boolean(issue))
        .map((issue) => ({
            code: typeof issue.code === "string" ? issue.code : "editorial_issue",
            severity: typeof issue.severity === "string" ? issue.severity : "info",
            message: typeof issue.message === "string" ? issue.message : "Editorial diagnostic recorded.",
        }))
        .slice(0, 5);

    const issueCount = typeof validation?.issue_count === "number" ? validation.issue_count : issues.length;
    const errorCount = typeof validation?.error_count === "number" ? validation.error_count : issues.filter((issue) => issue.severity === "error").length;
    const warningCount = typeof validation?.warning_count === "number" ? validation.warning_count : issues.filter((issue) => issue.severity === "warning").length;
    const overallScore = typeof scorecard?.overall === "number" ? scorecard.overall : null;
    const passed = typeof scorecard?.passed === "boolean" ? scorecard.passed : null;

    return {
        valid: typeof validation?.valid === "boolean" ? validation.valid : passed === true,
        issueCount,
        errorCount,
        warningCount,
        repairAttempts: typeof validation?.repair_attempts === "number" ? validation.repair_attempts : 0,
        repaired: validation?.repaired === true,
        overallScore,
        issues,
    };
}

export function BlogPostEditorNode({ initialData }: BlogPostEditorNodeProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [title, setTitle] = useState(initialData.title || "");
    const [content, setContent] = useState(initialData.content_markdown || "");
    const [status, setStatus] = useState(initialData.status || "draft");
    const [excerpt, setExcerpt] = useState<string>(() => {
        const raw = initialData.metadata?.excerpt;
        return typeof raw === "string" ? raw : "";
    });
    const [featuredImageUrl, setFeaturedImageUrl] = useState<string>(
        (initialData.metadata?.featured_image_url as string) || ""
    );
    const [seo, setSeo] = useState<{ title: string; description: string; keywords: string[] }>(() => {
        // Strategist-generated drafts may persist a partial seo object (e.g. only
        // `keywords` set). Fill missing keys so `seo.title.length` / `seo.description.length`
        // don't crash the render with "Cannot read properties of undefined (reading 'length')".
        const raw = (initialData.metadata?.seo ?? null) as Partial<{ title: string; description: string; keywords: string[] }> | null;
        return {
            title: typeof raw?.title === "string" ? raw.title : "",
            description: typeof raw?.description === "string" ? raw.description : "",
            keywords: Array.isArray(raw?.keywords) ? raw.keywords : [],
        };
    });
    const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>(() => {
        const raw = initialData.metadata?.faqs;
        return Array.isArray(raw) ? raw : [];
    });

    // Track the last successfully synced/saved database state so we can detect when an external API
    // (like AI humanize, SEO enhance, or Auto-Fix) updates the DB and triggers router.refresh().
    // This allows us to sync the new data into the editor without reverting unsaved user typing.
    const [lastSyncVersion, setLastSyncVersion] = useState(() => ({
        title: initialData.title || "",
        content: initialData.content_markdown || "",
        status: initialData.status || "draft",
        excerpt: typeof initialData.metadata?.excerpt === "string" ? initialData.metadata.excerpt : "",
        featuredImageUrl: (initialData.metadata?.featured_image_url as string) || "",
        seo: (() => {
            const raw = (initialData.metadata?.seo ?? null) as Partial<{ title: string; description: string; keywords: string[] }> | null;
            return {
                title: typeof raw?.title === "string" ? raw.title : "",
                description: typeof raw?.description === "string" ? raw.description : "",
                keywords: Array.isArray(raw?.keywords) ? raw.keywords : [],
            };
        })(),
        faqs: Array.isArray(initialData.metadata?.faqs) ? initialData.metadata.faqs : [],
    }));

    useEffect(() => {
        let updated = false;
        const newSync = { ...lastSyncVersion };

        const incomingTitle = initialData.title || "";
        if (incomingTitle !== lastSyncVersion.title) {
            setTitle(incomingTitle);
            newSync.title = incomingTitle;
            updated = true;
        }

        const incomingContent = initialData.content_markdown || "";
        if (incomingContent !== lastSyncVersion.content) {
            setContent(incomingContent);
            newSync.content = incomingContent;
            updated = true;
        }

        const incomingStatus = initialData.status || "draft";
        if (incomingStatus !== lastSyncVersion.status) {
            setStatus(incomingStatus);
            newSync.status = incomingStatus;
            updated = true;
        }

        const incomingExcerpt = typeof initialData.metadata?.excerpt === "string" ? initialData.metadata.excerpt : "";
        if (incomingExcerpt !== lastSyncVersion.excerpt) {
            setExcerpt(incomingExcerpt);
            newSync.excerpt = incomingExcerpt;
            updated = true;
        }

        const incomingFeaturedImage = (initialData.metadata?.featured_image_url as string) || "";
        if (incomingFeaturedImage !== lastSyncVersion.featuredImageUrl) {
            setFeaturedImageUrl(incomingFeaturedImage);
            newSync.featuredImageUrl = incomingFeaturedImage;
            updated = true;
        }

        const incomingSeoRaw = (initialData.metadata?.seo ?? null) as Partial<{ title: string; description: string; keywords: string[] }> | null;
        const incomingSeo = {
            title: typeof incomingSeoRaw?.title === "string" ? incomingSeoRaw.title : "",
            description: typeof incomingSeoRaw?.description === "string" ? incomingSeoRaw.description : "",
            keywords: Array.isArray(incomingSeoRaw?.keywords) ? incomingSeoRaw.keywords : [],
        };
        if (JSON.stringify(incomingSeo) !== JSON.stringify(lastSyncVersion.seo)) {
            setSeo(incomingSeo);
            newSync.seo = incomingSeo;
            updated = true;
        }

        const incomingFaqs = Array.isArray(initialData.metadata?.faqs) ? initialData.metadata.faqs : [];
        if (JSON.stringify(incomingFaqs) !== JSON.stringify(lastSyncVersion.faqs)) {
            setFaqs(incomingFaqs);
            newSync.faqs = incomingFaqs;
            updated = true;
        }

        if (updated) {
            setLastSyncVersion(newSync);
        }
    }, [initialData, lastSyncVersion]);
    const [error, setError] = useState<string | null>(null);
    const [isGeneratingFaq, setIsGeneratingFaq] = useState(false);
    const [mediaDialog, setMediaDialog] = useState<MediaDialog>(null);
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [youtubeTitle, setYoutubeTitle] = useState("");
    const [mediaError, setMediaError] = useState<string | null>(null);
    const [mediaNotice, setMediaNotice] = useState<string | null>(null);
    const [uploadTitle, setUploadTitle] = useState("");
    const [uploadPoster, setUploadPoster] = useState("");
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Asset injection — fetch from Supabase Storage
    const [storageAssets, setStorageAssets] = useState<StorageAsset[]>([]);
    const [isLoadingAssets, setIsLoadingAssets] = useState(true);

    const loadAssets = useCallback(async () => {
        setIsLoadingAssets(true);
        try {
            const res = await fetch(`/api/content/${initialData.id}/assets`);
            const data = await res.json();
            if (res.ok && data.assets) {
                setStorageAssets(data.assets);
            }
        } catch (err) {
            console.error("Failed to load assets from storage:", err);
        } finally {
            setIsLoadingAssets(false);
        }
    }, [initialData.id]);

    useEffect(() => {
        loadAssets();
    }, [loadAssets]);

    const handleGenerateFaq = async () => {
        setIsGeneratingFaq(true);
        try {
            const res = await fetch("/api/generate-node", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contentId: initialData.id,
                    nodeType: "faq_schema",
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to generate FAQ");
                return;
            }
            if (data.text?.faqs && Array.isArray(data.text.faqs)) {
                setFaqs(data.text.faqs);
                setError(null);
            } else {
                setError("No FAQs returned from the model.");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to generate FAQ");
        } finally {
            setIsGeneratingFaq(false);
        }
    };

    // Filter to image assets only for injection
    const imageAssets = storageAssets.filter((a) => {
        const mime = a.metadata?.mimetype || "";
        const name = a.name.toLowerCase();
        return mime.startsWith("image/") || name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".webp");
    });

    const handleSave = async () => {
        if (!title.trim()) {
            setError("Title is required");
            return;
        }

        setError(null);
        startTransition(async () => {
            const updatedMetadata = {
                ...initialData.metadata,
                seo,
                faqs,
                excerpt: excerpt || null,
                featured_image_url: featuredImageUrl || null,
            };
            const result = await updateContentItem(initialData.id, {
                title,
                content_markdown: content,
                status,
                metadata: updatedMetadata,
            });

            if (result.error) {
                setError(result.error);
            } else {
                setLastSyncVersion({
                    title,
                    content,
                    status,
                    excerpt: excerpt || "",
                    featuredImageUrl: featuredImageUrl || "",
                    seo,
                    faqs,
                });
                router.refresh();
            }
        });
    };

    const handleTogglePublish = () => {
        const newStatus = status === "published" ? "draft" : "published";
        startTransition(async () => {
            const result = await updateContentItem(initialData.id, { status: newStatus });
            if (!result.error) {
                setStatus(newStatus);
                setLastSyncVersion((prev) => ({ ...prev, status: newStatus }));
                router.refresh();
            } else {
                setError(result.error);
            }
        });
    };

    // Insert image as markdown syntax into the content
    const injectImage = (url: string, altText: string) => {
        const imageMarkdown = `\n\n![${altText}](${url})\n\n`;
        setContent((prev) => prev + imageMarkdown);
    };

    const appendMarkdownBlock = (markdown: string, notice: string) => {
        setContent((prev) => `${prev.trimEnd()}\n\n${markdown.trim()}\n`);
        setMediaNotice(notice);
        setMediaError(null);
    };

    const appendTextSection = () => {
        appendMarkdownBlock("## New section\n\n", "Text section added to the article body.");
    };

    const insertYouTubeVideo = () => {
        const id = extractYouTubeVideoId(youtubeUrl);
        if (!id) {
            setMediaError("Paste a valid YouTube URL or 11-character video ID.");
            return;
        }
        const titleText = youtubeTitle.trim() || title.trim() || "Embedded YouTube video";
        appendMarkdownBlock(createYouTubeVideoShortcode({ id, title: titleText }), "YouTube video embed inserted as a safe shortcode.");
        setYoutubeUrl("");
        setYoutubeTitle("");
        setMediaDialog(null);
    };

    async function uploadAndInsertVideo(file: File) {
        setMediaError(null);
        setMediaNotice(null);

        if (!initialData.workspace_id) {
            setMediaError("Missing workspace context for scoped video upload. Save or reload the article workspace, then try again.");
            return;
        }
        if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
            setMediaError(`Unsupported file type: ${file.type}. Use MP4, WebM, or MOV.`);
            return;
        }
        if (file.size > MAX_VIDEO_BYTES) {
            setMediaError(`File too large (${(file.size / 1024 / 1024).toFixed(0)}MB). Max 500MB.`);
            return;
        }

        try {
            setUploadProgress(0);
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
            const pathname = `videos/${initialData.workspace_id}/${Date.now()}-${safeName}`;
            const res = await fetch("/api/videos/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pathname, contentType: file.type, size: file.size }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to generate upload URL");

            const { uploadUrl, publicUrl } = json as { uploadUrl: string; publicUrl: string };
            const uploadBody = new FormData();
            uploadBody.append("cacheControl", "3600");
            uploadBody.append("", file);

            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("PUT", uploadUrl, true);
                xhr.setRequestHeader("x-upsert", "false");
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        setUploadProgress(Math.round((event.loaded / event.total) * 100));
                    }
                };
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) resolve();
                    else reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
                };
                xhr.onerror = () => reject(new Error("Network error during upload"));
                xhr.send(uploadBody);
            });

            const titleText = uploadTitle.trim() || file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
            appendMarkdownBlock(
                createUrlVideoShortcode({ src: publicUrl, title: titleText, poster: uploadPoster.trim() || undefined }),
                "Uploaded video inserted as a reusable article shortcode.",
            );
            setUploadTitle("");
            setUploadPoster("");
            setMediaDialog(null);
        } catch (err) {
            setMediaError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploadProgress(null);
        }
    }

    const isPublished = status === "published";
    const postSlug = initialData.slug || initialData.id;
    const editorialDiagnostics = extractEditorialDiagnostics(initialData.metadata);
    const visualBlocks = getVisualEnrichment(initialData.metadata).visual_blocks;

    return (
        <div className="flex min-w-0 flex-col gap-6">
            {/* Main Editor Section */}
            <div className="flex-1 space-y-4 flex flex-col min-w-0">
                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <h2 className="flex items-center gap-2 text-[23px] font-bold sm:text-[27px]">
                            <FileTextIcon className="h-6 w-6 text-primary" />
                            Core Article
                        </h2>
                    </div>
                    <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
                        {isPending ? <PremiumInlinePending label="Saving article" description="Syncing content + SEO" /> : null}
                        <ContentFreshnessBadge
                            contentId={initialData.id}
                            lastCheck={extractLastFreshnessCheck(initialData.metadata)}
                        />
                        <HumanizeBlogButton
                            contentId={initialData.id}
                            onApplied={() => router.refresh()}
                        />
                        <BlogSeoEnhanceButton
                            contentId={initialData.id}
                            onEnhancementApplied={() => router.refresh()}
                        />
                        {isPublished ? (
                            <BlogRegenerateButton
                                contentId={initialData.id}
                                onApplied={() => router.refresh()}
                            />
                        ) : null}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleTogglePublish}
                            disabled={isPending}
                            className="w-full sm:w-auto"
                        >
                            {isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            {isPublished ? "Unpublish" : "Publish"}
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={isPending} className="w-full min-w-0 sm:w-auto sm:min-w-[120px]">
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save changes
                        </Button>
                    </div>
                </div>

                {error && (
                    <div className="p-3 text-[17px] font-medium text-destructive bg-destructive/10 rounded-lg">
                        {error}
                    </div>
                )}

                <div className="space-y-4 rounded-md border border-border/50 bg-card p-4 shadow-sm sm:flex-1 sm:flex sm:min-h-0 sm:flex-col sm:p-6">
                    <div className="space-y-2">
                        <label htmlFor="title" className="text-[15px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                            H1 Headline
                        </label>
                        <Input
                            id="title"
                            placeholder="e.g., The Future of Vibe Coding..."
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="h-12 bg-background text-[21px] font-bold focus:ring-primary/20 sm:text-[23px]"
                        />
                    </div>

                    <div className="flex flex-col space-y-2 sm:min-h-[400px] sm:flex-1">
                        <div className="text-[15px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                            Content Body
                        </div>
                        <div className="rounded-2xl border border-slate-200/70 bg-slate-950 p-3 text-slate-100 shadow-sm dark:border-white/10">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200/80">Article blocks</p>
                                    <p className="mt-1 text-[13px] text-slate-400">Add structured text, privacy-safe embeds, or signed uploaded video without pasting raw HTML.</p>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-3 lg:w-auto">
                                    <Button type="button" variant="outline" size="sm" onClick={appendTextSection} className="border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/10 hover:text-white">
                                        <Plus className="h-3.5 w-3.5" /> Text section
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" onClick={() => { setMediaDialog("youtube"); setMediaError(null); }} className="border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/10 hover:text-white">
                                        <Youtube className="h-3.5 w-3.5" /> YouTube
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" onClick={() => { setMediaDialog("upload"); setMediaError(null); }} className="border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/10 hover:text-white">
                                        <UploadCloud className="h-3.5 w-3.5" /> Upload video
                                    </Button>
                                </div>
                            </div>
                            {(mediaNotice || mediaError) ? (
                                <div className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-[13px] ${mediaError ? "border-red-400/30 bg-red-500/10 text-red-200" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"}`}>
                                    {mediaError ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                                    <span>{mediaError || mediaNotice}</span>
                                </div>
                            ) : null}
                        </div>
                        <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
                            {isPending ? <PremiumPanelSkeleton className="min-h-[420px]" lines={10} /> : (
                                <MarkdownSectionEditor
                                    content={content}
                                    onChange={setContent}
                                    contentId={initialData.id}
                                    visualBlocks={visualBlocks}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Panels (Previously Right Sidebar) */}
            <div className="w-full grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-6 border-t border-border/50 pt-8 mt-6">
                {/* Publishing Panel */}
                <div className="bg-card p-5 rounded-md border shadow-sm space-y-4">
                    <h3 className="font-semibold text-[17px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Publishing
                    </h3>

                    {/* Status badge */}
                    <div className="flex items-center justify-between">
                        <span className="text-[15px] font-medium text-muted-foreground">Status</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[15px] font-semibold ${
                            isPublished
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-amber-500/10 text-amber-600"
                        }`}>
                            {isPublished ? "Published" : "Draft"}
                        </span>
                    </div>

                    {/* Slug */}
                    <div className="space-y-1.5">
                        <label className="text-[15px] font-medium text-foreground">URL Slug</label>
                        <div className="flex items-center gap-2">
                            <Input
                                value={postSlug}
                                readOnly
                                className="text-[15px] text-muted-foreground bg-muted/50 cursor-default"
                            />
                            {isPublished && (
                                <a
                                    href={canonicalBlogHref("en", `/blog/${postSlug}`)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0 p-2 rounded-md border border-border/50 hover:bg-muted transition-colors"
                                    title="View live post"
                                >
                                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                </a>
                            )}
                        </div>
                        <p className="text-[13px] text-muted-foreground">Slug is auto-generated from the title.</p>
                    </div>

                    {/* Excerpt */}
                    <div className="space-y-1.5">
                        <label className="text-[15px] font-medium text-foreground">Excerpt (max 200 chars)</label>
                        <Textarea
                            value={excerpt}
                            onChange={(e) => setExcerpt(e.target.value)}
                            placeholder="Short summary shown in blog listings..."
                            className="text-[17px] resize-none h-20"
                            maxLength={200}
                        />
                        <p className={`text-[13px] text-right ${excerpt.length > 200 ? "text-destructive font-medium" : "text-muted-foreground"}`}>{excerpt.length}/200</p>
                    </div>

                    {/* Featured Image URL */}
                    <div className="space-y-1.5">
                        <label className="text-[15px] font-medium text-foreground">Featured Image URL</label>
                        <Input
                            value={featuredImageUrl}
                            onChange={(e) => setFeaturedImageUrl(e.target.value)}
                            placeholder="https://... or paste from assets below"
                            className="text-[15px]"
                        />
                        {featuredImageUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                src={featuredImageUrl}
                                alt="Featured preview"
                                className="w-full h-24 object-cover rounded-lg border border-border/50 mt-2"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                        )}
                    </div>
                </div>

                {/* SEO Panel */}
                <div className="bg-card p-5 rounded-md border shadow-sm space-y-4">
                    <h3 className="font-semibold text-[17px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        SEO Metadata
                    </h3>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[15px] font-medium text-foreground">SEO Title (max 60 chars)</label>
                            <Input
                                value={seo.title}
                                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                                onChange={(e) => setSeo((prev: any) => ({ ...prev, title: e.target.value }))}
                                placeholder="Optimized title..."
                                className="text-[17px]"
                            />
                            <p className="text-[13px] text-muted-foreground text-right">{seo.title.length}/60</p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[15px] font-medium text-foreground">Meta Description (max 160 chars)</label>
                            <Textarea
                                value={seo.description}
                                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                                onChange={(e) => setSeo((prev: any) => ({ ...prev, description: e.target.value }))}
                                placeholder="Summary for search engines..."
                                className="text-[17px] resize-none h-24"
                            />
                            <p className="text-[13px] text-muted-foreground text-right">{seo.description.length}/160</p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[15px] font-medium text-foreground">Keywords (comma separated)</label>
                            <Input
                                value={seo.keywords?.join(", ") || ""}
                                onChange={(e) => {
                                    const kw = e.target.value.split(",").map((k: string) => k.trim()).filter(Boolean);
                                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                                    setSeo((prev: any) => ({ ...prev, keywords: kw }));
                                }}
                                placeholder="react, nextjs, ai..."
                                className="text-[17px]"
                            />
                        </div>
                    </div>
                </div>

                {/* FAQ Panel */}
                <div className="bg-card p-5 rounded-md border shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-[17px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            FAQ & Schema
                        </h3>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[13px] hover:text-foreground gap-1 bg-primary/5 border-primary/20 hover:bg-primary/10"
                                onClick={handleGenerateFaq}
                                disabled={isGeneratingFaq}
                            >
                                {isGeneratingFaq ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-primary" />}
                                Auto-Generate
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[13px] hover:text-foreground gap-1"
                                onClick={() => setFaqs(prev => [...prev, { question: "", answer: "" }])}
                            >
                                <Plus className="h-3 w-3" /> Add
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {faqs.length === 0 ? (
                            <p className="text-[14px] text-muted-foreground italic">No FAQs generated.</p>
                        ) : (
                            faqs.map((faq, idx) => (
                                <div key={idx} className="space-y-2 border border-border/50 rounded-md p-3 relative group">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-1 top-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => setFaqs(prev => prev.filter((_, i) => i !== idx))}
                                    >
                                        <X className="h-3 w-3 text-muted-foreground" />
                                    </Button>
                                    <Input
                                        value={faq.question}
                                        onChange={(e) => setFaqs(prev => {
                                            const n = [...prev];
                                            n[idx].question = e.target.value;
                                            return n;
                                        })}
                                        placeholder="Question"
                                        className="font-medium pr-8"
                                    />
                                    <Textarea
                                        value={faq.answer}
                                        onChange={(e) => setFaqs(prev => {
                                            const n = [...prev];
                                            n[idx].answer = e.target.value;
                                            return n;
                                        })}
                                        placeholder="Answer"
                                        className="h-20 resize-none text-[14px]"
                                    />
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {editorialDiagnostics ? (
                    <div className="bg-card p-5 rounded-md border shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-[17px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                {editorialDiagnostics.valid ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                                Editorial Diagnostics
                            </h3>
                            {(editorialDiagnostics.errorCount > 0
                                || (
                                    editorialDiagnostics.overallScore !== null
                                    && editorialDiagnostics.overallScore < BLOG_EDITORIAL_PUBLICATION_SCORE_FLOOR
                                )) && (
                                <RepairEditorialButton contentId={initialData.id} onApplied={() => router.refresh()} />
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-lg border bg-muted/30 p-2">
                                <p className="text-[13px] uppercase tracking-wide text-muted-foreground">Score</p>
                                <p className="text-[17px] font-semibold text-foreground">{editorialDiagnostics.overallScore ?? "—"}</p>
                            </div>
                            <div className="rounded-lg border bg-muted/30 p-2">
                                <p className="text-[13px] uppercase tracking-wide text-muted-foreground">Issues</p>
                                <p className="text-[17px] font-semibold text-foreground">{editorialDiagnostics.issueCount}</p>
                            </div>
                            <div className="rounded-lg border bg-muted/30 p-2">
                                <p className="text-[13px] uppercase tracking-wide text-muted-foreground">Repairs</p>
                                <p className="text-[17px] font-semibold text-foreground">{editorialDiagnostics.repairAttempts}</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 text-[14px] font-medium">
                            <span className={`rounded-full px-2 py-1 ${editorialDiagnostics.valid ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-700"}`}>
                                {editorialDiagnostics.valid ? "Validation passed" : "Needs review"}
                            </span>
                            <span className="rounded-full bg-destructive/10 px-2 py-1 text-destructive">{editorialDiagnostics.errorCount} errors</span>
                            <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-700">{editorialDiagnostics.warningCount} warnings</span>
                            {editorialDiagnostics.repaired ? <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">Auto-repaired</span> : null}
                        </div>

                        {editorialDiagnostics.issues.length > 0 ? (
                            <div className="space-y-2 border-t pt-3">
                                <p className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    <ListChecks className="h-3 w-3" /> Top diagnostics
                                </p>
                                <ul className="space-y-2">
                                    {editorialDiagnostics.issues.map((issue, index) => (
                                        <li key={`${issue.code}-${index}`} className="rounded-lg bg-muted/40 p-2 text-[15px] leading-relaxed">
                                            <span className="font-semibold text-foreground">{issue.code}</span>
                                            <span className="ml-1 text-muted-foreground">({issue.severity})</span>
                                            <p className="mt-1 text-muted-foreground">{issue.message}</p>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <p className="text-[15px] text-muted-foreground">No editorial issues were recorded for this draft.</p>
                        )}
                    </div>
                ) : null}

                {/* Asset Injection Panel */}
                <div className="bg-card p-5 rounded-md border shadow-sm space-y-4 flex flex-col max-h-[500px]">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-[17px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <ImagePlus className="h-4 w-4" />
                            Inject Assets
                        </h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[15px] text-muted-foreground hover:text-foreground gap-1"
                            onClick={loadAssets}
                            disabled={isLoadingAssets}
                        >
                            <RefreshCw className={`h-3 w-3 ${isLoadingAssets ? "animate-spin" : ""}`} />
                            Sync
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                        {isLoadingAssets ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : imageAssets.length > 0 ? (
                            imageAssets.map((asset) => {
                                const assetLabel = asset.name.split(".")[0].replace(/_/g, " ");
                                return (
                                    <div
                                        key={asset.id || asset.name}
                                        className="group relative rounded-lg overflow-hidden border bg-muted cursor-pointer transition-all hover:ring-2 ring-primary"
                                        onClick={() => injectImage(asset.url, assetLabel)}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={asset.url}
                                            alt={assetLabel}
                                            className="w-full h-32 object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <div className="bg-background/90 text-foreground text-[15px] font-bold px-3 py-1.5 rounded flex items-center gap-2">
                                                <ImagePlus className="h-3 w-3" /> Insert as Markdown
                                            </div>
                                        </div>
                                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[13px] px-2 py-0.5 rounded uppercase font-semibold">
                                            {assetLabel}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-8 text-[17px] text-muted-foreground border-2 border-dashed rounded-lg">
                                No images found in storage yet.
                                <p className="text-[15px] mt-1 text-muted-foreground/70">Generate assets from the Asset Library tab first.</p>
                            </div>
                        )}
                    </div>
                    <p className="text-[15px] text-muted-foreground">Click an image to append it as markdown, or copy its URL into the Featured Image field above.</p>
                </div>
            </div>

            {mediaDialog ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="article-media-dialog-title"
                    className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
                    onClick={(event) => {
                        if (event.target === event.currentTarget && uploadProgress === null) setMediaDialog(null);
                    }}
                >
                    <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-slate-950 text-slate-100 shadow-2xl">
                        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
                            <div className="flex items-start gap-3">
                                <div className="rounded-xl bg-cyan-400/15 p-2 text-cyan-200">
                                    {mediaDialog === "youtube" ? <Youtube className="h-5 w-5" /> : <Film className="h-5 w-5" />}
                                </div>
                                <div>
                                    <h3 id="article-media-dialog-title" className="text-[17px] font-semibold">
                                        {mediaDialog === "youtube" ? "Insert YouTube embed" : "Upload video block"}
                                    </h3>
                                    <p className="mt-1 text-[13px] text-slate-400">
                                        Stored as canonical shortcode. Rendering normalizes YouTube to youtube-nocookie.
                                    </p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setMediaDialog(null)} disabled={uploadProgress !== null} className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-40" aria-label="Close media dialog">
                                <X className="h-4 w-4" />
                            </button>
                        </header>

                        <div className="space-y-4 px-5 py-5">
                            {mediaDialog === "youtube" ? (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">YouTube URL or ID</label>
                                        <Input value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="border-white/10 bg-white/[0.04] text-slate-100 placeholder:text-slate-500" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">Accessible title</label>
                                        <Input value={youtubeTitle} onChange={(event) => setYoutubeTitle(event.target.value)} placeholder="What this video explains" className="border-white/10 bg-white/[0.04] text-slate-100 placeholder:text-slate-500" />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">Video title</label>
                                        <Input value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} placeholder="Demo, explainer, or walkthrough title" className="border-white/10 bg-white/[0.04] text-slate-100 placeholder:text-slate-500" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">Poster URL (optional)</label>
                                        <Input value={uploadPoster} onChange={(event) => setUploadPoster(event.target.value)} placeholder="https://..." className="border-white/10 bg-white/[0.04] text-slate-100 placeholder:text-slate-500" />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploadProgress !== null}
                                        className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.03] px-6 py-10 text-sm text-slate-300 transition hover:border-cyan-300/50 hover:bg-cyan-300/5 hover:text-white disabled:opacity-60"
                                    >
                                        {uploadProgress !== null ? (
                                            <>
                                                <Loader2 className="h-6 w-6 animate-spin text-cyan-200" />
                                                <span>Uploading through signed storage route… {uploadProgress}%</span>
                                            </>
                                        ) : (
                                            <>
                                                <UploadCloud className="h-6 w-6 text-cyan-200" />
                                                <span>Choose MP4, WebM, or MOV (max 500MB)</span>
                                            </>
                                        )}
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept={ALLOWED_VIDEO_TYPES.join(",")}
                                        className="hidden"
                                        onChange={(event) => {
                                            const file = event.target.files?.[0];
                                            if (file) void uploadAndInsertVideo(file);
                                            event.target.value = "";
                                        }}
                                    />
                                </>
                            )}

                            {mediaError ? (
                                <div className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-200">
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <span>{mediaError}</span>
                                </div>
                            ) : null}
                        </div>

                        <footer className="flex items-center justify-between gap-3 border-t border-white/10 bg-white/[0.02] px-5 py-4">
                            <p className="text-[12px] text-slate-500">No raw iframe or HTML is stored in the article.</p>
                            <div className="flex items-center gap-2">
                                <Button type="button" variant="ghost" onClick={() => setMediaDialog(null)} disabled={uploadProgress !== null} className="text-slate-300 hover:bg-white/5 hover:text-white">Cancel</Button>
                                {mediaDialog === "youtube" ? (
                                    <Button type="button" onClick={insertYouTubeVideo} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
                                        <Youtube className="mr-2 h-4 w-4" /> Insert embed
                                    </Button>
                                ) : null}
                            </div>
                        </footer>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

// Quick helper
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function FileTextIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M10 9H8" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
        </svg>
    );
}
