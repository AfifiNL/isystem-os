import { Copy, Video, PlayCircle, MessageSquare, Linkedin, Twitter, Instagram, Image as ImageIcon, Check, Loader2, Mic, Mail, Send, AlertCircle } from "lucide-react";
import { Textarea } from "@/shared/ui/textarea";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/shared/ui/button";
import { ProBadge } from "@/shared/ui/pro-badge";
import { createCampaignFromContentInlineAction } from "@/features/newsletter/actions";

interface StructuredNodeViewerProps {
    nodeId: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>;
    contentId?: string;
    aiGenerationEnabled?: boolean;
}

export function StructuredNodeViewer({ nodeId, data, contentId, aiGenerationEnabled = true }: StructuredNodeViewerProps) {
    const [generatingScenes, setGeneratingScenes] = useState<Record<number, boolean>>({});
    const [editedDialogues, setEditedDialogues] = useState<Record<number, string>>({});
    // We'll maintain a local state for the audio URLs to optimistically show them without requiring a full page refresh
    const [sceneAudio, setSceneAudio] = useState<Record<number, string>>(() => {
        if (!data?.assets?.video_voiceover_scenes) return {};
        return (data.assets.video_voiceover_scenes as Array<{ url?: string }>).reduce(
            (acc: Record<number, string>, scene, idx) => {
                if (scene?.url) acc[idx] = scene.url;
                return acc;
            },
            {}
        );
    });

    if (!data || typeof data !== "object") {
        return (
            <div className="flex items-center justify-center p-8 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/20">
                <p>No structured data available for preview.</p>
            </div>
        );
    }

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch { /* clipboard API may fail */ }
    };

    const CopyButton = ({ text }: { text: string }) => {
        const [copied, setCopied] = useState(false);
        const handleCopy = () => {
            copyToClipboard(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        };
        return (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={handleCopy}>
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </Button>
        );
    };

    const handleGenerateVoiceover = async (sceneIndex: number) => {
        if (!contentId || !aiGenerationEnabled) return;
        setGeneratingScenes(prev => ({ ...prev, [sceneIndex]: true }));
        try {
            const body = editedDialogues[sceneIndex] !== undefined
                ? JSON.stringify({ editedDialogue: editedDialogues[sceneIndex] })
                : "{}";

            const res = await fetch(`/api/content/${contentId}/voiceover?sceneIndex=${sceneIndex}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body
            });
            if (res.ok) {
                const json = await res.json();
                if (json.url) {
                    setSceneAudio(prev => ({ ...prev, [sceneIndex]: json.url }));
                }
            } else {
                console.error("Failed to generate voiceover for scene", sceneIndex);
            }
        } catch (err) {
            console.error("Network error generating voiceover:", err);
        } finally {
            setGeneratingScenes(prev => ({ ...prev, [sceneIndex]: false }));
        }
    };

    if (nodeId === "video_script" && data.scenes) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-500/10 p-2 rounded-lg">
                            <Video className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">{data.title || "Video Script"}</h3>
                            <p className="text-xs text-muted-foreground">{data.scenes.length} Scenes Documented</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {data.scenes.map((scene: any, idx: number) => {
                        const isGenerating = generatingScenes[idx];
                        const audioUrl = sceneAudio[idx];
                        const hasDialogue = !!scene.dialogue;

                        return (
                            <div key={idx} className="bg-card border shadow-sm rounded-xl overflow-hidden group">
                                <div className="bg-muted/50 px-4 py-2 border-b flex justify-between items-center">
                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                        <PlayCircle className="w-4 h-4 text-primary" />
                                        Scene {scene.scene_number || idx + 1}
                                    </span>
                                    {scene.estimated_seconds && (
                                        <span className="bg-background border rounded px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                            ~{scene.estimated_seconds} sec
                                        </span>
                                    )}
                                </div>
                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5 border-b pb-1">
                                            <ImageIcon className="w-3 h-3" /> Visuals
                                        </h4>
                                        <p className="text-sm italic text-foreground/80 leading-relaxed font-serif">
                                            {scene.visuals}
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between border-b pb-1">
                                            <h4 className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
                                                <MessageSquare className="w-3 h-3" /> Dialogue / Voiceover
                                            </h4>
                                            <div className="flex items-center gap-2">
                                                {contentId && hasDialogue && (
                                                    <Button
                                                        onClick={() => handleGenerateVoiceover(idx)}
                                                        disabled={isGenerating || !aiGenerationEnabled}
                                                        variant="outline"
                                                        className="h-6 px-2 text-[10px] gap-1 shrink-0"
                                                    >
                                                        {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mic className="w-3 h-3" />}
                                                        {audioUrl ? "Regenerate" : "Generate"}
                                                        {!aiGenerationEnabled ? <ProBadge className="ml-1" /> : null}
                                                    </Button>
                                                )}
                                                <CopyButton text={editedDialogues[idx] !== undefined ? editedDialogues[idx] : (scene.dialogue || "")} />
                                            </div>
                                        </div>
                                        <Textarea
                                            value={editedDialogues[idx] !== undefined ? editedDialogues[idx] : (scene.dialogue || "")}
                                            onChange={(e) => setEditedDialogues(prev => ({ ...prev, [idx]: e.target.value }))}
                                            className="text-sm font-medium text-foreground leading-relaxed min-h-[100px] mt-2 resize-y bg-transparent"
                                        />

                                        {audioUrl && (
                                            <div className="mt-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg p-2 border border-indigo-100 dark:border-indigo-900/50">
                                                <audio controls src={audioUrl} className="w-full h-8" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    if (nodeId === "social_linkedin" && data.posts) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b">
                    <div className="bg-blue-600/10 p-2 rounded-lg">
                        <Linkedin className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">LinkedIn Posts</h3>
                        <p className="text-xs text-muted-foreground">{data.posts.length} Variations Generated</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {data.posts.map((post: any, idx: number) => {
                        const fullText = `${post.hook}\n\n${post.body}\n\n${post.cta}\n\n${(post.hashtags || []).map((h: string) => h.startsWith('#') ? h : `#${h}`).join(" ")}`;

                        return (
                            <div key={idx} className="bg-card border shadow-sm rounded-xl p-5 space-y-4">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Variation {idx + 1}</span>
                                    <CopyButton text={fullText} />
                                </div>
                                <div className="space-y-3">
                                    <p className="text-sm font-bold text-foreground leading-relaxed bg-primary/5 p-2 rounded-md border-l-2 border-primary">
                                        {post.hook}
                                    </p>
                                    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                        {post.body}
                                    </p>
                                    <p className="text-sm font-medium italic text-foreground/80">
                                        {post.cta}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5 pt-2">
                                        {(post.hashtags || []).map((t: string, i: number) => (
                                            <span key={i} className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full dark:bg-blue-900/30 dark:text-blue-400">
                                                {t.startsWith('#') ? t : `#${t}`}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        );
    }

    if (nodeId === "social_twitter" && data.thread) {
        return (
            <div className="space-y-6 max-w-2xl mx-auto">
                <div className="flex items-center gap-3 pb-4 border-b">
                    <div className="bg-sky-500/10 p-2 rounded-lg">
                        <Twitter className="w-6 h-6 text-sky-500" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">X (Twitter) Thread</h3>
                        <p className="text-xs text-muted-foreground">{data.thread.length} Tweets in sequence</p>
                    </div>
                </div>

                <div className="space-y-4 relative">
                    <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-border -z-10"></div>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {data.thread.map((tweet: any, idx: number) => (
                        <div key={idx} className="flex gap-4 group">
                            <div className="w-12 h-12 rounded-full border-2 border-background bg-muted text-muted-foreground flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm z-10">
                                {tweet.position || idx + 1}/{data.thread.length}
                            </div>
                            <div className="bg-card border shadow-sm rounded-2xl rounded-tl-sm p-4 flex-1 space-y-3">
                                <div className="flex justify-between items-start mb-1">
                                    <Twitter className="w-4 h-4 text-sky-500 opacity-50" />
                                    <CopyButton text={tweet.text || ""} />
                                </div>
                                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                    {tweet.text}
                                </p>
                                <div className="text-right">
                                    <span className={`text-[10px] font-bold ${(!tweet.text || tweet.text.length > 280) ? 'text-destructive' : 'text-muted-foreground/50'}`}>
                                        {tweet.text?.length || 0}/280
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (nodeId === "social_instagram" && data.variations) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b">
                    <div className="bg-pink-600/10 p-2 rounded-lg">
                        <Instagram className="w-6 h-6 text-pink-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">Instagram Content</h3>
                        <p className="text-xs text-muted-foreground">{data.variations.length} Carousel/Caption Concepts</p>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {data.variations.map((variation: any, idx: number) => {
                        const fullCaption = `${variation.caption}\n\n${(variation.hashtags || []).map((h: string) => h.startsWith('#') ? h : `#${h}`).join(" ")}`;

                        return (
                            <div key={idx} className="bg-card border shadow-sm rounded-xl overflow-hidden">
                                <div className="bg-muted/50 p-4 border-b flex justify-between items-center">
                                    <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Carousel Concept {idx + 1}</span>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2">
                                    <div className="p-5 border-b lg:border-b-0 lg:border-r space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                                                <MessageSquare className="w-3 h-3" /> Core Caption
                                            </h4>
                                            <CopyButton text={fullCaption} />
                                        </div>
                                        <p className="text-sm whitespace-pre-wrap text-foreground/90 leading-relaxed">
                                            {variation.caption}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5 pt-2">
                                            {(variation.hashtags || []).map((t: string, i: number) => (
                                                <span key={i} className="text-[10px] font-medium text-pink-700 bg-pink-100 px-2 py-0.5 rounded-full dark:bg-pink-900/30 dark:text-pink-400">
                                                    {t.startsWith('#') ? t : `#${t}`}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="p-5 bg-muted/10 space-y-4">
                                        <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2 mb-3">
                                            <ImageIcon className="w-3 h-3" /> Carousel Slides ({variation.slides?.length || 0})
                                        </h4>
                                        <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                            {(variation.slides || []).map((slide: any, sIdx: number) => (
                                                <div key={sIdx} className="snap-center shrink-0 w-[240px] aspect-square rounded-xl border-2 border-dashed border-primary/20 bg-background flex flex-col items-center justify-center p-4 text-center relative overflow-hidden group hover:border-primary/50 transition-colors shadow-sm">
                                                    <div className="absolute top-2 left-2 bg-muted/80 backdrop-blur text-[10px] font-bold px-1.5 py-0.5 rounded text-muted-foreground border">
                                                        {slide.slide_number || sIdx + 1}
                                                    </div>
                                                    <p className="text-sm font-bold text-foreground mb-3 font-serif">
                                                        {slide.text}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground/80 italic w-full">
                                                        🎨 {slide.visual_idea}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        );
    }

    if (nodeId === "newsletter_issue" && typeof data.subject === "string") {
        return (
            <NewsletterIssueViewer
                data={data as { subject: string; preheader: string; body_markdown: string; cta_label: string; cta_url: string }}
                contentId={contentId}
                CopyButton={CopyButton}
            />
        );
    }

    // Fallback: A nice recursive JSON renderer for any other unhandled schema outputs
    return (
        <div className="bg-card rounded-xl border overflow-hidden">
            <div className="bg-muted p-3 border-b flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{nodeId.replace(/_/g, " ")} DATA</span>
                <CopyButton text={JSON.stringify(data, null, 2)} />
            </div>
            <pre className="p-4 text-xs font-mono overflow-auto max-h-[600px] text-foreground/80 leading-relaxed bg-background">
                {JSON.stringify(data, null, 2)}
            </pre>
        </div>
    );
}

interface NewsletterIssueData {
    subject: string;
    preheader: string;
    body_markdown: string;
    cta_label: string;
    cta_url: string;
}

function NewsletterIssueViewer({
    data,
    contentId,
    CopyButton,
}: {
    data: NewsletterIssueData;
    contentId?: string;
    CopyButton: React.FC<{ text: string }>;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const fullEmail = `${data.subject}\n${data.preheader}\n\n${data.body_markdown}\n\n${data.cta_label}: ${data.cta_url}`;

    const handleCreateCampaign = () => {
        if (!contentId) {
            setError("Save the content item before creating a campaign.");
            return;
        }
        setError(null);
        startTransition(async () => {
            const result = await createCampaignFromContentInlineAction(contentId);
            if (result.error) {
                setError(result.error);
                return;
            }
            router.push("/dashboard/newsletter?created=1");
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600/10 p-2 rounded-lg">
                        <Mail className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">Newsletter Issue</h3>
                        <p className="text-xs text-muted-foreground">Ready to convert into a Newsletter Control Center campaign.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <CopyButton text={fullEmail} />
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleCreateCampaign}
                        disabled={pending || !contentId}
                    >
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Create campaign in Newsletter
                    </Button>
                </div>
            </div>

            {error ? (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{error}</span>
                </div>
            ) : null}

            <div className="rounded-xl border bg-card overflow-hidden">
                <div className="border-b bg-muted/30 px-4 py-2 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subject</span>
                    <span className="text-[10px] text-muted-foreground">{data.subject.length}/80</span>
                </div>
                <div className="px-4 py-3 text-sm font-semibold text-foreground">{data.subject}</div>
            </div>

            <div className="rounded-xl border bg-card overflow-hidden">
                <div className="border-b bg-muted/30 px-4 py-2 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Preheader</span>
                    <span className="text-[10px] text-muted-foreground">{data.preheader.length}/120</span>
                </div>
                <div className="px-4 py-3 text-sm text-foreground/80">{data.preheader}</div>
            </div>

            <div className="rounded-xl border bg-card overflow-hidden">
                <div className="border-b bg-muted/30 px-4 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Body</span>
                </div>
                <article className="prose prose-sm dark:prose-invert max-w-none px-5 py-4 prose-p:leading-relaxed prose-p:text-foreground/85 prose-headings:font-bold prose-a:text-primary prose-strong:text-foreground">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.body_markdown}</ReactMarkdown>
                </article>
            </div>

            <div className="rounded-xl border bg-card overflow-hidden">
                <div className="border-b bg-muted/30 px-4 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Call to action</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <a
                        href={data.cta_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                    >
                        {data.cta_label}
                    </a>
                    <span className="text-xs text-muted-foreground truncate max-w-[60%]" title={data.cta_url}>
                        {data.cta_url}
                    </span>
                </div>
            </div>
        </div>
    );
}
