import type { Metadata } from "next";
import { headers } from "next/headers";
import { getPublicBookingCatalog } from "@/features/booking/actions";
import { PublicBookingExperience } from "@/features/booking/ui/public-booking-experience";
import { getPublicGdprFlags } from "@/features/gdpr/public";
import { resolveLocalizedPrivacyPolicyUrl } from "@/features/booking/lib/privacy";
import { getActiveTemplate } from "@/features/templates/actions";
import { buildSecondaryPageMetadata } from "@/features/templates/metadata";
import { DEFAULT_LOCALE, LOCALE_HEADER_KEY, isSupportedLocale } from "@/shared/lib/i18n/routing";

export const dynamic = "force-dynamic";

const BOOKING_COPY: Record<"en" | "nl" | "ar", { title: string; description: string }> = {
    en: {
        title: "Systems Fit Call & Blueprint",
        description: "Review available services, choose a suitable time, and complete a secure booking request.",
    },
    nl: {
        title: "Systems Fit Call & Blueprint",
        description: "Bekijk beschikbare diensten, kies een geschikt moment en rond een veilige boekingsaanvraag af.",
    },
    ar: {
        title: "مكالمة ملاءمة الأنظمة وخارطة الأنظمة",
        description: "راجع الخدمات المتاحة، واختر الموعد المناسب، وأكمل طلب الحجز الآمن.",
    },
};

export async function generateMetadata(): Promise<Metadata> {
    const { config, locale, settings } = await getActiveTemplate();
    const supported = locale === "nl" || locale === "ar" ? locale : "en";
    const copy = BOOKING_COPY[supported];
    return buildSecondaryPageMetadata({
        path: "/booking",
        title: copy.title,
        description: copy.description,
        locale,
        siteName: settings.siteName,
        siteDomain: settings.siteDomain,
        config,
        localized: true,
    });
}

type BookingPaymentReturnStatus = "paypal_success" | "paypal_cancelled" | "paypal_capture_failed";

function parseBookingPaymentReturnStatus(value: string | string[] | undefined): BookingPaymentReturnStatus | null {
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw === "paypal_success" || raw === "paypal_cancelled" || raw === "paypal_capture_failed") {
        return raw;
    }

    return null;
}

export default async function PublicBookingPage({
    searchParams,
}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
    const headerStore = await headers();
    const host = headerStore.get("host");
    const headerLocale = headerStore.get(LOCALE_HEADER_KEY);
    const locale = isSupportedLocale(headerLocale) ? headerLocale : DEFAULT_LOCALE;
    const resolvedSearchParams = (await searchParams) ?? {};
    const catalog = await getPublicBookingCatalog({
        siteDomain: host,
        locale,
    });
    const gdprFlags = await getPublicGdprFlags(catalog.workspace?.id ?? null);
    const configuredPrivacyUrl = gdprFlags.privacyUrl?.trim() || null;
    const privacyUrl = resolveLocalizedPrivacyPolicyUrl(configuredPrivacyUrl, locale);

    return (
        <PublicBookingExperience
            catalog={catalog}
            consentRequired={gdprFlags.consentRequired}
            privacyUrl={privacyUrl}
            paymentReturnStatus={parseBookingPaymentReturnStatus(resolvedSearchParams.payment)}
        />
    );
}
