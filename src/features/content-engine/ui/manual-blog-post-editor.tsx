"use client";

import { ManualBlogPostBuilder } from "@/features/content-engine/ui/manual-blog-post-builder";

interface ManualBlogPostEditorProps {
    item: {
        id: string;
        title: string;
        slug: string;
        status: string | null;
        content_markdown: string;
        metadata?: Record<string, unknown> | null;
    };
}

export function ManualBlogPostEditor({ item }: ManualBlogPostEditorProps) {
    return <ManualBlogPostBuilder mode="edit" initialData={item} />;
}
