import { PremiumPageLoading } from "@/shared/ui/loading";

export default function NotesLoading() {
    return (
        <PremiumPageLoading
            eyebrow="Notes"
            title="Loading notes"
            description="Fetching notes, boards, and recent edits."
            tone="content"
            metrics={3}
            panels={2}
        />
    );
}
