import { PremiumPageLoading } from "@/shared/ui/loading";

export default function BookingLoading() {
    return (
        <PremiumPageLoading
            eyebrow="Booking"
            title="Loading booking center"
            description="Fetching booking resources, templates, profiles, and upcoming appointments."
            tone="default"
            metrics={4}
            panels={2}
        />
    );
}
