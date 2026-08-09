import dynamic from "next/dynamic";
import { fetchFacilityDataForMembership } from "@/features/portal/actions/facility-operations-actions";
import { fetchPartnerAnnouncements } from "@/features/portal/actions/announcements";
import type { PartnerPortalAccess } from "@/features/portal/actions/portal-access";

const FacilityServicesPortal = dynamic(
    () =>
        import(
            "@/features/templates/ui/portal-renderers/facility-services-portal"
        ).then((m) => m.default),
    { ssr: true },
);

const GenericPartnerPortal = dynamic(
    () =>
        import(
            "@/features/templates/ui/portal-renderers/generic-partner-portal"
        ).then((m) => m.default),
    { ssr: true },
);

interface PortalRendererProps {
    access: PartnerPortalAccess;
}

/**
 * Routes the active workspace to its portal dashboard. Template-specific
 * renderers take precedence; any template without a bespoke dashboard (or with
 * missing template data) falls back to the generic workspace overview.
 */
export async function PortalRenderer({ access }: PortalRendererProps) {
    const { workspace, membershipId } = access;

    if (workspace.templateId === "facility-services") {
        const result = await fetchFacilityDataForMembership(
            membershipId,
            workspace.id,
            workspace.companyName,
        );

        if (result.data && result.data.locations.length > 0) {
            return <FacilityServicesPortal data={result.data} />;
        }
    }

    const announcements = await fetchPartnerAnnouncements(workspace.id);
    return <GenericPartnerPortal workspace={workspace} announcements={announcements} />;
}
