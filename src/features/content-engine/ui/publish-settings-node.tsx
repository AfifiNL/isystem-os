"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Loader2, Save, Globe, Lock, ImageIcon, User } from "lucide-react";
import { updateContentItem } from "../actions";
import { PremiumInlinePending } from "@/shared/ui/loading";

interface PublishSettingsNodeProps {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    item: any;
}

export function PublishSettingsNode({ item }: PublishSettingsNodeProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [slug, setSlug] = useState(item.slug || "");
    const [status, setStatus] = useState(item.status || "draft");
    const [featuredImage, setFeaturedImage] = useState(item.metadata?.featured_image_url || "");
    const [error, setError] = useState<string | null>(null);

    const assets = item.metadata?.assets || {};
    const imageAssets = Object.entries(assets)
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        .map(([key, assetData]: [string, any]) => {
            const urlStr = typeof assetData === "string" ? assetData : assetData?.url;
            return [key, urlStr];
        })
        .filter(([, url]) => {
            if (typeof url !== "string") return false;
            const u = url.toLowerCase();
            return u.includes(".png") || u.includes(".jpg") || u.includes(".jpeg") || u.includes(".webp") || u.startsWith("http");
        });

    const handleSave = () => {
        setError(null);
        startTransition(async () => {
            const updatedMetadata = { ...item.metadata, featured_image_url: featuredImage };

            const result = await updateContentItem(item.id, {
                slug,
                status,
                metadata: updatedMetadata,
            });

            if (result.error) {
                setError(result.error);
            } else {
                router.refresh();
            }
        });
    };

    return (
        <div className="max-w-4xl min-w-0 space-y-6 p-1 sm:space-y-8">
            <div className="flex min-w-0 flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Globe className="h-6 w-6 text-primary" />
                        Publish Settings
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Manage URL routing, visibility, and primary metadata for the public blog.
                    </p>
                </div>
                <div className="grid w-full gap-2 sm:flex sm:w-auto sm:items-center">
                    {isPending ? <PremiumInlinePending label="Publishing settings" description="Updating routing + visibility" /> : null}
                    <Button onClick={handleSave} disabled={isPending} className="w-full min-w-0 sm:w-auto sm:min-w-[140px]">
                        {isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Save Settings
                    </Button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 text-sm font-medium">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: Core Routing & Status */}
                <div className="space-y-6">
                    <div className="space-y-3 bg-card p-5 rounded-xl border shadow-sm">
                        <label className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 text-foreground">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            URL Slug
                        </label>
                        <p className="text-xs text-muted-foreground">
                            The unique identifier for the public URL path.
                        </p>
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-sm bg-muted px-3 py-2.5 rounded-md border">
                                /blog/
                            </span>
                            <Input
                                value={slug}
                                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                                placeholder="my-awesome-post"
                                className="flex-1"
                            />
                        </div>
                    </div>

                    <div className="space-y-3 bg-card p-5 rounded-xl border shadow-sm">
                        <label className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 text-foreground">
                            <Lock className="h-4 w-4 text-muted-foreground" />
                            Visibility Status
                        </label>
                        <p className="text-xs text-muted-foreground">
                            Control who can see this project.
                        </p>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="draft">Draft (Hidden)</option>
                            <option value="review">In Review (Internal Only)</option>
                            <option value="ready">Ready (Scheduled/Awaiting Publish)</option>
                            <option value="published">Published (Public)</option>
                        </select>
                    </div>

                    <div className="space-y-3 bg-card p-5 rounded-xl border shadow-sm">
                        <label className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 text-foreground">
                            <User className="h-4 w-4 text-muted-foreground" />
                            Author ID
                        </label>
                        <p className="text-xs text-muted-foreground">
                            The UUID of the author assigned to this post.
                        </p>
                        <Input
                            value={item.author_id}
                            disabled
                            className="bg-muted text-muted-foreground font-mono text-xs"
                        />
                    </div>
                </div>

                {/* Right Column: Featured Assets */}
                <div className="space-y-6">
                    <div className="space-y-4 bg-card p-5 rounded-xl border shadow-sm h-full">
                        <label className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 text-foreground">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            Featured Image
                        </label>
                        <p className="text-xs text-muted-foreground">
                            Select a generated image to act as the primary OpenGraph and blog card image.
                        </p>

                        {imageAssets.length > 0 ? (
                            <div className="space-y-4">
                                <select
                                    value={featuredImage}
                                    onChange={(e) => setFeaturedImage(e.target.value)}
                                    className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                >
                                    <option value="">-- Select an Image --</option>
                                    {imageAssets.map(([key, url]) => (
                                        <option key={key as string} value={url as string}>
                                            {key as string}
                                        </option>
                                    ))}
                                </select>

                                {featuredImage && (
                                    <div className="rounded-lg overflow-hidden border bg-muted/30 p-2">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={featuredImage}
                                            alt="Featured Preview"
                                            className="w-full h-48 object-cover rounded-md"
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-6 border-2 border-dashed rounded-xl text-center flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
                                <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                                <p className="text-sm">No images generated yet.</p>
                                <p className="text-xs mt-1">Generate assets first to select a featured image.</p>
                            </div>
                        )}

                        {featuredImage === "" && imageAssets.length > 0 && (
                            <div className="p-3 bg-amber-500/10 text-amber-500 text-xs rounded-md border border-amber-500/20 font-medium flex items-center gap-2">
                                ⚠️ No featured image selected. The public card will lack an image.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
