"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RichTextEditor } from "./editor";
import { richTextHtmlToPlainText, normalizeRichTextInput } from "@/features/content-engine/lib/rich-text";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Pencil, Check, X, ChevronDown, ChevronRight, ShieldCheck, Loader2, Plus } from "lucide-react";
import { splitMarkdownByVideoShortcodes } from "@/features/content-engine/lib/video-shortcodes";
import { BlogVideoEmbed } from "./blog-video-embed";
import { BlogMarkdownWithVisuals } from "./blog-markdown-with-visuals";
import type { BlogVisualBlock } from "@/features/content-engine/visual-enrichment";

interface MarkdownSection {
    id: number;
    heading: string;
    level: number;
    rawContent: string;
}

interface MarkdownSectionEditorProps {
    content: string;
    onChange: (markdown: string) => void;
    /**
     * Content item id. When supplied, each H2+ section gets a "Humanize"
     * button that calls the per-section humanize endpoint and updates the
     * editor with the rewritten section spliced back into the article.
     * Omitted in flows where the editor renders read-only or detached
     * markdown (no DB-backed content item).
     */
    contentId?: string;
    visualBlocks?: BlogVisualBlock[];
}

/**
 * Normalizes escaped newlines (\\n) into actual newlines
 * since content from the DB may be stored with literal backslash-n.
 */
function normalizeContent(raw: string): string {
    // Replace literal \\n (escaped newline) with actual newlines
    return raw.replace(/\\n/g, "\n");
}

/**
 * Splits markdown content into sections based on ## headings.
 * The first section (before any ## heading) is the "intro".
 */
function parseMarkdownSections(markdown: string): MarkdownSection[] {
    const normalized = normalizeContent(markdown);
    const lines = normalized.split("\n");
    const sections: MarkdownSection[] = [];
    let currentSection: MarkdownSection | null = null;
    let sectionId = 0;

    for (const line of lines) {
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

        if (headingMatch) {
            const level = headingMatch[1].length;

            // Skip H1 headings entirely — they duplicate the title field
            if (level === 1) {
                continue;
            }

            // Split on h2+ headings
            if (level >= 2) {
                // Push previous section
                if (currentSection) {
                    sections.push(currentSection);
                }
                currentSection = {
                    id: sectionId++,
                    heading: headingMatch[2].trim(),
                    level,
                    // Store the full heading line in rawContent for editing,
                    // but we'll strip it from the rendered preview
                    rawContent: line + "\n",
                };
                continue;
            }
        }

        if (currentSection) {
            currentSection.rawContent += line + "\n";
        } else {
            // Intro section (before any ## heading)
            if (!currentSection) {
                currentSection = {
                    id: sectionId++,
                    heading: "Introduction",
                    level: 0,
                    rawContent: line + "\n",
                };
            }
        }
    }

    if (currentSection) {
        sections.push(currentSection);
    }

    // If there are no sections at all, create one with all content
    if (sections.length === 0) {
        sections.push({
            id: 0,
            heading: "Content",
            level: 0,
            rawContent: normalized,
        });
    }

    return sections;
}

/**
 * Returns the content of a section for rendering, stripping the leading heading
 * since the heading is already displayed in the section header bar.
 */
function getDisplayContent(section: MarkdownSection): string {
    const content = section.rawContent.trim();
    if (section.level >= 2) {
        // Remove the first line if it matches the section heading
        const lines = content.split("\n");
        if (lines[0]?.match(/^#{2,6}\s+/)) {
            return lines.slice(1).join("\n").trim();
        }
    }
    return content;
}

/**
 * Reassembles sections into a single markdown string.
 */
function reassembleSections(sections: MarkdownSection[]): string {
    return sections.map((s) => s.rawContent.trimEnd()).join("\n\n") + "\n";
}

export function MarkdownSectionEditor({ content, onChange, contentId, visualBlocks = [] }: MarkdownSectionEditorProps) {
    const sections = useMemo(() => parseMarkdownSections(content), [content]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editBuffer, setEditBuffer] = useState("");
    // Per-section humanize state. Keyed by section heading so the spinner
    // and error message stay attached to the right card even if the
    // section list re-renders.
    const [humanizingHeading, setHumanizingHeading] = useState<string | null>(null);
    const [humanizeError, setHumanizeError] = useState<{ heading: string; message: string } | null>(null);

    async function handleHumanizeSection(section: MarkdownSection) {
        if (!contentId || section.level < 2) return;
        const headingText = section.heading;
        setHumanizeError(null);
        setHumanizingHeading(headingText);
        try {
            // Apply directly — the rewrite is bounded to one section and the
            // server validates that the H2 line and shortcodes survive. If
            // the operator wants a preview-first flow they still have the
            // article-level Humanize button at the top of the editor.
            const res = await fetch(`/api/humanize-blog/${contentId}?apply=true`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sectionHeading: headingText }),
            });
            const data = await res.json();
            if (!res.ok) {
                setHumanizeError({ heading: headingText, message: data.error ?? "Humanize failed." });
                return;
            }
            // The server already wrote the change to content_items. Reflect
            // it in the editor immediately by passing the new full markdown
            // up to the parent — saves the operator a refresh and a save.
            if (typeof data.revisedFullMarkdown === "string" && data.revisedFullMarkdown.length > 0) {
                onChange(data.revisedFullMarkdown);
            }
        } catch (err) {
            setHumanizeError({
                heading: headingText,
                message: err instanceof Error ? err.message : "Network error.",
            });
        } finally {
            setHumanizingHeading(null);
        }
    }
    // Heading edits are tracked separately because they live in the section
    // header bar (above the body editor) and need their own controlled state.
    // Previously the heading was rendered as a read-only span and re-prepended
    // verbatim on save, making H2/H3/H4 text structurally uneditable.
    const [headingDraft, setHeadingDraft] = useState("");
    const [levelDraft, setLevelDraft] = useState<number>(2);
    const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());

    const handleStartEdit = useCallback((section: MarkdownSection) => {
        setEditingId(section.id);
        // Strip the heading line from the buffer — the heading is edited via
        // its own input, not in the body editor. We re-prepend on save.
        const bodyOnly = section.level >= 2
            ? section.rawContent.replace(/^#{2,6}\s+[^\n]*\n?/, "").trimEnd()
            : section.rawContent.trimEnd();
        setEditBuffer(bodyOnly);
        setHeadingDraft(section.heading);
        // Default level: keep current if it's already a heading; otherwise
        // promote an "intro / content" section to H2 if the operator wants
        // to add a heading to it.
        setLevelDraft(section.level >= 2 ? section.level : 2);
    }, []);

    const handleCancelEdit = useCallback(() => {
        setEditingId(null);
        setEditBuffer("");
        setHeadingDraft("");
    }, []);

    const handleSaveEdit = useCallback((sectionId: number) => {
        const updatedSections = sections.map((s) => {
            if (s.id !== sectionId) return s;
            const trimmedHeading = headingDraft.trim();
            const level = Math.min(Math.max(levelDraft, 2), 6);
            // Reconstruct: heading line (if present) + blank line + body.
            // Intro / Content pseudo-sections (level 0) keep their headingless
            // body unless the operator typed a heading AND the section had
            // started with a real heading. We only emit a heading line when
            // the original section actually had one (s.level >= 2); promoting
            // an intro to a heading would corrupt the article structure on
            // save by adding spurious H2s above the lede.
            const headingLine = s.level >= 2 && trimmedHeading
                ? `${"#".repeat(level)} ${trimmedHeading}\n\n`
                : "";
            return {
                ...s,
                heading: s.level >= 2 ? (trimmedHeading || s.heading) : s.heading,
                level: s.level >= 2 ? level : s.level,
                rawContent: `${headingLine}${editBuffer.trimEnd()}\n`,
            };
        });
        onChange(reassembleSections(updatedSections));
        setEditingId(null);
        setEditBuffer("");
        setHeadingDraft("");
    }, [sections, editBuffer, headingDraft, levelDraft, onChange]);

    // Sync drafts when the editing target changes (e.g. user clicks Edit on
    // a different section without saving the previous one).
    useEffect(() => {
        if (editingId === null) return;
        const target = sections.find((s) => s.id === editingId);
        if (!target) {
            setEditingId(null);
            setEditBuffer("");
            setHeadingDraft("");
        }
    }, [editingId, sections]);

    /**
     * Insert a new empty H2 section at `position`. `position` is the section
     * index AFTER which the new section is inserted; pass `sections.length`
     * to append at the end. The new section is auto-opened in edit mode so
     * the operator can type a heading immediately.
     */
    const handleAddSection = useCallback((position: number) => {
        const updated = sections.map((s) => ({ ...s }));
        const newRaw = `## New section\n\n`;
        const newSection: MarkdownSection = {
            id: -1, // temporary; will be reassigned by parseMarkdownSections on next render
            heading: "New section",
            level: 2,
            rawContent: newRaw,
        };
        updated.splice(position, 0, newSection);
        const nextMarkdown = reassembleSections(updated);
        onChange(nextMarkdown);
        // Re-parse to get the assigned id, then open the new section in edit mode.
        // Defer to next tick so the parent re-renders with the new content first.
        setTimeout(() => {
            const reparsed = parseMarkdownSections(nextMarkdown);
            const inserted = reparsed[position];
            if (inserted) {
                setEditingId(inserted.id);
                setEditBuffer("");
                setHeadingDraft(inserted.heading);
                setLevelDraft(2);
            }
        }, 0);
    }, [sections, onChange]);

    const toggleCollapse = useCallback((sectionId: number) => {
        setCollapsedSections((prev) => {
            const next = new Set(prev);
            if (next.has(sectionId)) {
                next.delete(sectionId);
            } else {
                next.add(sectionId);
            }
            return next;
        });
    }, []);

    if (!content || content.trim() === "") {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground border-2 border-dashed rounded-xl p-12 gap-3">
                <p className="text-sm">No content yet. Use the AI generator or start writing.</p>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddSection(0)}
                    className="gap-1.5"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add first section
                </Button>
            </div>
        );
    }

    return (
        <div className="min-w-0 space-y-3">
            {sections.map((section, idx) => {
                const isEditing = editingId === section.id;
                const isCollapsed = collapsedSections.has(section.id);

                return (
                    <div key={section.id} className="min-w-0 space-y-3">
                    {/* Inter-section insert affordance — hidden until the row
                        is hovered to keep the editor visually quiet. Skips
                        rendering above the very first section since an
                        operator can use the bottom "Add section" button or
                        the section's own "Add section above" handle when we
                        add one later. For now the inter-section button
                        inserts BEFORE this section. */}
                    {idx > 0 ? (
                        <div className="group/insert flex items-center justify-center -my-1.5">
                            <button
                                onClick={() => handleAddSection(idx)}
                                className="opacity-0 group-hover/insert:opacity-100 transition-opacity flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium"
                                title="Insert a new section here"
                            >
                                <Plus className="h-3 w-3" />
                                Add section here
                            </button>
                        </div>
                    ) : null}
                    <div
                        className="group min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-border"
                    >
                        {/* Section Header */}
                        <div className="flex min-w-0 flex-col gap-2 border-b border-border/40 bg-muted/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4">
                            <div className="flex flex-1 min-w-0 items-center gap-2">
                                <button
                                    onClick={() => toggleCollapse(section.id)}
                                    className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label={isCollapsed ? "Expand section" : "Collapse section"}
                                >
                                    {isCollapsed ? (
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    ) : (
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    )}
                                </button>
                                {isEditing && section.level >= 2 ? (
                                    <>
                                        <select
                                            value={levelDraft}
                                            onChange={(e) => setLevelDraft(Number(e.target.value))}
                                            className="h-7 text-[11px] font-bold text-foreground uppercase tracking-wider bg-background border border-border/60 rounded px-1.5"
                                            aria-label="Heading level"
                                        >
                                            <option value={2}>H2</option>
                                            <option value={3}>H3</option>
                                            <option value={4}>H4</option>
                                            <option value={5}>H5</option>
                                            <option value={6}>H6</option>
                                        </select>
                                        <Input
                                            value={headingDraft}
                                            onChange={(e) => setHeadingDraft(e.target.value)}
                                            placeholder="Heading text"
                                            className="h-8 text-sm font-semibold flex-1 min-w-0 bg-background"
                                            autoFocus
                                        />
                                    </>
                                ) : (
                                    <button
                                        onClick={() => toggleCollapse(section.id)}
                                        className="flex items-center gap-2 text-sm font-semibold text-foreground/80 hover:text-foreground transition-colors text-left truncate"
                                    >
                                        {section.level > 0 ? (
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded shrink-0">
                                                H{section.level}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">
                                                Intro
                                            </span>
                                        )}
                                        <span className="truncate">{section.heading}</span>
                                    </button>
                                )}
                            </div>
                            <div className="grid w-full shrink-0 grid-cols-2 gap-1 sm:flex sm:w-auto sm:items-center">
                                {isEditing ? (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                                            onClick={() => handleSaveEdit(section.id)}
                                        >
                                            <Check className="h-3 w-3" /> Done
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive"
                                            onClick={handleCancelEdit}
                                        >
                                            <X className="h-3 w-3" /> Cancel
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        {contentId && section.level >= 2 ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={humanizingHeading === section.heading}
                                                className="h-7 text-xs gap-1 opacity-100 transition-opacity text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 disabled:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                                onClick={() => handleHumanizeSection(section)}
                                                title="Run humanize pass on this section only — preserves the heading and shortcodes."
                                            >
                                                {humanizingHeading === section.heading ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <ShieldCheck className="h-3 w-3" />
                                                )}
                                                {humanizingHeading === section.heading ? "Humanizing…" : "Humanize"}
                                            </Button>
                                        ) : null}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs gap-1 opacity-100 transition-opacity text-muted-foreground hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
                                            onClick={() => handleStartEdit(section)}
                                        >
                                            <Pencil className="h-3 w-3" /> Edit
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Inline humanize error — scoped to this section. */}
                        {humanizeError && humanizeError.heading === section.heading ? (
                            <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">
                                {humanizeError.message}
                            </div>
                        ) : null}

                        {/* Section Content */}
                        {!isCollapsed && (
                            <div className="min-w-0 p-3 sm:p-5">
                                {isEditing ? (
                                    <RichTextEditor
                                        content={normalizeRichTextInput(editBuffer)}
                                        onChange={(value) => {
                                            // Body-only edit: heading lives in
                                            // the header input above and is
                                            // re-prepended on save. No more
                                            // silent overwrite of edits to the
                                            // heading text.
                                            setEditBuffer(richTextHtmlToPlainText(value).trimEnd());
                                        }}
                                    />
                                ) : (
                                    <article className="prose prose-sm max-w-none break-words dark:prose-invert sm:prose-base prose-headings:font-bold prose-headings:tracking-tight prose-h2:mt-0 prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-p:text-foreground/85 prose-strong:text-foreground prose-code:rounded prose-code:bg-slate-950 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-cyan-200 prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-xl prose-pre:border prose-pre:border-white/10 prose-pre:bg-slate-950 prose-blockquote:border-l-primary prose-blockquote:text-foreground/70 prose-a:text-primary prose-li:text-foreground/85 prose-img:rounded-xl prose-img:shadow-lg prose-table:block prose-table:overflow-x-auto">
                                        {visualBlocks.length > 0 ? (
                                            <BlogMarkdownWithVisuals
                                                content={getDisplayContent(section)}
                                                visualBlocks={visualBlocks}
                                                className="contents"
                                                imageClassName="rounded-xl shadow-lg"
                                                imageAltFallback="Article image"
                                            />
                                        ) : (
                                            splitMarkdownByVideoShortcodes(getDisplayContent(section)).map((chunk, chunkIndex) => (
                                                chunk.type === "video" ? (
                                                    <BlogVideoEmbed key={`video-${section.id}-${chunkIndex}`} video={chunk.video} surface="editor" />
                                                ) : (
                                                    <ReactMarkdown key={`markdown-${section.id}-${chunkIndex}`} remarkPlugins={[remarkGfm]}>
                                                        {chunk.content}
                                                    </ReactMarkdown>
                                                )
                                            ))
                                        )}
                                    </article>
                                )}
                            </div>
                        )}
                    </div>
                    </div>
                );
            })}
            {/* Persistent bottom CTA — always visible so operators can extend
                the article without having to hover-discover the inter-section
                affordance. Appends a new H2 section at the end. */}
            <div className="pt-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddSection(sections.length)}
                    className="w-full gap-1.5 border-dashed text-muted-foreground hover:text-foreground hover:border-border"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add section
                </Button>
            </div>
        </div>
    );
}
