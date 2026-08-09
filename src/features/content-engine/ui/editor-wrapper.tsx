"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RichTextEditor } from "./editor";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { createContentItem, updateContentItem } from "../actions";
import { Save, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface ContentEditorWrapperProps {
    initialData?: {
        id?: string;
        title: string;
        content_markdown: string;
    };
}

export function ContentEditorWrapper({ initialData }: ContentEditorWrapperProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [title, setTitle] = useState(initialData?.title || "");
    const [content, setContent] = useState(initialData?.content_markdown || "");
    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
        if (!title.trim()) {
            setError("Title is required");
            return;
        }

        setError(null);
        startTransition(async () => {
            let result;
            if (initialData?.id) {
                result = await updateContentItem(initialData.id, {
                    title,
                    content_markdown: content,
                });
            } else {
                result = await createContentItem({
                    title,
                    content_markdown: content,
                });
            }

            if (result.error) {
                setError(result.error);
            } else {
                router.push("/dashboard/content");
                router.refresh();
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Link href="/dashboard/content">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Button>
                </Link>
                <Button onClick={handleSave} disabled={isPending} className="min-w-[120px]">
                    {isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    {initialData?.id ? "Update Draft" : "Save Draft"}
                </Button>
            </div>

            <div className="space-y-4 bg-muted/20 p-6 rounded-xl border border-border/50">
                {error && (
                    <div className="p-3 text-sm font-medium text-destructive bg-destructive/10 rounded-lg">
                        {error}
                    </div>
                )}

                <div className="space-y-2">
                    <label htmlFor="title" className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                        Draft Title
                    </label>
                    <Input
                        id="title"
                        placeholder="e.g., The Future of Vibe Coding..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="text-xl font-bold h-12 bg-background border-border/50 focus:ring-primary/20"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                        Content Body
                    </label>
                    <RichTextEditor content={content} onChange={setContent} />
                </div>
            </div>
        </div>
    );
}
