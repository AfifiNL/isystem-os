import { requireAdminDashboardState } from "@/features/admin/lib/route-guard";
import { listNotes } from "@/features/productivity/notes/actions";
import { NotesApp } from "@/features/productivity/notes/notes-app";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Notes",
};

export default async function NotesPage() {
    await requireAdminDashboardState();
    const result = await listNotes({ archivedState: "active", page: 1, pageSize: 50 });
    return (
        <NotesApp
            initialNotes={result.data}
            initialActiveCount={result.activeCount}
            initialArchivedCount={result.archivedCount}
        />
    );
}
