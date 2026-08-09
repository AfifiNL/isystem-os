"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    AlertCircle,
    ArrowRight,
    Briefcase,
    CalendarClock,
    CalendarRange,
    CheckCircle2,
    Clock3,
    ConciergeBell,
    FileText,
    Layers3,
    MapPin,
    ShieldCheck,
    Sparkles,
    UserRound,
    Users,
    Link2,
} from "lucide-react";
import type { Tables } from "@/shared/lib/supabase/database.types";
import {
    BOOKING_MINIMUM_LEAD_TIME_MINUTES,
    BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES,
} from "@/features/booking/lib/booking-policies";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { ProFeatureNotice } from "@/shared/ui/pro-feature-notice";
import { PremiumInlinePending } from "@/shared/ui/loading";
import {
    DashboardAppWorkbench,
    AppCommandBar,
    AppTabList,
    AppMetricStrip,
    AppMetric,
    AppFeedbackLoop,
} from "@/features/admin/ui/app-workbench";
import {
    deleteBookingAvailabilityRule,
    deleteBookingBlackoutWindow,
    deleteBookingFormDefinition,
    deleteBookingLocation,
    deleteBookingResource,
    deleteBookingRuleDefinition,
    deleteBookingService,
    deleteBookingStaffProfile,
    deleteBookingTemplateProfile,
    confirmPaidBookingReservation,
    markBookingPaymentVerified,
    markBookingDeliveryStarted,
    setBookingServiceLocations,
    setBookingServiceResources,
    transitionBookingReservationStatus,
    disconnectBookingCalendarConnection,
    setBookingCalendarConnectionEnabled,
    testBookingCalendarConnection,
    testBookingZoomConnection,
    upsertBookingAvailabilityRule,
    upsertBookingBlackoutWindow,
    upsertBookingFormDefinition,
    upsertBookingLocation,
    upsertBookingResource,
    upsertBookingRuleDefinition,
    upsertBookingService,
    upsertBookingStaffProfile,
    upsertBookingTemplateProfile,
    updateBookingCustomerEmail,
    resendBookingNotification,
    retryBookingMeeting,
    retryBookingMeetingCleanup,
    retryConsultationPortalProvisioning,
} from "@/features/booking/actions";
import { BookingPaymentHolds } from "@/features/booking/ui/booking-payment-holds";
import { calculateBookingPrice } from "@/features/booking/lib/pricing";
import type { BookingDashboardSummary, BookingPaymentProvider, BookingSeededServiceDefinition, BookingTemplateAdapterDefinition } from "@/features/booking/types";
import {
    IntakeFieldsEditor,
    intakeSchemaFromJson,
    intakeSchemaToJson,
    type IntakeSchema,
} from "@/features/booking/ui/intake-fields-editor";

type BookingTemplateProfileRow = Tables<"booking_template_profiles">;
type BookingServiceRow = Tables<"booking_services">;
type BookingResourceRow = Tables<"booking_resources">;
type BookingStaffProfileRow = Tables<"booking_staff_profiles">;
type BookingLocationRow = Tables<"booking_locations">;
type BookingAvailabilityRuleRow = Tables<"booking_availability_rules">;
type BookingBlackoutWindowRow = Tables<"booking_blackout_windows">;
type BookingRuleDefinitionRow = Tables<"booking_rule_definitions">;
type BookingFormDefinitionRow = Tables<"booking_form_definitions">;
type BookingReservationRow = Tables<"booking_reservations">;

type BookingTab = "overview" | "connections" | "profiles" | "services" | "resources" | "locations" | "forms" | "availability" | "customization" | "analytics" | "reservations" | "payments";

type BookingCalendarConnection = {
    id: string;
    provider: string;
    account_email: string;
    calendar_id: string | null;
    sync_enabled: boolean;
    token_expires_at: string;
    last_sync_at: string | null;
    last_error: string | null;
};

interface AdminBookingControlCenterProps {
    workspaceTier: "basic" | "pro";
    summary: BookingDashboardSummary;
    adapters: BookingTemplateAdapterDefinition[];
    templateProfiles: BookingTemplateProfileRow[];
    services: BookingServiceRow[];
    resources: BookingResourceRow[];
    staffProfiles: BookingStaffProfileRow[];
    locations: BookingLocationRow[];
    availabilityRules: BookingAvailabilityRuleRow[];
    blackoutWindows: BookingBlackoutWindowRow[];
    ruleDefinitions: BookingRuleDefinitionRow[];
    formDefinitions: BookingFormDefinitionRow[];
    reservations: BookingReservationRow[];
    calendarConnections: BookingCalendarConnection[];
    initialTab?: string;
}

function classNames(...values: Array<string | false | null | undefined>) {
    return values.filter(Boolean).join(" ");
}

function createSlug(input: string) {
    return input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

function parseJsonInput(raw: string, fallback: Record<string, unknown> | Array<unknown> = {}) {
    const trimmed = raw.trim();
    if (!trimmed) {
        return fallback;
    }

    return JSON.parse(trimmed) as Record<string, unknown> | Array<unknown>;
}

function formatDate(value: string | null) {
    if (!value) {
        return "—";
    }

    return new Date(value).toLocaleString();
}

function formatReservationStatus(value: string) {
    return value.replace(/_/g, " ");
}

function readReservationPaymentState(reservation: BookingReservationRow): {
    state: "not_configured" | "payment_requested" | "verified" | "expired" | null;
    amountCents: number | null;
    currency: string | null;
    provider: "manual_revolut_pro" | "paypal_checkout" | null;
} {
    const metadata = reservation.metadata && typeof reservation.metadata === "object" && !Array.isArray(reservation.metadata)
        ? reservation.metadata as Record<string, unknown>
        : null;
    const stateRaw = typeof metadata?.paymentExtensionState === "string" ? metadata.paymentExtensionState : null;
    const allowed = ["not_configured", "payment_requested", "verified", "expired"] as const;
    const state = stateRaw && (allowed as readonly string[]).includes(stateRaw)
        ? (stateRaw as typeof allowed[number])
        : null;
    const provider = metadata?.paymentProvider === "manual_revolut_pro" || metadata?.paymentProvider === "paypal_checkout"
        ? metadata.paymentProvider
        : null;
    return {
        state,
        amountCents: typeof metadata?.paymentAmountCents === "number" ? metadata.paymentAmountCents : null,
        currency: typeof metadata?.paymentCurrency === "string" ? metadata.paymentCurrency : null,
        provider,
    };
}

function readReservationAntiAbuse(reservation: BookingReservationRow) {
    const metadata = reservation.metadata && typeof reservation.metadata === "object" && !Array.isArray(reservation.metadata)
        ? reservation.metadata as Record<string, unknown>
        : null;
    const antiAbuse = metadata?.antiAbuse && typeof metadata.antiAbuse === "object" && !Array.isArray(metadata.antiAbuse)
        ? metadata.antiAbuse as Record<string, unknown>
        : null;

    return {
        decision: typeof antiAbuse?.decision === "string" ? antiAbuse.decision : null,
        riskLevel: typeof antiAbuse?.riskLevel === "string" ? antiAbuse.riskLevel : null,
        riskScore: typeof antiAbuse?.riskScore === "number" ? antiAbuse.riskScore : null,
        reasons: Array.isArray(antiAbuse?.reasons) ? antiAbuse.reasons.filter((value): value is string => typeof value === "string") : [],
    };
}

function formatBookingPaymentProvider(value: string | null | undefined) {
    if (value === "paypal_checkout") {
        return "PayPal Checkout";
    }

    return "Manual Revolut Pro";
}

function getEmailDeliveryState(res: BookingReservationRow) {
    const metadata = res.metadata && typeof res.metadata === "object" && !Array.isArray(res.metadata)
        ? res.metadata as Record<string, unknown>
        : null;
    const delivery = metadata?.emailDelivery && typeof metadata.emailDelivery === "object" && !Array.isArray(metadata.emailDelivery)
        ? metadata.emailDelivery as Record<string, unknown>
        : null;
    const customer = delivery?.customer && typeof delivery.customer === "object" && !Array.isArray(delivery.customer)
        ? delivery.customer as Record<string, unknown>
        : null;
    return {
        status: typeof customer?.status === "string" ? customer.status : null,
        requiresCorrection: Boolean(customer?.requiresEmailCorrection),
        reason: typeof customer?.reason === "string" ? customer.reason : null,
    };
}

function getConsultationProvisioningState(reservation: BookingReservationRow) {
    const metadata = reservation.metadata && typeof reservation.metadata === "object" && !Array.isArray(reservation.metadata)
        ? reservation.metadata as Record<string, unknown>
        : null;
    return {
        consentGranted: metadata?.accountCreationConsentGranted === true,
        provisioned: typeof metadata?.provisionedPortalClientId === "string" && metadata.provisionedPortalClientId.length > 0,
        pending: metadata?.provisioningPending === true,
    };
}

const TABS: Array<{ key: BookingTab; label: string; icon: typeof Layers3 }> = [
    { key: "overview", label: "Overview", icon: Layers3 },
    { key: "connections", label: "Connections", icon: Link2 },
    { key: "profiles", label: "Template setup", icon: Sparkles },
    { key: "services", label: "Services", icon: ConciergeBell },
    { key: "resources", label: "Resources & staff", icon: Users },
    { key: "locations", label: "Locations", icon: MapPin },
    { key: "forms", label: "Forms", icon: FileText },
    { key: "availability", label: "Availability", icon: CalendarClock },
    { key: "customization", label: "Customization", icon: Sparkles },
    { key: "analytics", label: "Analytics", icon: ShieldCheck },
    { key: "reservations", label: "Reservations", icon: CalendarRange },
    { key: "payments", label: "Payment holds", icon: Clock3 },
];

export function AdminBookingControlCenter({
    workspaceTier,
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
    initialTab,
}: AdminBookingControlCenterProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
    const [activeTab, setActiveTab] = useState<BookingTab>(
        TABS.some((tab) => tab.key === initialTab) ? (initialTab as BookingTab) : "overview",
    );
    const [selectedAdapterKey, setSelectedAdapterKey] = useState<string>(adapters[0]?.templateKey ?? "consultation");
    const [selectedProfileId, setSelectedProfileId] = useState<string>(templateProfiles[0]?.id ?? "");
    const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id ?? "");
    const [selectedResourceId, setSelectedResourceId] = useState<string>(resources[0]?.id ?? "");
    const [selectedLocationId, setSelectedLocationId] = useState<string>(locations[0]?.id ?? "");
    const [profileSettingsDraft, setProfileSettingsDraft] = useState<string>("");
    const [heroHeadingDraft, setHeroHeadingDraft] = useState("");
    const [heroHeadingNlDraft, setHeroHeadingNlDraft] = useState("");
    const [heroBodyDraft, setHeroBodyDraft] = useState("");
    const [heroBodyNlDraft, setHeroBodyNlDraft] = useState("");
    const [ctaMicrocopyDraft, setCtaMicrocopyDraft] = useState("");
    const [ctaMicrocopyNlDraft, setCtaMicrocopyNlDraft] = useState("");
    const [serviceTitleDraft, setServiceTitleDraft] = useState<string>("");
    const [serviceSubtitleDraft, setServiceSubtitleDraft] = useState<string>("");
    const [serviceTypeDraft, setServiceTypeDraft] = useState<string>("");
    const [serviceDurationDraft, setServiceDurationDraft] = useState<string>("60");
    const [serviceDescriptionDraft, setServiceDescriptionDraft] = useState<string>("");
    const [serviceCapacityModeDraft, setServiceCapacityModeDraft] = useState<string>("single");
    const [serviceLocationModeDraft, setServiceLocationModeDraft] = useState<string>("onsite");
    const [servicePaymentRequiredDraft, setServicePaymentRequiredDraft] = useState<boolean>(false);
    const [servicePaymentProviderDraft, setServicePaymentProviderDraft] = useState<BookingPaymentProvider>("manual_revolut_pro");
    const [servicePriceAmountDraft, setServicePriceAmountDraft] = useState<string>("");
    const [servicePriceCurrencyDraft, setServicePriceCurrencyDraft] = useState<string>("EUR");
    const [servicePaymentUrlDraft, setServicePaymentUrlDraft] = useState<string>("");
    const [servicePaymentInstructionsDraft, setServicePaymentInstructionsDraft] = useState<string>("");
    const [servicePaymentDeadlineMinutesDraft, setServicePaymentDeadlineMinutesDraft] = useState<string>(String(BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES));
    const [serviceVatRateDraft, setServiceVatRateDraft] = useState<string>("0");
    const [serviceMeetingProviderDraft, setServiceMeetingProviderDraft] = useState<"none" | "google_meet" | "zoom">("none");
    // i18n drafts: nl/ar overrides written to copy_i18n. The DB trigger keeps
    // copy_i18n.en in sync with the plain-text columns above.
    const [serviceLocaleTab, setServiceLocaleTab] = useState<"nl" | "ar">("nl");
    const [serviceTitleNlDraft, setServiceTitleNlDraft] = useState<string>("");
    const [serviceSubtitleNlDraft, setServiceSubtitleNlDraft] = useState<string>("");
    const [serviceDescriptionNlDraft, setServiceDescriptionNlDraft] = useState<string>("");
    const [serviceTitleArDraft, setServiceTitleArDraft] = useState<string>("");
    const [serviceSubtitleArDraft, setServiceSubtitleArDraft] = useState<string>("");
    const [serviceDescriptionArDraft, setServiceDescriptionArDraft] = useState<string>("");
    const [locationLocaleTab, setLocationLocaleTab] = useState<"nl" | "ar">("nl");
    const [locationNameNl, setLocationNameNl] = useState<string>("");
    const [locationInstructionsNl, setLocationInstructionsNl] = useState<string>("");
    const [locationNameAr, setLocationNameAr] = useState<string>("");
    const [locationInstructionsAr, setLocationInstructionsAr] = useState<string>("");
    const [formTitleNl, setFormTitleNl] = useState<string>("");
    const [formTitleAr, setFormTitleAr] = useState<string>("");
    const [intakeSchemaDraft, setIntakeSchemaDraft] = useState<IntakeSchema>({ version: "1.0.0", fields: [] });
    const [editingFormId, setEditingFormId] = useState<string | null>(null);
    const [editingFormKey, setEditingFormKey] = useState<string>("");
    const [editingFormTitle, setEditingFormTitle] = useState<string>("");
    const [selectedSeededServiceKey, setSelectedSeededServiceKey] = useState<string>("");
    const [selectedReservationId, setSelectedReservationId] = useState<string>(reservations[0]?.id ?? "");
    const [correctedEmail, setCorrectedEmail] = useState<string>("");

    const adapterByKey = useMemo(
        () => Object.fromEntries(adapters.map((adapter) => [adapter.templateKey, adapter])) as Record<string, BookingTemplateAdapterDefinition>,
        [adapters],
    );

    const activeAdapter = adapterByKey[selectedAdapterKey] ?? adapters[0];
    const selectedProfile = templateProfiles.find((profile) => profile.id === selectedProfileId) ?? null;
    const selectedProfileAdapter = (selectedProfile ? adapterByKey[selectedProfile.template_key] : null) ?? activeAdapter;
    const selectedReservation = reservations.find((reservation) => reservation.id === selectedReservationId) ?? reservations[0] ?? null;

    useEffect(() => {
        setCorrectedEmail(selectedReservation?.customer_email || "");
    }, [selectedReservationId, selectedReservation?.customer_email]);

    const suspiciousReservations = reservations.filter((reservation) => {
        const antiAbuse = readReservationAntiAbuse(reservation);
        const metadata = reservation.metadata && typeof reservation.metadata === "object" && !Array.isArray(reservation.metadata)
            ? reservation.metadata as Record<string, unknown>
            : null;
        const delivery = metadata?.emailDelivery && typeof metadata.emailDelivery === "object" && !Array.isArray(metadata.emailDelivery)
            ? metadata.emailDelivery as Record<string, unknown>
            : null;
        const customer = delivery?.customer && typeof delivery.customer === "object" && !Array.isArray(delivery.customer)
            ? delivery.customer as Record<string, unknown>
            : null;
        const emailBounced = customer?.status === "bounced" || Boolean(customer?.requiresEmailCorrection);
        return antiAbuse.decision === "review" || antiAbuse.decision === "throttle" || antiAbuse.riskScore !== null || reservation.requires_manual_review || emailBounced;
    });
    const reservationServiceMap = useMemo(
        () => Object.fromEntries(services.map((service) => [service.id, service])) as Record<string, BookingServiceRow>,
        [services],
    );
    const reservationsByStatus = useMemo(() => {
        const counts = new Map<string, number>();

        for (const reservation of reservations) {
            counts.set(reservation.status, (counts.get(reservation.status) ?? 0) + 1);
        }

        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    }, [reservations]);
    const reservationsByService = useMemo(() => {
        const counts = new Map<string, number>();

        for (const reservation of reservations) {
            if (!reservation.service_id) continue;
            counts.set(reservation.service_id, (counts.get(reservation.service_id) ?? 0) + 1);
        }

        return Array.from(counts.entries())
            .map(([serviceId, count]) => ({
                serviceId,
                title: reservationServiceMap[serviceId]?.title ?? "Unknown service",
                count,
            }))
            .sort((a, b) => b.count - a.count);
    }, [reservationServiceMap, reservations]);
    const selectedProfileSettingsRecord = useMemo(
        () => (
            selectedProfile?.settings_json &&
            typeof selectedProfile.settings_json === "object" &&
            !Array.isArray(selectedProfile.settings_json)
        )
            ? (selectedProfile.settings_json as Record<string, unknown>)
            : {},
        [selectedProfile],
    );

    const selectedProfileSettings = useMemo(() => JSON.stringify({
        publicSections: activeAdapter?.publicSections ?? [],
        dashboardModules: activeAdapter?.dashboardModules ?? [],
        seededContent: activeAdapter?.seededContent ?? null,
    }, null, 2), [activeAdapter]);

    const selectedAdapterIntakeSchema = useMemo<IntakeSchema>(
        () => intakeSchemaFromJson(selectedProfileAdapter?.defaultIntakeSchema ?? { version: "1.0.0", fields: [] }),
        [selectedProfileAdapter],
    );

    useEffect(() => {
        setProfileSettingsDraft(selectedProfileSettings);
    }, [selectedProfileSettings]);

    useEffect(() => {
        if (!selectedProfile) {
            setHeroHeadingDraft("");
            setHeroHeadingNlDraft("");
            setHeroBodyDraft("");
            setHeroBodyNlDraft("");
            setCtaMicrocopyDraft("");
            setCtaMicrocopyNlDraft("");
            return;
        }

        setHeroHeadingDraft(typeof selectedProfileSettingsRecord.hero_heading === "string" ? selectedProfileSettingsRecord.hero_heading : "");
        setHeroHeadingNlDraft(typeof selectedProfileSettingsRecord.hero_heading_nl === "string" ? selectedProfileSettingsRecord.hero_heading_nl : "");
        setHeroBodyDraft(typeof selectedProfileSettingsRecord.hero_body === "string" ? selectedProfileSettingsRecord.hero_body : "");
        setHeroBodyNlDraft(typeof selectedProfileSettingsRecord.hero_body_nl === "string" ? selectedProfileSettingsRecord.hero_body_nl : "");
        setCtaMicrocopyDraft(typeof selectedProfileSettingsRecord.cta_microcopy === "string" ? selectedProfileSettingsRecord.cta_microcopy : "");
        setCtaMicrocopyNlDraft(typeof selectedProfileSettingsRecord.cta_microcopy_nl === "string" ? selectedProfileSettingsRecord.cta_microcopy_nl : "");
    }, [selectedProfile, selectedProfileSettingsRecord]);

    useEffect(() => {
        // Switching template profile resets the editor to the adapter default,
        // unless the user is mid-edit on an existing form (preserve that).
        if (!editingFormId) {
            setIntakeSchemaDraft(selectedAdapterIntakeSchema);
        }
    }, [selectedAdapterIntakeSchema, editingFormId]);

    function loadFormForEditing(formDefinition: BookingFormDefinitionRow) {
        setEditingFormId(formDefinition.id);
        setEditingFormKey(formDefinition.form_key);
        setEditingFormTitle(formDefinition.title);
        setIntakeSchemaDraft(intakeSchemaFromJson(formDefinition.schema_json));
        const localized = formDefinition.copy_i18n && typeof formDefinition.copy_i18n === "object" && !Array.isArray(formDefinition.copy_i18n)
            ? formDefinition.copy_i18n as Record<string, Record<string, string>>
            : null;
        setFormTitleNl(localized?.nl?.title ?? "");
        setFormTitleAr(localized?.ar?.title ?? "");
    }

    function clearFormEditor() {
        setEditingFormId(null);
        setEditingFormKey("");
        setEditingFormTitle("");
        setFormTitleNl("");
        setFormTitleAr("");
        setIntakeSchemaDraft(selectedAdapterIntakeSchema);
    }

    useEffect(() => {
        if (!selectedReservationId && reservations[0]?.id) {
            setSelectedReservationId(reservations[0].id);
        }
    }, [reservations, selectedReservationId]);

    useEffect(() => {
        if (selectedReservation) {
            setCorrectedEmail(selectedReservation.customer_email);
        }
    }, [selectedReservationId, selectedReservation]);

    useEffect(() => {
        const firstSeededService = selectedProfileAdapter?.seededServices?.[0];

        if (firstSeededService) {
            applySeededService(firstSeededService);
            return;
        }

        setSelectedSeededServiceKey("");
        setServiceTitleDraft("");
        setServiceSubtitleDraft("");
        setServiceDescriptionDraft("");
        setServiceTypeDraft(selectedProfileAdapter?.defaultServiceTypes[0] ?? "custom_service");
        setServiceDurationDraft("60");
        setServiceCapacityModeDraft("single");
        setServiceLocationModeDraft(selectedProfileAdapter?.templateKey === "consultation" ? "remote" : "onsite");
        setServicePaymentProviderDraft("manual_revolut_pro");
        setServicePaymentDeadlineMinutesDraft(String(BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES));
        setServiceVatRateDraft("0");
        setServiceMeetingProviderDraft("none");
    }, [selectedProfileAdapter]);

    function applySeededService(service: BookingSeededServiceDefinition) {
        const isBlueprint = service.serviceKey === "systems-blueprint";
        setSelectedSeededServiceKey(service.serviceKey);
        setServiceTitleDraft(service.title);
        setServiceSubtitleDraft(service.subtitle);
        setServiceTypeDraft(service.serviceType);
        setServiceDurationDraft(String(service.durationMinutes));
        setServiceDescriptionDraft(service.description);
        setServiceCapacityModeDraft(service.capacityMode);
        setServiceLocationModeDraft(service.locationMode);
        setServicePaymentDeadlineMinutesDraft(String(BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES));
        setServicePaymentRequiredDraft(isBlueprint);
        setServicePriceAmountDraft(isBlueprint ? "490" : "");
        setServicePriceCurrencyDraft("EUR");
        setServicePaymentProviderDraft(isBlueprint ? "paypal_checkout" : "manual_revolut_pro");
        setServicePaymentUrlDraft("");
        setServicePaymentInstructionsDraft(isBlueprint ? "Complete payment through PayPal Checkout to confirm this booking." : "");
        setServiceVatRateDraft(isBlueprint ? "21" : "0");
        setServiceMeetingProviderDraft(service.serviceKey === "systems-blueprint" || service.serviceKey === "systems-fit-call" ? "google_meet" : "none");
    }

    async function handleAction(action: () => Promise<{ error?: string | null; message?: string | null } | { success?: boolean; error?: string | null; message?: string | null }>) {
        setStatus(null);
        startTransition(async () => {
            try {
                const result = await action();
                if ("error" in result && result.error) {
                    setStatus({ tone: "error", message: result.error });
                    return;
                }

                const successMessage = "message" in result && typeof result.message === "string" && result.message.length > 0
                    ? result.message
                    : "Booking configuration updated.";
                setStatus({ tone: "success", message: successMessage });
                router.refresh();
            } catch (error) {
                setStatus({ tone: "error", message: error instanceof Error ? error.message : "Something went wrong." });
            }
        });
    }

    if (workspaceTier === "basic") {
        return (
            <DashboardAppWorkbench>
                <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-6">
                    <div>
                        <h1 className="text-[23px] font-bold tracking-tight text-foreground sm:text-[27px]">Booking Control Center</h1>
                        <p className="mt-2 text-[17px] text-muted-foreground">
                            Design consultation, real-estate, horeca, and custom booking flows from the dashboard, then publish an on-brand public reservation journey with a structured inbox.
                        </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-4">
                        {[
                            { label: "Adapters ready", value: adapters.length, icon: Sparkles },
                            { label: "Draft services possible", value: 4, icon: ConciergeBell },
                            { label: "Reservation inbox", value: "Live", icon: CalendarRange },
                            { label: "Public booking journey", value: "Pro", icon: ArrowRight },
                        ].map((item) => (
                            <Card key={item.label} className="border-border/60 bg-card/40 shadow-2xs">
                                <CardContent className="flex items-center justify-between p-6">
                                    <div>
                                        <p className="text-[14px] uppercase tracking-wider text-muted-foreground font-semibold">{item.label}</p>
                                        <p className="mt-2 text-[23px] font-bold text-foreground">{item.value}</p>
                                    </div>
                                    <div className="rounded-md border border-primary/20 bg-primary/10 p-3 text-primary">
                                        <item.icon className="h-5 w-5" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <ProFeatureNotice
                        title="Activate Pro to publish premium booking journeys"
                        description="Booking is intentionally visible here so operators can understand the workflow, but live setup, public rendering, and reservation operations only activate on Pro workspaces."
                        benefits={[
                            "Launch a premium public booking page matched to your active theme and template.",
                            "Configure services, staff, locations, forms, blackout rules, and reservation messaging.",
                            "Run the structured reservations inbox and analytics layer from one operator surface.",
                        ]}
                    />
                </div>
            </DashboardAppWorkbench>
        );
    }

    const tabs = TABS.map((tab) => ({ label: tab.label, value: tab.key }));

    return (
        <DashboardAppWorkbench>
            <AppCommandBar
                leading={<span className="text-[15px] font-bold text-foreground">Booking Ops</span>}
                tabs={
                    <AppTabList
                        tabs={tabs}
                        selectedValue={activeTab}
                        onSelect={(val) => setActiveTab(val as BookingTab)}
                    />
                }
            />

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
                <div className="rounded-md border border-border/60 bg-card/35 px-3 py-3 sm:px-4">
                    <h1 className="text-[21px] font-bold tracking-tight text-foreground sm:text-[25px]">Booking Control Center</h1>
                    <p className="mt-1 text-[15px] leading-6 text-muted-foreground">
                        Configure template-aware booking profiles, publish premium services, control staff and locations, and keep the reservations inbox operational without leaving the dashboard.
                    </p>
                </div>

                {isPending ? (
                    <div className="flex items-center gap-3 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-[15px] font-medium">
                        <PremiumInlinePending label="Applying booking change" description="Syncing with the database" />
                    </div>
                ) : status ? (
                    <div className={classNames(
                        "flex items-center gap-3 rounded-md px-4 py-3 text-[15px] font-medium",
                        status.tone === "success"
                            ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border border-destructive/20 bg-destructive/10 text-destructive",
                    )}>
                        {status.tone === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        {status.message}
                    </div>
                ) : null}

                <AppMetricStrip className="px-0 py-0 border-b-0 bg-transparent">
                    <AppMetric label="Template Profiles" value={summary.templateProfiles} icon={Sparkles} />
                    <AppMetric label="Published Profiles" value={summary.publishedProfiles} icon={Sparkles} />
                    <AppMetric label="Services" value={summary.services} icon={ConciergeBell} />
                    <AppMetric label="Pending Review" value={summary.pendingReviewReservations} icon={Clock3} variant={summary.pendingReviewReservations > 0 ? "warning" : "default"} />
                    <AppMetric label="Confirmed" value={summary.confirmedReservations} icon={ShieldCheck} variant="success" />
                    <AppMetric label="Upcoming" value={summary.upcomingReservations} icon={CalendarRange} />
                </AppMetricStrip>

                <AppFeedbackLoop
                    title="Reservation control loop"
                    description="A booking moves from configured capacity to a verified customer outcome."
                    stages={[
                        { label: "Services", value: summary.services, detail: "published paths", tone: summary.services > 0 ? "info" : "warning" },
                        { label: "Pending", value: summary.pendingReviewReservations, detail: "operator review", tone: summary.pendingReviewReservations > 0 ? "warning" : "success" },
                        { label: "Confirmed", value: summary.confirmedReservations, detail: "secured slots", tone: "success" },
                        { label: "Completed", value: summary.completedReservations, detail: "real outcomes", tone: "success" },
                    ]}
                    feedbackLabel="No-shows, payment holds, and completed reservations should change availability rules and service design."
                />

            {activeTab === "connections" ? (
                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                    <Card className="premium-panel rounded-lg border-border/60 bg-background/75">
                        <CardHeader>
                            <CardTitle>Calendar and meeting connections</CardTitle>
                            <CardDescription>Connect Google Calendar to create private calendar events and free Google Meet links. Zoom is configured server-side when the free Zoom credentials are available.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col gap-3 rounded-md border border-border/60 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="font-semibold text-foreground">Google Calendar</p>
                                    <p className="mt-1 text-sm text-muted-foreground">OAuth connection with Calendar events, free/busy, and Meet conference creation.</p>
                                </div>
                                <Link href="/api/booking/calendar/google/connect" className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/15">
                                    <Link2 className="h-4 w-4" />
                                    {calendarConnections.some((connection) => connection.provider === "google") ? "Reconnect Google" : "Connect Google"}
                                </Link>
                            </div>
                            {calendarConnections.length === 0 ? (
                                <p className="rounded-md border border-dashed border-border/60 px-4 py-5 text-sm text-muted-foreground">No Google Calendar connection is active yet.</p>
                            ) : calendarConnections.map((connection) => (
                                <div key={connection.id} className="rounded-md border border-border/60 bg-background/60 p-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="font-semibold text-foreground">{connection.account_email}</p>
                                            <p className="mt-1 text-sm text-muted-foreground">{connection.provider} · {connection.calendar_id ?? "primary"}</p>
                                            {connection.last_error ? <p className="mt-2 text-sm text-destructive">{connection.last_error}</p> : null}
                                        </div>
                                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${connection.sync_enabled ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border/60 text-muted-foreground"}`}>
                                            {connection.sync_enabled ? "Enabled" : "Disabled"}
                                        </span>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <Button variant="outline" size="sm" onClick={() => handleAction(() => testBookingCalendarConnection(connection.id))}>Test</Button>
                                        <Button variant="outline" size="sm" onClick={() => handleAction(() => setBookingCalendarConnectionEnabled(connection.id, !connection.sync_enabled))}>{connection.sync_enabled ? "Disable" : "Enable"}</Button>
                                        <Button variant="outline" size="sm" onClick={() => handleAction(() => disconnectBookingCalendarConnection(connection.id))}>Disconnect</Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                    <Card className="premium-panel rounded-lg border-border/60 bg-background/75">
                        <CardHeader><CardTitle>Free-provider policy</CardTitle></CardHeader>
                        <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                            <p>Google Meet is used for the 90-minute Systems Blueprint and supports the free one-to-one booking path.</p>
                            <p>Zoom is allowed only for services up to 40 minutes. Configure its Server-to-Server OAuth credentials in Coolify; customer rows never store host URLs.</p>
                            <p>Provider failures keep the booking pending. Confirmation is released only after a customer-safe meeting link is ready.</p>
                            <Button variant="outline" size="sm" onClick={() => handleAction(() => testBookingZoomConnection())}>Test Zoom provisioning</Button>
                        </CardContent>
                    </Card>
                </div>
            ) : activeTab === "overview" ? (
                <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                    <Card className="premium-panel premium-glow rounded-lg border-border/60 bg-background/75">
                        <CardHeader>
                            <CardTitle>Adapter strategy</CardTitle>
                            <CardDescription>Each adapter keeps vocabulary and conversion blocks distinct while the shared engine drives reservations, availability, and intake.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            {adapters.map((adapter) => (
                                <article key={adapter.templateKey} className="rounded-md border border-border/60 bg-background/70 p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{adapter.templateKey.replace(/_/g, " ")}</p>
                                            <h3 className="mt-2 text-lg font-semibold text-foreground">{adapter.displayName}</h3>
                                        </div>
                                        <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                                            {adapter.slotStrategy.replace(/_/g, " ")}
                                        </span>
                                    </div>
                                    <p className="mt-4 text-sm leading-6 text-muted-foreground">
                                        Entity mode: <span className="font-medium text-foreground">{adapter.entityMode}</span>. Public flow blocks: {adapter.publicSections.join(", ")}.
                                    </p>
                                </article>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="premium-panel rounded-lg border-border/60 bg-background/75">
                        <CardHeader>
                            <CardTitle>Inbox momentum</CardTitle>
                            <CardDescription>Operational view of the booking funnel right now.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {[
                                { label: "Pending review", value: summary.pendingReviewReservations },
                                { label: "Confirmed", value: summary.confirmedReservations },
                                { label: "Completed", value: summary.completedReservations },
                                { label: "Reservations total", value: summary.reservations },
                            ].map((entry) => (
                                <div key={entry.label} className="rounded-md border border-border/60 bg-background/80 p-4">
                                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{entry.label}</p>
                                    <p className="mt-2 text-2xl font-bold text-foreground">{entry.value}</p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            ) : null}

            {activeTab === "profiles" ? (
                <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                    <Card className="premium-panel rounded-lg border-border/60 bg-background/75">
                        <CardHeader>
                            <CardTitle>Create template profile</CardTitle>
                            <CardDescription>Choose the booking adapter that shapes the public journey and operator modules for this workspace.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <Input id="profileKey" placeholder="primary" defaultValue="primary" />
                            <select value={selectedAdapterKey} onChange={(event) => setSelectedAdapterKey(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                                {adapters.map((adapter) => (
                                    <option key={adapter.templateKey} value={adapter.templateKey}>{adapter.displayName}</option>
                                ))}
                            </select>
                            <select id="profileStatus" defaultValue="active" className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                                <option value="draft">Draft</option>
                                <option value="active">Active</option>
                                <option value="archived">Archived</option>
                            </select>
                            <div className="space-y-4 rounded-md border border-border/60 bg-background/80 p-4">
                                <div>
                                    <p className="font-medium text-foreground">Hero Customization</p>
                                    <p className="text-xs text-muted-foreground mt-1">Override the default adapter copy for English and Dutch visitors. Leave blank to use defaults.</p>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-semibold uppercase text-muted-foreground">Hero Heading (EN)</label>
                                        <Input value={heroHeadingDraft} onChange={(e) => setHeroHeadingDraft(e.target.value)} placeholder="English heading..." className="bg-background" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-semibold uppercase text-muted-foreground">Hero Heading (NL)</label>
                                        <Input value={heroHeadingNlDraft} onChange={(e) => setHeroHeadingNlDraft(e.target.value)} placeholder="Dutch heading..." className="bg-background" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-semibold uppercase text-muted-foreground">Hero Body (EN)</label>
                                        <Textarea rows={3} value={heroBodyDraft} onChange={(e) => setHeroBodyDraft(e.target.value)} placeholder="English body text..." className="bg-background" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-semibold uppercase text-muted-foreground">Hero Body (NL)</label>
                                        <Textarea rows={3} value={heroBodyNlDraft} onChange={(e) => setHeroBodyNlDraft(e.target.value)} placeholder="Dutch body text..." className="bg-background" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-semibold uppercase text-muted-foreground">CTA Microcopy (EN)</label>
                                        <Input value={ctaMicrocopyDraft} onChange={(e) => setCtaMicrocopyDraft(e.target.value)} placeholder="English CTA..." className="bg-background" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-semibold uppercase text-muted-foreground">CTA Microcopy (NL)</label>
                                        <Input value={ctaMicrocopyNlDraft} onChange={(e) => setCtaMicrocopyNlDraft(e.target.value)} placeholder="Dutch CTA..." className="bg-background" />
                                    </div>
                                </div>
                            </div>
                            {activeAdapter?.seededContent ? (
                                <div className="rounded-md border border-primary/15 bg-primary/5 p-4 text-sm">
                                    <p className="font-medium text-foreground">Starter consultation copy</p>
                                    <p className="mt-2 text-muted-foreground">Selecting the consultation adapter now preloads premium positioning blocks into template settings so managers can apply and lightly edit instead of starting from scratch.</p>
                                    <div className="mt-4 grid gap-3">
                                        {activeAdapter.seededContent.positioning.map((block) => (
                                            <div key={block.key} className="rounded-md border border-border/60 bg-background/80 p-4">
                                                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{block.label}</p>
                                                <p className="mt-2 leading-6 text-foreground">{block.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                            <Button
                                onClick={() => handleAction(async () => upsertBookingTemplateProfile({
                                    profileKey: (document.getElementById("profileKey") as HTMLInputElement).value,
                                    templateKey: selectedAdapterKey,
                                    status: (document.getElementById("profileStatus") as HTMLSelectElement).value,
                                    settingsJson: {
                                        ...(parseJsonInput(profileSettingsDraft) as Record<string, unknown>),
                                        ...(heroHeadingDraft.trim() ? { hero_heading: heroHeadingDraft.trim() } : {}),
                                        ...(heroHeadingNlDraft.trim() ? { hero_heading_nl: heroHeadingNlDraft.trim() } : {}),
                                        ...(heroBodyDraft.trim() ? { hero_body: heroBodyDraft.trim() } : {}),
                                        ...(heroBodyNlDraft.trim() ? { hero_body_nl: heroBodyNlDraft.trim() } : {}),
                                        ...(ctaMicrocopyDraft.trim() ? { cta_microcopy: ctaMicrocopyDraft.trim() } : {}),
                                        ...(ctaMicrocopyNlDraft.trim() ? { cta_microcopy_nl: ctaMicrocopyNlDraft.trim() } : {}),
                                    },
                                    brandingJson: {},
                                    analyticsJson: {},
                                    placementConfigJson: {},
                                    publishedAt: (document.getElementById("profileStatus") as HTMLSelectElement).value === "active" ? new Date().toISOString() : null,
                                }))}
                                disabled={isPending}
                            >
                                <Sparkles className="h-4 w-4" />
                                Save template profile
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="premium-panel premium-glow rounded-lg border-border/60 bg-background/75">
                        <CardHeader>
                            <CardTitle>Active profiles</CardTitle>
                            <CardDescription>Profiles determine which adapter powers your dashboard vocabulary and the public booking journey.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            {templateProfiles.length > 0 ? templateProfiles.map((profile) => (
                                <article key={profile.id} className="rounded-md border border-border/60 bg-background/80 p-5">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{profile.profile_key}</p>
                                            <h3 className="mt-2 text-lg font-semibold text-foreground">{profile.template_key.replace(/_/g, " ")}</h3>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{profile.status}</span>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={isPending}
                                                onClick={() => handleAction(async () => deleteBookingTemplateProfile(profile.id))}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                </article>
                            )) : <p className="text-sm text-muted-foreground">No booking template profiles yet.</p>}
                        </CardContent>
                    </Card>
                </div>
            ) : null}

            {activeTab === "services" ? (
                <div className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
                    <Card className="premium-panel rounded-lg border-border/60 bg-background/75">
                        <CardHeader>
                            <CardTitle>Publish service inventory</CardTitle>
                            <CardDescription>Build a conversion-oriented service layer with duration, capacity, and operator review logic.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <select value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                                <option value="">Select template profile</option>
                                {templateProfiles.map((profile) => (
                                    <option key={profile.id} value={profile.id}>{profile.profile_key} · {profile.template_key}</option>
                                ))}
                            </select>
                            {selectedProfileAdapter?.seededServices?.length ? (
                                <div className="rounded-md border border-primary/15 bg-primary/5 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">Seeded consultation offerings</p>
                                            <p className="mt-1 text-sm text-muted-foreground">Use the starter defaults as a ready-made starting point, then edit the final details for this workspace.</p>
                                        </div>
                                        <select value={selectedSeededServiceKey} onChange={(event) => {
                                            const seededService = selectedProfileAdapter.seededServices?.find((entry) => entry.serviceKey === event.target.value);
                                            if (seededService) {
                                                applySeededService(seededService);
                                            }
                                        }} className="h-10 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm sm:min-w-[250px]">
                                            {selectedProfileAdapter.seededServices.map((service) => (
                                                <option key={service.serviceKey} value={service.serviceKey}>{service.title}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="mt-4 grid gap-3">
                                        {selectedProfileAdapter.seededServices.map((service) => (
                                            <article key={service.serviceKey} className={classNames(
                                                "rounded-md border bg-background/85 p-4 transition-colors",
                                                selectedSeededServiceKey === service.serviceKey ? "border-primary/40 shadow-[0_0_0_1px_rgba(59,130,246,0.12)]" : "border-border/60",
                                            )}>
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div>
                                                        <h3 className="text-base font-semibold text-foreground">{service.title}</h3>
                                                        <p className="mt-1 text-sm text-muted-foreground">{service.subtitle}</p>
                                                    </div>
                                                    <Button type="button" variant={selectedSeededServiceKey === service.serviceKey ? "default" : "outline"} onClick={() => applySeededService(service)}>
                                                        Apply defaults
                                                    </Button>
                                                </div>
                                                <p className="mt-3 text-sm leading-6 text-muted-foreground">{service.description}</p>
                                                <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                    <span className="rounded-full border border-border/60 px-3 py-1">{service.durationMinutes} min</span>
                                                    <span className="rounded-full border border-border/60 px-3 py-1">{service.locationMode}</span>
                                                    <span className="rounded-full border border-border/60 px-3 py-1">{service.serviceType}</span>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                            <Input id="serviceTitle" placeholder="Premium consultation session (English)" value={serviceTitleDraft} onChange={(event) => setServiceTitleDraft(event.target.value)} />
                            <Input id="serviceSubtitle" placeholder="Short supporting promise for the public catalog (English)" value={serviceSubtitleDraft} onChange={(event) => setServiceSubtitleDraft(event.target.value)} />
                            <Input id="serviceType" placeholder="consultation_call" value={serviceTypeDraft} onChange={(event) => setServiceTypeDraft(event.target.value)} />
                            <Input id="serviceDuration" type="number" min={15} value={serviceDurationDraft} onChange={(event) => setServiceDurationDraft(event.target.value)} placeholder="Duration minutes" />
                            <Textarea id="serviceDescription" rows={4} value={serviceDescriptionDraft} onChange={(event) => setServiceDescriptionDraft(event.target.value)} placeholder="Describe the outcome, positioning, and promise of this booking offer. (English)" />

                            {/* Locale overrides — translations stored as copy_i18n.{nl,ar} */}
                            <div className="rounded-md border border-border/60 bg-background/60 p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-foreground">Localized copy</p>
                                    <div className="inline-flex rounded-full border border-border/60 bg-background p-0.5 text-xs">
                                        <button type="button" onClick={() => setServiceLocaleTab("nl")} className={`rounded-full px-3 py-1 ${serviceLocaleTab === "nl" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>NL</button>
                                        <button type="button" onClick={() => setServiceLocaleTab("ar")} className={`rounded-full px-3 py-1 ${serviceLocaleTab === "ar" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>AR</button>
                                    </div>
                                </div>
                                <p className="mb-3 text-xs text-muted-foreground">English is canonical and synced from the fields above. Optional translations below render on /nl and /ar.</p>
                                {serviceLocaleTab === "nl" ? (
                                    <div className="grid gap-3">
                                        <Input dir="auto" placeholder="Title (Dutch)" value={serviceTitleNlDraft} onChange={(e) => setServiceTitleNlDraft(e.target.value)} />
                                        <Input dir="auto" placeholder="Subtitle (Dutch)" value={serviceSubtitleNlDraft} onChange={(e) => setServiceSubtitleNlDraft(e.target.value)} />
                                        <Textarea rows={3} dir="auto" placeholder="Description (Dutch)" value={serviceDescriptionNlDraft} onChange={(e) => setServiceDescriptionNlDraft(e.target.value)} />
                                    </div>
                                ) : (
                                    <div className="grid gap-3">
                                        <Input dir="rtl" placeholder="العنوان (Arabic title)" value={serviceTitleArDraft} onChange={(e) => setServiceTitleArDraft(e.target.value)} />
                                        <Input dir="rtl" placeholder="العنوان الفرعي (Arabic subtitle)" value={serviceSubtitleArDraft} onChange={(e) => setServiceSubtitleArDraft(e.target.value)} />
                                        <Textarea rows={3} dir="rtl" placeholder="الوصف (Arabic description)" value={serviceDescriptionArDraft} onChange={(e) => setServiceDescriptionArDraft(e.target.value)} />
                                    </div>
                                )}
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <select id="serviceCapacityMode" value={serviceCapacityModeDraft} onChange={(event) => setServiceCapacityModeDraft(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                                    <option value="single">Single</option>
                                    <option value="group">Group</option>
                                    <option value="pooled">Pooled</option>
                                    <option value="capacity">Capacity</option>
                                </select>
                                <select id="serviceLocationMode" value={serviceLocationModeDraft} onChange={(event) => setServiceLocationModeDraft(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                                    <option value="onsite">Onsite</option>
                                    <option value="remote">Remote</option>
                                    <option value="hybrid">Hybrid</option>
                                </select>
                            </div>
                            <div className="grid gap-3 rounded-md border border-border/60 bg-background/60 p-4 md:grid-cols-3">
                                <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                                    VAT rate (%)
                                    <Input type="number" min={0} max={100} step="0.01" value={serviceVatRateDraft} onChange={(event) => setServiceVatRateDraft(event.target.value)} />
                                </label>
                                <label className="grid gap-1.5 text-xs font-medium text-muted-foreground md:col-span-2">
                                    Free meeting provider
                                    <select value={serviceMeetingProviderDraft} onChange={(event) => setServiceMeetingProviderDraft(event.target.value as "none" | "google_meet" | "zoom")} className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground">
                                        <option value="none">No automatic room</option>
                                        <option value="google_meet">Google Meet</option>
                                        <option value="zoom">Zoom (max 40 minutes)</option>
                                    </select>
                                </label>
                            </div>
                            <div className="rounded-md border border-border/60 bg-background/60 p-4">
                                <div className="flex items-center justify-between gap-3">
                                     <div>
                                         <p className="text-sm font-medium text-foreground">Payment method</p>
                                         <p className="text-xs text-muted-foreground">Paid services hold the slot in pending_confirmation for 24 hours until payment is verified or captured. Public slots always require at least 72 hours notice.</p>
                                    </div>
                                    <label className="inline-flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={servicePaymentRequiredDraft}
                                            onChange={(event) => setServicePaymentRequiredDraft(event.target.checked)}
                                        />
                                        Payment required
                                    </label>
                                </div>
                                 {servicePaymentRequiredDraft ? (
                                     <div className="mt-4 grid gap-3 md:grid-cols-2">
                                         <label className="grid gap-1.5 text-xs font-medium text-muted-foreground md:col-span-2">
                                             Payment provider
                                             <select
                                                 value={servicePaymentProviderDraft}
                                                 onChange={(event) => setServicePaymentProviderDraft(event.target.value as BookingPaymentProvider)}
                                                 className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
                                             >
                                                 <option value="manual_revolut_pro">Manual Revolut Pro — static payment link + manual verification</option>
                                                 <option value="paypal_checkout">PayPal Checkout — generated approval URL per reservation</option>
                                             </select>
                                         </label>
                                         <div className="rounded-xl border border-border/60 bg-background/80 p-3 text-xs leading-5 text-muted-foreground md:col-span-2">
                                             {servicePaymentProviderDraft === "paypal_checkout"
                                                 ? "PayPal approval URLs are generated per reservation. Leave the static payment URL blank; configure PAYPAL_* environment variables and the PayPal webhook in deployment."
                                                 : "Manual Revolut Pro requires a static payment URL and clear customer instructions so operators can verify the payment manually."}
                                         </div>
                                         <Input
                                             type="number"
                                            min={0}
                                            step="0.01"
                                            placeholder="Price (e.g. 50.00)"
                                            value={servicePriceAmountDraft}
                                            onChange={(event) => setServicePriceAmountDraft(event.target.value)}
                                        />
                                        <Input
                                            placeholder="Currency (EUR)"
                                            maxLength={3}
                                            value={servicePriceCurrencyDraft}
                                            onChange={(event) => setServicePriceCurrencyDraft(event.target.value.toUpperCase())}
                                        />
                                         {servicePaymentProviderDraft === "manual_revolut_pro" ? (
                                             <Input
                                                 className="md:col-span-2"
                                                 placeholder="Revolut Pro payment URL (https://revolut.me/...)"
                                                 value={servicePaymentUrlDraft}
                                                 onChange={(event) => setServicePaymentUrlDraft(event.target.value)}
                                             />
                                         ) : null}
                                         <Textarea
                                             className="md:col-span-2"
                                             rows={2}
                                             placeholder={servicePaymentProviderDraft === "paypal_checkout"
                                                 ? "Optional PayPal checkout note shown to the customer. Do not paste approval URLs here."
                                                 : "Optional payment instructions shown to the customer. Include Revolut note/reference guidance if needed."}
                                             value={servicePaymentInstructionsDraft}
                                            onChange={(event) => setServicePaymentInstructionsDraft(event.target.value)}
                                        />
                                         <Input
                                             type="number"
                                             min={BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES}
                                             max={BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES}
                                             placeholder="Payment deadline (fixed 1440 = 24h)"
                                             value={servicePaymentDeadlineMinutesDraft}
                                             onChange={(event) => setServicePaymentDeadlineMinutesDraft(event.target.value)}
                                             disabled
                                         />
                                    </div>
                                ) : null}
                            </div>
                            <Button
                                onClick={() => handleAction(async () => upsertBookingService({
                                    templateProfileId: selectedProfileId,
                                    serviceKey: selectedSeededServiceKey || createSlug(serviceTitleDraft),
                                    serviceType: serviceTypeDraft,
                                    title: serviceTitleDraft,
                                    subtitle: serviceSubtitleDraft || null,
                                    description: serviceDescriptionDraft,
                                    durationMinutes: Number(serviceDurationDraft || 60),
                                    capacityMode: serviceCapacityModeDraft,
                                    locationMode: serviceLocationModeDraft,
                                    visibilityStatus: "published",
                                    requiresManualReview: selectedProfileAdapter?.templateKey === "real_estate",
                                    paymentRequired: servicePaymentRequiredDraft,
                                    priceAmountCents: servicePaymentRequiredDraft && servicePriceAmountDraft
                                        ? Math.round(Number(servicePriceAmountDraft) * 100)
                                        : null,
                                    priceCurrency: (servicePriceCurrencyDraft || "EUR").toUpperCase(),
                                     paymentProvider: servicePaymentProviderDraft,
                                     paymentUrl: servicePaymentRequiredDraft && servicePaymentProviderDraft === "manual_revolut_pro" ? (servicePaymentUrlDraft.trim() || null) : null,
                                    paymentInstructions: servicePaymentRequiredDraft ? (servicePaymentInstructionsDraft.trim() || null) : null,
                                    vatRateBasisPoints: Math.round(Number(serviceVatRateDraft || 0) * 100),
                                    virtualMeetingProvider: serviceMeetingProviderDraft,
                                    autoCreateVirtualMeeting: serviceMeetingProviderDraft !== "none",
                                    leadTimeMinutes: BOOKING_MINIMUM_LEAD_TIME_MINUTES,
                                    paymentDeadlineMinutes: BOOKING_PAYMENT_COMPLETION_WINDOW_MINUTES,
                                    metadata: {
                                        templateKey: selectedProfileAdapter?.templateKey ?? "custom",
                                        seededServiceKey: selectedSeededServiceKey || null,
                                        seededContent: selectedProfileAdapter?.seededContent ?? null,
                                        seededService: selectedProfileAdapter?.seededServices?.find((entry) => entry.serviceKey === selectedSeededServiceKey) ?? null,
                                    },
                                    localeOverrides: {
                                        nl: {
                                            title: serviceTitleNlDraft || undefined,
                                            subtitle: serviceSubtitleNlDraft || undefined,
                                            description: serviceDescriptionNlDraft || undefined,
                                        },
                                        ar: {
                                            title: serviceTitleArDraft || undefined,
                                            subtitle: serviceSubtitleArDraft || undefined,
                                            description: serviceDescriptionArDraft || undefined,
                                        },
                                    },
                                }))}
                                disabled={isPending || !selectedProfileId}
                            >
                                <ConciergeBell className="h-4 w-4" />
                                Save service
                            </Button>

                            <div className="rounded-md border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                                <p className="font-medium text-foreground">Primary resource / location assignment</p>
                                <div className="mt-3 grid gap-3 md:grid-cols-3">
                                    <select value={selectedServiceId} onChange={(event) => setSelectedServiceId(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                                        <option value="">Select service</option>
                                        {services.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}
                                    </select>
                                    <select value={selectedResourceId} onChange={(event) => setSelectedResourceId(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                                        <option value="">Select resource</option>
                                        {resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}
                                    </select>
                                    <Button onClick={() => handleAction(async () => setBookingServiceResources({ serviceId: selectedServiceId, links: selectedServiceId && selectedResourceId ? [{ serviceId: selectedServiceId, resourceId: selectedResourceId, assignmentMode: "primary", metadata: { uiManaged: true } }] : [] }))} disabled={isPending || !selectedServiceId} variant="outline">
                                        Link primary resource
                                    </Button>
                                </div>
                                <div className="mt-3 grid gap-3 md:grid-cols-3">
                                    <select value={selectedServiceId} onChange={(event) => setSelectedServiceId(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                                        <option value="">Select service</option>
                                        {services.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}
                                    </select>
                                    <select value={selectedLocationId} onChange={(event) => setSelectedLocationId(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                                        <option value="">Select location</option>
                                        {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                                    </select>
                                    <Button onClick={() => handleAction(async () => setBookingServiceLocations({ serviceId: selectedServiceId, links: selectedServiceId && selectedLocationId ? [{ serviceId: selectedServiceId, locationId: selectedLocationId, isDefault: true, metadata: { uiManaged: true } }] : [] }))} disabled={isPending || !selectedServiceId} variant="outline">
                                        Link default location
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="premium-panel premium-glow rounded-lg border-border/60 bg-background/75">
                        <CardHeader>
                            <CardTitle>Published services</CardTitle>
                            <CardDescription>These offers drive the public booking catalog and analytics source attribution.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            {services.length > 0 ? services.map((service) => (
                                <article key={service.id} className="rounded-md border border-border/60 bg-background/80 p-5">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{service.service_type}</p>
                                            <h3 className="mt-2 text-lg font-semibold text-foreground">{service.title}</h3>
                                            {service.description ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{service.description}</p> : null}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{service.visibility_status}</span>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={isPending}
                                                onClick={() => handleAction(async () => deleteBookingService(service.id))}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                         {service.payment_required && service.price_amount_cents != null ? (
                                            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-semibold text-primary">
                                                {(() => {
                                                    try {
                                                        const snapshot = calculateBookingPrice({
                                                            amountCents: service.price_amount_cents,
                                                            vatRateBasisPoints: service.vat_rate_basis_points ?? 0,
                                                        });
                                                        const format = (cents: number) => new Intl.NumberFormat("en-US", {
                                                            style: "currency",
                                                            currency: service.price_currency,
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        }).format(cents / 100);
                                                        return (
                                                            <span className="grid gap-0.5">
                                                                <span>{format(snapshot.netAmountCents)} net</span>
                                                                <span className="text-[10px] font-normal">{format(snapshot.vatAmountCents)} VAT ({snapshot.vatRateBasisPoints / 100}%)</span>
                                                                <span className="text-[10px] font-normal">{format(snapshot.grossAmountCents)} total</span>
                                                            </span>
                                                        );
                                                    } catch {
                                                        return `${(service.price_amount_cents / 100).toFixed(2)} ${service.price_currency}`;
                                                    }
                                                })()}
                                            </span>
                                         ) : null}
                                         {service.payment_required ? (
                                             <span className="rounded-full border border-border/60 px-3 py-1">
                                                 {formatBookingPaymentProvider(service.payment_provider)}
                                             </span>
                                         ) : null}
                                        <span className="rounded-full border border-border/60 px-3 py-1">{service.duration_minutes} min</span>
                                        <span className="rounded-full border border-border/60 px-3 py-1">{service.location_mode}</span>
                                        <span className="rounded-full border border-border/60 px-3 py-1">{service.capacity_mode}</span>
                                    </div>
                                </article>
                            )) : <p className="text-sm text-muted-foreground">No services published yet.</p>}
                        </CardContent>
                    </Card>
                </div>
            ) : null}

            {activeTab === "resources" ? (
                <div className="grid gap-6 xl:grid-cols-2">
                    <Card className="premium-panel rounded-lg border-border/60 bg-background/75">
                        <CardHeader>
                            <CardTitle>Resources & staff</CardTitle>
                            <CardDescription>Model people and schedulable assets separately so one engine can support advisors, agents, rooms, and properties.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <Input id="resourceName" placeholder="Lead advisor" />
                            <select id="resourceType" className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                                <option value="staff">Staff</option>
                                <option value="agent">Agent</option>
                                <option value="room">Room</option>
                                <option value="table_zone">Table zone</option>
                                <option value="property">Property</option>
                            </select>
                            <Button onClick={() => handleAction(async () => upsertBookingResource({
                                resourceType: (document.getElementById("resourceType") as HTMLSelectElement).value,
                                name: (document.getElementById("resourceName") as HTMLInputElement).value,
                                slug: createSlug((document.getElementById("resourceName") as HTMLInputElement).value),
                                isActive: true,
                                capacityValue: 1,
                                attributesJson: {},
                                metadata: {},
                            }))} disabled={isPending}>
                                <Briefcase className="h-4 w-4" />
                                Save resource
                            </Button>

                            <div className="grid gap-3 rounded-md border border-border/60 bg-background/70 p-4">
                                <p className="text-sm font-medium text-foreground">Staff profile overlay</p>
                                <select value={selectedResourceId} onChange={(event) => setSelectedResourceId(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                                    <option value="">Select resource</option>
                                    {resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}
                                </select>
                                <Input id="staffDisplayName" placeholder="Amira van Dijk" />
                                <Input id="staffRoleLabel" placeholder="Senior consultant" />
                                <Textarea id="staffBio" rows={3} placeholder="Short operator bio used in the public booking flow." />
                                <Button onClick={() => handleAction(async () => upsertBookingStaffProfile({
                                    resourceId: selectedResourceId,
                                    displayName: (document.getElementById("staffDisplayName") as HTMLInputElement).value,
                                    roleLabel: (document.getElementById("staffRoleLabel") as HTMLInputElement).value,
                                    bio: (document.getElementById("staffBio") as HTMLTextAreaElement).value,
                                    languagesJson: [],
                                    specialtiesJson: [],
                                    contactRulesJson: {},
                                    isBookable: true,
                                    metadata: {},
                                }))} disabled={isPending || !selectedResourceId} variant="outline">
                                    <UserRound className="h-4 w-4" />
                                    Save staff profile
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="premium-panel premium-glow rounded-lg border-border/60 bg-background/75">
                        <CardHeader>
                            <CardTitle>Current team inventory</CardTitle>
                            <CardDescription>Resources power scheduling, staff overlays power public trust and operator visibility.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            {resources.map((resource) => (
                                <article key={resource.id} className="rounded-md border border-border/60 bg-background/80 p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-lg font-semibold text-foreground">{resource.name}</h3>
                                            <p className="text-sm text-muted-foreground">{resource.resource_type}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="rounded-full border border-border/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{resource.is_active ? "active" : "inactive"}</span>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={isPending}
                                                onClick={() => handleAction(async () => deleteBookingResource(resource.id))}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                    {staffProfiles.filter((profile) => profile.resource_id === resource.id).map((profile) => (
                                        <div key={profile.id} className="mt-4 rounded-md border border-primary/10 bg-primary/5 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-medium text-foreground">{profile.display_name}</p>
                                                    <p className="text-sm text-muted-foreground">{profile.role_label ?? "Staff profile"}</p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={isPending}
                                                    onClick={() => handleAction(async () => deleteBookingStaffProfile(profile.id))}
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </article>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            ) : null}

            {activeTab === "locations" ? (
                <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                    <Card className="premium-panel rounded-lg border-border/60 bg-background/75">
                        <CardHeader>
                            <CardTitle>Location inventory</CardTitle>
                            <CardDescription>Capture fulfillment context for remote, venue, office, or property-based bookings.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <Input id="locationName" placeholder="Amsterdam flagship office (English)" />
                            <select id="locationType" className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                                <option value="office">Office</option>
                                <option value="site">Site</option>
                                <option value="venue">Venue</option>
                                <option value="property">Property</option>
                                <option value="remote">Remote</option>
                            </select>
                            <Textarea id="locationInstructions" rows={4} placeholder="Arrival guidance, parking notes, access code, or preparation notes. (English)" />

                            <div className="rounded-md border border-border/60 bg-background/60 p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-foreground">Localized copy</p>
                                    <div className="inline-flex rounded-full border border-border/60 bg-background p-0.5 text-xs">
                                        <button type="button" onClick={() => setLocationLocaleTab("nl")} className={`rounded-full px-3 py-1 ${locationLocaleTab === "nl" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>NL</button>
                                        <button type="button" onClick={() => setLocationLocaleTab("ar")} className={`rounded-full px-3 py-1 ${locationLocaleTab === "ar" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>AR</button>
                                    </div>
                                </div>
                                {locationLocaleTab === "nl" ? (
                                    <div className="grid gap-3">
                                        <Input dir="auto" placeholder="Name (Dutch)" value={locationNameNl} onChange={(e) => setLocationNameNl(e.target.value)} />
                                        <Textarea rows={3} dir="auto" placeholder="Instructions (Dutch)" value={locationInstructionsNl} onChange={(e) => setLocationInstructionsNl(e.target.value)} />
                                    </div>
                                ) : (
                                    <div className="grid gap-3">
                                        <Input dir="rtl" placeholder="الاسم (Arabic name)" value={locationNameAr} onChange={(e) => setLocationNameAr(e.target.value)} />
                                        <Textarea rows={3} dir="rtl" placeholder="التعليمات (Arabic instructions)" value={locationInstructionsAr} onChange={(e) => setLocationInstructionsAr(e.target.value)} />
                                    </div>
                                )}
                            </div>

                            <Button onClick={() => handleAction(async () => upsertBookingLocation({
                                locationType: (document.getElementById("locationType") as HTMLSelectElement).value,
                                name: (document.getElementById("locationName") as HTMLInputElement).value,
                                slug: createSlug((document.getElementById("locationName") as HTMLInputElement).value),
                                addressJson: {},
                                geoJson: {},
                                instructions: (document.getElementById("locationInstructions") as HTMLTextAreaElement).value,
                                isActive: true,
                                metadata: {},
                                localeOverrides: {
                                    nl: {
                                        name: locationNameNl || undefined,
                                        instructions: locationInstructionsNl || undefined,
                                    },
                                    ar: {
                                        name: locationNameAr || undefined,
                                        instructions: locationInstructionsAr || undefined,
                                    },
                                },
                            }))} disabled={isPending}>
                                <MapPin className="h-4 w-4" />
                                Save location
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="premium-panel premium-glow rounded-lg border-border/60 bg-background/75">
                        <CardHeader>
                            <CardTitle>Published locations</CardTitle>
                            <CardDescription>Locations surface in public booking only when the adapter requires them.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            {locations.length > 0 ? locations.map((location) => (
                                <article key={location.id} className="rounded-md border border-border/60 bg-background/80 p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{location.location_type}</p>
                                            <h3 className="mt-2 text-lg font-semibold text-foreground">{location.name}</h3>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={isPending}
                                            onClick={() => handleAction(async () => deleteBookingLocation(location.id))}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{location.instructions || "Add directions and service context to sharpen the booking handoff."}</p>
                                </article>
                            )) : <p className="text-sm text-muted-foreground">No locations saved yet.</p>}
                        </CardContent>
                    </Card>
                </div>
            ) : null}

            {activeTab === "forms" ? (
                <div className="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
                    <Card className="premium-panel rounded-lg border-border/60 bg-background/75">
                        <CardHeader>
                            <CardTitle>Intake form definition</CardTitle>
                            <CardDescription>Use adapter defaults as a base, then evolve toward richer intake and qualification paths.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <select value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                                <option value="">Select template profile</option>
                                {templateProfiles.map((profile) => (
                                    <option key={profile.id} value={profile.id}>{profile.profile_key} · {profile.template_key}</option>
                                ))}
                            </select>
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm text-muted-foreground">
                                    {editingFormId
                                        ? "Editing existing form — save will overwrite it."
                                        : "Creating a new form. Click Edit on a form below to modify it instead."}
                                </p>
                                {editingFormId ? (
                                    <Button type="button" variant="outline" size="sm" onClick={clearFormEditor}>
                                        New form
                                    </Button>
                                ) : null}
                            </div>
                            <Input
                                id="formKey"
                                placeholder="primary-intake"
                                value={editingFormKey}
                                onChange={(event) => setEditingFormKey(event.target.value)}
                            />
                            <Input
                                id="formTitle"
                                placeholder="Premium intake form (English)"
                                value={editingFormTitle}
                                onChange={(event) => setEditingFormTitle(event.target.value)}
                            />
                            <div className="grid gap-3 md:grid-cols-2">
                                <Input dir="auto" placeholder="Form title (Dutch)" value={formTitleNl} onChange={(e) => setFormTitleNl(e.target.value)} />
                                <Input dir="rtl" placeholder="عنوان الاستمارة (Arabic)" value={formTitleAr} onChange={(e) => setFormTitleAr(e.target.value)} />
                            </div>
                            {selectedProfileAdapter?.seededContent ? (
                                <div className="rounded-md border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                                    <p className="font-medium text-foreground">Seeded messaging guidance</p>
                                    <ul className="mt-3 grid gap-2">
                                        {selectedProfileAdapter.seededContent.nextSteps.map((item) => (
                                            <li key={item} className="rounded-xl border border-border/60 bg-background/80 px-3 py-2">{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}
                            <div className="rounded-md border border-border/60 bg-background/60 p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-foreground">Intake fields</p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIntakeSchemaDraft(selectedAdapterIntakeSchema)}
                                    >
                                        Reset to template default
                                    </Button>
                                </div>
                                <IntakeFieldsEditor
                                    fields={intakeSchemaDraft.fields}
                                    onChange={(fields) => setIntakeSchemaDraft({ ...intakeSchemaDraft, fields })}
                                />
                            </div>
                            <Button
                                onClick={() => handleAction(async () => upsertBookingFormDefinition({
                                    id: editingFormId ?? undefined,
                                    templateProfileId: selectedProfileId,
                                    formKey: editingFormKey,
                                    title: editingFormTitle,
                                    schemaJson: intakeSchemaToJson(intakeSchemaDraft),
                                    uiSchemaJson: {},
                                    completionRulesJson: {},
                                    version: 1,
                                    isActive: true,
                                    metadata: {
                                        templateKey: selectedProfileAdapter?.templateKey ?? "custom",
                                        seededContent: selectedProfileAdapter?.seededContent ?? null,
                                    },
                                    localeOverrides: {
                                        nl: { title: formTitleNl || undefined },
                                        ar: { title: formTitleAr || undefined },
                                    },
                                }))}
                                disabled={isPending || !selectedProfileId || !editingFormKey.trim() || !editingFormTitle.trim()}
                            >
                                <FileText className="h-4 w-4" />
                                {editingFormId ? "Update form definition" : "Save form definition"}
                            </Button>

                            <div className="rounded-md border border-border/60 bg-background/70 p-4">
                                <p className="text-sm font-medium text-foreground">Booking rule definition</p>
                                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                                    <Input id="ruleKey" placeholder="single_active_reservation_per_email" />
                                    <Input id="ruleType" placeholder="boolean" defaultValue="boolean" />
                                    <Button variant="outline" onClick={() => handleAction(async () => upsertBookingRuleDefinition({
                                        serviceId: selectedServiceId || null,
                                        ruleKey: (document.getElementById("ruleKey") as HTMLInputElement).value,
                                        ruleType: (document.getElementById("ruleType") as HTMLInputElement).value,
                                        ruleValueJson: { value: true },
                                        isActive: true,
                                        metadata: {},
                                    }))} disabled={isPending}>Save rule</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="premium-panel premium-glow rounded-lg border-border/60 bg-background/75">
                        <CardHeader>
                            <CardTitle>Form & rule library</CardTitle>
                            <CardDescription>Intake definitions and rule policies currently available to the operator stack.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            {formDefinitions.map((formDefinition) => (
                                <article key={formDefinition.id} className="rounded-md border border-border/60 bg-background/80 p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h3 className="text-lg font-semibold text-foreground">{formDefinition.title}</h3>
                                            <p className="text-sm text-muted-foreground">{formDefinition.form_key} · version {formDefinition.version}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={isPending}
                                                onClick={() => loadFormForEditing(formDefinition)}
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={isPending}
                                                onClick={() => handleAction(async () => deleteBookingFormDefinition(formDefinition.id))}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                </article>
                            ))}
                            {ruleDefinitions.map((rule) => (
                                <article key={rule.id} className="rounded-md border border-border/60 bg-background/80 p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">{rule.rule_key}</h3>
                                            <p className="mt-2 text-sm text-muted-foreground">Type: {rule.rule_type}</p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={isPending}
                                            onClick={() => handleAction(async () => deleteBookingRuleDefinition(rule.id))}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </article>
                            ))}
                            {formDefinitions.length === 0 && ruleDefinitions.length === 0 ? <p className="text-sm text-muted-foreground">No forms or booking rules defined yet.</p> : null}
                        </CardContent>
                    </Card>
                </div>
            ) : null}

            {activeTab === "availability" ? (
                <div className="grid gap-6 xl:grid-cols-2">
                    <Card className="premium-panel rounded-lg border-border/60 bg-background/75">
                        <CardHeader>
                            <CardTitle>Availability policy</CardTitle>
                            <CardDescription>Set recurring hours and blackout exceptions that shape slot visibility on the public journey.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <select value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                                <option value="">Select template profile</option>
                                {templateProfiles.map((profile) => (
                                    <option key={profile.id} value={profile.id}>{profile.profile_key} · {profile.template_key}</option>
                                ))}
                            </select>
                            <select id="availabilityScope" className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                                <option value="workspace">Workspace</option>
                                <option value="service">Service</option>
                                <option value="resource">Resource</option>
                                <option value="location">Location</option>
                            </select>
                            <AvailabilityRuleEditor
                                disabled={isPending || !selectedProfileId}
                                onSave={(payload) => handleAction(async () => upsertBookingAvailabilityRule({
                                    templateProfileId: selectedProfileId,
                                    serviceId: selectedServiceId || null,
                                    resourceId: selectedResourceId || null,
                                    locationId: selectedLocationId || null,
                                    scopeType: (document.getElementById("availabilityScope") as HTMLSelectElement).value,
                                    ruleType: "recurring",
                                    timezone: payload.timezone,
                                    weekdayJson: payload.weekdays,
                                    dateJson: {},
                                    timeWindowsJson: payload.windows,
                                    isActive: true,
                                    metadata: {},
                                }))}
                            />

                            <div className="rounded-md border border-border/60 bg-background/70 p-4">
                                <p className="text-sm font-medium text-foreground">Blackout window</p>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                    <Input id="blackoutStart" type="datetime-local" min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} />
                                    <Input id="blackoutEnd" type="datetime-local" min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} />
                                </div>
                                <Input id="blackoutReason" className="mt-3" placeholder="Internal event, maintenance, or travel buffer" />
                                <Button className="mt-3" variant="outline" onClick={() => handleAction(async () => upsertBookingBlackoutWindow({
                                    serviceId: selectedServiceId || null,
                                    resourceId: selectedResourceId || null,
                                    locationId: selectedLocationId || null,
                                    timezone: "Europe/Amsterdam",
                                    startsAt: new Date((document.getElementById("blackoutStart") as HTMLInputElement).value).toISOString(),
                                    endsAt: new Date((document.getElementById("blackoutEnd") as HTMLInputElement).value).toISOString(),
                                    reason: (document.getElementById("blackoutReason") as HTMLInputElement).value,
                                    source: "dashboard_ui",
                                    isActive: true,
                                    metadata: {},
                                }))} disabled={isPending}>
                                    Save blackout window
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="premium-panel premium-glow rounded-lg border-border/60 bg-background/75">
                        <CardHeader>
                            <CardTitle>Live scheduling policies</CardTitle>
                            <CardDescription>Current recurring rules and exceptions shaping the slot engine.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            {availabilityRules.map((rule) => (
                                <article key={rule.id} className="rounded-md border border-border/60 bg-background/80 p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="text-lg font-semibold text-foreground">{rule.scope_type} · {rule.rule_type}</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">priority {rule.priority}</span>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={isPending}
                                                onClick={() => handleAction(async () => deleteBookingAvailabilityRule(rule.id))}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="mt-3 text-sm text-muted-foreground">Timezone: {rule.timezone}</p>
                                </article>
                            ))}
                            {blackoutWindows.map((window) => (
                                <article key={window.id} className="rounded-md border border-border/60 bg-background/80 p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">Blackout</h3>
                                            <p className="mt-2 text-sm text-muted-foreground">{formatDate(window.starts_at)} → {formatDate(window.ends_at)}</p>
                                            <p className="mt-2 text-sm text-foreground">{window.reason || "No reason provided"}</p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={isPending}
                                            onClick={() => handleAction(async () => deleteBookingBlackoutWindow(window.id))}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </article>
                            ))}
                            {availabilityRules.length === 0 && blackoutWindows.length === 0 ? <p className="text-sm text-muted-foreground">No rules or blackout windows saved yet.</p> : null}
                        </CardContent>
                    </Card>
                </div>
            ) : null}

            {activeTab === "customization" ? (
                <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                    <Card className="premium-panel rounded-lg border-border/60 bg-background/75">
                        <CardHeader>
                            <CardTitle>Profile customization</CardTitle>
                            <CardDescription>Adjust hero copy, CTA microcopy, and public journey metadata for the active booking profile.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <select value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                                <option value="">Select template profile</option>
                                {templateProfiles.map((profile) => (
                                    <option key={profile.id} value={profile.id}>{profile.profile_key} · {profile.template_key}</option>
                                ))}
                            </select>
                            <Textarea rows={8} value={profileSettingsDraft} onChange={(event) => setProfileSettingsDraft(event.target.value)} className="bg-background font-mono text-xs" />
                            <Button
                                onClick={() => handleAction(async () => upsertBookingTemplateProfile({
                                    id: selectedProfile?.id,
                                    profileKey: selectedProfile?.profile_key,
                                    templateKey: selectedProfile?.template_key,
                                    status: selectedProfile?.status,
                                    settingsJson: {
                                        ...(parseJsonInput(profileSettingsDraft) as Record<string, unknown>),
                                        ...(heroHeadingDraft.trim() ? { hero_heading: heroHeadingDraft.trim() } : {}),
                                        ...(heroHeadingNlDraft.trim() ? { hero_heading_nl: heroHeadingNlDraft.trim() } : {}),
                                        ...(heroBodyDraft.trim() ? { hero_body: heroBodyDraft.trim() } : {}),
                                        ...(heroBodyNlDraft.trim() ? { hero_body_nl: heroBodyNlDraft.trim() } : {}),
                                        ...(ctaMicrocopyDraft.trim() ? { cta_microcopy: ctaMicrocopyDraft.trim() } : {}),
                                        ...(ctaMicrocopyNlDraft.trim() ? { cta_microcopy_nl: ctaMicrocopyNlDraft.trim() } : {}),
                                    },
                                    brandingJson: (selectedProfile?.branding_json as Record<string, unknown> | null) ?? {},
                                    analyticsJson: (selectedProfile?.analytics_json as Record<string, unknown> | null) ?? {},
                                    placementConfigJson: (selectedProfile?.placement_config_json as Record<string, unknown> | null) ?? {},
                                    publishedAt: selectedProfile?.published_at ?? null,
                                }))}
                                disabled={isPending || !selectedProfile}
                            >
                                <Sparkles className="h-4 w-4" />
                                Save customization
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="premium-panel premium-glow rounded-lg border-border/60 bg-background/75">
                        <CardHeader>
                            <CardTitle>Journey composition preview</CardTitle>
                            <CardDescription>These blocks are declared by the selected adapter and now inform the public booking surface.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="rounded-md border border-border/60 bg-background/80 p-5">
                                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Adapter</p>
                                <h3 className="mt-2 text-xl font-semibold text-foreground">{selectedProfileAdapter?.displayName ?? "No adapter selected"}</h3>
                                <p className="mt-3 text-sm text-muted-foreground">Public sections: {(selectedProfileAdapter?.publicSections ?? []).join(", ") || "—"}</p>
                                <p className="mt-2 text-sm text-muted-foreground">Dashboard modules: {(selectedProfileAdapter?.dashboardModules ?? []).join(", ") || "—"}</p>
                            </div>
                            {selectedProfileAdapter?.seededContent ? (
                                <div className="rounded-md border border-primary/15 bg-primary/5 p-5">
                                    <p className="text-sm font-medium text-foreground">Trust signals</p>
                                    <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
                                        {selectedProfileAdapter.seededContent.trustSignals.map((signal) => (
                                            <li key={signal} className="rounded-xl border border-border/60 bg-background/80 px-3 py-2">{signal}</li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>
                </div>
            ) : null}

            {activeTab === "analytics" ? (
                <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                    <Card className="premium-panel rounded-lg border-border/60 bg-background/75">
                        <CardHeader>
                            <CardTitle>Booking funnel health</CardTitle>
                            <CardDescription>Current performance snapshot derived from reservation outcomes and source attribution.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            {[
                                { label: "Reservations", value: summary.reservations },
                                { label: "Pending review", value: summary.pendingReviewReservations },
                                { label: "Confirmed", value: summary.confirmedReservations },
                                { label: "Completed", value: summary.completedReservations },
                                { label: "Cancelled", value: summary.cancelledReservations },
                                { label: "Top source", value: summary.topSourceChannel ?? "—" },
                            ].map((metric) => (
                                <article key={metric.label} className="rounded-md border border-border/60 bg-background/80 p-5">
                                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{metric.label}</p>
                                    <p className="mt-2 text-2xl font-bold text-foreground">{metric.value}</p>
                                </article>
                            ))}
                        </CardContent>
                    </Card>

                    <div className="grid gap-6">
                        <Card className="premium-panel premium-glow rounded-lg border-border/60 bg-background/75">
                            <CardHeader>
                                <CardTitle>Performance by service</CardTitle>
                                <CardDescription>Which offers are creating the most booking activity right now.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-3">
                                {reservationsByService.length > 0 ? reservationsByService.map((entry) => (
                                    <article key={entry.serviceId} className="rounded-md border border-border/60 bg-background/80 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="font-medium text-foreground">{entry.title}</p>
                                            <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{entry.count} reservations</span>
                                        </div>
                                    </article>
                                )) : <p className="text-sm text-muted-foreground">No reservation-to-service data yet.</p>}
                            </CardContent>
                        </Card>

                        <Card className="premium-panel rounded-lg border-border/60 bg-background/75">
                            <CardHeader>
                                <CardTitle>Status distribution</CardTitle>
                                <CardDescription>Outcome mix across the current reservation inventory.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-3">
                                {reservationsByStatus.length > 0 ? reservationsByStatus.map(([statusKey, count]) => (
                                    <article key={statusKey} className="rounded-md border border-border/60 bg-background/80 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="font-medium capitalize text-foreground">{formatReservationStatus(statusKey)}</p>
                                            <span className="text-sm text-muted-foreground">{count}</span>
                                        </div>
                                    </article>
                                )) : <p className="text-sm text-muted-foreground">No reservation statuses available yet.</p>}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            ) : null}

            {activeTab === "reservations" ? (
                <div className="space-y-6">
                    <Card className="premium-panel rounded-lg border-border/60 bg-background/75">
                        <CardHeader>
                            <CardTitle>Reservations inbox</CardTitle>
                            <CardDescription>Review inbound requests, confirm outcomes, and keep the operator timeline auditable.</CardDescription>
                        </CardHeader>
                    </Card>

                    {suspiciousReservations.length > 0 ? (
                        <Card className="premium-panel rounded-lg border-amber-500/20 bg-amber-500/5">
                            <CardHeader>
                                <CardTitle>Suspicious review queue</CardTitle>
                                <CardDescription>{suspiciousReservations.length} reservation{ suspiciousReservations.length === 1 ? "" : "s" } carry anti-abuse or manual-review signals and should be triaged first.</CardDescription>
                            </CardHeader>
                        </Card>
                    ) : null}

                    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                        {reservations.length > 0 ? reservations.map((reservation) => {
                            const antiAbuse = readReservationAntiAbuse(reservation);
                            const isSelected = reservation.id === (selectedReservation?.id ?? reservation.id);

                            const emailDelivery = getEmailDeliveryState(reservation);

                            const payment = readReservationPaymentState(reservation);
                            const paymentRequiresVerification = payment.state === "payment_requested";
                            const paymentCanBeManuallyVerified = paymentRequiresVerification && payment.provider === "manual_revolut_pro";
                            const paymentVerified = payment.state === "verified";
                            const formatPaymentAmount = (cents: number, currency: string) => {
                                try {
                                    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
                                } catch {
                                    return `${(cents / 100).toFixed(2)} ${currency}`;
                                }
                            };
                            return (
                            <article key={reservation.id} onClick={() => setSelectedReservationId(reservation.id)} className={classNames("premium-panel premium-glow rounded-lg p-6 cursor-pointer transition-colors", isSelected ? "border border-primary/30 bg-primary/5" : "")}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{reservation.public_reference}</p>
                                        <h3 className="mt-2 text-xl font-semibold text-foreground">{reservation.customer_full_name}</h3>
                                        <p className="mt-1 text-sm text-muted-foreground">{reservation.customer_email}</p>
                                        {reservation.portal_client_id ? (
                                            <Link
                                                href={`/dashboard/clients/${reservation.portal_client_id}`}
                                                onClick={(event) => event.stopPropagation()}
                                                className="mt-2 inline-flex items-center text-xs font-medium text-primary hover:underline"
                                            >
                                                Open client account →
                                            </Link>
                                        ) : null}
                                    </div>
                                    <div className="flex flex-wrap justify-end gap-2">
                                        {antiAbuse.riskLevel ? (
                                            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                                                Risk · {antiAbuse.riskLevel}
                                            </span>
                                        ) : null}
                                        {paymentRequiresVerification ? (
                                            <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                                                Payment pending{payment.amountCents && payment.currency ? ` · ${formatPaymentAmount(payment.amountCents, payment.currency)}` : ""}
                                            </span>
                                        ) : null}
                                        {paymentVerified ? (
                                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
                                                Payment verified
                                            </span>
                                        ) : null}
                                        {emailDelivery.status === "bounced" ? (
                                            <span className="rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-destructive">
                                                Email bounced
                                            </span>
                                        ) : emailDelivery.status === "delayed" ? (
                                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
                                                Delivery delayed
                                            </span>
                                        ) : emailDelivery.status === "delivered" ? (
                                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
                                                Delivered
                                            </span>
                                        ) : null}
                                        <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{formatReservationStatus(reservation.status)}</span>
                                    </div>
                                </div>
                                <div className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                                    <p>Start: <span className="font-medium text-foreground">{formatDate(reservation.scheduled_start)}</span></p>
                                    <p>Visitor timezone: <span className="font-medium text-foreground">{reservation.reservation_timezone}</span></p>
                                    {reservation.business_timezone ? <p>Business timezone: <span className="font-medium text-foreground">{reservation.business_timezone}</span></p> : null}
                                    <p>Party size: <span className="font-medium text-foreground">{reservation.party_size}</span></p>
                                    <p>Manual review: <span className="font-medium text-foreground">{reservation.requires_manual_review ? "Yes" : "No"}</span></p>
                                </div>
                                {antiAbuse.riskLevel ? (
                                    <div className="mt-4 rounded-md border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
                                        <p className="font-medium">Anti-abuse assessment: {antiAbuse.riskScore ?? 0}/100 · {antiAbuse.decision ?? "review"}</p>
                                        {antiAbuse.reasons.length > 0 ? <p className="mt-2 text-xs uppercase tracking-[0.18em]">{antiAbuse.reasons.join(" · ")}</p> : null}
                                    </div>
                                ) : null}
                                <div className="mt-5 flex flex-wrap gap-2">
                                    {paymentCanBeManuallyVerified ? (
                                        <Button size="sm" onClick={() => handleAction(async () => markBookingPaymentVerified({ reservationId: reservation.id, autoConfirm: true, note: null }))} disabled={isPending}>
                                            Mark payment verified & confirm
                                        </Button>
                                    ) : null}
                                    {paymentRequiresVerification && payment.provider === "paypal_checkout" ? (
                                        <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                                            Awaiting PayPal capture confirmation
                                        </span>
                                    ) : null}
                                    <Button size="sm" onClick={() => handleAction(async () => paymentRequiresVerification || paymentVerified ? confirmPaidBookingReservation(reservation.id) : transitionBookingReservationStatus({ reservationId: reservation.id, nextStatus: "confirmed", reason: "Confirmed by booking control center." }))} disabled={isPending || reservation.status === "confirmed" || paymentRequiresVerification}>
                                        Confirm
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => handleAction(async () => transitionBookingReservationStatus({ reservationId: reservation.id, nextStatus: "completed", reason: "Marked complete by workspace operator." }))} disabled={isPending || reservation.status === "completed"}>
                                        Complete
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => handleAction(async () => markBookingDeliveryStarted({ reservationId: reservation.id, reason: "Implementation delivery started from the booking control center." }))} disabled={isPending || (reservation.status !== "confirmed" && reservation.status !== "completed")}>
                                        Start delivery
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => handleAction(async () => transitionBookingReservationStatus({ reservationId: reservation.id, nextStatus: "cancelled_by_workspace", reason: "Cancelled from dashboard inbox." }))} disabled={isPending}>
                                        Cancel
                                    </Button>
                                </div>
                            </article>
                            );
                        }) : <p className="text-sm text-muted-foreground">No reservations in the inbox yet.</p>}

                        <Card className="premium-panel rounded-lg border-border/60 bg-background/75">
                            <CardHeader>
                                <CardTitle>Reservation detail</CardTitle>
                                <CardDescription>Review source, notes, anti-abuse context, and the operator trail for the selected reservation.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4">
                                {selectedReservation ? (
                                    (() => {
                                        const antiAbuse = readReservationAntiAbuse(selectedReservation);
                                        const emailDelivery = getEmailDeliveryState(selectedReservation);
                                        const provisioning = getConsultationProvisioningState(selectedReservation);
                                        const linkedService = selectedReservation.service_id ? reservationServiceMap[selectedReservation.service_id] : null;

                                        return (
                                            <>
                                                <div className="rounded-md border border-border/60 bg-background/80 p-5">
                                                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Reference</p>
                                                    <h3 className="mt-2 text-xl font-semibold text-foreground">{selectedReservation.public_reference}</h3>
                                                    <p className="mt-2 text-sm text-muted-foreground">{selectedReservation.customer_full_name} · {selectedReservation.customer_email}</p>
                                                </div>
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <div className="rounded-md border border-border/60 bg-background/80 p-4 text-sm">
                                                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Service</p>
                                                        <p className="mt-2 font-medium text-foreground">{linkedService?.title ?? "Unknown service"}</p>
                                                    </div>
                                                    <div className="rounded-md border border-border/60 bg-background/80 p-4 text-sm">
                                                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Source channel</p>
                                                        <p className="mt-2 font-medium text-foreground">{selectedReservation.source_channel ?? "—"}</p>
                                                    </div>
                                                    <div className="rounded-md border border-border/60 bg-background/80 p-4 text-sm">
                                                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Scheduled start</p>
                                                        <p className="mt-2 font-medium text-foreground">{formatDate(selectedReservation.scheduled_start)}</p>
                                                    </div>
                                                    <div className="rounded-md border border-border/60 bg-background/80 p-4 text-sm">
                                                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Manual review reason</p>
                                                        <p className="mt-2 font-medium text-foreground">{selectedReservation.manual_review_reason || "—"}</p>
                                                    </div>
                                                </div>
                                                <div className="rounded-md border border-border/60 bg-background/80 p-5 text-sm">
                                                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Internal notes</p>
                                                    <p className="mt-2 leading-6 text-foreground">{selectedReservation.notes_internal || "No internal notes recorded yet."}</p>
                                                </div>
                                                <div className="rounded-md border border-border/60 bg-background/80 p-5 text-sm">
                                                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Customer notes</p>
                                                    <p className="mt-2 leading-6 text-foreground">{selectedReservation.notes_customer || "No customer note captured."}</p>
                                                </div>
                                                <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-5 text-sm">
                                                    <p className="font-medium text-foreground">Risk review</p>
                                                    <p className="mt-2 text-muted-foreground">Decision: {antiAbuse.decision ?? "none"} · Score: {antiAbuse.riskScore ?? 0} · Level: {antiAbuse.riskLevel ?? "none"}</p>
                                                    {antiAbuse.reasons.length > 0 ? (
                                                        <ul className="mt-3 grid gap-2 text-muted-foreground">
                                                            {antiAbuse.reasons.map((reason) => <li key={reason} className="rounded-xl border border-border/60 bg-background/80 px-3 py-2">{reason}</li>)}
                                                        </ul>
                                                    ) : null}
                                                </div>
                                                <div className="rounded-md border border-border/60 bg-background/80 p-5 text-sm space-y-4">
                                                    <div>
                                                        <h4 className="font-semibold text-foreground">Email correction & manual resend</h4>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            Correct customer email address if they made a typo, then resend status emails manually.
                                                        </p>
                                                    </div>

                                                    {emailDelivery.status === "bounced" ? (
                                                        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                                                            <p className="font-medium">⚠️ Email delivery bounced</p>
                                                            <p className="mt-1 text-muted-foreground/90">Reason: {emailDelivery.reason || "Bounced by recipient mail server."}</p>
                                                        </div>
                                                    ) : null}

                                                    <div className="flex gap-2">
                                                        <Input
                                                            type="email"
                                                            value={correctedEmail}
                                                            onChange={(e) => setCorrectedEmail(e.target.value)}
                                                            placeholder="customer@domain.com"
                                                            className="flex-1"
                                                        />
                                                        <Button
                                                            size="sm"
                                                            disabled={isPending || !correctedEmail.includes("@") || correctedEmail.trim() === selectedReservation.customer_email}
                                                            onClick={() => handleAction(async () => {
                                                                const result = await updateBookingCustomerEmail({
                                                                    reservationId: selectedReservation.id,
                                                                    email: correctedEmail.trim(),
                                                                });
                                                                if (result.error) return { error: result.error };
                                                                setCorrectedEmail("");
                                                                return { message: "Email corrected successfully." };
                                                            })}
                                                        >
                                                            Update Email
                                                        </Button>
                                                    </div>

                                                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
                                                        <div className="text-xs text-muted-foreground">
                                                            Resend status email to: <code className="text-foreground">{selectedReservation.customer_email}</code>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            {provisioning.consentGranted && !provisioning.provisioned ? (
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    disabled={isPending}
                                                                    onClick={() => handleAction(async () => {
                                                                        const result = await retryConsultationPortalProvisioning(selectedReservation.id);
                                                                        if (result.error) return { error: result.error };
                                                                        return { message: provisioning.pending ? "Consultation portal provisioning retried." : "Consultation portal account linked." };
                                                                    })}
                                                                >
                                                                    {provisioning.pending ? "Retry portal link" : "Link portal account"}
                                                                </Button>
                                                            ) : null}
                                                            {selectedReservation.status === "confirmed" || selectedReservation.status === "completed" ? (
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    disabled={isPending}
                                                                    onClick={() => handleAction(async () => {
                                                                        const result = await retryBookingMeeting(selectedReservation.id);
                                                                        if (result.error) return { error: result.error };
                                                                        return { message: result.data?.status === "ready" ? "Meeting link is ready and the customer was notified." : "Meeting creation is still pending." };
                                                                    })}
                                                                >
                                                                    Retry meeting link
                                                                </Button>
                                                            ) : null}
                                                            {selectedReservation.status === "cancelled_by_customer"
                                                                || selectedReservation.status === "cancelled_by_workspace"
                                                                || selectedReservation.status === "expired"
                                                                || selectedReservation.status === "no_show" ? (
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    disabled={isPending}
                                                                    onClick={() => handleAction(async () => {
                                                                        const result = await retryBookingMeetingCleanup(selectedReservation.id);
                                                                        if (result.error) return { error: result.error };
                                                                        return { message: "Meeting and calendar cleanup completed." };
                                                                    })}
                                                                >
                                                                    Retry meeting cleanup
                                                                </Button>
                                                            ) : null}
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                disabled={isPending}
                                                                onClick={() => handleAction(async () => {
                                                                    let eventType = "reservation_created";
                                                                    if (selectedReservation.status === "confirmed") {
                                                                        eventType = "reservation_confirmed";
                                                                    } else if (selectedReservation.status === "completed") {
                                                                        eventType = "reservation_completed";
                                                                    } else if (selectedReservation.status === "pending_review") {
                                                                        eventType = "reservation_pending_review";
                                                                    } else if (selectedReservation.status.startsWith("cancelled")) {
                                                                        eventType = "reservation_cancelled";
                                                                    }
                                                                    const result = await resendBookingNotification({
                                                                        reservationId: selectedReservation.id,
                                                                        eventType,
                                                                    });
                                                                    if (result.error) return { error: result.error };
                                                                    return { message: `Resent ${eventType.replace("reservation_", "")} notification.` };
                                                                })}
                                                            >
                                                                Resend Status Email
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()
                                ) : (
                                    <p className="text-sm text-muted-foreground">Select a reservation to inspect its detail view.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            ) : null}

            {activeTab === "payments" ? (
                <BookingPaymentHolds reservations={reservations} />
            ) : null}
            </div>
        </DashboardAppWorkbench>
    );
}

// ─── Availability rule editor ───────────────────────────────────────────────
//
// Replaces the previous single-window JSON textarea with structured weekday
// checkboxes + per-window time/stride rows. Why split it out: the old form
// emitted brittle JSON and a hardcoded Mon–Fri weekday list, so operators
// could not configure Saturdays without editing JSON. This component keeps
// the same upsert payload shape (timezone, weekdays, windows[]) and lets the
// admin-booking surface focus on orchestration.

const WEEKDAY_LABELS: Array<{ value: number; short: string }> = [
    { value: 1, short: "Mon" },
    { value: 2, short: "Tue" },
    { value: 3, short: "Wed" },
    { value: 4, short: "Thu" },
    { value: 5, short: "Fri" },
    { value: 6, short: "Sat" },
    { value: 0, short: "Sun" },
];

interface AvailabilityRuleDraftWindow {
    start: string;
    end: string;
    slotMinutes?: number | null;
}

interface AvailabilityRuleEditorPayload {
    timezone: string;
    weekdays: number[];
    windows: AvailabilityRuleDraftWindow[];
}

function AvailabilityRuleEditor({
    disabled,
    onSave,
}: {
    disabled: boolean;
    onSave: (payload: AvailabilityRuleEditorPayload) => void;
}) {
    const [timezone, setTimezone] = useState("Europe/Amsterdam");
    const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
    const [windows, setWindows] = useState<AvailabilityRuleDraftWindow[]>([
        { start: "09:00", end: "17:00" },
    ]);

    const toggleWeekday = (value: number) => {
        setWeekdays((current) => current.includes(value)
            ? current.filter((d) => d !== value)
            : [...current, value].sort((a, b) => a - b));
    };

    const updateWindow = (index: number, patch: Partial<AvailabilityRuleDraftWindow>) => {
        setWindows((current) => current.map((w, i) => (i === index ? { ...w, ...patch } : w)));
    };

    const addWindow = () => {
        setWindows((current) => [...current, { start: "09:00", end: "17:00" }]);
    };

    const removeWindow = (index: number) => {
        setWindows((current) => current.length > 1 ? current.filter((_, i) => i !== index) : current);
    };

    return (
        <div className="grid gap-3">
            <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Timezone (IANA)</p>
                <Input
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="e.g. Europe/Amsterdam, America/New_York"
                />
            </div>

            <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Active days</p>
                <div className="flex flex-wrap gap-1.5">
                    {WEEKDAY_LABELS.map((day) => {
                        const active = weekdays.includes(day.value);
                        return (
                            <button
                                key={day.value}
                                type="button"
                                onClick={() => toggleWeekday(day.value)}
                                className={`h-8 rounded-md border px-2.5 text-xs font-medium transition ${active
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-input bg-background text-muted-foreground hover:border-primary/30"
                                    }`}
                            >
                                {day.short}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div>
                <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Time windows</p>
                    <button
                        type="button"
                        onClick={addWindow}
                        className="text-xs font-medium text-primary hover:underline"
                    >
                        + Add window
                    </button>
                </div>
                <div className="grid gap-2">
                    {windows.map((win, i) => (
                        <div key={i} className="grid dashboard-mobile-stack grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
                            <Input
                                type="time"
                                value={win.start}
                                onChange={(e) => updateWindow(i, { start: e.target.value })}
                                aria-label={`Window ${i + 1} start`}
                            />
                            <Input
                                type="time"
                                value={win.end}
                                onChange={(e) => updateWindow(i, { end: e.target.value })}
                                aria-label={`Window ${i + 1} end`}
                            />
                            <Input
                                type="number"
                                min={1}
                                placeholder="Stride min (opt.)"
                                value={win.slotMinutes ?? ""}
                                onChange={(e) => updateWindow(i, { slotMinutes: e.target.value ? Number(e.target.value) : null })}
                                aria-label={`Window ${i + 1} stride minutes`}
                            />
                            <button
                                type="button"
                                onClick={() => removeWindow(i)}
                                disabled={windows.length === 1}
                                className="h-8 w-8 rounded-md border border-input text-xs text-muted-foreground transition hover:border-destructive/40 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
                                aria-label={`Remove window ${i + 1}`}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Stride defaults to the service duration when blank — e.g. a 60-min service produces back-to-back slots. Set a smaller stride for overlapping starts.
                </p>
            </div>

            <Button
                onClick={() => onSave({
                    timezone: timezone.trim() || "Europe/Amsterdam",
                    weekdays,
                    windows: windows
                        .filter((w) => w.start && w.end)
                        .map((w) => ({
                            start: w.start,
                            end: w.end,
                            ...(w.slotMinutes && w.slotMinutes > 0 ? { slotMinutes: w.slotMinutes } : {}),
                        })),
                })}
                disabled={disabled || weekdays.length === 0 || windows.length === 0}
            >
                <CalendarClock className="h-4 w-4" />
                Save recurring rule
            </Button>
        </div>
    );
}
