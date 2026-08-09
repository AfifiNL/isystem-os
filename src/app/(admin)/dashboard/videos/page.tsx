import Link from "next/link";
import { Film, Plus, ExternalLink } from "lucide-react";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { listWorkspaceVideos } from "@/features/video-stream/manager-actions";
import {
    DashboardAppWorkbench,
    AppCommandBar,
} from "@/features/admin/ui/app-workbench";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Videos",
};

function formatDuration(seconds: number | null): string {
    if (!seconds || seconds <= 0) return "—";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    if (s === 0) return `${m}m`;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function statusPill(status: string) {
    const isPublished = status === "published";
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] font-semibold uppercase tracking-wider ${
                isPublished
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-amber-500/10 text-amber-600"
            }`}
        >
            <span className={`h-1.5 w-1.5 rounded-full ${isPublished ? "bg-emerald-500" : "bg-amber-500"}`} />
            {status}
        </span>
    );
}

export default async function VideosDashboardPage() {
    await requireDashboardModuleAccess("videos");
    const { data: videos, error } = await listWorkspaceVideos();

    return (
        <DashboardAppWorkbench>
            <AppCommandBar>
                <div className="flex flex-1 items-center justify-between gap-4">
                    <Link
                        href="/dashboard/videos/new"
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-[15px] font-medium text-primary-foreground hover:opacity-90 cursor-pointer"
                    >
                        <Plus className="h-4 w-4" />
                        Upload video
                    </Link>
                </div>
            </AppCommandBar>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                {error && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-[17px] text-destructive">
                        {error}
                    </div>
                )}

                {videos.length === 0 ? (
                    <div className="rounded-md border-2 border-dashed border-border/50 bg-muted/20 px-4 py-12 text-center sm:px-6 sm:py-16">
                        <Film className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                        <h2 className="mb-2 text-[19px] font-semibold text-foreground">No videos yet</h2>
                        <p className="mb-6 text-[17px] text-muted-foreground">
                            Upload your first video to start populating /videos for your workspace.
                        </p>
                        <Link
                            href="/dashboard/videos/new"
                            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-[15px] font-medium text-primary-foreground"
                        >
                            <Plus className="h-4 w-4" />
                            Upload your first video
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Mobile Grid */}
                        <div className="space-y-3 md:hidden">
                            {videos.map((video) => (
                                <article key={video.id} className="rounded-md border border-border/60 bg-card p-4 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <Link href={`/dashboard/videos/${video.id}`} className="break-words font-medium text-[17px] text-foreground hover:text-primary">
                                                {video.title}
                                            </Link>
                                            {video.slug && (
                                                <p className="mt-1 break-all text-[14px] text-muted-foreground">/videos/{video.slug}</p>
                                            )}
                                        </div>
                                        {statusPill(video.status)}
                                    </div>
                                    <dl className="mt-4 grid grid-cols-2 gap-3 text-[15px] text-muted-foreground">
                                        <div>
                                            <dt className="uppercase tracking-wider">Locale</dt>
                                            <dd className="mt-1 font-medium uppercase text-foreground">{video.locale}</dd>
                                        </div>
                                        <div>
                                            <dt className="uppercase tracking-wider">Duration</dt>
                                            <dd className="mt-1 font-medium text-foreground">{formatDuration(video.video_duration)}</dd>
                                        </div>
                                        <div className="col-span-2">
                                            <dt className="uppercase tracking-wider">Updated</dt>
                                            <dd className="mt-1 font-medium text-foreground">
                                                {new Date(video.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                                            </dd>
                                        </div>
                                    </dl>
                                    {video.status === "published" && video.slug ? (
                                        <a
                                            href={`/videos/${video.slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-4 inline-flex items-center gap-1 text-[15px] text-muted-foreground hover:text-foreground"
                                        >
                                            View public page <ExternalLink className="h-3 w-3" />
                                        </a>
                                    ) : null}
                                </article>
                            ))}
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden overflow-x-auto rounded-md border border-border/60 bg-card shadow-sm md:block">
                            <table className="w-full text-[17px]">
                                <thead className="border-b border-border/50 bg-muted/30 text-left text-[14px] uppercase tracking-wider text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Title</th>
                                        <th className="px-4 py-3 font-medium">Status</th>
                                        <th className="px-4 py-3 font-medium">Locale</th>
                                        <th className="px-4 py-3 font-medium">Duration</th>
                                        <th className="px-4 py-3 font-medium">Updated</th>
                                        <th className="px-4 py-3 font-medium" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {videos.map((video) => (
                                        <tr key={video.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                                            <td className="px-4 py-3">
                                                <Link href={`/dashboard/videos/${video.id}`} className="font-medium text-foreground hover:text-primary">
                                                    {video.title}
                                                </Link>
                                                {video.slug && (
                                                    <p className="text-[14px] text-muted-foreground">/videos/{video.slug}</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">{statusPill(video.status)}</td>
                                            <td className="px-4 py-3 text-[15px] uppercase text-muted-foreground">{video.locale}</td>
                                            <td className="px-4 py-3 text-[15px] text-muted-foreground">{formatDuration(video.video_duration)}</td>
                                            <td className="px-4 py-3 text-[15px] text-muted-foreground">
                                                {new Date(video.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {video.status === "published" && video.slug && (
                                                    <a
                                                        href={`/videos/${video.slug}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-[15px] text-muted-foreground hover:text-foreground"
                                                    >
                                                        View <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </DashboardAppWorkbench>
    );
}
