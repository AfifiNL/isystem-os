function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function countWords(text: string): number {
    return text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function markdownToPlainText(markdown: string): string {
    return markdown
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/~~~[\s\S]*?~~~/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/^#{1,6}\s+.+$/gm, " ")
        .replace(/\{\{\s*visual\s*:[^}]*\}\}/g, " ")
        .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/[`*_~>\-]/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();
}

function readGeneratedBlogMarkdown(metadata: unknown): string | null {
    const root = asRecord(metadata);
    const generatedFormats = asRecord(root?.generated_formats);
    const blogPost = generatedFormats?.blog_post;
    return typeof blogPost === "string" && blogPost.trim().length > 0 ? blogPost : null;
}

export function getBlogWordCount(input: {
    content_markdown?: string | null;
    metadata?: unknown;
}): number {
    const markdown = input.content_markdown || readGeneratedBlogMarkdown(input.metadata) || "";
    return countWords(markdownToPlainText(markdown));
}

export function getBlogReadingTimeMinutes(input: {
    content_markdown?: string | null;
    metadata?: unknown;
    wordsPerMinute?: number;
}): number {
    const wordsPerMinute = input.wordsPerMinute && input.wordsPerMinute > 0 ? input.wordsPerMinute : 250;
    const wordCount = getBlogWordCount(input);
    return Math.max(1, Math.ceil(Math.max(wordCount, 1) / wordsPerMinute));
}
