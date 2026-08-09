import { cn } from "@/shared/lib/utils";
import { normalizeRichTextInput } from "@/features/content-engine/lib/rich-text";
import { isValidElement, type ReactNode } from "react";

interface RichTextRendererProps {
    content?: ReactNode | string | null;
    className?: string;
}

export function RichTextRenderer({ content, className }: RichTextRendererProps) {
    const renderClasses = cn(
        "prose prose-sm max-w-none text-foreground sm:prose-base",
        "prose-headings:text-inherit prose-p:text-inherit prose-li:text-inherit",
        // Inline links default to the active template's accent (brand orange
        // on iSystem). Previously these defaulted to `--primary`, which is
        // shadcn's dark blue and clashed with brand styling on Puck-rendered
        // pages and any RichTextRenderer caller that didn't pass a prose-a
        // override (e.g. /en/<slug> industry pages, facility-services blog).
        "prose-strong:text-inherit prose-a:text-[var(--template-text-accent-strong)] prose-a:font-medium hover:prose-a:opacity-80",
        "prose-blockquote:border-[var(--template-accent)]/30 prose-blockquote:text-foreground",
        "prose-img:rounded-2xl prose-img:border prose-img:border-border/50",
        "[&_mark]:rounded-sm [&_mark]:px-1 [&_mark]:py-0.5 [&_mark]:text-inherit",
        className,
    );

    // If the content is a React element (e.g., injected by Puck's useRichtextProps during editing),
    // render it directly instead of trying to parse it as an HTML/markdown string.
    if (isValidElement(content)) {
        return <div className={renderClasses}>{content}</div>;
    }

    const normalized = normalizeRichTextInput(content as string | null | undefined);

    if (!normalized) {
        return null;
    }

    // suppressHydrationWarning: the content is sanitized HTML that we trust to be
    // identical between SSR and CSR. Browsers can normalize HTML in ways that produce
    // benign text-node drift (whitespace collapsing, attribute reordering), which has
    // surfaced as React #418. Suppressing here is safe because dangerouslySetInnerHTML
    // is already opaque to React's reconciler — the content is set from a deterministic
    // sanitizer pass, not user input.
    return <div className={renderClasses} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: normalized }} />;
}
