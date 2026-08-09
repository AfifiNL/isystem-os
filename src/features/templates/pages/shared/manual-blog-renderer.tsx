import type { ReactNode } from "react";
import Image from "next/image";
import { RichTextRenderer } from "@/features/content-engine/ui/rich-text-renderer";

export type ManualBlogTemplate = "editorial" | "insight-grid" | "case-study";
export type ManualSectionType = "richText" | "image" | "quote" | "twoColumn" | "statsGrid";

export type ManualBlogSection = {
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

interface ManualBlogRendererProps {
    builder: {
        template?: ManualBlogTemplate;
        sections?: ManualBlogSection[];
    };
}

const templateShells: Record<ManualBlogTemplate, string> = {
    editorial: "space-y-10",
    "insight-grid": "space-y-8",
    "case-study": "space-y-10",
};

function renderSection(section: ManualBlogSection): ReactNode {
    if (section.type === "richText") {
        return (
            <section className="space-y-4 rounded-3xl border border-[var(--template-border-inverse)] [background:var(--template-surface-glass)] p-6 shadow-sm backdrop-blur-[8px]">
                {section.eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--template-text-accent-strong)]">{section.eyebrow}</p> : null}
                {section.title ? <h2 className="text-2xl font-bold tracking-tight text-[var(--template-text-inverse)]">{section.title}</h2> : null}
                {section.body ? <RichTextRenderer content={section.body} className={`text-base leading-8 text-[var(--template-text-inverse-muted)]`} /> : null}
            </section>
        );
    }

    if (section.type === "image") {
        return (
            <figure className="space-y-4 rounded-3xl border border-[var(--template-border-inverse)] [background:var(--template-surface-glass)] p-4 shadow-sm backdrop-blur-[8px]">
                {section.imageUrl ? (
                    <div className="relative w-full overflow-hidden rounded-2xl aspect-[16/9]">
                        <Image
                            src={section.imageUrl}
                            alt={section.imageAlt || section.title || "Blog image"}
                            fill
                            sizes="(max-width: 768px) 100vw, 768px"
                            className="object-cover"
                            loading="lazy"
                        />
                    </div>
                ) : null}
                {section.title ? <h2 className="text-xl font-semibold text-[var(--template-text-inverse)]">{section.title}</h2> : null}
                {section.caption ? <figcaption className="text-sm leading-6 text-[var(--template-text-inverse-muted)]">{section.caption}</figcaption> : null}
            </figure>
        );
    }

    if (section.type === "quote") {
        return (
            <blockquote
                className="rounded-3xl border p-8 shadow-sm"
                style={{
                    borderColor: "color-mix(in oklch, var(--template-accent) 25%, transparent)",
                    background: "color-mix(in oklch, var(--template-accent) 6%, transparent)",
                }}
            >
                <p className="text-2xl font-semibold leading-10 text-[var(--template-text-inverse)]">&ldquo;{section.quote}&rdquo;</p>
                {section.author ? <footer className="mt-4 text-sm font-medium text-[var(--template-text-accent-strong)]">— {section.author}</footer> : null}
            </blockquote>
        );
    }

    if (section.type === "twoColumn") {
        return (
            <section className="space-y-4 rounded-3xl border border-[var(--template-border-inverse)] [background:var(--template-surface-glass)] p-6 shadow-sm backdrop-blur-[8px]">
                {section.eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--template-text-accent-strong)]">{section.eyebrow}</p> : null}
                <div className="grid gap-6 md:grid-cols-2">
                    <article className="rounded-2xl border border-[var(--template-border-inverse)] bg-white/5 p-5">
                        {section.leftTitle ? <h3 className="text-lg font-semibold text-[var(--template-text-inverse)]">{section.leftTitle}</h3> : null}
                        {section.leftBody ? <RichTextRenderer content={section.leftBody} className={`mt-3 text-sm leading-7 text-[var(--template-text-inverse-muted)]`} /> : null}
                    </article>
                    <article className="rounded-2xl border border-[var(--template-border-inverse)] bg-white/5 p-5">
                        {section.rightTitle ? <h3 className="text-lg font-semibold text-[var(--template-text-inverse)]">{section.rightTitle}</h3> : null}
                        {section.rightBody ? <RichTextRenderer content={section.rightBody} className={`mt-3 text-sm leading-7 text-[var(--template-text-inverse-muted)]`} /> : null}
                    </article>
                </div>
            </section>
        );
    }

    if (section.type === "statsGrid") {
        return (
            <section className="space-y-4 rounded-3xl border border-[var(--template-border-inverse)] [background:var(--template-surface-glass)] p-6 shadow-sm backdrop-blur-[8px]">
                {section.title ? <h2 className="text-2xl font-bold tracking-tight text-[var(--template-text-inverse)]">{section.title}</h2> : null}
                <div className="grid gap-4 md:grid-cols-3">
                    {(section.stats || []).map((stat, index) => (
                        <div key={`${section.id}-${index}`} className="rounded-2xl border border-[var(--template-border-inverse)] bg-white/5 p-5 text-center">
                            <div className="text-3xl font-bold text-[var(--template-text-accent-strong)]">{stat.value}</div>
                            <div className="mt-2 text-sm text-[var(--template-text-inverse-muted)]">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    return null;
}

export function ManualBlogRenderer({ builder }: ManualBlogRendererProps) {
    const template = builder.template && builder.template in templateShells ? builder.template : "editorial";
    const sections = Array.isArray(builder.sections) ? builder.sections : [];

    if (sections.length === 0) {
        return null;
    }

    return <div className={templateShells[template]}>{sections.map((section) => <div key={section.id}>{renderSection(section)}</div>)}</div>;
}
