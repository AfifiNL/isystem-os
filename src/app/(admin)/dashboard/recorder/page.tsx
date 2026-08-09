import { requireAdminDashboardState } from "@/features/admin/lib/route-guard";
import { listClientProjects, listVoiceMemos } from "@/features/productivity/recorder/actions";
import { RecorderApp } from "@/features/productivity/recorder/recorder-app";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Voice Memo",
};

export default async function RecorderPage() {
    await requireAdminDashboardState();
    const [{ data: memos }, { data: projects }] = await Promise.all([
        listVoiceMemos(),
        listClientProjects(),
    ]);
    return <RecorderApp initialMemos={memos} projects={projects} />;
}
