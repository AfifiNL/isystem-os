import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, XCircle } from "lucide-react";

import { getActiveTemplate } from "@/features/templates/actions";
import { buildSecondaryPageMetadata } from "@/features/templates/metadata";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import type { Database } from "@/shared/lib/supabase/database.types";
import { getLocaleBcp47, localizeHref } from "@/shared/lib/i18n/routing";
import type { Locale } from "@/features/templates/types";
import { isLegacyBookingPricingVersion } from "@/features/booking/lib/pricing";

export const dynamic = "force-dynamic";

type PaymentResultStatus = "success" | "pending" | "cancelled" | "failed" | "not_found";

type ReservationStatus = Database["public"]["Enums"]["booking_reservation_status"];
type PaymentStatus = Database["public"]["Enums"]["booking_payment_status"];

interface PublicPaymentResult {
    status: PaymentResultStatus;
    reference: string | null;
    reservationStatus: ReservationStatus | null;
    paymentStatus: PaymentStatus | null;
    serviceTitle: string | null;
    scheduledStart: string | null;
    reservationTimezone: string | null;
    amountCents: number | null;
    netAmountCents: number | null;
    vatAmountCents: number | null;
    vatRateBasisPoints: number | null;
    grossAmountCents: number | null;
    pricingVersion: string | null;
    currency: string | null;
    provider: string | null;
    verifiedAt: string | null;
}

const RESULT_COPY: Record<Locale, Record<PaymentResultStatus, {
    eyebrow: string;
    title: string;
    body: string;
    tone: "success" | "warning" | "error";
}>> = {
    en: {
        success: { eyebrow: "Payment received", title: "Your PayPal payment was received", body: "The payment is safely linked to your booking. If the booking requires manual review, the team will confirm the final slot after review; otherwise your confirmation email is sent automatically.", tone: "success" },
        pending: { eyebrow: "Payment pending", title: "Your PayPal payment is still being confirmed", body: "PayPal has not completed the capture yet. Keep this page or return to your booking link; the confirmation will update after the provider callback is reconciled.", tone: "warning" },
        cancelled: { eyebrow: "Payment not completed", title: "PayPal checkout was cancelled", body: "Your booking is not confirmed yet. Return to the booking page and use the booking PayPal button if you still want to complete payment.", tone: "warning" },
        failed: { eyebrow: "Payment needs attention", title: "We could not capture the PayPal payment", body: "No confirmed payment was applied to this booking. Please retry from the booking payment button or contact us with your booking reference.", tone: "error" },
        not_found: { eyebrow: "Payment lookup unavailable", title: "We could not verify this payment link", body: "For security, this page only displays booking details when the payment reference matches a booking payment created by the public booking flow.", tone: "error" },
    },
    nl: {
        success: { eyebrow: "Betaling ontvangen", title: "Uw PayPal-betaling is ontvangen", body: "De betaling is veilig aan uw boeking gekoppeld. Als handmatige beoordeling nodig is, bevestigt het team het definitieve tijdslot; anders wordt automatisch een bevestigingsmail verzonden.", tone: "success" },
        pending: { eyebrow: "Betaling in behandeling", title: "Uw PayPal-betaling wordt nog bevestigd", body: "PayPal heeft de betaling nog niet afgerond. Kom later terug; de bevestiging wordt bijgewerkt zodra de provider-callback is verwerkt.", tone: "warning" },
        cancelled: { eyebrow: "Betaling niet voltooid", title: "PayPal-checkout is geannuleerd", body: "Uw boeking is nog niet bevestigd. Ga terug naar de boekingspagina en gebruik de PayPal-knop als u alsnog wilt betalen.", tone: "warning" },
        failed: { eyebrow: "Betaling vereist aandacht", title: "We konden de PayPal-betaling niet vastleggen", body: "Er is geen bevestigde betaling op deze boeking toegepast. Probeer opnieuw of neem contact op met uw boekingsreferentie.", tone: "error" },
        not_found: { eyebrow: "Betaling niet gevonden", title: "We konden deze betalingslink niet verifiëren", body: "Om veiligheidsredenen tonen we gegevens alleen wanneer de betalingsreferentie overeenkomt met een betaling uit de openbare boekingsflow.", tone: "error" },
    },
    ar: {
        success: { eyebrow: "تم استلام الدفع", title: "تم استلام دفعة PayPal", body: "تم ربط الدفعة بحجزك بأمان. إذا احتاج الحجز إلى مراجعة يدوية، سيؤكد الفريق الموعد النهائي؛ وإلا فستُرسل رسالة تأكيد تلقائيًا.", tone: "success" },
        pending: { eyebrow: "الدفع قيد المعالجة", title: "ما زال تأكيد دفعة PayPal جارياً", body: "لم يُكمل PayPal عملية التحصيل بعد. عُد لاحقاً؛ وسيتم تحديث التأكيد بعد معالجة إشعار مزود الدفع.", tone: "warning" },
        cancelled: { eyebrow: "لم يكتمل الدفع", title: "تم إلغاء عملية PayPal", body: "لم يتم تأكيد حجزك بعد. عُد إلى صفحة الحجز واستخدم زر PayPal إذا كنت تريد إكمال الدفع.", tone: "warning" },
        failed: { eyebrow: "الدفع يحتاج إلى إجراء", title: "تعذر إتمام دفعة PayPal", body: "لم تُطبّق دفعة مؤكدة على هذا الحجز. حاول مرة أخرى أو تواصل معنا مع مرجع الحجز.", tone: "error" },
        not_found: { eyebrow: "تعذر العثور على الدفع", title: "تعذر التحقق من رابط الدفع", body: "لأسباب أمنية، نعرض التفاصيل فقط عندما يطابق مرجع الدفع دفعة أُنشئت عبر مسار الحجز العام.", tone: "error" },
    },
};

function normalizeParam(value: string | string[] | undefined): string | null {
    const raw = Array.isArray(value) ? value[0] : value;
    const normalized = raw?.trim();
    return normalized && normalized.length > 0 ? normalized : null;
}

function parseStatus(value: string | string[] | undefined): PaymentResultStatus {
    const raw = normalizeParam(value);
    if (raw === "success" || raw === "pending" || raw === "cancelled" || raw === "failed") {
        return raw;
    }
    return "not_found";
}

function normalizeProvider(value: string | null): string | null {
    if (value === "paypal_checkout" || value === "paypal") return "PayPal";
    if (value === "manual_revolut_pro") return "Revolut";
    return value;
}

function formatMoney(amountCents: number | null, currency: string | null, locale: Locale): string | null {
    if (amountCents === null || !currency) return null;
    try {
        return new Intl.NumberFormat(getLocaleBcp47(locale), {
            style: "currency",
            currency,
        }).format(amountCents / 100);
    } catch {
        return `${currency} ${(amountCents / 100).toFixed(2)}`;
    }
}

function formatDateTime(value: string | null, timezone: string | null, locale: Locale): string | null {
    if (!value) return null;
    try {
        return new Intl.DateTimeFormat(getLocaleBcp47(locale), {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: timezone ?? "UTC",
        }).format(new Date(value));
    } catch {
        return new Date(value).toUTCString();
    }
}

function statusLabel(value: ReservationStatus | PaymentStatus | null, locale: Locale): string | null {
    if (!value) return null;
    const labels: Record<Locale, Record<string, string>> = {
        en: { draft: "Draft", requested: "Requested", verified: "Verified", failed: "Failed", refunded: "Refunded", expired: "Expired", pending_confirmation: "Pending confirmation", pending_review: "Pending review", confirmed: "Confirmed", completed: "Completed", no_show: "No-show", cancelled_by_customer: "Cancelled by customer", cancelled_by_workspace: "Cancelled by workspace" },
        nl: { draft: "Concept", requested: "Aangevraagd", verified: "Geverifieerd", failed: "Mislukt", refunded: "Terugbetaald", expired: "Verlopen", pending_confirmation: "Wacht op bevestiging", pending_review: "Wacht op beoordeling", confirmed: "Bevestigd", completed: "Voltooid", no_show: "Niet verschenen", cancelled_by_customer: "Geannuleerd door klant", cancelled_by_workspace: "Geannuleerd door workspace" },
        ar: { draft: "مسودة", requested: "مطلوب", verified: "تم التحقق", failed: "فشل", refunded: "مُسترد", expired: "منتهي", pending_confirmation: "بانتظار التأكيد", pending_review: "بانتظار المراجعة", confirmed: "مؤكد", completed: "مكتمل", no_show: "لم يحضر", cancelled_by_customer: "ألغاه العميل", cancelled_by_workspace: "ألغاه فريق العمل" },
    };
    return labels[locale][value] ?? value.replace(/_/g, " ");
}

function isConfirmedReservation(status: ReservationStatus | null): boolean {
    return status === "confirmed" || status === "completed";
}

function isPendingReviewReservation(status: ReservationStatus | null): boolean {
    return status === "pending_review";
}

async function loadPaymentResult(params: {
    requestedStatus: PaymentResultStatus;
    paymentId: string | null;
    reference: string | null;
}): Promise<PublicPaymentResult> {
    if (!params.paymentId || !params.reference) {
        return {
            status: params.requestedStatus === "cancelled" ? "cancelled" : "not_found",
            reference: params.reference,
            reservationStatus: null,
            paymentStatus: null,
            serviceTitle: null,
            scheduledStart: null,
            reservationTimezone: null,
            amountCents: null,
            netAmountCents: null,
            vatAmountCents: null,
            vatRateBasisPoints: null,
            grossAmountCents: null,
            pricingVersion: null,
            currency: null,
            provider: null,
            verifiedAt: null,
        };
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("booking_payments")
        .select(`
            id,
            provider,
            paypal_status,
            status,
            amount_cents,
            net_amount_cents,
            vat_amount_cents,
            vat_rate_basis_points,
            gross_amount_cents,
            pricing_version,
            currency,
            payment_reference,
            verified_at,
            booking_reservations:reservation_id!booking_payments_workspace_reservation_fk (
                public_reference,
                status,
                scheduled_start,
                reservation_timezone,
                booking_services!booking_reservations_workspace_service_fk ( title )
            )
        `)
        .eq("id", params.paymentId)
        .eq("payment_reference", params.reference)
        .maybeSingle();

    if (error || !data) {
        return {
            status: "not_found",
            reference: params.reference,
            reservationStatus: null,
            paymentStatus: null,
            serviceTitle: null,
            scheduledStart: null,
            reservationTimezone: null,
            amountCents: null,
            netAmountCents: null,
            vatAmountCents: null,
            vatRateBasisPoints: null,
            grossAmountCents: null,
            pricingVersion: null,
            currency: null,
            provider: null,
            verifiedAt: null,
        };
    }

    const reservation = data.booking_reservations as unknown as {
        public_reference: string;
        status: ReservationStatus;
        scheduled_start: string;
        reservation_timezone: string;
        booking_services: { title: string | null } | null;
    } | null;
    const effectiveStatus: PaymentResultStatus = data.status === "verified"
        ? "success"
        : data.paypal_status === "CUSTOMER_CANCELLED"
            ? "cancelled"
            : data.status === "failed" || data.status === "expired" || data.status === "refunded"
                ? "failed"
                : data.status === "requested"
                    ? "pending"
                    : params.requestedStatus === "failed"
                        ? "failed"
                        : "failed";

    return {
        status: effectiveStatus,
        reference: reservation?.public_reference ?? data.payment_reference,
        reservationStatus: reservation?.status ?? null,
        paymentStatus: data.status,
        serviceTitle: reservation?.booking_services?.title ?? null,
        scheduledStart: reservation?.scheduled_start ?? null,
        reservationTimezone: reservation?.reservation_timezone ?? null,
        amountCents: data.amount_cents,
        netAmountCents: data.net_amount_cents,
        vatAmountCents: data.vat_amount_cents,
        vatRateBasisPoints: data.vat_rate_basis_points,
        grossAmountCents: data.gross_amount_cents,
        pricingVersion: data.pricing_version,
        currency: data.currency,
        provider: normalizeProvider(data.provider),
        verifiedAt: data.verified_at,
    };
}

export async function generateMetadata(): Promise<Metadata> {
    const { config, locale, settings } = await getActiveTemplate();
    const title = locale === "nl" ? "Betaling ontvangen" : locale === "ar" ? "تم استلام الدفع" : "Payment received";
    const description = locale === "nl"
        ? "Resultaat van uw boekingsbetaling en vervolgstappen."
        : locale === "ar"
            ? "نتيجة دفع الحجز والخطوات التالية."
            : "Booking payment result and next steps.";
    return buildSecondaryPageMetadata({
        path: "/booking/payment-received",
        title,
        description,
        locale,
        siteName: settings.siteName,
        siteDomain: settings.siteDomain,
        config,
        localized: true,
        noIndex: true,
    });
}

export default async function BookingPaymentReceivedPage({
    searchParams,
}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
    const { config, locale } = await getActiveTemplate();
    const resolvedSearchParams = (await searchParams) ?? {};
    const requestedStatus = parseStatus(resolvedSearchParams.status);
    const result = await loadPaymentResult({
        requestedStatus,
        paymentId: normalizeParam(resolvedSearchParams.payment_id),
        reference: normalizeParam(resolvedSearchParams.reference),
    });
    const copy = RESULT_COPY[locale][result.status];
    const amount = formatMoney(result.grossAmountCents ?? result.amountCents, result.currency, locale);
    const netAmount = formatMoney(result.netAmountCents, result.currency, locale);
    const vatAmount = formatMoney(result.vatAmountCents, result.currency, locale);
    const scheduledAt = formatDateTime(result.scheduledStart, result.reservationTimezone, locale);
    const verifiedAt = formatDateTime(result.verifiedAt, result.reservationTimezone, locale);
    const labels = {
        back: locale === "nl" ? "Terug naar boeken" : locale === "ar" ? "العودة إلى الحجز" : "Back to booking",
        summary: locale === "nl" ? "Overzicht boeking en betaling" : locale === "ar" ? "ملخص الحجز والدفع" : "Booking payment summary",
        reference: locale === "nl" ? "Referentie" : locale === "ar" ? "المرجع" : "Reference",
        service: locale === "nl" ? "Dienst" : locale === "ar" ? "الخدمة" : "Service",
        slot: locale === "nl" ? "Aangevraagd tijdslot" : locale === "ar" ? "الموعد المطلوب" : "Requested slot",
        net: locale === "nl" ? "Netto (excl. BTW)" : locale === "ar" ? "الصافي (قبل الضريبة)" : "Net (excl. VAT)",
        vat: locale === "nl" ? "BTW" : locale === "ar" ? "ضريبة القيمة المضافة" : "VAT",
        total: locale === "nl" ? "Totaal" : locale === "ar" ? "الإجمالي" : "Total",
        legacyPricing: locale === "nl" ? "Historische prijsstelling" : locale === "ar" ? "تسعير تاريخي" : "Legacy pricing",
        provider: locale === "nl" ? "Provider" : locale === "ar" ? "مزود الدفع" : "Provider",
        paymentStatus: locale === "nl" ? "Betaalstatus" : locale === "ar" ? "حالة الدفع" : "Payment status",
        bookingStatus: locale === "nl" ? "Boekingsstatus" : locale === "ar" ? "حالة الحجز" : "Booking status",
        verified: locale === "nl" ? "Geverifieerd" : locale === "ar" ? "تم التحقق" : "Verified",
        unavailable: locale === "nl" ? "Niet beschikbaar" : locale === "ar" ? "غير متاح" : "Unavailable",
        confirmed: locale === "nl" ? "Uw boeking is bevestigd. Er wordt een bevestigingsmail verzonden." : locale === "ar" ? "تم تأكيد حجزك. سيتم إرسال رسالة التأكيد." : "Your booking is confirmed. A confirmation email is being sent.",
        pendingReview: locale === "nl" ? "De betaling is geverifieerd; uw boeking wacht nog op handmatige beoordeling." : locale === "ar" ? "تم التحقق من الدفع، والحجز بانتظار المراجعة اليدوية." : "Payment is verified, and your booking remains in manual review.",
        verifiedNext: locale === "nl" ? "De betaling is geverifieerd en gekoppeld aan uw boeking." : locale === "ar" ? "تم التحقق من الدفع وربطه بحجزك." : "Payment is verified and linked to your booking.",
    };
    const confirmed = isConfirmedReservation(result.reservationStatus);
    const pendingReview = isPendingReviewReservation(result.reservationStatus);
    const Icon = result.status === "pending"
        ? Clock3
        : copy.tone === "success"
            ? CheckCircle2
            : copy.tone === "warning"
                ? AlertTriangle
                : XCircle;
    const toneClasses = copy.tone === "success"
        ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
        : copy.tone === "warning"
            ? "border-amber-400/25 bg-amber-500/10 text-amber-300"
            : "border-red-400/25 bg-red-500/10 text-red-300";

    return (
        <div dir={locale === "ar" ? "rtl" : "ltr"} className={`mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-20 ${config.id === "isystem-agency" ? "isystem-payment-surface" : ""}`}>
            <section className="relative overflow-hidden rounded-[28px] border border-[var(--template-border-soft)] [background:var(--template-surface-glass)] p-5 shadow-[var(--template-depth-lg)] backdrop-blur-[20px] sm:p-8 md:p-10">
                <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(circle at top right, color-mix(in oklch, var(--template-accent) 14%, transparent) 0%, transparent 34%), radial-gradient(circle at bottom left, color-mix(in oklch, var(--template-gradient-from) 10%, transparent) 0%, transparent 32%)" }} />
                <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
                    <div className="min-w-0 space-y-5">
                        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${toneClasses}`}>
                            <Icon className="h-4 w-4 shrink-0" />
                            {copy.eyebrow}
                        </div>
                        <div className="space-y-3">
                            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--template-text-primary)] sm:text-4xl md:text-5xl">
                                {copy.title}
                            </h1>
                            <p className="max-w-2xl text-base leading-8 text-[var(--template-text-secondary)] md:text-lg">
                                {copy.body}
                            </p>
                        </div>

                        {result.status === "success" ? (
                            <div className="rounded-2xl border border-[var(--template-border-soft)] bg-black/5 p-4 text-sm leading-7 text-[var(--template-text-secondary)]">
                                {confirmed ? (
                                    <p>{labels.confirmed}</p>
                                ) : pendingReview ? (
                                    <p>{labels.pendingReview}</p>
                                ) : (
                                    <p>{labels.verifiedNext}</p>
                                )}
                            </div>
                        ) : null}

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Link
                                href={localizeHref(locale, "/booking")}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--template-border-accent-soft)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--template-depth-glow)]"
                                style={{ background: "linear-gradient(to right, var(--template-gradient-from), var(--template-gradient-to))" }}
                            >
                                <ArrowLeft className="h-4 w-4 rtl-flip" />
                                {labels.back}
                            </Link>
                        </div>
                    </div>

                    <aside className="min-w-0 rounded-2xl border border-[var(--template-border-soft)] bg-black/5 p-5 sm:rounded-3xl">
                        <h2 className="text-base font-semibold text-[var(--template-text-primary)]">{labels.summary}</h2>
                        <dl className="mt-4 space-y-3 text-sm">
                            <div className="flex justify-between gap-4">
                                <dt className="text-[var(--template-text-subtle)]">{labels.reference}</dt>
                                <dd className="min-w-0 break-all text-right font-semibold text-[var(--template-text-primary)]">{result.reference ?? labels.unavailable}</dd>
                            </div>
                            {result.serviceTitle ? (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-[var(--template-text-subtle)]">{labels.service}</dt>
                                    <dd className="min-w-0 text-right text-[var(--template-text-primary)]">{result.serviceTitle}</dd>
                                </div>
                            ) : null}
                            {scheduledAt ? (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-[var(--template-text-subtle)]">{labels.slot}</dt>
                                    <dd className="min-w-0 text-right text-[var(--template-text-primary)]">{scheduledAt}</dd>
                                </div>
                            ) : null}
                            {netAmount ? (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-[var(--template-text-subtle)]">{labels.net}</dt>
                                    <dd className="text-right text-[var(--template-text-primary)]">{netAmount}</dd>
                                </div>
                            ) : null}
                            {vatAmount ? (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-[var(--template-text-subtle)]">{labels.vat}{result.vatRateBasisPoints ? ` (${result.vatRateBasisPoints / 100}%)` : ""}</dt>
                                    <dd className="text-right text-[var(--template-text-primary)]">{vatAmount}</dd>
                                </div>
                            ) : null}
                            {amount ? (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-[var(--template-text-subtle)]">{labels.total}</dt>
                                    <dd className="text-right font-semibold text-[var(--template-text-primary)]">{amount}</dd>
                                </div>
                            ) : null}
                            {isLegacyBookingPricingVersion(result.pricingVersion) && result.amountCents !== null ? (
                                <div className="text-xs text-amber-700 dark:text-amber-300">{labels.legacyPricing}</div>
                            ) : null}
                            {result.provider ? (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-[var(--template-text-subtle)]">{labels.provider}</dt>
                                    <dd className="text-right text-[var(--template-text-primary)]">{result.provider}</dd>
                                </div>
                            ) : null}
                            {result.paymentStatus ? (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-[var(--template-text-subtle)]">{labels.paymentStatus}</dt>
                                    <dd className="text-right capitalize text-[var(--template-text-primary)]">{statusLabel(result.paymentStatus, locale)}</dd>
                                </div>
                            ) : null}
                            {result.reservationStatus ? (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-[var(--template-text-subtle)]">{labels.bookingStatus}</dt>
                                    <dd className="text-right capitalize text-[var(--template-text-primary)]">{statusLabel(result.reservationStatus, locale)}</dd>
                                </div>
                            ) : null}
                            {verifiedAt ? (
                                <div className="flex justify-between gap-4 border-t border-[var(--template-border-soft)] pt-3">
                                    <dt className="inline-flex items-center gap-1 text-[var(--template-text-subtle)]"><Clock3 className="h-3.5 w-3.5" /> {labels.verified}</dt>
                                    <dd className="text-right text-[var(--template-text-primary)]">{verifiedAt}</dd>
                                </div>
                            ) : null}
                        </dl>
                    </aside>
                </div>
            </section>
        </div>
    );
}
