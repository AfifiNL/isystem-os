import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import {
    getBookingAvailabilityRules,
    getBookingBlackoutWindows,
    getBookingCalendarConnections,
    getBookingDashboardSummary,
    getBookingFormDefinitions,
    getBookingLocations,
    getBookingReservations,
    getBookingResources,
    getBookingRuleDefinitions,
    getBookingServices,
    getBookingStaffProfiles,
    getBookingTemplateAdapters,
    getBookingTemplateProfiles,
} from "@/features/booking/actions";
import { AdminBookingControlCenter } from "@/features/booking/ui/admin-booking-control-center";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Booking Control Center",
    description: "Premium booking operations, intake, services, availability, and reservation workflows for Pro workspaces.",
};

export default async function BookingDashboardPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>;
}) {
    const state = await requireDashboardModuleAccess("booking");
    const params = await searchParams;
    const [
        summary,
        adapters,
        templateProfiles,
        services,
        resources,
        staffProfiles,
        locations,
        availabilityRules,
        blackoutWindows,
        ruleDefinitions,
        formDefinitions,
        reservations,
        calendarConnections,
    ] = await Promise.all([
        getBookingDashboardSummary(),
        getBookingTemplateAdapters(),
        getBookingTemplateProfiles(),
        getBookingServices(),
        getBookingResources(),
        getBookingStaffProfiles(),
        getBookingLocations(),
        getBookingAvailabilityRules(),
        getBookingBlackoutWindows(),
        getBookingRuleDefinitions(),
        getBookingFormDefinitions(),
        getBookingReservations(),
        getBookingCalendarConnections(),
    ]);

    return (
        <AdminBookingControlCenter
            workspaceTier={state.workspace.workspace_tier}
            summary={summary}
            adapters={adapters}
            templateProfiles={templateProfiles.data ?? []}
            services={services.data ?? []}
            resources={resources.data ?? []}
            staffProfiles={staffProfiles.data ?? []}
            locations={locations.data ?? []}
            availabilityRules={availabilityRules.data ?? []}
            blackoutWindows={blackoutWindows.data ?? []}
            ruleDefinitions={ruleDefinitions.data ?? []}
            formDefinitions={formDefinitions.data ?? []}
            reservations={reservations.data ?? []}
            calendarConnections={(calendarConnections.data ?? []) as never}
            initialTab={params.tab}
        />
    );
}
