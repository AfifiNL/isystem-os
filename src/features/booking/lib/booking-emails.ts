// Inline booking email dispatch via Resend. Called from the three booking
// server actions (submit, transition, markPaymentVerified) right after the
// internal_dashboard notification signal is recorded.
//
// Design choices:
//
// 1. Best-effort. Email delivery must never fail the booking flow. Resend
//    outages, missing API keys, malformed recipients — all are recorded on the
//    notification event row (delivery_status='failed', failure reason in
//    payload_json.emailError) and the caller continues.
//
// 2. Audit row separate from the dashboard signal. The dashboard signal lives
//    on its own row with channel='internal_dashboard' (always status='pending'
//    — it's just an indicator, not a queue). Email sends create a *second*
//    row with channel='email' that transitions to 'sent' or 'failed'. This
//    keeps the two concerns auditable independently.
//
// 3. Idempotency via successful audit rows plus Resend's Idempotency-Key
//    header. Each retry has its own audit row; a sent/delivered event for the
//    same reservation, event, role, and reminder window suppresses duplicates.
//
// 4. Inline sends keep the customer journey fast. Failed/skipped audit rows
//    are recovered by the authenticated booking follow-up cron, up to the
//    configured attempt limit; hard bounces and complaints are terminal.

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/shared/lib/resend/send-email";
import { BOOKING_PAYMENT_COMPLETION_WINDOW_HOURS } from "@/features/booking/lib/booking-policies";
import type { Database, Json } from "@/shared/lib/supabase/database.types";
import {
    getBookingEmailPlan,
    normalizeEmailLocale,
    type SupportedEmailLocale,
} from "@/features/communications/email-lifecycle";
import {
    createBookingManagementToken,
    getBookingManagementCapabilityExpiry,
} from "@/features/booking/lib/customer-management-token";
import { isLegacyBookingPricingVersion } from "@/features/booking/lib/pricing";
import { normalizePublicHttpUrl } from "@/features/booking/lib/privacy";
import { localizeHref } from "@/shared/lib/i18n/routing";
import { resolveLocalizedJson } from "@/shared/lib/i18n/resolve";
import { resolveRecoveredBookingEmailEvent } from "@/features/booking/lib/booking-email-recovery-policy";
import {
    addBookingEmailDeliveryOutcome,
    emptyBookingEmailDeliveryOutcome,
    mergeBookingEmailDeliveryOutcomes,
    type BookingEmailDeliveryOutcome,
    type BookingEmailDeliveryStatus,
} from "@/features/booking/lib/booking-email-delivery-outcome";

type SupabaseAny = SupabaseClient<Database> | SupabaseClient<Database, "public">;

const EMAIL_CLAIM_LEASE_MS = 10 * 60 * 1000;

type EventType =
    | "reservation_created"
    | "reservation_pending_review"
    | "reservation_reschedule_requested"
    | "reservation_confirmed"
    | "reservation_cancelled"
    | "reservation_completed"
    | "reservation_rescheduled"
    | "meeting_ready"
    | "reservation_no_show"
    | "payment_requested"
    | "payment_reminder"
    | "payment_failed"
    | "payment_expired"
    | "payment_refunded"
    | "appointment_reminder"
    | "post_session_followup";

interface ReservationEmailContext {
    reservationId: string;
    workspaceId: string;
    workspaceName: string;
    workspaceSlug: string;
    publicReference: string;
    customerFullName: string;
    customerEmail: string;
    scheduledStart: string;
    scheduledEnd: string;
    status: Database["public"]["Enums"]["booking_reservation_status"];
    reservationTimezone: string;
    serviceTitle: string | null;
    locationMode: string;
    locationName: string | null;
    locationInstructions: string | null;
    locale: SupportedEmailLocale;
    payment: PaymentEmailContext | null;
    meeting: {
        provider: "google_meet" | "zoom";
        providerMeetingId: string | null;
        calendarEventId: string | null;
        joinUrl: string | null;
        status: string;
    } | null;
}

interface PaymentEmailContext {
    amountCents: number;
    netAmountCents: number | null;
    vatAmountCents: number | null;
    vatRateBasisPoints: number | null;
    grossAmountCents: number | null;
    pricingVersion: string | null;
    currency: string;
    paymentUrl: string | null;
    paymentReference: string;
    customerInstructions: string | null;
    deadlineAt: string | null;
    provider: string;
    status: Database["public"]["Enums"]["booking_payment_status"];
}

interface DispatchParams {
    supabase: SupabaseAny;
    workspaceId: string;
    reservationId: string;
    eventType: EventType;
    reason?: string | null;
    reminderWindow?: string | null;
    eventInstanceKey?: string | null;
}

export type BookingPaymentEmailEventType = EventType;

function defaultFromEmail(): string {
    return (
        process.env.BOOKING_FROM_EMAIL?.trim() ||
        process.env.NEWSLETTER_FROM_EMAIL?.trim() ||
        "Bookings <noreply@example.invalid>"
    );
}

function defaultReplyTo(): string | undefined {
    return (
        process.env.BOOKING_REPLY_TO_EMAIL?.trim() ||
        process.env.NEWSLETTER_REPLY_TO_EMAIL?.trim() ||
        undefined
    );
}

function formatScheduledStart(iso: string, timezone: string, locale: SupportedEmailLocale = "en"): string {
    try {
        return new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : locale === "ar" ? "ar" : "en-GB", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: timezone,
        }).format(new Date(iso));
    } catch {
        return new Date(iso).toUTCString();
    }
}

function localize(locale: SupportedEmailLocale, en: string, nl: string, ar: string) {
    return locale === "nl" ? nl : locale === "ar" ? ar : en;
}

function formatMoney(cents: number, currency: string, locale: SupportedEmailLocale = "en"): string {
    try {
        return new Intl.NumberFormat(locale === "nl" ? "nl-NL" : locale === "ar" ? "ar" : "en-GB", {
            style: "currency",
            currency,
        }).format(cents / 100);
    } catch {
        return `${currency} ${(cents / 100).toFixed(2)}`;
    }
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function compactUtcDate(iso: string) {
    return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function buildCalendarLinks(ctx: ReservationEmailContext) {
    const subject = ctx.serviceTitle || localize(ctx.locale, "Appointment", "Afspraak", "موعد");
    const handoffDetails = [
        `${ctx.workspaceName} · ${ctx.publicReference}`,
        ctx.meeting?.joinUrl ? `Join meeting: ${ctx.meeting.joinUrl}` : null,
        ctx.locationInstructions,
    ].filter((value): value is string => Boolean(value));
    const details = handoffDetails.join("\n");
    const location = ctx.locationName ?? (ctx.meeting?.joinUrl ? localize(ctx.locale, "Online meeting", "Online vergadering", "اجتماع عبر الإنترنت") : null);
    const google = new URL("https://calendar.google.com/calendar/render");
    google.searchParams.set("action", "TEMPLATE");
    google.searchParams.set("text", subject);
    google.searchParams.set("dates", `${compactUtcDate(ctx.scheduledStart)}/${compactUtcDate(ctx.scheduledEnd)}`);
    google.searchParams.set("details", details);
    if (location) google.searchParams.set("location", location);

    const outlook = new URL("https://outlook.live.com/calendar/0/deeplink/compose");
    outlook.searchParams.set("path", "/calendar/action/compose");
    outlook.searchParams.set("rru", "addevent");
    outlook.searchParams.set("subject", subject);
    outlook.searchParams.set("startdt", new Date(ctx.scheduledStart).toISOString());
    outlook.searchParams.set("enddt", new Date(ctx.scheduledEnd).toISOString());
    outlook.searchParams.set("body", details);
    if (location) outlook.searchParams.set("location", location);

    const googleLabel = localize(ctx.locale, "Add to Google Calendar", "Toevoegen aan Google Agenda", "أضف إلى تقويم Google");
    const outlookLabel = localize(ctx.locale, "Add to Outlook", "Toevoegen aan Outlook", "أضف إلى Outlook");
    return `<p style="margin:18px 0 0;"><a href="${escapeHtml(google.toString())}" style="color:#0f172a;font-weight:700;">${escapeHtml(googleLabel)}</a><span style="color:#94a3b8;"> · </span><a href="${escapeHtml(outlook.toString())}" style="color:#0f172a;font-weight:700;">${escapeHtml(outlookLabel)}</a></p>`;
}

function buildBookingManagementLink(ctx: ReservationEmailContext): string {
    try {
        const token = createBookingManagementToken({
            reservationId: ctx.reservationId,
            workspaceId: ctx.workspaceId,
            expiresAt: getBookingManagementCapabilityExpiry(ctx.scheduledEnd),
        });
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
        const path = localizeHref(ctx.locale, "/booking/manage");
        const url = new URL(path, `${siteUrl}/`);
        url.searchParams.set("token", token);
        const label = localize(ctx.locale, "Manage booking", "Boeking beheren", "إدارة الحجز");

        return `<p style="margin:20px 0 0;"><a href="${escapeHtml(url.toString())}" style="display:inline-block;padding:11px 18px;border-radius:10px;background:#0f172a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;">${escapeHtml(label)}</a></p>`;
    } catch (error) {
        console.warn(
            "booking-emails: management link unavailable",
            error instanceof Error ? error.message : error,
        );
        return "";
    }
}

function buildCustomerSubject(eventType: EventType, ctx: ReservationEmailContext): string {
    const ref = ctx.publicReference;
    switch (eventType) {
        case "payment_requested":
            return localize(ctx.locale, `Payment required to confirm your booking · ${ref}`, `Betaling nodig om uw boeking te bevestigen · ${ref}`, `الدفع مطلوب لتأكيد حجزك · ${ref}`);
        case "payment_reminder":
            return localize(ctx.locale, `Payment reminder — booking not confirmed yet · ${ref}`, `Betalingsherinnering — boeking nog niet bevestigd · ${ref}`, `تذكير بالدفع — الحجز غير مؤكد بعد · ${ref}`);
        case "payment_failed":
            return localize(ctx.locale, `Payment failed — action needed · ${ref}`, `Betaling mislukt — actie nodig · ${ref}`, `فشل الدفع — يلزم اتخاذ إجراء · ${ref}`);
        case "payment_expired":
            return localize(ctx.locale, `Booking cancelled — payment deadline passed · ${ref}`, `Boeking geannuleerd — betaaltermijn verstreken · ${ref}`, `تم إلغاء الحجز — انتهت مهلة الدفع · ${ref}`);
        case "payment_refunded":
            return localize(ctx.locale, `Payment refunded · ${ref}`, `Betaling terugbetaald · ${ref}`, `تم رد الدفعة · ${ref}`);
        case "reservation_created":
            return localize(ctx.locale, `Booking received · ${ref}`, `Boeking ontvangen · ${ref}`, `تم استلام الحجز · ${ref}`);
        case "reservation_pending_review":
            return localize(ctx.locale, `Booking received — awaiting confirmation · ${ref}`, `Boeking ontvangen — wacht op bevestiging · ${ref}`, `تم استلام الحجز — بانتظار التأكيد · ${ref}`);
        case "reservation_reschedule_requested":
            return localize(ctx.locale, `New booking time awaiting confirmation · ${ref}`, `Nieuw boekingsmoment wacht op bevestiging · ${ref}`, `موعد الحجز الجديد بانتظار التأكيد · ${ref}`);
        case "reservation_confirmed":
            return localize(ctx.locale, `Booking confirmed · ${ref}`, `Boeking bevestigd · ${ref}`, `تم تأكيد الحجز · ${ref}`);
        case "reservation_rescheduled":
            return localize(ctx.locale, `Booking rescheduled · ${ref}`, `Boeking verplaatst · ${ref}`, `تم تغيير موعد الحجز · ${ref}`);
        case "meeting_ready":
            return localize(ctx.locale, `Your meeting link is ready · ${ref}`, `Uw vergaderlink is klaar · ${ref}`, `رابط اجتماعك جاهز · ${ref}`);
        case "reservation_cancelled":
            return localize(ctx.locale, `Booking cancelled · ${ref}`, `Boeking geannuleerd · ${ref}`, `تم إلغاء الحجز · ${ref}`);
        case "reservation_completed":
        case "post_session_followup":
            return localize(ctx.locale, `Thanks for booking with ${ctx.workspaceName}`, `Bedankt voor uw boeking bij ${ctx.workspaceName}`, `شكرًا لحجزك مع ${ctx.workspaceName}`);
        case "reservation_no_show":
            return localize(ctx.locale, `We missed you · ${ref}`, `We hebben u gemist · ${ref}`, `افتقدناك في الموعد · ${ref}`);
        case "appointment_reminder":
            return localize(ctx.locale, `Your appointment is coming up · ${ref}`, `Uw afspraak komt eraan · ${ref}`, `موعدك يقترب · ${ref}`);
    }
}

function buildCustomerHeadline(eventType: EventType, ctx: ReservationEmailContext): string {
    switch (eventType) {
        case "payment_requested":
            return localize(ctx.locale, "Payment is required before your booking is confirmed.", "Betaling is nodig voordat uw boeking wordt bevestigd.", "الدفع مطلوب قبل تأكيد حجزك.");
        case "payment_reminder":
            return localize(ctx.locale, "Reminder: your booking is still waiting for payment.", "Herinnering: uw boeking wacht nog op betaling.", "تذكير: حجزك لا يزال بانتظار الدفع.");
        case "payment_failed":
            return localize(ctx.locale, "We could not complete your payment.", "Uw betaling kon niet worden voltooid.", "تعذر إكمال دفعتك.");
        case "payment_expired":
            return localize(ctx.locale, "Your unpaid booking hold has been cancelled.", "Uw onbetaalde boekingsreservering is geannuleerd.", "تم إلغاء الحجز غير المدفوع.");
        case "payment_refunded":
            return localize(ctx.locale, "Your payment has been refunded.", "Uw betaling is terugbetaald.", "تم رد دفعتك.");
        case "reservation_created":
            return localize(ctx.locale, "Your booking is in.", "Uw boeking is ontvangen.", "تم استلام حجزك.");
        case "reservation_pending_review":
            return localize(ctx.locale, "We’ve received your booking.", "We hebben uw boeking ontvangen.", "لقد استلمنا حجزك.");
        case "reservation_reschedule_requested":
            return localize(ctx.locale, "We’ve received your request for a new time.", "We hebben uw verzoek voor een nieuw moment ontvangen.", "تلقينا طلبك لتغيير الموعد.");
        case "reservation_confirmed":
            return localize(ctx.locale, "Your booking is confirmed.", "Uw boeking is bevestigd.", "تم تأكيد حجزك.");
        case "reservation_rescheduled":
            return localize(ctx.locale, "Your booking has a new time.", "Uw boeking heeft een nieuwe tijd.", "تم تحديد وقت جديد لحجزك.");
        case "meeting_ready":
            return localize(ctx.locale, "Your customer-safe meeting link is ready.", "Uw veilige vergaderlink voor klanten is klaar.", "رابط الاجتماع الآمن الخاص بك جاهز.");
        case "reservation_cancelled":
            return localize(ctx.locale, "Your booking was cancelled.", "Uw boeking is geannuleerd.", "تم إلغاء حجزك.");
        case "reservation_completed":
        case "post_session_followup":
            return localize(ctx.locale, "Thanks for visiting.", "Bedankt voor uw bezoek.", "شكرًا لزيارتك.");
        case "reservation_no_show":
            return localize(ctx.locale, "We missed you at the appointment.", "We hebben u gemist bij de afspraak.", "افتقدناك في الموعد.");
        case "appointment_reminder":
            return localize(ctx.locale, "A reminder for your upcoming appointment.", "Een herinnering voor uw komende afspraak.", "تذكير بموعدك القادم.");
    }
}

function buildPaymentDetails(ctx: ReservationEmailContext): string {
    const payment = ctx.payment;
    if (!payment) return "";

    const providerLabel = payment.provider === "paypal_checkout" || payment.provider === "paypal"
        ? "PayPal"
        : "Revolut";
    const deadline = payment.deadlineAt
        ? formatScheduledStart(payment.deadlineAt, ctx.reservationTimezone, ctx.locale)
        : null;
    const payLabel = localize(ctx.locale, `Pay with ${providerLabel}`, `Betalen met ${providerLabel}`, `الدفع عبر ${providerLabel}`);
    const payButton = payment.paymentUrl
        ? `<p style="margin:18px 0;"><a href="${escapeHtml(payment.paymentUrl)}" style="display:inline-block;padding:11px 18px;border-radius:10px;background:#0f172a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;">${escapeHtml(payLabel)}</a></p>`
        : "";
    const instructions = payment.customerInstructions
        ? `<p style="margin:0 0 12px;white-space:pre-line;">${escapeHtml(payment.customerInstructions)}</p>`
        : "";
    const referenceNote = payment.provider === "paypal_checkout" || payment.provider === "paypal"
        ? localize(ctx.locale, "Use only the PayPal button generated for this booking. Payments started outside this booking flow may not link to your reservation automatically.", "Gebruik alleen de PayPal-knop voor deze boeking. Betalingen buiten deze boekingsflow worden mogelijk niet automatisch gekoppeld.", "استخدم زر PayPal المخصص لهذا الحجز فقط. قد لا ترتبط المدفوعات التي تبدأ خارج مسار الحجز تلقائيًا.")
        : localize(ctx.locale, "Important: include the payment reference in the Revolut payment note. We confirm the booking only after the payment is verified.", "Belangrijk: vermeld de betalingsreferentie in de Revolut-omschrijving. We bevestigen de boeking pas na verificatie.", "مهم: أدرج مرجع الدفع في ملاحظة Revolut. نؤكد الحجز فقط بعد التحقق من الدفع.");
    const amountLabel = localize(ctx.locale, "Amount", "Bedrag", "المبلغ");
    const referenceLabel = localize(ctx.locale, "Payment reference", "Betalingsreferentie", "مرجع الدفع");
    const deadlineLabel = localize(ctx.locale, `${BOOKING_PAYMENT_COMPLETION_WINDOW_HOURS}-hour payment deadline`, `Betaaltermijn van ${BOOKING_PAYMENT_COMPLETION_WINDOW_HOURS} uur`, `مهلة الدفع ${BOOKING_PAYMENT_COMPLETION_WINDOW_HOURS} ساعة`);
    const netLabel = localize(ctx.locale, "Net", "Netto", "الصافي");
    const vatLabel = localize(ctx.locale, "VAT", "BTW", "ضريبة القيمة المضافة");
    const totalLabel = localize(ctx.locale, "Total", "Totaal", "الإجمالي");
    const legacyPricingLabel = localize(ctx.locale, "Legacy pricing", "Historische prijsstelling", "تسعير تاريخي");
    const netAmount = payment.netAmountCents ?? payment.amountCents;
    const vatAmount = payment.vatAmountCents ?? 0;
    const grossAmount = payment.grossAmountCents ?? payment.amountCents;

    return `<div style="margin:16px 0;padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
      <p style="margin:0 0 8px;">${escapeHtml(amountLabel)}: <strong>${escapeHtml(formatMoney(grossAmount, payment.currency, ctx.locale))}</strong></p>
      ${payment.netAmountCents !== null ? `<p style="margin:0 0 6px;color:#475569;">${escapeHtml(netLabel)}: ${escapeHtml(formatMoney(netAmount, payment.currency, ctx.locale))}</p>` : ""}
      ${payment.vatAmountCents !== null ? `<p style="margin:0 0 8px;color:#475569;">${escapeHtml(vatLabel)}${payment.vatRateBasisPoints ? ` (${payment.vatRateBasisPoints / 100}%)` : ""}: ${escapeHtml(formatMoney(vatAmount, payment.currency, ctx.locale))}</p>` : ""}
      ${payment.grossAmountCents !== null ? `<p style="margin:0 0 8px;font-weight:700;">${escapeHtml(totalLabel)}: ${escapeHtml(formatMoney(grossAmount, payment.currency, ctx.locale))}</p>` : ""}
      ${isLegacyBookingPricingVersion(payment.pricingVersion) ? `<p style="margin:0 0 8px;color:#a16207;font-size:12px;">${escapeHtml(legacyPricingLabel)}</p>` : ""}
      <p style="margin:0 0 8px;">${escapeHtml(referenceLabel)}: <code>${escapeHtml(payment.paymentReference)}</code></p>
      ${deadline ? `<p style="margin:0 0 8px;">${escapeHtml(deadlineLabel)}: <strong>${escapeHtml(deadline)}</strong></p>` : ""}
      ${instructions}
      ${payButton}
      <p style="margin:0;color:#64748b;font-size:13px;">${escapeHtml(referenceNote)}</p>
    </div>`;
}

function buildCustomerBody(eventType: EventType, ctx: ReservationEmailContext, reason: string | null): string {
    const when = formatScheduledStart(ctx.scheduledStart, ctx.reservationTimezone, ctx.locale);
    const serviceLabel = localize(ctx.locale, "Service", "Dienst", "الخدمة");
    const what = ctx.serviceTitle ? `<p style="margin:0 0 12px;">${escapeHtml(serviceLabel)}: <strong>${escapeHtml(ctx.serviceTitle)}</strong></p>` : "";
    const meetingLink = ctx.meeting?.joinUrl && (ctx.meeting.status === "ready" || eventType === "meeting_ready")
        ? `<p style="margin:18px 0;"><a href="${escapeHtml(ctx.meeting.joinUrl)}" style="display:inline-block;padding:11px 18px;border-radius:10px;background:#0f172a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;">${escapeHtml(localize(ctx.locale, "Join meeting", "Deelnemen aan de vergadering", "انضم إلى الاجتماع"))}</a></p>`
        : "";
    const locationDetails = ctx.locationName || ctx.locationInstructions
        ? `<div style="margin:16px 0;padding:14px;border-radius:10px;background:#f8fafc;color:#334155;"><strong>${escapeHtml(localize(ctx.locale, "Location", "Locatie", "الموقع"))}:</strong>${ctx.locationName ? ` ${escapeHtml(ctx.locationName)}` : ""}${ctx.locationInstructions ? `<p style="margin:8px 0 0;white-space:pre-line;">${escapeHtml(ctx.locationInstructions)}</p>` : ""}</div>`
        : "";
    switch (eventType) {
        case "payment_requested":
            return `${what}<p>${escapeHtml(localize(ctx.locale, `Requested for ${when}.`, `Aangevraagd voor ${when}.`, `طُلب الموعد في ${when}.`))}</p><p>${escapeHtml(localize(ctx.locale, `This booking is not confirmed yet. Your slot is held for ${BOOKING_PAYMENT_COMPLETION_WINDOW_HOURS} hours while payment is verified.`, `Deze boeking is nog niet bevestigd. Uw tijdslot blijft ${BOOKING_PAYMENT_COMPLETION_WINDOW_HOURS} uur gereserveerd tijdens de betalingscontrole.`, `هذا الحجز غير مؤكد بعد. نحتفظ بالموعد لمدة ${BOOKING_PAYMENT_COMPLETION_WINDOW_HOURS} ساعة أثناء التحقق من الدفع.`))}</p>${buildPaymentDetails(ctx)}`;
        case "payment_reminder":
            return `${what}<p>${escapeHtml(localize(ctx.locale, `Your booking for ${when} is still waiting for payment. Complete payment before the deadline or the slot will be released.`, `Uw boeking voor ${when} wacht nog op betaling. Betaal vóór de deadline, anders komt het tijdslot vrij.`, `لا يزال حجزك في ${when} بانتظار الدفع. أكمل الدفع قبل المهلة وإلا سيُتاح الموعد مجددًا.`))}</p>${buildPaymentDetails(ctx)}`;
        case "payment_failed":
            return `${what}<p>${escapeHtml(localize(ctx.locale, `We could not verify payment for ${when}.`, `We konden de betaling voor ${when} niet verifiëren.`, `تعذر علينا التحقق من الدفع لموعد ${when}.`))}</p>${buildPaymentDetails(ctx)}${reason ? `<p>${escapeHtml(reason)}</p>` : ""}`;
        case "payment_expired":
            return `${what}<p>${escapeHtml(localize(ctx.locale, `The temporary hold for ${when} was cancelled because payment was not verified before the deadline.`, `De tijdelijke reservering voor ${when} is geannuleerd omdat de betaling niet op tijd is geverifieerd.`, `أُلغي الحجز المؤقت في ${when} لعدم التحقق من الدفع قبل انتهاء المهلة.`))}</p><p><code>${escapeHtml(ctx.publicReference)}</code></p>`;
        case "payment_refunded":
            return `${what}<p>${escapeHtml(localize(ctx.locale, "The payment linked to this booking was refunded.", "De betaling voor deze boeking is terugbetaald.", "تم رد الدفعة المرتبطة بهذا الحجز."))}</p><p><code>${escapeHtml(ctx.publicReference)}</code></p>`;
        case "reservation_created":
            return `${what}<p>${escapeHtml(localize(ctx.locale, `Scheduled for ${when}.`, `Gepland voor ${when}.`, `الموعد في ${when}.`))}</p><p><code>${escapeHtml(ctx.publicReference)}</code></p>`;
        case "reservation_pending_review":
            return `${what}<p>${escapeHtml(localize(ctx.locale, `Requested for ${when}. We will review and confirm shortly.`, `Aangevraagd voor ${when}. We beoordelen en bevestigen dit zo snel mogelijk.`, `طُلب الموعد في ${when}. سنراجعه ونؤكده قريبًا.`))}</p><p><code>${escapeHtml(ctx.publicReference)}</code></p>`;
        case "reservation_reschedule_requested":
            return `${what}<p>${escapeHtml(localize(ctx.locale, `Your requested new time is ${when}. The original booking is no longer active while we review this request.`, `Uw aangevraagde nieuwe moment is ${when}. De oorspronkelijke boeking is niet langer actief terwijl we dit verzoek beoordelen.`, `الموعد الجديد المطلوب هو ${when}. لم يعد الحجز الأصلي نشطًا بينما نراجع هذا الطلب.`))}</p><p><code>${escapeHtml(ctx.publicReference)}</code></p>`;
        case "reservation_confirmed":
            return `${what}<p>${escapeHtml(localize(ctx.locale, `Confirmed for ${when}.`, `Bevestigd voor ${when}.`, `تم التأكيد في ${when}.`))}</p><p><code>${escapeHtml(ctx.publicReference)}</code></p>${meetingLink}${locationDetails}${buildCalendarLinks(ctx)}`;
        case "reservation_rescheduled":
            return `${what}<p>${escapeHtml(localize(ctx.locale, `Your new appointment time is ${when}.`, `Uw nieuwe afspraaktijd is ${when}.`, `موعدك الجديد هو ${when}.`))}</p><p><code>${escapeHtml(ctx.publicReference)}</code></p>${meetingLink}${locationDetails}${buildCalendarLinks(ctx)}`;
        case "meeting_ready":
            return `${what}<p>${escapeHtml(localize(ctx.locale, `Your meeting is ready for ${when}.`, `Uw vergadering staat klaar voor ${when}.`, `اجتماعك جاهز في ${when}.`))}</p><p><code>${escapeHtml(ctx.publicReference)}</code></p>${meetingLink}${locationDetails}`;
        case "reservation_cancelled":
            return `${what}<p>${escapeHtml(localize(ctx.locale, "This booking was cancelled.", "Deze boeking is geannuleerd.", "تم إلغاء هذا الحجز."))} <code>${escapeHtml(ctx.publicReference)}</code></p>${ctx.payment?.status === "verified" ? `<p>${escapeHtml(localize(ctx.locale, "Any refund is reviewed separately; cancellation does not automatically issue a refund.", "Een eventuele terugbetaling wordt afzonderlijk beoordeeld; annuleren leidt niet automatisch tot terugbetaling.", "تتم مراجعة أي استرداد بشكل منفصل؛ ولا يؤدي الإلغاء تلقائيًا إلى رد المبلغ."))}</p>` : ""}${reason ? `<p>${escapeHtml(reason)}</p>` : ""}`;
        case "reservation_completed":
        case "post_session_followup":
            return `${what}<p>${escapeHtml(localize(ctx.locale, "Thank you for your time. Reply with feedback or any follow-up question.", "Bedankt voor uw tijd. Reageer met feedback of een vervolgvraag.", "شكرًا لوقتك. رد على هذه الرسالة بملاحظاتك أو أي سؤال متابعة."))}</p><p><code>${escapeHtml(ctx.publicReference)}</code></p>`;
        case "reservation_no_show":
            return `${what}<p>${escapeHtml(localize(ctx.locale, `We did not see you at ${when}. Reply if you need help arranging a new time.`, `We hebben u niet gezien op ${when}. Reageer als u hulp wilt bij een nieuw moment.`, `لم نرك في الموعد ${when}. رد إذا كنت تحتاج إلى ترتيب موعد جديد.`))}</p>`;
        case "appointment_reminder":
            return `${what}<p>${escapeHtml(localize(ctx.locale, `Your appointment is scheduled for ${when}.`, `Uw afspraak staat gepland voor ${when}.`, `موعدك مقرر في ${when}.`))}</p><p><code>${escapeHtml(ctx.publicReference)}</code></p>${meetingLink}${locationDetails}${buildCalendarLinks(ctx)}`;
    }
}

function buildCustomerHtml(eventType: EventType, ctx: ReservationEmailContext, reason: string | null): string {
    const headline = buildCustomerHeadline(eventType, ctx);
    const body = buildCustomerBody(eventType, ctx, reason);
    const managementLink = buildBookingManagementLink(ctx);
    return `<!doctype html><html lang="${ctx.locale}"><body dir="${ctx.locale === "ar" ? "rtl" : "ltr"}" style="margin:0;padding:24px;background:#f6f7f9;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="560" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;">
    <tr><td style="padding:28px 28px 8px 28px;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#64748b;">${escapeHtml(ctx.workspaceName)}</p>
      <h1 style="margin:0;font-size:22px;line-height:1.3;color:#0f172a;">${escapeHtml(headline)}</h1>
    </td></tr>
    <tr><td style="padding:16px 28px 28px 28px;font-size:14px;line-height:1.6;color:#334155;">
      ${body}
      ${managementLink}
    </td></tr>
  </table>
</body></html>`;
}

function buildManagerSubject(eventType: EventType, ctx: ReservationEmailContext): string {
    if (eventType === "reservation_pending_review") {
        return `New booking awaiting review · ${ctx.publicReference} · ${ctx.customerFullName}`;
    }
    return `Booking ${eventType.replace("reservation_", "")} · ${ctx.publicReference}`;
}

function buildManagerHtml(eventType: EventType, ctx: ReservationEmailContext, dashboardUrl: string): string {
    const when = formatScheduledStart(ctx.scheduledStart, ctx.reservationTimezone);
    return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f7f9;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="560" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;">
    <tr><td style="padding:28px;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#64748b;">${escapeHtml(ctx.workspaceName)} · operations</p>
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#0f172a;">${escapeHtml(buildManagerSubject(eventType, ctx))}</h1>
      <p style="margin:0 0 6px;font-size:14px;color:#334155;">${escapeHtml(ctx.customerFullName)} · ${escapeHtml(ctx.customerEmail)}</p>
      ${ctx.serviceTitle ? `<p style="margin:0 0 6px;font-size:14px;color:#334155;">${escapeHtml(ctx.serviceTitle)}</p>` : ""}
      <p style="margin:0 0 18px;font-size:14px;color:#334155;">${escapeHtml(when)}</p>
      <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:10px 18px;border-radius:10px;background:#0f172a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;">Open booking inbox</a>
    </td></tr>
  </table>
</body></html>`;
}

async function loadReservationContext(
    supabase: SupabaseAny,
    workspaceId: string,
    reservationId: string,
): Promise<ReservationEmailContext | null> {
    const { data, error } = await supabase
        .from("booking_reservations")
        .select(`
            id,
            workspace_id,
            public_reference,
            customer_full_name,
            customer_email,
            scheduled_start,
            scheduled_end,
            status,
            reservation_timezone,
            attribution_json,
            workspaces:workspace_id ( name, slug ),
            booking_services!booking_reservations_workspace_service_fk ( title, location_mode ),
            booking_locations!booking_reservations_workspace_location_fk ( name, instructions, copy_i18n, location_type ),
            booking_payments!booking_payments_workspace_reservation_fk ( amount_cents, net_amount_cents, vat_amount_cents, vat_rate_basis_points, gross_amount_cents, pricing_version, currency, payment_url, payment_reference, customer_instructions, deadline_at, provider, status ),
            booking_meetings!booking_meetings_workspace_reservation_fk ( provider, provider_meeting_id, calendar_event_id, join_url, status )
        `)
        .eq("id", reservationId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

    if (error) {
        console.error("booking-emails: reservation context lookup failed", error.message);
        return null;
    }
    if (!data) {
        console.warn("booking-emails: reservation context was not found", { workspaceId, reservationId });
        return null;
    }

    const row = data as unknown as {
        id: string;
        workspace_id: string;
        public_reference: string;
        customer_full_name: string;
        customer_email: string;
        scheduled_start: string;
        scheduled_end: string;
        status: Database["public"]["Enums"]["booking_reservation_status"];
        reservation_timezone: string;
        attribution_json: Json;
        workspaces: { name: string | null; slug: string | null } | null;
        booking_services: { title: string | null; location_mode: string } | null;
        booking_locations: Array<{
            name: string;
            instructions: string | null;
            copy_i18n: Json;
            location_type: string;
        }> | {
            name: string;
            instructions: string | null;
            copy_i18n: Json;
            location_type: string;
        } | null;
        booking_payments: Array<{
            amount_cents: number;
            net_amount_cents: number | null;
            vat_amount_cents: number | null;
            vat_rate_basis_points: number | null;
            gross_amount_cents: number | null;
            pricing_version: string | null;
            currency: string;
            payment_url: string | null;
            payment_reference: string;
            customer_instructions: string | null;
            deadline_at: string | null;
            provider: string;
            status: Database["public"]["Enums"]["booking_payment_status"];
        }> | {
            amount_cents: number;
            net_amount_cents: number | null;
            vat_amount_cents: number | null;
            vat_rate_basis_points: number | null;
            gross_amount_cents: number | null;
            pricing_version: string | null;
            currency: string;
            payment_url: string | null;
            payment_reference: string;
            customer_instructions: string | null;
            deadline_at: string | null;
            provider: string;
            status: Database["public"]["Enums"]["booking_payment_status"];
        } | null;
        booking_meetings: Array<{
            provider: "google_meet" | "zoom";
            provider_meeting_id: string | null;
            calendar_event_id: string | null;
            join_url: string | null;
            status: string;
        }> | {
            provider: "google_meet" | "zoom";
            provider_meeting_id: string | null;
            calendar_event_id: string | null;
            join_url: string | null;
            status: string;
        } | null;
    };

    const paymentRow = Array.isArray(row.booking_payments)
        ? row.booking_payments[0] ?? null
        : row.booking_payments;
    const meetingRow = Array.isArray(row.booking_meetings)
        ? row.booking_meetings[0] ?? null
        : row.booking_meetings;
    const locationRow = Array.isArray(row.booking_locations)
        ? row.booking_locations[0] ?? null
        : row.booking_locations;
    const locale = normalizeEmailLocale(
        row.attribution_json && typeof row.attribution_json === "object" && !Array.isArray(row.attribution_json)
            ? (row.attribution_json as Record<string, unknown>).locale as string | undefined
            : undefined,
    );

    return {
        reservationId: row.id,
        workspaceId: row.workspace_id,
        workspaceName: row.workspaces?.name ?? "Your workspace",
        workspaceSlug: row.workspaces?.slug ?? "",
        publicReference: row.public_reference,
        customerFullName: row.customer_full_name,
        customerEmail: row.customer_email,
        scheduledStart: row.scheduled_start,
        scheduledEnd: row.scheduled_end,
        status: row.status,
        reservationTimezone: row.reservation_timezone,
        serviceTitle: row.booking_services?.title ?? null,
        locationMode: row.booking_services?.location_mode ?? locationRow?.location_type ?? "remote",
        locationName: locationRow
            ? resolveLocalizedJson(locationRow.copy_i18n, locale, "name") ?? locationRow.name
            : null,
        locationInstructions: locationRow
            ? resolveLocalizedJson(locationRow.copy_i18n, locale, "instructions") ?? locationRow.instructions
            : null,
        locale,
        payment: paymentRow
            ? {
                amountCents: paymentRow.amount_cents,
                netAmountCents: paymentRow.net_amount_cents,
                vatAmountCents: paymentRow.vat_amount_cents,
                vatRateBasisPoints: paymentRow.vat_rate_basis_points,
                grossAmountCents: paymentRow.gross_amount_cents,
                pricingVersion: paymentRow.pricing_version,
                currency: paymentRow.currency,
                paymentUrl: normalizePublicHttpUrl(paymentRow.payment_url),
                paymentReference: paymentRow.payment_reference,
                customerInstructions: paymentRow.customer_instructions,
                deadlineAt: paymentRow.deadline_at,
                provider: paymentRow.provider,
                status: paymentRow.status,
            }
            : null,
        meeting: meetingRow
            ? {
                provider: meetingRow.provider,
                providerMeetingId: meetingRow.provider_meeting_id,
                calendarEventId: meetingRow.calendar_event_id,
                joinUrl: meetingRow.join_url,
                status: meetingRow.status,
            }
            : null,
    };
}

export async function loadManagerRecipients(
    supabase: SupabaseAny,
    workspaceId: string,
): Promise<string[]> {
    const { data } = await supabase
        .from("workspace_memberships")
        .select("profiles:profile_id ( email )")
        .eq("workspace_id", workspaceId)
        .in("role", ["admin", "manager"]);

    const emails: string[] = [];

    if (data) {
        const parsed = (data as unknown as Array<{ profiles: { email: string | null } | null }>)
            .map((row) => row.profiles?.email)
            .filter((email): email is string => Boolean(email && email.includes("@")));
        emails.push(...parsed);
    }

    return Array.from(new Set(emails.map((email) => email.toLowerCase())));
}

async function recordAndSend(params: {
    supabase: SupabaseAny;
    workspaceId: string;
    reservationId: string;
    eventType: EventType;
    recipientRole: "customer" | "manager";
    to: string | string[];
    subject: string;
    html: string;
    payloadHint: Record<string, unknown>;
}): Promise<BookingEmailDeliveryStatus> {
    const newClaimExpiry = () => new Date(Date.now() + EMAIL_CLAIM_LEASE_MS).toISOString();
    const notificationKey = [
        params.reservationId,
        params.eventType,
        params.recipientRole,
        params.payloadHint.reminderWindow ?? "",
        params.payloadHint.eventInstanceKey ?? "",
    ].join(":");
    const existingQuery = params.supabase
        .from("booking_notification_events")
        .select("id,delivery_status")
        .eq("workspace_id", params.workspaceId)
        .eq("reservation_id", params.reservationId)
        .eq("event_type", params.eventType)
        .eq("channel", "email")
        .contains("payload_json", {
            recipientRole: params.recipientRole,
            ...(params.payloadHint.reminderWindow
                ? { reminderWindow: params.payloadHint.reminderWindow }
                : {}),
            ...(params.payloadHint.eventInstanceKey
                ? { eventInstanceKey: params.payloadHint.eventInstanceKey }
                : {}),
        })
        .in("delivery_status", ["sent", "delivered"])
        .limit(1);
    const { data: successfulExisting, error: successfulExistingError } = await existingQuery.maybeSingle();
    if (successfulExistingError) {
        console.error("booking-emails: failed to inspect existing delivery", successfulExistingError);
        return "failed";
    }
    if (successfulExisting) return "suppressed";

    const basePayload = {
        recipientRole: params.recipientRole,
        ...params.payloadHint,
    };
    let eventClaimExpiresAt = newClaimExpiry();
    // Insert the audit row up-front so a process crash mid-send still leaves a
    // trace. delivery_status starts as 'pending' and is moved to 'sent' or
    // 'failed' once Resend responds.
    const insertResult = await (params.supabase as unknown as {
        from: (t: string) => {
            insert: (row: Record<string, unknown>) => {
                select: (cols: string) => {
                    single: () => Promise<{ data: { id: string } | null; error: { message: string; code?: string } | null }>;
                };
            };
        };
    })
        .from("booking_notification_events")
        .insert({
            workspace_id: params.workspaceId,
            reservation_id: params.reservationId,
            event_type: params.eventType,
            channel: "email",
            delivery_status: "pending",
            claim_expires_at: eventClaimExpiresAt,
            payload_json: basePayload,
            idempotency_key: notificationKey,
        })
        .select("id")
        .single();

    let eventId = insertResult.data?.id ?? null;

    if (insertResult.error?.code === "23505") {
        // Another worker already claimed this exact message. Reuse a failed
        // claim for retry, but never send while another worker owns a pending
        // claim. The stable provider key below also deduplicates a retry after
        // a process crash that happened after Resend accepted the message.
        const existingClaim = await params.supabase
            .from("booking_notification_events")
            .select("id,delivery_status,claim_expires_at")
            .eq("workspace_id", params.workspaceId)
            .eq("idempotency_key", notificationKey)
            .maybeSingle();
        if (existingClaim.error || !existingClaim.data) return "failed";
        if (existingClaim.data.delivery_status === "sent" || existingClaim.data.delivery_status === "delivered") return "suppressed";
        const existingClaimExpiresAt = existingClaim.data.claim_expires_at;
        const claimIsActive = existingClaim.data.delivery_status === "pending"
            && typeof existingClaimExpiresAt === "string"
            && new Date(existingClaimExpiresAt).getTime() > Date.now();
        if (claimIsActive) return "suppressed";
        eventClaimExpiresAt = newClaimExpiry();
        const claimUpdate = params.supabase
            .from("booking_notification_events")
            .update({ delivery_status: "pending", claim_expires_at: eventClaimExpiresAt, payload_json: basePayload })
            .eq("id", existingClaim.data.id)
            .eq("delivery_status", existingClaim.data.delivery_status);
        const reclaimed = typeof existingClaimExpiresAt === "string"
            ? await claimUpdate
                .eq("claim_expires_at", existingClaimExpiresAt)
                .select("id")
                .maybeSingle()
            : await claimUpdate
                .is("claim_expires_at", null)
                .select("id")
                .maybeSingle();
        if (reclaimed.error || !reclaimed.data) return "failed";
        eventId = reclaimed.data.id;
    } else if (insertResult.error || !eventId) {
        console.error("booking-emails: failed to insert event row", insertResult.error);
        return "failed";
    }

    if (!process.env.RESEND_API_KEY?.trim()) {
        return await markEvent(params.supabase, eventId, eventClaimExpiresAt, "skipped", { ...basePayload, emailError: "RESEND_API_KEY missing" })
            ? "skipped" : "persistence_degraded";
    }

    try {
        const result = await sendEmail({
            from: defaultFromEmail(),
            to: params.to,
            subject: params.subject,
            html: params.html,
            replyTo: defaultReplyTo(),
            idempotencyKey: `booking:${notificationKey}`,
        });
        return await markEvent(params.supabase, eventId, eventClaimExpiresAt, "sent", { ...basePayload, providerMessageId: result.id })
            ? "sent" : "persistence_degraded";
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return await markEvent(params.supabase, eventId, eventClaimExpiresAt, "failed", { ...basePayload, emailError: message })
            ? "failed" : "persistence_degraded";
    }
}

async function markEvent(
    supabase: SupabaseAny,
    eventId: string,
    claimExpiresAt: string,
    status: "sent" | "failed" | "skipped",
    extra: Record<string, unknown>,
): Promise<boolean> {
    const patch: Record<string, unknown> = {
        delivery_status: status,
        claim_expires_at: null,
    };
    if (status === "sent") {
        patch.sent_at = new Date().toISOString();
        if (typeof extra.providerMessageId === "string") {
            patch.provider_message_id = extra.providerMessageId;
        }
    }
    patch.payload_json = extra;

    const result = await supabase
        .from("booking_notification_events")
        .update(patch)
        .eq("id", eventId)
        .eq("delivery_status", "pending")
        .eq("claim_expires_at", claimExpiresAt)
        .select("id")
        .maybeSingle();
    return !result.error && Boolean(result.data);
}

/**
 * Fire booking emails for the given event. Always resolves; never throws.
 *
 * Sends to the customer for every supported event. For pending_review only,
 * also fans out to workspace admins/managers so they know a booking is
 * waiting for them outside the dashboard.
 */
export async function dispatchBookingEmails(params: DispatchParams): Promise<BookingEmailDeliveryOutcome> {
    let outcome = emptyBookingEmailDeliveryOutcome();
    try {
        const ctx = await loadReservationContext(params.supabase, params.workspaceId, params.reservationId);
        if (!ctx) return addBookingEmailDeliveryOutcome(outcome, "failed");

        const reason = params.reason ?? null;
        const eventInstanceKey = params.eventInstanceKey ?? (
            params.eventType === "reservation_rescheduled"
            || params.eventType === "reservation_reschedule_requested"
                ? ctx.scheduledStart
                : params.eventType === "meeting_ready" && ctx.meeting
                    ? `${ctx.meeting.provider}:${ctx.meeting.providerMeetingId ?? ctx.meeting.calendarEventId ?? ctx.meeting.joinUrl ?? "pending"}`
                    : null
        );

        const customerStatus = await recordAndSend({
            supabase: params.supabase,
            workspaceId: params.workspaceId,
            reservationId: params.reservationId,
            eventType: params.eventType,
            recipientRole: "customer",
            to: ctx.customerEmail,
            subject: buildCustomerSubject(params.eventType, ctx),
            html: buildCustomerHtml(params.eventType, ctx, reason),
            payloadHint: {
                recipient: ctx.customerEmail,
                reason,
                reminderWindow: params.reminderWindow ?? null,
                eventInstanceKey,
                paymentReference: ctx.payment?.paymentReference ?? null,
            },
        });
        outcome = addBookingEmailDeliveryOutcome(outcome, customerStatus);

        const plan = getBookingEmailPlan(params.eventType, ctx.locale);
        if (plan.recipients.includes("manager")) {
            const managers = await loadManagerRecipients(params.supabase, params.workspaceId);
            if (managers.length > 0) {
                const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
                const dashboardUrl = `${siteUrl}/dashboard/booking?tab=inbox`;
                const managerStatus = await recordAndSend({
                    supabase: params.supabase,
                    workspaceId: params.workspaceId,
                    reservationId: params.reservationId,
                    eventType: params.eventType,
                    recipientRole: "manager",
                    to: managers,
                    subject: buildManagerSubject(params.eventType, ctx),
                    html: buildManagerHtml(params.eventType, ctx, dashboardUrl),
                    payloadHint: {
                        recipients: managers,
                        reason,
                        eventInstanceKey,
                    },
                });
                outcome = addBookingEmailDeliveryOutcome(outcome, managerStatus);
            } else {
                outcome = addBookingEmailDeliveryOutcome(outcome, "skipped");
            }
        }
        return outcome;
    } catch (error) {
        console.error("dispatchBookingEmails failed (non-fatal)", error);
        return addBookingEmailDeliveryOutcome(outcome, "failed");
    }
}

const RECOVERABLE_BOOKING_EMAIL_EVENTS = [
    "reservation_created",
    "reservation_pending_review",
    "reservation_reschedule_requested",
    "reservation_confirmed",
    "reservation_cancelled",
    "reservation_completed",
    "reservation_rescheduled",
    "meeting_ready",
    "reservation_no_show",
    "payment_requested",
    "payment_failed",
    "payment_expired",
    "payment_refunded",
] as const satisfies readonly EventType[];

/**
 * Rebuild missing customer email claims from the durable dashboard signal.
 * The reservation transition and the dashboard insert are separate writes;
 * this sweep closes the crash window before the inline dispatcher can create
 * the channel=email row. Stable idempotency keys in recordAndSend make it
 * safe to observe the same dashboard signal on every cron run.
 */
export async function recoverPendingBookingEmailOutbox(params: {
    supabase: SupabaseAny;
    limit?: number;
    since?: Date;
}): Promise<BookingEmailDeliveryOutcome> {
    let outcome = emptyBookingEmailDeliveryOutcome();
    const since = params.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { data, error } = await params.supabase
        .from("booking_notification_events")
        .select("id,workspace_id,reservation_id,event_type,payload_json,created_at")
        .eq("channel", "internal_dashboard")
        .eq("delivery_status", "pending")
        .contains("payload_json", { emailDispatchRequired: true })
        .in("event_type", [...RECOVERABLE_BOOKING_EMAIL_EVENTS])
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true })
        .limit(params.limit ?? 200);
    if (error) {
        console.warn("booking-emails: outbox recovery lookup failed", error.message);
        return addBookingEmailDeliveryOutcome(outcome, "failed");
    }

    const reservationIds = Array.from(new Set((data ?? []).map((row) => row.reservation_id)));
    const currentStatusByReservation = new Map<string, string>();
    if (reservationIds.length > 0) {
        const { data: reservations, error: reservationError } = await params.supabase
            .from("booking_reservations")
            .select("id,status")
            .in("id", reservationIds);
        if (reservationError) {
            console.warn("booking-emails: outbox recovery status lookup failed", reservationError.message);
            return addBookingEmailDeliveryOutcome(outcome, "failed");
        }
        for (const reservation of reservations ?? []) {
            currentStatusByReservation.set(reservation.id, reservation.status);
        }
    }

    const recoveredKeys = new Set<string>();
    for (const row of data ?? []) {
        const currentStatus = currentStatusByReservation.get(row.reservation_id);
        if (!currentStatus) {
            console.warn("booking-emails: outbox recovery reservation was not found", {
                workspaceId: row.workspace_id,
                reservationId: row.reservation_id,
            });
            outcome = addBookingEmailDeliveryOutcome(outcome, "failed");
            continue;
        }
        const eventType = resolveRecoveredBookingEmailEvent(row.event_type, currentStatus) as EventType;
        const payload = row.payload_json && typeof row.payload_json === "object" && !Array.isArray(row.payload_json)
            ? row.payload_json as Record<string, unknown>
            : {};
        const reminderWindow = typeof payload.reminderWindow === "string" ? payload.reminderWindow : undefined;
        const eventInstanceKey = typeof payload.eventInstanceKey === "string" ? payload.eventInstanceKey : undefined;
        const recoveryKey = [row.workspace_id, row.reservation_id, eventType, reminderWindow ?? "", eventInstanceKey ?? ""].join(":");
        if (recoveredKeys.has(recoveryKey)) continue;
        recoveredKeys.add(recoveryKey);

        // Keep a permanently failing recipient from being retried forever by
        // the dashboard-signal sweep. The normal failed-email retry path uses
        // the same five-attempt ceiling.
        const attemptsQuery = params.supabase
            .from("booking_notification_events")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", row.workspace_id)
            .eq("reservation_id", row.reservation_id)
            .eq("event_type", eventType)
            .eq("channel", "email")
            .contains("payload_json", {
                recipientRole: "customer",
                ...(reminderWindow ? { reminderWindow } : {}),
                ...(eventInstanceKey ? { eventInstanceKey } : {}),
            });
        const { count: attemptCount } = await attemptsQuery;
        if ((attemptCount ?? 0) >= 5) continue;

        const deliveryOutcome = await dispatchBookingEmails({
            supabase: params.supabase,
            workspaceId: row.workspace_id,
            reservationId: row.reservation_id,
            eventType,
            reason: typeof payload.reason === "string"
                ? payload.reason
                : "Automatic booking notification outbox recovery.",
            reminderWindow,
            eventInstanceKey,
        });
        outcome = mergeBookingEmailDeliveryOutcomes(outcome, deliveryOutcome);
    }
    return outcome;
}
