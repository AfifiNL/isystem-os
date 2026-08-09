import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { listEpisodes, listShows } from "@/features/podcast/actions";
import { listMusicTracks } from "@/features/music-library/actions";
import { listVoices } from "@/features/voices/actions";
import { PodcastStudio } from "@/features/podcast/ui/podcast-studio";
import {
    DashboardAppWorkbench,
} from "@/features/admin/ui/app-workbench";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Podcast Studio",
};

export default async function PodcastPage() {
    const state = await requireDashboardModuleAccess("podcast");
    const [{ data: shows }, { data: episodes }, { data: tracks }, { data: voices }] = await Promise.all([
        listShows(),
        listEpisodes(),
        listMusicTracks({ includeArchived: false }),
        listVoices(false),
    ]);

    return (
        <DashboardAppWorkbench>
            <div className="min-h-0 flex-1 overflow-hidden md:h-[calc(100vh-8rem)]">
                <PodcastStudio
                    initialShows={shows}
                    initialEpisodes={episodes}
                    initialTracks={tracks}
                    initialVoices={voices}
                    canManage={state.role === "admin" || state.role === "manager"}
                />
            </div>
        </DashboardAppWorkbench>
    );
}
