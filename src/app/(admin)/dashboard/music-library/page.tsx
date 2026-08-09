import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { listMusicTracks } from "@/features/music-library/actions";
import { MusicLibraryApp } from "@/features/music-library/ui/music-library-app";
import {
    DashboardAppWorkbench,
} from "@/features/admin/ui/app-workbench";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Music Library",
};

export default async function MusicLibraryPage() {
    const state = await requireDashboardModuleAccess("music-library");
    const { data, error } = await listMusicTracks({ includeArchived: false });

    return (
        <DashboardAppWorkbench>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <MusicLibraryApp
                    initialTracks={data}
                    initialError={error}
                    canManage={state.role === "admin" || state.role === "manager"}
                />
            </div>
        </DashboardAppWorkbench>
    );
}
