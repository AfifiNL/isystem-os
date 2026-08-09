"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, useTransition } from "react";
import { Linkedin, Github, Twitter, Globe, Save, Upload, Loader2, UserCircle } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { listWorkspaceAuthors, updateAuthorProfile } from "@/features/blog/author-actions";
import type { BlogAuthor } from "@/features/blog/types";

interface AuthorDraft extends BlogAuthor {
    dirty: boolean;
    saving: boolean;
    error: string | null;
    saved: boolean;
}

function toDraft(author: BlogAuthor): AuthorDraft {
    return { ...author, dirty: false, saving: false, error: null, saved: false };
}

export function AuthorsTab() {
    const [drafts, setDrafts] = useState<AuthorDraft[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [, startReload] = useTransition();
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        startReload(async () => {
            const { data, error } = await listWorkspaceAuthors();
            if (cancelled) return;
            if (error) {
                setLoadError(error);
                setLoaded(true);
                return;
            }
            setDrafts(data.map(toDraft));
            setLoaded(true);
        });
        return () => { cancelled = true; };
    }, []);

    const updateDraft = (id: string, patch: Partial<AuthorDraft>) => {
        setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch, dirty: true, saved: false } : d)));
    };

    const updateSocial = (id: string, key: keyof BlogAuthor["social_links"], value: string) => {
        setDrafts((prev) => prev.map((d) => d.id === id
            ? { ...d, social_links: { ...d.social_links, [key]: value }, dirty: true, saved: false }
            : d));
    };

    const handleSave = async (draft: AuthorDraft) => {
        setDrafts((prev) => prev.map((d) => (d.id === draft.id ? { ...d, saving: true, error: null } : d)));
        const { data, error } = await updateAuthorProfile({
            profileId: draft.id,
            patch: {
                display_name: draft.display_name,
                role_title: draft.role_title,
                bio: draft.bio,
                avatar_url: draft.avatar_url,
                social_links: draft.social_links,
            },
        });
        if (error || !data) {
            setDrafts((prev) => prev.map((d) => (d.id === draft.id ? { ...d, saving: false, error: error || "Save failed" } : d)));
            return;
        }
        setDrafts((prev) => prev.map((d) => (d.id === draft.id ? { ...toDraft(data), saved: true } : d)));
    };

    const handleAvatarUpload = async (id: string, file: File) => {
        setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, saving: true, error: null } : d)));
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/author-avatars/upload", { method: "POST", body: formData });
            const payload = await res.json();
            if (!res.ok || !payload.url) throw new Error(payload.error || "Upload failed");
            setDrafts((prev) => prev.map((d) => (d.id === id
                ? { ...d, avatar_url: payload.url, saving: false, dirty: true, saved: false }
                : d)));
        } catch (err) {
            setDrafts((prev) => prev.map((d) => (d.id === id ? {
                ...d,
                saving: false,
                error: err instanceof Error ? err.message : "Upload failed",
            } : d)));
        }
    };

    if (!loaded) {
        return (
            <div className="flex min-h-[300px] items-center justify-center text-muted-foreground">
                <Loader2 className="me-2 h-5 w-5 animate-spin" /> Loading authors…
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-[17px] text-destructive">
                Failed to load authors: {loadError}
            </div>
        );
    }

    if (drafts.length === 0) {
        return (
            <div className="rounded-md border border-dashed border-border p-10 text-center">
                <UserCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <h3 className="text-base font-semibold text-foreground">No authors found</h3>
                <p className="mt-1 text-[17px] text-muted-foreground">
                    Authors appear here once a blog post is published or a manager is invited to the workspace.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-xl font-semibold text-foreground">Authors</h2>
                <p className="mt-1 text-[17px] text-muted-foreground">
                    Edit each author&apos;s public profile. Display name, headshot, role, bio, and social links appear on every blog post they wrote and on the blog index. Bylines are inferred from the post&apos;s author column — to change which author is attached to a post, edit the post itself.
                </p>
            </header>

            <div className="grid gap-5">
                {drafts.map((draft) => (
                    <article key={draft.id} className="rounded-md border border-border bg-card p-5 sm:p-6 shadow-sm">
                        <div className="grid gap-6 lg:grid-cols-[160px_1fr]">
                            <div className="space-y-3">
                                <div className="relative h-32 w-32 overflow-hidden rounded-md border border-border bg-muted">
                                    {draft.avatar_url ? (
                                        <img src={draft.avatar_url} alt={draft.display_name} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-muted-foreground">
                                            {draft.display_name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <label className="block">
                                    <span className="sr-only">Upload avatar</span>
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/gif"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) void handleAvatarUpload(draft.id, file);
                                            e.target.value = "";
                                        }}
                                        disabled={draft.saving}
                                    />
                                    <span className="inline-flex w-32 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[15px] font-medium text-foreground hover:bg-accent">
                                        <Upload className="h-3.5 w-3.5" /> Upload
                                    </span>
                                </label>
                                {draft.avatar_url ? (
                                    <button
                                        type="button"
                                        onClick={() => updateDraft(draft.id, { avatar_url: null })}
                                        className="text-[15px] text-muted-foreground underline-offset-4 hover:underline"
                                    >
                                        Remove
                                    </button>
                                ) : null}
                            </div>

                            <div className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Field label="Display name">
                                        <Input
                                            value={draft.display_name}
                                            onChange={(e) => updateDraft(draft.id, { display_name: e.target.value })}
                                            placeholder="Alex Morgan"
                                            maxLength={120}
                                        />
                                    </Field>
                                    <Field label="Role / title">
                                        <Input
                                            value={draft.role_title ?? ""}
                                            onChange={(e) => updateDraft(draft.id, { role_title: e.target.value || null })}
                                            placeholder="Founder and operator"
                                            maxLength={160}
                                        />
                                    </Field>
                                </div>

                                <Field label="Short bio" hint="1–3 sentences. Shown on every published post by this author.">
                                    <Textarea
                                        value={draft.bio ?? ""}
                                        onChange={(e) => updateDraft(draft.id, { bio: e.target.value || null })}
                                        rows={3}
                                        maxLength={600}
                                        placeholder="Operator and writer focused on operations-grade AI for SMEs."
                                    />
                                </Field>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <SocialField icon={Linkedin} label="LinkedIn URL" value={draft.social_links.linkedin ?? ""} onChange={(v) => updateSocial(draft.id, "linkedin", v)} />
                                    <SocialField icon={Twitter} label="X (Twitter) URL" value={draft.social_links.x ?? ""} onChange={(v) => updateSocial(draft.id, "x", v)} />
                                    <SocialField icon={Github} label="GitHub URL" value={draft.social_links.github ?? ""} onChange={(v) => updateSocial(draft.id, "github", v)} />
                                    <SocialField icon={Globe} label="Personal website" value={draft.social_links.website ?? ""} onChange={(v) => updateSocial(draft.id, "website", v)} />
                                </div>

                                <div className="flex items-center justify-between gap-3 pt-2">
                                    <div className="text-[15px]">
                                        {draft.error ? (
                                            <span className="text-destructive">{draft.error}</span>
                                        ) : draft.saved ? (
                                            <span className="text-emerald-600">Saved.</span>
                                        ) : draft.dirty ? (
                                            <span className="text-muted-foreground">Unsaved changes.</span>
                                        ) : null}
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => handleSave(draft)}
                                        disabled={!draft.dirty || draft.saving}
                                    >
                                        {draft.saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                                        Save
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="text-[15px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</label>
            {children}
            {hint ? <p className="text-[17px] text-muted-foreground">{hint}</p> : null}
        </div>
    );
}

function SocialField({ icon: Icon, label, value, onChange }: { icon: typeof Linkedin; label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[15px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Icon className="h-3.5 w-3.5" /> {label}
            </label>
            <Input
                type="url"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="https://"
            />
        </div>
    );
}
