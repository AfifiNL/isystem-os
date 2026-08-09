"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, FileText, Headphones, Mail, Smartphone, Video, Folder, Settings, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { EditorNode } from "./editor-node";
import { ContentAssetViewer } from "./content-asset-viewer";
import { BlogPostEditorNode } from "./blog-post-editor";
import { PublishSettingsNode } from "./publish-settings-node";
import { VisualInsightsNode } from "./visual-insights-node";
import { PodcastProductionNode } from "./podcast-production-node";

interface CmsWorkspaceProps {
    item: {
        id: string;
        title: string;
        content_markdown: string;
        workspace_id?: string | null;
        status?: string;
        slug?: string;
        metadata?: {
            generated_formats?: Record<string, string>;
            [key: string]: unknown;
        };
    };
    aiGenerationEnabled?: boolean;
}

// Define the tree structure
const MENU_GROUPS = [
    {
        title: "Core Content",
        icon: FileText,
        items: [
            { id: "blog_post", label: "Blog Post", type: "core" }
        ]
    },
    {
        title: "Visual Intelligence",
        icon: BarChart3,
        items: [
            { id: "visual_insights", label: "Charts & Diagrams", type: "visual" }
        ]
    },
    {
        title: "Email",
        icon: Mail,
        items: [
            { id: "newsletter_issue", label: "Newsletter Issue", type: "newsletter" },
            { id: "newsletter_subject_lines", label: "Subject Line Variants", type: "newsletter" }
        ]
    },
    {
        title: "Social Media",
        icon: Smartphone,
        items: [
            { id: "social_linkedin", label: "LinkedIn Post", type: "social" },
            { id: "social_twitter", label: "Twitter Thread", type: "social" },
            { id: "social_instagram", label: "Instagram Copy", type: "social" }
        ]
    },
    {
        title: "Video Production",
        icon: Video,
        items: [
            { id: "video_script", label: "Video Script", type: "video" }
        ]
    },
    {
        title: "Podcast Production",
        icon: Headphones,
        items: [
            { id: "podcast_episode", label: "Generate Podcast Episode", type: "podcast" }
        ]
    },
    {
        title: "Asset Library",
        icon: Folder,
        items: [
            { id: "asset_library", label: "Live Assets", type: "library" }
        ]
    },
    {
        title: "Visual Builder",
        icon: FileText,
        items: [
            { id: "visual_builder", label: "Visual Page Builder", type: "builder" }
        ]
    },
    {
        title: "Publishing & Control",
        icon: Settings,
        items: [
            { id: "publish_settings", label: "Publish Settings", type: "settings" }
        ]
    }
];

export function CmsWorkspace({ item, aiGenerationEnabled = true }: CmsWorkspaceProps) {
    const [selectedNode, setSelectedNode] = useState("blog_post");
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // We maintain local state for all editable formats so we can save them together or individually
    const [formats, setFormats] = useState<Record<string, string>>(
        item.metadata?.generated_formats || {}
    );

    const handleFormatChange = (id: string, value: string) => {
        setFormats((prev) => ({ ...prev, [id]: value }));
    };

    const renderContent = () => {
        if (selectedNode === "asset_library") {
            return (
                <div className="min-w-0 p-4 sm:p-6">
                    <ContentAssetViewer
                        contentId={item.id}
                        aiGenerationEnabled={aiGenerationEnabled}
                        onOpenPodcastProduction={() => setSelectedNode("podcast_episode")}
                    />
                </div>
            );
        }

        if (selectedNode === "publish_settings") {
            return (
                <div className="min-w-0 p-4 sm:p-6">
                    <PublishSettingsNode item={item} />
                </div>
            );
        }

        if (selectedNode === "blog_post") {
            return (
                <div className="flex min-w-0 flex-col p-4 sm:h-full sm:p-6">
                    <BlogPostEditorNode
                        initialData={{
                            id: item.id,
                            title: item.title,
                            content_markdown: item.content_markdown,
                            workspace_id: item.workspace_id,
                            status: item.status,
                            slug: item.slug,
                            metadata: item.metadata,
                        }}
                    />
                </div>
            );
        }

        if (selectedNode === "podcast_episode") {
            return (
                <div className="min-w-0 overflow-y-auto p-4 sm:h-full sm:p-6">
                    <PodcastProductionNode contentId={item.id} contentTitle={item.title} />
                </div>
            );
        }

        if (selectedNode === "visual_insights") {
            return (
                <div className="min-w-0 p-4 sm:h-full sm:p-6">
                    <VisualInsightsNode
                        item={{
                            id: item.id,
                            content_markdown: item.content_markdown,
                            metadata: item.metadata,
                        }}
                    />
                </div>
            );
        }

        if (selectedNode === "visual_builder") {
            return (
                <div className="min-w-0 p-4 sm:h-full sm:p-8">
                    <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
                        <span className="inline-flex w-fit rounded-full bg-[#002f58]/10 px-3 py-1 text-[14px] font-semibold uppercase tracking-[0.24em] text-[#002f58]">
                            Workspace visual system
                        </span>
                        <h2 className="mt-5 text-[27px] font-semibold tracking-tight text-slate-950 sm:text-[33px]">
                            Compose branded landing pages with constrained strategic content blocks.
                        </h2>
                        <p className="mt-4 text-[17px] leading-7 text-slate-600">
                            Launch the dedicated builder to arrange hero sections, service pillars, industry proof, and conversion paths without exposing arbitrary styles or off-brand layout controls.
                        </p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
                            <Link
                                href={`/dashboard/builder/${item.id}`}
                                className="inline-flex h-11 items-center justify-center rounded-md bg-[#002f58] px-5 text-[17px] font-medium text-white transition hover:bg-[#0a3d69]"
                            >
                                Open builder
                            </Link>
                            <div className="inline-flex min-w-0 items-center rounded-md border border-slate-200 px-4 py-3 text-[17px] text-slate-500">
                                Visual data saved into <code className="ml-1 font-semibold text-slate-700">visual_layout</code>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // For all other nodes (social, video, etc.), render the targeted EditorNode
        const activeItem = MENU_GROUPS.flatMap(g => g.items).find(i => i.id === selectedNode);

        if (!activeItem) return null;

        return (
            <div className="flex min-w-0 flex-col p-4 sm:h-full sm:p-6">
                <EditorNode
                    contentId={item.id}
                    nodeId={selectedNode}
                    label={activeItem?.label || "Content"}
                    value={formats[selectedNode] || ""}
                    onChange={(val) => handleFormatChange(selectedNode, val)}
                    currentMetadata={item.metadata}
                    aiGenerationEnabled={aiGenerationEnabled}
                />
            </div>
        );
    };

    return (
        <div className="flex w-full h-full min-w-0 flex-col overflow-hidden bg-background lg:flex-row">
            {/* Tree-Map Sidebar */}
            {isSidebarOpen ? (
                <div className="flex min-w-0 flex-col border-b bg-muted/30 lg:w-56 lg:border-b-0 lg:border-r relative group shrink-0">
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="absolute right-2 top-3 z-10 hidden lg:flex items-center justify-center p-1.5 rounded-md hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Collapse sidebar"
                    >
                        <PanelLeftClose className="w-4 h-4" />
                    </button>
                    <div className="min-w-0 overflow-x-auto p-3 lg:flex-1 lg:space-y-6 lg:overflow-y-auto lg:pt-4">
                        <div className="flex items-center justify-between lg:mb-4 lg:px-2">
                            <h3 className="sr-only lg:not-sr-only text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Project Workspace
                            </h3>
                            <button
                                onClick={() => setIsSidebarOpen(false)}
                                className="flex lg:hidden items-center justify-center p-1.5 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground mr-2 shrink-0"
                                title="Collapse sidebar"
                            >
                                <PanelLeftClose className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex min-w-max gap-2 lg:min-w-0 lg:flex-col lg:gap-6">
                            {MENU_GROUPS.map((group) => (
                                <div key={group.title} className="space-y-1">
                                    <h4 className="hidden items-center gap-2 px-2 mb-2 text-[15px] font-semibold uppercase text-muted-foreground lg:flex">
                                        <group.icon className="h-3.5 w-3.5" />
                                        {group.title}
                                    </h4>
                                    {group.items.map((navItem) => (
                                        <button
                                            key={navItem.id}
                                            onClick={() => setSelectedNode(navItem.id)}
                                            className={`flex w-max min-w-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-[17px] transition-colors lg:w-full lg:whitespace-normal lg:text-left ${selectedNode === navItem.id
                                                ? "bg-primary text-primary-foreground font-medium shadow-sm"
                                                : "text-foreground hover:bg-muted font-medium"
                                                }`}
                                        >
                                            {navItem.label}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex min-w-0 flex-row lg:flex-col items-center border-b lg:border-b-0 lg:border-r bg-muted/30 p-2 lg:w-14 lg:py-4 transition-all shrink-0">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="flex items-center justify-center p-2 rounded-md hover:bg-muted/80 bg-background border shadow-sm text-foreground shrink-0"
                        title="Expand sidebar"
                    >
                        <PanelLeftOpen className="w-4 h-4" />
                    </button>
                    <div className="ml-3 lg:hidden text-[15px] font-medium text-muted-foreground truncate">
                        Project Workspace
                    </div>
                </div>
            )}

            {/* Main Content Pane — min-w-0 prevents wide children from pushing the flex row past the viewport. */}
            <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-background sm:overflow-auto">
                {renderContent()}
            </div>
        </div>
    );
}
