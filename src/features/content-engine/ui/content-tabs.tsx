"use client";

import { useState } from "react";
import { ContentEditorWrapper } from "./editor-wrapper";
import { ContentAssetViewer } from "./content-asset-viewer";
import { FileText, ImageIcon } from "lucide-react";

interface ContentTabsProps {
    item: {
        id: string;
        title: string;
        content_markdown: string;
        metadata?: {
            [key: string]: unknown;
        };
    };
}

export function ContentTabs({ item }: ContentTabsProps) {
    const [activeTab, setActiveTab] = useState<"editor" | "assets">("editor");

    return (
        <div className="space-y-6">
            {/* Tab Bar */}
            <div className="flex gap-1 border-b">
                <button
                    onClick={() => setActiveTab("editor")}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "editor"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                >
                    <FileText className="h-4 w-4" />
                    Editor
                </button>
                <button
                    onClick={() => setActiveTab("assets")}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "assets"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                >
                    <ImageIcon className="h-4 w-4" />
                    Asset Library
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === "editor" && (
                <ContentEditorWrapper
                    initialData={{
                        id: item.id,
                        title: item.title,
                        content_markdown: item.content_markdown,
                    }}
                />
            )}

            {activeTab === "assets" && (
                <ContentAssetViewer contentId={item.id} />
            )}
        </div>
    );
}
