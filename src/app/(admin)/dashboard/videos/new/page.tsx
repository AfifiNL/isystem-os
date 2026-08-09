import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { resolveWorkspaceContext, resolveWorkspaceIdFromTemplate } from "@/shared/lib/workspace/context";
import { resolveLegacyTemplateForWorkspaceContext } from "@/features/templates/workspace-adapter";
import { getSiteSettings } from "@/features/templates/actions";
import { VideoUploadForm } from "@/features/video-stream/ui/video-upload-form";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Upload video",
};

export default async function NewVideoPage() {
    await requireDashboardModuleAccess("videos");

    const [context, settings] = await Promise.all([
        resolveWorkspaceContext(),
        getSiteSettings(),
    ]);
    const resolution = await resolveLegacyTemplateForWorkspaceContext(context, settings.activeTemplate);
    const workspaceId =
        context?.activeWorkspace?.id
        ?? (await resolveWorkspaceIdFromTemplate(resolution.templateId));

    if (!workspaceId) redirect("/dashboard/videos?error=no-workspace");

    const defaultLocaleRaw = context?.activeWorkspace?.default_locale ?? "en";
    const initialLocale: "en" | "nl" | "ar" =
        defaultLocaleRaw === "nl" || defaultLocaleRaw === "ar" ? defaultLocaleRaw : "en";

    return (
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 lg:px-6">
            <Link
                href="/dashboard/videos"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to videos
            </Link>

            <header>
                <h1 className="text-lg font-semibold tracking-tight text-foreground">Upload video</h1>
                <p className="text-xs text-muted-foreground">
                    The file uploads directly to the public-videos Supabase Storage bucket. After saving, the video appears on /videos when published.
                </p>
            </header>

            <VideoUploadForm mode="create" workspaceId={workspaceId} initialLocale={initialLocale} />
        </div>
    );
}
