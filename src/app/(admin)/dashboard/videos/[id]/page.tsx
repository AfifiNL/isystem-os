import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { resolveWorkspaceContext, resolveWorkspaceIdFromTemplate } from "@/shared/lib/workspace/context";
import { resolveLegacyTemplateForWorkspaceContext } from "@/features/templates/workspace-adapter";
import { getSiteSettings } from "@/features/templates/actions";
import { getWorkspaceVideoById, deleteVideo } from "@/features/video-stream/manager-actions";
import { VideoUploadForm } from "@/features/video-stream/ui/video-upload-form";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Edit video",
};

async function deleteVideoAction(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    const result = await deleteVideo(id);
    if ("error" in result && result.error) {
        redirect(`/dashboard/videos/${id}?error=${encodeURIComponent(result.error)}`);
    }
    redirect("/dashboard/videos");
}

interface EditVideoPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EditVideoPage({ params, searchParams }: EditVideoPageProps) {
    await requireDashboardModuleAccess("videos");
    const { id } = await params;
    const sp = await searchParams;
    const error = typeof sp.error === "string" ? sp.error : null;

    const [{ data: video, error: fetchError }, context, settings] = await Promise.all([
        getWorkspaceVideoById(id),
        resolveWorkspaceContext(),
        getSiteSettings(),
    ]);

    if (fetchError && !video) {
        return (
            <div className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
                <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {fetchError}
                </p>
            </div>
        );
    }
    if (!video) notFound();

    const resolution = await resolveLegacyTemplateForWorkspaceContext(context, settings.activeTemplate);
    const workspaceId =
        context?.activeWorkspace?.id
        ?? (await resolveWorkspaceIdFromTemplate(resolution.templateId));
    if (!workspaceId) notFound();

    const meta = (video.metadata ?? {}) as Record<string, unknown>;
    const initialPoster = typeof meta.poster_url === "string" ? meta.poster_url : "";
    const initialDescription =
        typeof meta.description === "string" ? meta.description : "";
    const localeRaw = video.locale;
    const initialLocale: "en" | "nl" | "ar" =
        localeRaw === "nl" || localeRaw === "ar" ? localeRaw : "en";
    const initialStatus: "draft" | "published" =
        video.status === "published" ? "published" : "draft";

    return (
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 lg:px-6">
            <Link
                href="/dashboard/videos"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to videos
            </Link>

            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-lg font-semibold tracking-tight text-foreground">{video.title}</h1>
                    {video.slug && (
                        <p className="text-xs text-muted-foreground">/videos/{video.slug}</p>
                    )}
                </div>
                <form action={deleteVideoAction}>
                    <input type="hidden" name="id" value={video.id} />
                    <button
                        type="submit"
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input px-3 text-xs font-medium hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                    </button>
                </form>
            </header>

            {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            )}

            <VideoUploadForm
                mode="edit"
                workspaceId={workspaceId}
                videoId={video.id}
                initialTitle={video.title}
                initialDescription={initialDescription}
                initialSlug={video.slug ?? ""}
                initialLocale={initialLocale}
                initialStatus={initialStatus}
                initialVideoUrl={video.video_url}
                initialPosterUrl={initialPoster}
                initialDuration={video.video_duration}
                initialResolution={null}
            />
        </div>
    );
}
