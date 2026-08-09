"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
    ArrowRight,
    CalendarClock,
    CheckCircle2,
    ConciergeBell,
    Copy,
    ExternalLink,
    MapPin,
    Sparkles,
    UserRound,
} from "lucide-react";
import { useTemplate } from "@/features/templates/template-provider";
import { getBookingAvailabilityPreview, submitBookingReservation } from "@/features/booking/actions";
import { BOOKING_TEMPLATE_ADAPTERS, type BookingPaymentDirective, type BookingPaymentProvider, type BookingPublicCatalog, type BookingSubmissionNextStepsKind } from "@/features/booking/types";
import { BOOKING_PAYMENT_COMPLETION_WINDOW_HOURS } from "@/features/booking/lib/booking-policies";
import { deriveAnalyticsContentType } from "@/features/analytics/taxonomy";
import { ensureAnalyticsClientId, useAnalyticsConsent } from "@/features/analytics/ui/use-analytics-consent";
import { intakeSchemaFromJson, type IntakeFieldDraft } from "@/features/booking/ui/intake-fields-editor";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { getLocaleBcp47 } from "@/shared/lib/i18n/routing";
import type { Locale } from "@/features/templates/types";

interface PublicBookingExperienceProps {
    catalog: BookingPublicCatalog;
    consentRequired?: boolean;
    privacyUrl?: string | null;
    paymentReturnStatus?: "paypal_success" | "paypal_cancelled" | "paypal_capture_failed" | null;
}

const BOOKING_COPY: Record<Locale, {
    select: string;
    location: string;
    partySize: string;
    fullName: string;
    email: string;
    phone: string;
    step1: string;
    step2: string;
    step3: string;
    chooseContextTiming: string;
    availabilityPreview: string;
    slotsUpdate: string;
    updating: string;
    nextAvailabilityOpens: (date: string) => string;
    noOpenSlots: string;
    timezoneSameNote: (viewerTz: string) => string;
    timezoneDualNote: (viewerTz: string, businessTz: string) => string;
    businessTimeLabel: (businessTime: string, businessTz: string) => string;
    requestReservation: string;
    submittingReservation: string;
    completeRequired: string;
    marketingConsent: string;
    privacyConsent: string;
    submitFailed: string;
    submitSuccess: string;
    couldNotLoadAvailability: string;
    reservationReference: string;
    accountConsent: string;
    bookingPreparedEyebrow: string;
    bookingPreparedTitle: string;
    bookingPreparedBody: string;
    bookingUnavailableEyebrow: string;
    bookingUnavailableTitle: string;
    bookingUnavailableBody: string;
    bookingPortal: string;
    operationalLiveSettings: string;
    smartTiming: string;
    smartTimingCopy: string;
    serviceHeadingExperience: (label: string) => string;
    serviceHeadingListing: string;
    detailHeadingGuest: string;
    detailHeadingIntent: string;
    detailHeadingDefault: string;
    minutes: string;
    paidServiceChip: string;
    reserveAndPay: string;
    paymentRequiredTitle: (provider: BookingPaymentProvider) => string;
    paymentRequiredBody: (provider: BookingPaymentProvider) => string;
    paymentReferenceLabel: string;
    payNowLabel: (provider: BookingPaymentProvider) => string;
    paymentDeadlineNote: (deadline: string) => string;
    paymentReferenceCopied: string;
    paymentReferenceCopy: string;
    paymentManualConfirmationNote: (provider: BookingPaymentProvider) => string | null;
    paymentProviderBenefit: (provider: BookingPaymentProvider) => string | null;
    paypalReturnSuccess: string;
    paypalReturnCancelled: string;
    paypalReturnCaptureFailed: string;
    nextSteps: Record<BookingSubmissionNextStepsKind, (reference: string, provider?: BookingPaymentProvider) => string[]>;
    nextStepsConsultationAccount: string;
    didYouMean: string;
    yesCorrectIt: string;
    noContinue: string;
    emailTypoReviewRequired: string;
}> = {
    en: {
        select: "Select",
        location: "Location",
        partySize: "Party size",
        fullName: "Full name",
        email: "Email address",
        phone: "Phone number",
        step1: "Step 1",
        step2: "Step 2",
        step3: "Step 3",
        chooseContextTiming: "Choose context and timing.",
        availabilityPreview: "Availability preview",
        slotsUpdate: "Availability updates as times are booked.",
        updating: "Updating…",
        nextAvailabilityOpens: (d) => `The next availability opens ${d}. Earlier dates are fully blocked.`,
        noOpenSlots: "No open slots were found within the next 6 months. Please contact us directly to arrange a booking.",
        timezoneSameNote: (tz) => `Times shown in your timezone (${tz}).`,
        timezoneDualNote: (viewerTz, businessTz) => `Times shown in your timezone (${viewerTz}). Business hours are operated in ${businessTz}.`,
        businessTimeLabel: (time, tz) => `${time} ${tz}`,
        requestReservation: "Request reservation",
        submittingReservation: "Submitting your reservation…",
        completeRequired: "Please complete the required booking details before continuing.",
        marketingConsent: "Send me useful updates and follow-up resources by email. I can unsubscribe anytime.",
        privacyConsent: "I have read and acknowledge the privacy policy for this booking.",
        submitFailed: "Reservation could not be submitted.",
        submitSuccess: "Reservation request submitted successfully.",
        couldNotLoadAvailability: "Could not load availability.",
        reservationReference: "Reservation reference",
        accountConsent: "Also create a client account with this email, so I can follow up on this consultation online.",
        bookingPreparedEyebrow: "Booking",
        bookingPreparedTitle: "Online booking isn't open here yet.",
        bookingPreparedBody: "You can still get in touch directly. Use the contact page and we'll arrange a time with you.",
        bookingUnavailableEyebrow: "Booking",
        bookingUnavailableTitle: "No times are open right now.",
        bookingUnavailableBody: "New times are published regularly, so please check back shortly. If your request is urgent, reach us through the contact page.",
        bookingPortal: "Online booking",
        operationalLiveSettings: "Live service settings shape your timeline and messaging.",
        smartTiming: "Smart timing",
        smartTimingCopy: "Availability, blackout windows, and booking rules are evaluated before submission.",
        serviceHeadingExperience: (label) => `Select the right ${label.toLowerCase()}.`,
        serviceHeadingListing: "Choose the listing or reservation context.",
        detailHeadingGuest: "Share guest and booking details.",
        detailHeadingIntent: "Share intent and qualification details.",
        detailHeadingDefault: "Share your details.",
        minutes: "min",
        paidServiceChip: "Paid",
        reserveAndPay: "Reserve and continue to payment",
        paymentRequiredTitle: () => "Complete payment to confirm your booking",
        paymentRequiredBody: (provider) => provider === "paypal_checkout"
            ? "Pay securely with PayPal. You will be redirected to PayPal to complete payment. Your booking is confirmed automatically after payment is captured."
            : "Your slot is temporarily reserved. Complete payment through the secure Revolut link below — we confirm the booking once payment is verified.",
        paymentReferenceLabel: "Payment reference",
        payNowLabel: (provider) => provider === "paypal_checkout" ? "Pay securely with PayPal" : "Pay through Revolut",
        paymentDeadlineNote: (deadline) => `Your slot is held for ${BOOKING_PAYMENT_COMPLETION_WINDOW_HOURS} hours. Please complete payment by ${deadline}; otherwise the slot is released.`,
        paymentReferenceCopied: "Reference copied",
        paymentReferenceCopy: "Copy reference",
        paymentManualConfirmationNote: (provider) => provider === "paypal_checkout" ? null : "Important: include the reference above in the Revolut payment note so we can match your payment to this booking.",
        paymentProviderBenefit: (provider) => provider === "paypal_checkout"
            ? "Your PayPal approval URL is generated specifically for this reservation."
            : null,
        paypalReturnSuccess: "PayPal payment received. Your booking status and next steps are shown on the payment result page.",
        paypalReturnCancelled: "PayPal checkout was cancelled. Your slot is not confirmed yet; choose the payment button again if you still want to complete the booking.",
        paypalReturnCaptureFailed: "PayPal payment could not be captured. Please retry checkout or contact us with your reservation reference.",
        nextSteps: {
            pending_review: () => [
                "Your request is waiting to be reviewed.",
                "We'll confirm the final time with you by email.",
            ],
            pending_confirmation_payment: (reference, provider) => provider === "paypal_checkout"
                ? [
                    "Your slot is temporarily reserved.",
                    "Pay securely with PayPal. You will be redirected to PayPal to complete payment.",
                    "Your booking is confirmed automatically after payment is captured.",
                ]
                : [
                    "Your slot is temporarily reserved.",
                    `Complete the secure payment through Revolut to confirm your booking — include reference "${reference}" in the payment note.`,
                    "We confirm the booking once we verify the payment in our system.",
                ],
            pending_confirmation: () => [
                "Your reservation is pending confirmation.",
                "You will receive a follow-up message once seating is reviewed.",
            ],
            captured: () => [
                "Your reservation has been captured.",
                "You'll receive confirmation details by email shortly.",
            ],
        },
        nextStepsConsultationAccount: "We've linked a client account to this email, so you can follow up on this consultation online.",
        didYouMean: "Did you mean",
        yesCorrectIt: "Yes, correct it",
        noContinue: "No, continue",
        emailTypoReviewRequired: "Please review your email address or accept/dismiss the suggested correction before continuing.",
    },
    nl: {
        select: "Selecteer",
        location: "Locatie",
        partySize: "Aantal personen",
        fullName: "Volledige naam",
        email: "E-mailadres",
        phone: "Telefoonnummer",
        step1: "Stap 1",
        step2: "Stap 2",
        step3: "Stap 3",
        chooseContextTiming: "Kies context en timing.",
        availabilityPreview: "Beschikbaarheid",
        slotsUpdate: "De beschikbaarheid wordt bijgewerkt zodra er tijden worden geboekt.",
        updating: "Bijwerken…",
        nextAvailabilityOpens: (d) => `De eerstvolgende beschikbaarheid is op ${d}. Eerdere datums zijn volledig geblokkeerd.`,
        noOpenSlots: "Er zijn geen vrije slots in de komende 6 maanden. Neem rechtstreeks contact op om een boeking te plannen.",
        timezoneSameNote: (tz) => `Tijden in jouw tijdzone (${tz}).`,
        timezoneDualNote: (viewerTz, businessTz) => `Tijden in jouw tijdzone (${viewerTz}). Werktijden worden beheerd in ${businessTz}.`,
        businessTimeLabel: (time, tz) => `${time} ${tz}`,
        requestReservation: "Reservering aanvragen",
        submittingReservation: "Uw reservering wordt verzonden…",
        completeRequired: "Vul de vereiste boekingsgegevens in voordat u verdergaat.",
        marketingConsent: "Stuur mij nuttige updates en opvolgresources per e-mail. Ik kan mij altijd uitschrijven.",
        privacyConsent: "Ik heb het privacybeleid voor deze boeking gelezen en bevestig dit.",
        submitFailed: "Reservering kon niet worden verzonden.",
        submitSuccess: "Reservering succesvol verzonden.",
        couldNotLoadAvailability: "Beschikbaarheid kon niet worden geladen.",
        reservationReference: "Reserveringsreferentie",
        accountConsent: "Maak met dit e-mailadres ook een klantaccount aan, zodat ik deze afspraak online kan opvolgen.",
        bookingPreparedEyebrow: "Reserveren",
        bookingPreparedTitle: "Online reserveren kan hier nog niet.",
        bookingPreparedBody: "U kunt wel rechtstreeks contact opnemen. Via de contactpagina plannen we samen een moment in.",
        bookingUnavailableEyebrow: "Reserveren",
        bookingUnavailableTitle: "Er zijn nu geen tijden beschikbaar.",
        bookingUnavailableBody: "We publiceren regelmatig nieuwe tijden, dus kom binnenkort even terug. Heeft u haast? Neem contact op via de contactpagina.",
        bookingPortal: "Online reserveren",
        operationalLiveSettings: "Live service-instellingen vormen uw tijdlijn en communicatie.",
        smartTiming: "Slimme timing",
        smartTimingCopy: "Beschikbaarheid, blackout-windows en boekingsregels worden vóór verzending geëvalueerd.",
        serviceHeadingExperience: (label) => `Kies de juiste ${label.toLowerCase()}.`,
        serviceHeadingListing: "Kies de listing of reserveringscontext.",
        detailHeadingGuest: "Deel gast- en boekingsgegevens.",
        detailHeadingIntent: "Deel intentie- en kwalificatiegegevens.",
        detailHeadingDefault: "Deel uw gegevens.",
        minutes: "min",
        paidServiceChip: "Betaald",
        reserveAndPay: "Reserveren en doorgaan naar betaling",
        paymentRequiredTitle: () => "Voltooi de betaling om uw boeking te bevestigen",
        paymentRequiredBody: (provider) => provider === "paypal_checkout"
            ? "Betaal veilig met PayPal. U wordt doorgestuurd naar PayPal om de betaling af te ronden. Uw boeking wordt automatisch bevestigd zodra de betaling is vastgelegd."
            : "Uw slot is tijdelijk gereserveerd. Voltooi de betaling via de veilige Revolut-link — we bevestigen de boeking zodra de betaling is geverifieerd.",
        paymentReferenceLabel: "Betalingsreferentie",
        payNowLabel: (provider) => provider === "paypal_checkout" ? "Betaal veilig met PayPal" : "Betaal via Revolut",
        paymentDeadlineNote: (deadline) => `Uw slot wordt ${BOOKING_PAYMENT_COMPLETION_WINDOW_HOURS} uur vastgehouden. Voltooi de betaling vóór ${deadline}; anders wordt het slot vrijgegeven.`,
        paymentReferenceCopied: "Referentie gekopieerd",
        paymentReferenceCopy: "Referentie kopiëren",
        paymentManualConfirmationNote: (provider) => provider === "paypal_checkout" ? null : "Belangrijk: vermeld bovenstaande referentie in de Revolut-betalingsnotitie zodat we uw betaling kunnen koppelen aan deze boeking.",
        paymentProviderBenefit: (provider) => provider === "paypal_checkout"
            ? "De PayPal-goedkeuringslink wordt specifiek voor deze reservering gegenereerd."
            : null,
        paypalReturnSuccess: "PayPal-betaling ontvangen. De boekingsstatus en vervolgstappen staan op de betaalresultaatpagina.",
        paypalReturnCancelled: "PayPal Checkout is geannuleerd. Uw slot is nog niet bevestigd; kies opnieuw de betaalbutton als u de boeking wilt afronden.",
        paypalReturnCaptureFailed: "PayPal-betaling kon niet worden vastgelegd. Probeer checkout opnieuw of neem contact op met uw reserveringsreferentie.",
        nextSteps: {
            pending_review: () => [
                "Uw aanvraag wacht op beoordeling.",
                "We bevestigen de definitieve tijd per e-mail.",
            ],
            pending_confirmation_payment: (reference, provider) => provider === "paypal_checkout"
                ? [
                    "Uw slot is tijdelijk gereserveerd.",
                    "Betaal veilig met PayPal. U wordt doorgestuurd naar PayPal om de betaling af te ronden.",
                    "Uw boeking wordt automatisch bevestigd zodra de betaling is vastgelegd.",
                ]
                : [
                    "Uw slot is tijdelijk gereserveerd.",
                    `Voltooi de veilige betaling via Revolut om uw boeking te bevestigen — vermeld referentie "${reference}" in de betalingsnotitie.`,
                    "We bevestigen de boeking zodra we de betaling in ons systeem hebben geverifieerd.",
                ],
            pending_confirmation: () => [
                "Uw reservering wacht op bevestiging.",
                "U ontvangt een vervolgbericht zodra de zitplaatsen zijn beoordeeld.",
            ],
            captured: () => [
                "Uw reservering is geregistreerd.",
                "U ontvangt binnenkort de bevestiging per e-mail.",
            ],
        },
        nextStepsConsultationAccount: "We hebben een klantaccount gekoppeld aan dit e-mailadres, zodat u deze afspraak online kunt opvolgen.",
        didYouMean: "Bedoelde u",
        yesCorrectIt: "Ja, corrigeren",
        noContinue: "Nee, doorgaan",
        emailTypoReviewRequired: "Controleer uw e-mailadres of accepteer/negeer de voorgestelde correctie voordat u doorgaat.",
    },
    ar: {
        select: "اختر",
        location: "الموقع",
        partySize: "عدد الأشخاص",
        fullName: "الاسم الكامل",
        email: "البريد الإلكتروني",
        phone: "رقم الهاتف",
        step1: "الخطوة 1",
        step2: "الخطوة 2",
        step3: "الخطوة 3",
        chooseContextTiming: "اختر السياق والتوقيت.",
        availabilityPreview: "معاينة التوفّر",
        slotsUpdate: "يتم تحديث المواعيد المتاحة فور حجز أي منها.",
        updating: "جارٍ التحديث…",
        nextAvailabilityOpens: (d) => `يفتح أقرب موعد متاح في ${d}. التواريخ السابقة محجوبة بالكامل.`,
        noOpenSlots: "لم يتم العثور على أي فترات متاحة خلال الأشهر الستة القادمة. يُرجى التواصل معنا مباشرة لترتيب الحجز.",
        timezoneSameNote: (tz) => `الأوقات معروضة بمنطقتك الزمنية (${tz}).`,
        timezoneDualNote: (viewerTz, businessTz) => `الأوقات معروضة بمنطقتك الزمنية (${viewerTz}). تُدار ساعات العمل بتوقيت ${businessTz}.`,
        businessTimeLabel: (time, tz) => `${time} ${tz}`,
        requestReservation: "طلب الحجز",
        submittingReservation: "جارٍ إرسال حجزك…",
        completeRequired: "يُرجى إكمال تفاصيل الحجز المطلوبة قبل المتابعة.",
        marketingConsent: "أرسلوا لي تحديثات وموارد متابعة مفيدة عبر البريد الإلكتروني. يمكنني إلغاء الاشتراك في أي وقت.",
        privacyConsent: "لقد قرأت سياسة الخصوصية الخاصة بهذا الحجز وأقرّ بها.",
        submitFailed: "تعذّر إرسال الحجز.",
        submitSuccess: "تم إرسال طلب الحجز بنجاح.",
        couldNotLoadAvailability: "تعذّر تحميل التوفّر.",
        reservationReference: "مرجع الحجز",
        accountConsent: "أنشئ أيضًا حساب عميل بهذا البريد الإلكتروني، لأتمكن من متابعة هذا الموعد عبر الإنترنت.",
        bookingPreparedEyebrow: "الحجز",
        bookingPreparedTitle: "الحجز عبر الإنترنت غير متاح هنا بعد.",
        bookingPreparedBody: "يسعدنا تواصلك معنا مباشرةً. عبر صفحة الاتصال يمكننا الاتفاق على موعد مناسب.",
        bookingUnavailableEyebrow: "الحجز",
        bookingUnavailableTitle: "لا توجد مواعيد متاحة حاليًا.",
        bookingUnavailableBody: "نضيف مواعيد جديدة بانتظام، فنرجو زيارة الصفحة مرة أخرى قريبًا. وإذا كان طلبك عاجلًا، يمكنك التواصل معنا عبر صفحة الاتصال.",
        bookingPortal: "الحجز عبر الإنترنت",
        operationalLiveSettings: "تشكّل إعدادات الخدمة المباشرة جدولك الزمني ورسائلك.",
        smartTiming: "توقيت ذكي",
        smartTimingCopy: "تُقيَّم التوفّر ونوافذ الحظر وقواعد الحجز قبل الإرسال.",
        serviceHeadingExperience: (label) => `اختر ${label} المناسب.`,
        serviceHeadingListing: "اختر السياق المناسب من القوائم أو الحجوزات.",
        detailHeadingGuest: "شاركنا بيانات الضيف والحجز.",
        detailHeadingIntent: "شاركنا بيانات النيّة والتأهيل.",
        detailHeadingDefault: "شاركنا بياناتك.",
        minutes: "دقيقة",
        paidServiceChip: "مدفوعة",
        reserveAndPay: "احجز وتابع إلى الدفع",
        paymentRequiredTitle: () => "أكمل الدفع لتأكيد الحجز",
        paymentRequiredBody: (provider) => provider === "paypal_checkout"
            ? "ادفع بأمان عبر PayPal. ستتم إعادة توجيهك إلى PayPal لإكمال الدفع. يتم تأكيد حجزك تلقائيًا بعد تحصيل الدفع."
            : "تم تعليق وقت الحجز مؤقتًا. أكمل الدفع عبر رابط Revolut الآمن أدناه — نؤكد الحجز فور التحقق من الدفع.",
        paymentReferenceLabel: "مرجع الدفع",
        payNowLabel: (provider) => provider === "paypal_checkout" ? "ادفع بأمان عبر PayPal" : "ادفع عبر Revolut",
        paymentDeadlineNote: (deadline) => `يتم الاحتفاظ بالموعد لمدة ${BOOKING_PAYMENT_COMPLETION_WINDOW_HOURS} ساعة. يُرجى إكمال الدفع قبل ${deadline}؛ وإلا سيُحرَّر الوقت تلقائيًا.`,
        paymentReferenceCopied: "تم نسخ المرجع",
        paymentReferenceCopy: "نسخ المرجع",
        paymentManualConfirmationNote: (provider) => provider === "paypal_checkout" ? null : "هام: يُرجى إدراج المرجع أعلاه في ملاحظة الدفع داخل Revolut حتى نتمكن من ربط دفعتك بهذا الحجز.",
        paymentProviderBenefit: (provider) => provider === "paypal_checkout"
            ? "يتم إنشاء رابط موافقة PayPal خصيصًا لهذا الحجز."
            : null,
        paypalReturnSuccess: "تم استلام دفعة PayPal. تظهر حالة الحجز والخطوات التالية في صفحة نتيجة الدفع.",
        paypalReturnCancelled: "تم إلغاء PayPal Checkout. لم يتم تأكيد موعدك بعد؛ اختر زر الدفع مرة أخرى إذا كنت لا تزال ترغب في إكمال الحجز.",
        paypalReturnCaptureFailed: "تعذّر تحصيل دفعة PayPal. يُرجى إعادة محاولة checkout أو التواصل معنا مع مرجع الحجز.",
        nextSteps: {
            pending_review: () => [
                "طلبك قيد المراجعة.",
                "سنؤكد لك الموعد النهائي عبر البريد الإلكتروني.",
            ],
            pending_confirmation_payment: (reference, provider) => provider === "paypal_checkout"
                ? [
                    "تم تعليق وقت الحجز مؤقتًا.",
                    "ادفع بأمان عبر PayPal. ستتم إعادة توجيهك إلى PayPal لإكمال الدفع.",
                    "يتم تأكيد حجزك تلقائيًا بعد تحصيل الدفع.",
                ]
                : [
                    "تم تعليق وقت الحجز مؤقتًا.",
                    `أكمل عملية الدفع الآمنة عبر Revolut لتأكيد الحجز — يُرجى إدراج المرجع "${reference}" في ملاحظة الدفع.`,
                    "نؤكد الحجز فور التحقق من الدفع في نظامنا.",
                ],
            pending_confirmation: () => [
                "حجزك في انتظار التأكيد.",
                "ستصلك رسالة متابعة بمجرد مراجعة الترتيبات.",
            ],
            captured: () => [
                "تم تسجيل حجزك.",
                "ستصلك تفاصيل التأكيد عبر البريد الإلكتروني قريبًا.",
            ],
        },
        nextStepsConsultationAccount: "ربطنا حساب عميل بهذا البريد الإلكتروني، لتتمكن من متابعة هذا الموعد عبر الإنترنت.",
        didYouMean: "هل تقصد",
        yesCorrectIt: "نعم، صححه",
        noContinue: "لا، تابع",
        emailTypoReviewRequired: "يرجى مراجعة بريدك الإلكتروني أو قبول/تجاهل التصحيح المقترح قبل المتابعة.",
    },
};

function detectViewerTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
        return "UTC";
    }
}

function formatTimeInTz(value: string, bcp47Locale: string, timeZone: string): string {
    return new Date(value).toLocaleString(bcp47Locale, {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatGroupHeading(yyyymmdd: string, bcp47Locale: string, timeZone: string): string {
    // yyyymmdd is the viewer-local date — anchor to noon to dodge any DST edge.
    const anchor = new Date(`${yyyymmdd}T12:00:00Z`);
    return anchor.toLocaleDateString(bcp47Locale, {
        timeZone,
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function viewerLocalYmd(value: string, timeZone: string): string {
    // We use sv-SE locale because it formats as YYYY-MM-DD natively.
    return new Date(value).toLocaleDateString("sv-SE", { timeZone });
}

function detectEmailTypo(email: string): string | null {
    if (!email) return null;
    const parts = email.split("@");
    if (parts.length !== 2) return null;
    const local = parts[0];
    const domain = parts[1].toLowerCase().trim();

    const typoMap: Record<string, string> = {
        "gmal.com": "gmail.com",
        "gmial.com": "gmail.com",
        "gamil.com": "gmail.com",
        "gmaill.com": "gmail.com",
        "hotnail.com": "hotmail.com",
        "hotmial.com": "hotmail.com",
        "outlok.com": "outlook.com",
        "outloock.com": "outlook.com",
        "icloud.co": "icloud.com",
        "iclud.com": "icloud.com",
    };

    if (domain in typoMap) {
        return `${local}@${typoMap[domain]}`;
    }
    return null;
}

const inputClass = "min-w-0 border-[var(--template-border-soft)] bg-transparent text-[var(--template-text-primary)] placeholder:text-[var(--template-text-subtle)] focus-visible:ring-[var(--template-accent)]/30 focus-visible:border-[var(--template-accent)]";
const selectClass = "h-11 w-full min-w-0 rounded-xl border border-[var(--template-border-soft)] bg-transparent px-3 text-sm text-[var(--template-text-primary)] focus:outline-none focus:border-[var(--template-accent)]";

export function PublicBookingExperience({ catalog, consentRequired = false, privacyUrl = null, paymentReturnStatus = null }: PublicBookingExperienceProps) {
    const { config, siteName, siteDescription, locale } = useTemplate();
    const analyticsAllowed = useAnalyticsConsent(consentRequired);
    const t = BOOKING_COPY[locale];
    const bcp47Locale = getLocaleBcp47(locale);
    const [isAvailabilityPending, startAvailabilityTransition] = useTransition();
    const [isSubmissionPending, startSubmissionTransition] = useTransition();
    const adapter = BOOKING_TEMPLATE_ADAPTERS[catalog.templateKey] ?? BOOKING_TEMPLATE_ADAPTERS.custom;
    const [selectedServiceId, setSelectedServiceId] = useState<string>(catalog.services[0]?.id ?? "");
    const [selectedResourceId, setSelectedResourceId] = useState<string>(catalog.resources[0]?.id ?? "");
    const [selectedLocationId, setSelectedLocationId] = useState<string>(catalog.locations[0]?.id ?? "");
    const [partySize, setPartySize] = useState<number>(adapter.templateKey === "horeca" ? 2 : 1);
    const [customerName, setCustomerName] = useState("");
    const [customerEmail, setCustomerEmail] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
    const [emailSuggestionDismissed, setEmailSuggestionDismissed] = useState(false);
    const [emailDomainSuggestionShown, setEmailDomainSuggestionShown] = useState(false);
    const [emailDomainSuggestionAccepted, setEmailDomainSuggestionAccepted] = useState(false);

    useEffect(() => {
        const suggestion = detectEmailTypo(customerEmail);

        if (suggestion) {
            if (suggestion !== emailSuggestion) {
                setEmailSuggestion(suggestion);
                setEmailSuggestionDismissed(false);
                setEmailDomainSuggestionShown(true);
            }
        } else {
            setEmailSuggestion(null);
        }
    }, [customerEmail, emailSuggestion]);
    const [accountCreationApproved, setAccountCreationApproved] = useState(false);
    const [marketingConsent, setMarketingConsent] = useState(false);
    const [privacyAccepted, setPrivacyAccepted] = useState(false);
    const [bookingHoneypot, setBookingHoneypot] = useState("");
    const [formStartedAt] = useState(() => new Date().toISOString());
    const [selectedSlot, setSelectedSlot] = useState<string>("");
    /** Currently expanded day in the day-strip picker (viewer-local YYYY-MM-DD). */
    const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
    const [availability, setAvailability] = useState<Awaited<ReturnType<typeof getBookingAvailabilityPreview>> | null>(null);
    const [availabilityWindowStart, setAvailabilityWindowStart] = useState<string | null>(null);
    const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
    const [submission, setSubmission] = useState<{
        reference: string;
        nextStepsKind: BookingSubmissionNextStepsKind;
        consultationAccountProvisioned: boolean;
        payment: BookingPaymentDirective | null;
    } | null>(null);
    const [referenceCopied, setReferenceCopied] = useState(false);
    const [intakeValues, setIntakeValues] = useState<Record<string, string>>({});
    const [intakeStartedTracked, setIntakeStartedTracked] = useState(false);
    const widgetViewedTrackedRef = useRef(false);

    const selectedService = useMemo(
        () => catalog.services.find((service) => service.id === selectedServiceId) ?? catalog.services[0] ?? null,
        [catalog.services, selectedServiceId],
    );
    const availableResources = useMemo(() => {
        const linkedIds = selectedService?.resourceIds ?? [];
        return linkedIds.length === 0
            ? catalog.resources
            : catalog.resources.filter((resource) => linkedIds.includes(resource.id));
    }, [catalog.resources, selectedService]);
    const availableLocations = useMemo(() => {
        const linkedIds = selectedService?.locationIds ?? [];
        return linkedIds.length === 0
            ? catalog.locations
            : catalog.locations.filter((location) => linkedIds.includes(location.id));
    }, [catalog.locations, selectedService]);

    // A service switch can change the allowed resource/location graph. Keep
    // the selected values inside that service's options so the availability
    // query and final submit never briefly carry another service's choice.
    useEffect(() => {
        if (!availableResources.some((resource) => resource.id === selectedResourceId)) {
            setSelectedResourceId(availableResources[0]?.id ?? "");
        }
        if (!availableLocations.some((location) => location.id === selectedLocationId)) {
            setSelectedLocationId(availableLocations[0]?.id ?? "");
        }
    }, [availableLocations, availableResources, selectedLocationId, selectedResourceId]);
    const submissionKeyRef = useRef<{ fingerprint: string; key: string } | null>(null);

    // Silence unused warning — config is part of the interface contract
    void config;

    const offersAccountCreation = adapter.templateKey === "consultation";
    const locationModeLabels: Record<BookingPublicCatalog["services"][number]["locationMode"], string> = locale === "nl"
        ? { remote: "Online", onsite: "Op locatie", hybrid: "Hybride" }
        : locale === "ar"
            ? { remote: "عن بُعد", onsite: "في الموقع", hybrid: "هجين" }
            : { remote: "Remote", onsite: "On site", hybrid: "Hybrid" };

    const formatPrice = (amountCents: number | null, currency: string) => {
        if (amountCents == null) return null;
        try {
            return new Intl.NumberFormat(getLocaleBcp47(locale), {
                style: "currency",
                currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(amountCents / 100);
        } catch {
            return `${(amountCents / 100).toFixed(2)} ${currency}`;
        }
    };

    const selectedServicePaymentRequired = Boolean(selectedService?.paymentRequired);
    const priceLabels = locale === "nl"
        ? { excl: "excl. btw", vat: "btw", total: "totaal" }
        : locale === "ar"
            ? { excl: "قبل الضريبة", vat: "ضريبة القيمة المضافة", total: "الإجمالي" }
            : { excl: "excl. VAT", vat: "VAT", total: "total" };

    const paypalReturnNotice = useMemo(() => {
        if (paymentReturnStatus === "paypal_success") {
            return { tone: "success" as const, message: t.paypalReturnSuccess };
        }
        if (paymentReturnStatus === "paypal_cancelled") {
            return { tone: "error" as const, message: t.paypalReturnCancelled };
        }
        if (paymentReturnStatus === "paypal_capture_failed") {
            return { tone: "error" as const, message: t.paypalReturnCaptureFailed };
        }

        return null;
    }, [paymentReturnStatus, t.paypalReturnCancelled, t.paypalReturnCaptureFailed, t.paypalReturnSuccess]);

    const sendBookingFunnelEvent = useCallback((eventType: "booking_widget_viewed" | "booking_service_selected" | "booking_slot_selected" | "booking_intake_started", metadata: Record<string, unknown> = {}) => {
        if (!analyticsAllowed || !catalog.workspace?.id) return;
        const path = typeof window !== "undefined" ? window.location.pathname : "/booking";
        const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        void fetch("/api/analytics/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                path,
                contentType: deriveAnalyticsContentType(path),
                eventType,
                eventName: eventType,
                visitorId: ensureAnalyticsClientId("visitor-id"),
                sessionId: ensureAnalyticsClientId("session-id"),
                referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
                utmSource: searchParams?.get("utm_source") || undefined,
                utmMedium: searchParams?.get("utm_medium") || undefined,
                utmCampaign: searchParams?.get("utm_campaign") || undefined,
                userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
                workspaceId: catalog.workspace.id,
                metadata: {
                    templateKey: adapter.templateKey,
                    sourceChannel: adapter.analyticsMapping.defaultSourceChannel,
                    locale,
                    ...metadata,
                },
            }),
            keepalive: true,
        }).catch(() => undefined);
    }, [adapter.analyticsMapping.defaultSourceChannel, adapter.templateKey, analyticsAllowed, catalog.workspace?.id, locale]);

    useEffect(() => {
        if (widgetViewedTrackedRef.current) return;
        if (catalog.bookingState !== "active") return;
        if (!analyticsAllowed || !catalog.workspace?.id) return;
        widgetViewedTrackedRef.current = true;
        sendBookingFunnelEvent("booking_widget_viewed", { serviceId: selectedServiceId || undefined });
    }, [analyticsAllowed, catalog.bookingState, catalog.workspace?.id, selectedServiceId, sendBookingFunnelEvent]);

    const handleServiceSelected = useCallback((serviceId: string) => {
        setSelectedServiceId(serviceId);
        sendBookingFunnelEvent("booking_service_selected", { serviceId });
    }, [sendBookingFunnelEvent]);

    const handleSlotSelected = useCallback((slotStart: string) => {
        setSelectedSlot(slotStart);
        sendBookingFunnelEvent("booking_slot_selected", {
            serviceId: selectedServiceId || undefined,
            selectedSlot: slotStart,
        });
    }, [selectedServiceId, sendBookingFunnelEvent]);

    const trackIntakeStarted = useCallback(() => {
        if (intakeStartedTracked) return;
        setIntakeStartedTracked(true);
        sendBookingFunnelEvent("booking_intake_started", {
            serviceId: selectedServiceId || undefined,
            selectedSlot: selectedSlot || undefined,
        });
    }, [intakeStartedTracked, selectedServiceId, selectedSlot, sendBookingFunnelEvent]);

    // Intake fields rendered to the visitor come from the workspace's active
    // form definition (booking_form_definitions.schema_json) when one exists,
    // falling back to the adapter default only on first run before the
    // operator saves a form. Previously the renderer hard-coded the adapter
    // default, so dashboard edits to options/labels never reached the
    // public page.
    const activeIntakeFields: IntakeFieldDraft[] = useMemo(() => {
        const persisted = catalog.formDefinitions?.[0]?.schemaJson;
        if (persisted) {
            const parsed = intakeSchemaFromJson(persisted);
            if (parsed.fields.length > 0) {
                return parsed.fields;
            }
        }
        return intakeSchemaFromJson(adapter.defaultIntakeSchema).fields;
    }, [catalog.formDefinitions, adapter.defaultIntakeSchema]);

    const profileSettings = catalog.profile?.settingsJson ?? {};
    const seededPositioning = adapter.seededContent?.positioning ?? [];
    const enabledSections = useMemo(() => new Set(adapter.publicSections), [adapter.publicSections]);
    const showHero = enabledSections.has("booking_hero") || enabledSections.has("listing_context") || enabledSections.has("experience_selector") || enabledSections.has("service_selector");
    const showServiceSelector = enabledSections.has("service_selector") || enabledSections.has("experience_selector") || enabledSections.has("listing_context");
    const showContextStep = enabledSections.has("advisor_selector") || enabledSections.has("agent_selector") || enabledSections.has("location_selector") || enabledSections.has("slot_picker") || enabledSections.has("listing_context");
    const showResourceSelector = adapter.availabilityPolicy.requiresResourceSelection && (enabledSections.has("advisor_selector") || enabledSections.has("agent_selector"));
    const showLocationSelector = (adapter.availabilityPolicy.requiresLocationSelection || availableLocations.length > 0) && (enabledSections.has("location_selector") || enabledSections.has("listing_context"));
    const showContactStep = enabledSections.has("intake_form") || enabledSections.has("intent_form") || enabledSections.has("guest_details") || enabledSections.has("confirmation");
    function translateFieldLabel(fieldId: string, defaultLabel: string, loc: Locale): string {
        if (loc === "nl") {
            switch (fieldId) {
                case "goal": return "Waar heeft u hulp bij nodig?";
                case "urgency": return "Hoe dringend is dit?";
                case "preferred_language": return "Voorkeurstaal";
                case "listing_reference": return "Advertentie referentie";
                case "intent": return "Bent u aan het kopen of verkopen?";
                case "budget": return "Budget bereik";
                case "party_size": return "Aantal personen";
                case "occasion": return "Gelegenheid";
                case "dietary_requirements": return "Dieetwensen";
                case "request_summary": return "Vertel ons over uw verzoek";
                default: return defaultLabel;
            }
        }
        if (loc === "ar") {
            switch (fieldId) {
                case "goal": return "ما الذي تحتاج إلى مساعدة فيه؟";
                case "urgency": return "ما مدى استعجال هذا الأمر؟";
                case "preferred_language": return "اللغة المفضلة";
                case "listing_reference": return "مرجع العقار";
                case "intent": return "هل تشتري أم تبيع؟";
                case "budget": return "نطاق الميزانية";
                case "party_size": return "عدد الأشخاص";
                case "occasion": return "المناسبة";
                case "dietary_requirements": return "المتطلبات الغذائية";
                case "request_summary": return "أخبرنا عن تفاصيل طلبك";
                default: return defaultLabel;
            }
        }
        return defaultLabel;
    }

    function translateOptionLabel(fieldId: string, option: string, loc: Locale): string {
        if (loc === "nl") {
            if (fieldId === "urgency") {
                switch (option) {
                    case "Low": return "Laag";
                    case "Medium": return "Gemiddeld";
                    case "High": return "Hoog";
                }
            }
            if (fieldId === "preferred_language") {
                switch (option) {
                    case "English": return "Engels";
                    case "Arabic": return "Arabisch";
                    case "Dutch": return "Nederlands";
                }
            }
            if (fieldId === "intent") {
                switch (option) {
                    case "Buying": return "Kopen";
                    case "Selling": return "Verkopen";
                }
            }
        }
        if (loc === "ar") {
            if (fieldId === "urgency") {
                switch (option) {
                    case "Low": return "منخفض";
                    case "Medium": return "متوسط";
                    case "High": return "مرتفع";
                }
            }
            if (fieldId === "preferred_language") {
                switch (option) {
                    case "English": return "الإنجليزية";
                    case "Arabic": return "العربية";
                    case "Dutch": return "الهولندية";
                }
            }
            if (fieldId === "intent") {
                switch (option) {
                    case "Buying": return "شراء";
                    case "Selling": return "بيع";
                }
            }
        }
        return option;
    }

    function translateEntityLabel(label: string, loc: Locale): string {
        if (loc === "nl") {
            switch (label.toLowerCase()) {
                case "service": return "service";
                case "advisor": return "adviseur";
                case "listing": return "advertentie";
                case "agent": return "makelaar";
                case "experience": return "ervaring";
                case "table area": return "tafelzone";
                case "resource": return "middel";
                default: return label;
            }
        }
        if (loc === "ar") {
            switch (label.toLowerCase()) {
                case "service": return "الخدمة";
                case "advisor": return "المستشار";
                case "listing": return "العقار";
                case "agent": return "الوكيل";
                case "experience": return "التجربة";
                case "table area": return "منطقة الطاولة";
                case "resource": return "المورد";
                default: return label;
            }
        }
        return label;
    }

    const serviceHeading = enabledSections.has("experience_selector")
        ? t.serviceHeadingExperience(translateEntityLabel(adapter.reservationProjection.primaryEntityLabel, locale))
        : enabledSections.has("listing_context")
            ? t.serviceHeadingListing
            : t.serviceHeadingExperience(translateEntityLabel(adapter.reservationProjection.primaryEntityLabel, locale));
    const detailHeading = enabledSections.has("guest_details")
        ? t.detailHeadingGuest
        : enabledSections.has("intent_form")
            ? t.detailHeadingIntent
            : t.detailHeadingDefault;

    function getSettingCopy(key: string, fallback: string) {
        const overrideKey = locale === "nl" ? `${key}_nl` : locale === "ar" ? `${key}_ar` : key;

        if (typeof profileSettings[overrideKey] === "string" && (profileSettings[overrideKey] as string).trim().length > 0) {
            return profileSettings[overrideKey] as string;
        }

        if ((locale === "nl" || locale === "ar") && typeof profileSettings[key] === "string" && (profileSettings[key] as string).trim().length > 0) {
            return profileSettings[key] as string;
        }

        const seeded = seededPositioning.find((block) => block.key === key);
        if (seeded) {
            const content = locale === "nl" && seeded.contentNl
                ? seeded.contentNl
                : locale === "ar" && seeded.contentAr
                    ? seeded.contentAr
                    : seeded.content;
            if (content.trim().length > 0) {
                return content;
            }
        }

        return fallback;
    }

    const heroHeadingFallback = locale === "ar"
        ? `احجز مع ${siteName} عبر رحلة موجَّهة متميّزة.`
        : locale === "nl"
            ? `Boek met ${siteName} via een premium, begeleide journey.`
            : `Book with ${siteName} through a premium, guided journey.`;
    const heroBodyFallback = locale === "ar"
        ? `${siteDescription}. اختر العرض المناسب وأكّد الموعد المفضّل لديك وشارك فقط ما يلزم للخطوة التالية بثقة.`
        : locale === "nl"
            ? `${siteDescription}. Kies het juiste aanbod, bevestig uw favoriete slot en deel alleen wat nodig is voor een zelfverzekerde volgende stap.`
            : `${siteDescription}. Choose the right offer, confirm your preferred slot, and share only the details needed for a confident next step.`;
    const ctaMicrocopyFallback = locale === "ar"
        ? "اختر عرضًا لمشاهدة التوفّر المباشر."
        : locale === "nl"
            ? "Selecteer een aanbod om live beschikbaarheid te zien."
            : "Select an offer to see live availability.";
    const heroHeading = getSettingCopy("hero_heading", heroHeadingFallback);
    const heroBody = getSettingCopy("hero_body", heroBodyFallback);
    const ctaMicrocopy = getSettingCopy("cta_microcopy", ctaMicrocopyFallback);

    useEffect(() => {
        if (!selectedServiceId || catalog.bookingState !== "active") {
            setAvailability(null);
            return;
        }

        if (adapter.availabilityPolicy.requiresResourceSelection && !selectedResourceId) {
            return;
        }

        if (adapter.availabilityPolicy.requiresLocationSelection && !selectedLocationId) {
            return;
        }

        startAvailabilityTransition(async () => {
            try {
                const WINDOW_DAYS = 7;
                const MAX_LOOKAHEAD_DAYS = 180;
                // Build the date string from LOCAL components, not toISOString().
                // toISOString() converts to UTC, which for any non-UTC timezone
                // can shift the date by ±1 day (e.g. Apr 28 00:00 Amsterdam =
                // Apr 27 22:00 UTC, leaking yesterday's slots into the picker).
                const formatLocalYmd = (date: Date) => {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, "0");
                    const d = String(date.getDate()).padStart(2, "0");
                    return `${y}-${m}-${d}`;
                };
                const cursor = new Date();
                cursor.setHours(0, 0, 0, 0);

                let result: Awaited<ReturnType<typeof getBookingAvailabilityPreview>> | null = null;
                let probedWindowStart: Date | null = null;

                for (let offset = 0; offset <= MAX_LOOKAHEAD_DAYS; offset += WINDOW_DAYS) {
                    const windowStart = new Date(cursor);
                    windowStart.setDate(windowStart.getDate() + offset);
                    const windowEnd = new Date(windowStart);
                    windowEnd.setDate(windowEnd.getDate() + WINDOW_DAYS);

                    const probe = await getBookingAvailabilityPreview({
                        serviceId: selectedServiceId,
                        resourceId: selectedResourceId || null,
                        locationId: selectedLocationId || null,
                        dateRange: {
                            start: formatLocalYmd(windowStart),
                            end: formatLocalYmd(windowEnd),
                        },
                        // Viewer-side TZ hint only. The server now derives the
                        // authoritative business timezone from the workspace's
                        // booking_availability_rules and does not trust this
                        // field for slot generation.
                        timezone: detectViewerTimezone(),
                        partySize,
                    });

                    if (offset === 0) {
                        result = probe;
                        probedWindowStart = windowStart;
                    }

                    const hasAvailable = probe.dateSlots.some((slot) => slot.status === "available");
                    if (hasAvailable) {
                        result = probe;
                        probedWindowStart = windowStart;
                        break;
                    }
                }

                if (result) {
                    setAvailability(result);
                    setAvailabilityWindowStart(probedWindowStart ? formatLocalYmd(probedWindowStart) : null);
                    const firstAvailable = result.dateSlots.find((slot) => slot.status === "available");
                    setSelectedSlot(firstAvailable?.start ?? "");
                    // Default the day picker to the first day with an
                    // available slot — saves the operator a tap, and keeps the
                    // selection coherent with `selectedSlot`.
                    const viewerTz = detectViewerTimezone();
                    setSelectedDayKey(firstAvailable ? viewerLocalYmd(firstAvailable.start, viewerTz) : null);
                }
            } catch (error) {
                setStatus({ tone: "error", message: error instanceof Error ? error.message : t.couldNotLoadAvailability });
            }
        });
    }, [adapter.availabilityPolicy.requiresLocationSelection, adapter.availabilityPolicy.requiresResourceSelection, catalog.bookingState, partySize, selectedLocationId, selectedResourceId, selectedServiceId, t.couldNotLoadAvailability]);

    function setIntakeValue(key: string, value: string) {
        setIntakeValues((current) => ({ ...current, [key]: value }));
    }

    function handleSubmit() {
        if (!selectedServiceId || !selectedSlot || !customerName || !customerEmail) {
            setStatus({ tone: "error", message: t.completeRequired });
            return;
        }

        if (!privacyAccepted) {
            setStatus({ tone: "error", message: t.privacyConsent });
            return;
        }

        if (emailSuggestion && !emailSuggestionDismissed && customerEmail !== emailSuggestion) {
            setStatus({ tone: "error", message: t.emailTypoReviewRequired });
            return;
        }

        setStatus(null);
        setSubmission(null);
        startSubmissionTransition(async () => {
            const submissionFingerprint = [
                selectedServiceId,
                selectedResourceId || "",
                selectedLocationId || "",
                selectedSlot,
                customerEmail.trim().toLowerCase(),
                partySize,
            ].join("|");
            if (submissionKeyRef.current?.fingerprint !== submissionFingerprint) {
                submissionKeyRef.current = {
                    fingerprint: submissionFingerprint,
                    key: crypto.randomUUID(),
                };
            }
            const searchParams = new URLSearchParams(window.location.search);
            const utmCampaign = searchParams.get("utm_campaign");
            const popupId = searchParams.get("popup_id");
            const sourceChannel = searchParams.get("utm_source") || adapter.analyticsMapping.defaultSourceChannel;
            const sourceReferrer = document.referrer || null;
            const result = await submitBookingReservation({
                idempotencyKey: submissionKeyRef.current.key,
                serviceId: selectedServiceId,
                resourceId: selectedResourceId || null,
                locationId: selectedLocationId || null,
                scheduledStart: selectedSlot,
                partySize,
                reservationTimezone: detectViewerTimezone(),
                customer: {
                    fullName: customerName,
                    email: customerEmail,
                    phone: customerPhone || null,
                },
                intakePayload: intakeValues,
                attribution: {
                    sourceChannel,
                    sourceCampaign: utmCampaign || popupId || null,
                    sourceReferrer,
                    metadata: {
                        locale,
                        templateKey: adapter.templateKey,
                        emailDomainSuggestionShown,
                        emailDomainSuggestionAccepted,
                        popupId,
                        utm: {
                            source: searchParams.get("utm_source"),
                            medium: searchParams.get("utm_medium"),
                            campaign: utmCampaign,
                            term: searchParams.get("utm_term"),
                            content: searchParams.get("utm_content"),
                        },
                    },
                },
                consents: {
                    marketing: marketingConsent,
                    privacyAccepted,
                    accountCreationApproved,
                },
                antiAbuse: {
                    honeypot: bookingHoneypot,
                    formStartedAt,
                    pagePath: "/booking",
                },
            });

            if (result.error || !result.data) {
                setStatus({ tone: "error", message: result.error ?? t.submitFailed });
                return;
            }

            setSubmission({
                reference: result.data.publicReference,
                nextStepsKind: result.data.nextStepsKind,
                consultationAccountProvisioned: result.data.consultationAccountProvisioned,
                payment: result.data.payment,
            });
            setReferenceCopied(false);
            setStatus({ tone: "success", message: t.submitSuccess });
        });
    }

    // Both non-bookable states are public, customer-facing surfaces. They share
    // one treatment and use localized copy only — `catalog.message` is an
    // English-only internal diagnostic and must not be rendered to visitors.
    if (catalog.bookingState === "gated" || catalog.bookingState === "unavailable") {
        const notice = catalog.bookingState === "gated"
            ? { eyebrow: t.bookingPreparedEyebrow, title: t.bookingPreparedTitle, body: t.bookingPreparedBody }
            : { eyebrow: t.bookingUnavailableEyebrow, title: t.bookingUnavailableTitle, body: t.bookingUnavailableBody };

        return (
            <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
                <section className="relative overflow-hidden rounded-[24px] border border-[var(--template-border-soft)] [background:var(--template-surface-glass)] p-5 shadow-[var(--template-depth-lg)] backdrop-blur-[20px] sm:rounded-[32px] sm:p-10">
                    <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at top right, color-mix(in oklch, var(--template-accent) 12%, transparent) 0%, transparent 40%), radial-gradient(circle at bottom left, color-mix(in oklch, var(--template-gradient-from) 8%, transparent) 0%, transparent 35%)" }} />
                    <div className="relative z-10 max-w-3xl space-y-4">
                        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--template-text-accent-strong)]" style={{ borderColor: "color-mix(in oklch, var(--template-accent) 25%, transparent)", background: "color-mix(in oklch, var(--template-accent) 8%, transparent)" }}>
                            <Sparkles className="h-3.5 w-3.5 shrink-0" /> {notice.eyebrow}
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-[var(--template-text-primary)] sm:text-4xl md:text-5xl">{notice.title}</h1>
                        <p className="text-base leading-7 text-[var(--template-text-secondary)]">{notice.body}</p>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div>
            {/* Hero */}
            {showHero ? (
            <section className="relative overflow-hidden border-b border-[var(--template-border-soft)] px-4 py-12 sm:py-16 md:px-6 md:py-20">
                <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at top right, color-mix(in oklch, var(--template-accent) 14%, transparent) 0%, transparent 30%), radial-gradient(circle at bottom left, color-mix(in oklch, var(--template-gradient-from) 10%, transparent) 0%, transparent 28%)" }} />
                <div className="relative z-10 mx-auto max-w-7xl">
                    <div data-public-surface-intro>
                        <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--template-text-accent-strong)] sm:text-[11px] sm:tracking-[0.24em]" style={{ borderColor: "color-mix(in oklch, var(--template-accent) 25%, transparent)", background: "color-mix(in oklch, var(--template-accent) 8%, transparent)" }}>
                            <Sparkles className="h-3.5 w-3.5 shrink-0" /> <span className="min-w-0 truncate">{t.bookingPortal}</span>
                        </div>
                        <div className="mb-4 flex min-w-0 flex-wrap items-center gap-3">
                            <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-[var(--template-text-primary)] sm:text-4xl md:text-5xl">{heroHeading}</h1>
                        </div>
                        <p className="max-w-2xl text-base leading-8 text-[var(--template-text-secondary)] md:text-lg">{heroBody}</p>
                    </div>
                </div>
            </section>
            ) : null}

            {/* Main grid */}
            <div
                className="mx-auto grid max-w-7xl gap-6 px-3 py-8 sm:px-4 sm:py-12 md:px-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]"
                data-public-surface-block
            >
                <div className="min-w-0 space-y-6 sm:space-y-8">
                    {/* Step 1 — Select service */}
                    {showServiceSelector ? (
                    <section className="rounded-[22px] border border-[var(--template-border-soft)] [background:var(--template-surface-glass)] p-4 shadow-[var(--template-depth-md)] backdrop-blur-[16px] sm:rounded-[30px] sm:p-6 md:p-8">
                        <div className="flex min-w-0 items-start gap-3 sm:items-center">
                            <div className="shrink-0 rounded-2xl border p-3 text-[var(--template-text-accent-strong)]" style={{ borderColor: "color-mix(in oklch, var(--template-accent) 25%, transparent)", background: "color-mix(in oklch, var(--template-accent) 10%, transparent)" }}>
                                <ConciergeBell className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs uppercase tracking-[0.22em] text-[var(--template-text-subtle)]">{t.step1}</p>
                                <h2 className="text-xl font-bold tracking-tight text-[var(--template-text-primary)] sm:text-2xl">
                                    {serviceHeading}
                                </h2>
                                <p className="mt-1 text-sm text-[var(--template-text-secondary)]">{ctaMicrocopy}</p>
                            </div>
                        </div>

                        <div className="mt-6 grid gap-4">
                            {catalog.services.map((service) => {
                                const isSelected = service.id === selectedServiceId;
                                return (
                                    <button
                                        key={service.id}
                                        type="button"
                                        aria-pressed={isSelected}
                                        onClick={() => handleServiceSelected(service.id)}
                                        className={`min-w-0 rounded-2xl border p-4 text-start transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--template-accent)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-5 ${
                                            isSelected
                                                ? "shadow-[var(--template-depth-glow)]"
                                                : "hover:border-[var(--template-accent)]/40"
                                        } border-[var(--template-border-soft)]`}
                                        style={isSelected ? {
                                            borderColor: "var(--template-accent)",
                                            background: "color-mix(in oklch, var(--template-accent) 8%, transparent)",
                                        } : { background: "transparent" }}
                                    >
                                        <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6">
                                            <div className="min-w-0">
                                                <h3 className="text-lg font-semibold leading-snug tracking-tight text-[var(--template-text-primary)]">
                                                    {service.title}
                                                </h3>
                                                {service.subtitle ? (
                                                    <p className="mt-1 text-sm leading-6 text-[var(--template-text-secondary)]">{service.subtitle}</p>
                                                ) : null}
                                                {service.description ? (
                                                    <p className="mt-3 max-w-[62ch] text-sm leading-6 text-[var(--template-text-secondary)]">
                                                        {service.description}
                                                    </p>
                                                ) : null}
                                            </div>

                                            {service.paymentRequired && service.priceAmountCents != null ? (
                                                <span
                                                    className="block w-full self-start rounded-xl border px-4 py-3 text-[var(--template-text-accent-strong)] sm:w-auto sm:min-w-44"
                                                    style={{
                                                        borderColor: "color-mix(in oklch, var(--template-accent) 28%, transparent)",
                                                        background: "color-mix(in oklch, var(--template-accent) 8%, transparent)",
                                                    }}
                                                >
                                                    <span className="block text-sm font-semibold leading-5 sm:text-end">
                                                        {formatPrice(service.netAmountCents ?? service.priceAmountCents, service.priceCurrency)} {priceLabels.excl}
                                                    </span>
                                                    <span className="mt-1 grid gap-0.5 text-[11px] font-normal leading-4 text-[var(--template-text-secondary)] sm:text-end">
                                                        {service.vatAmountCents != null ? (
                                                            <span>{formatPrice(service.vatAmountCents, service.priceCurrency)} {priceLabels.vat}{service.vatRateBasisPoints ? ` (${service.vatRateBasisPoints / 100}%)` : ""}</span>
                                                        ) : null}
                                                        {service.grossAmountCents != null ? (
                                                            <span>{formatPrice(service.grossAmountCents, service.priceCurrency)} {priceLabels.total}</span>
                                                        ) : null}
                                                    </span>
                                                </span>
                                            ) : null}
                                        </div>

                                        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[var(--template-border-soft)] pt-3 text-xs font-medium text-[var(--template-text-subtle)]">
                                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                                <CalendarClock className="size-3.5" aria-hidden="true" />
                                                {service.durationMinutes} {t.minutes}
                                            </span>
                                            <span className="h-3 w-px bg-[var(--template-border-soft)]" aria-hidden="true" />
                                            <span className="inline-flex items-center gap-1.5 capitalize">
                                                <MapPin className="size-3.5" aria-hidden="true" />
                                                {locationModeLabels[service.locationMode]}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                    ) : null}

                    {/* Step 2 — Context & timing */}
                    {showContextStep ? (
                    <section className="rounded-[22px] border border-[var(--template-border-soft)] [background:var(--template-surface-glass)] p-4 shadow-[var(--template-depth-md)] backdrop-blur-[16px] sm:rounded-[30px] sm:p-6 md:p-8">
                        <div className="flex min-w-0 items-start gap-3 sm:items-center">
                            <div className="shrink-0 rounded-2xl border p-3 text-[var(--template-text-accent-strong)]" style={{ borderColor: "color-mix(in oklch, var(--template-accent) 25%, transparent)", background: "color-mix(in oklch, var(--template-accent) 10%, transparent)" }}>
                                <CalendarClock className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs uppercase tracking-[0.22em] text-[var(--template-text-subtle)]">{t.step2}</p>
                                <h2 className="text-xl font-bold tracking-tight text-[var(--template-text-primary)] sm:text-2xl">{t.chooseContextTiming}</h2>
                            </div>
                        </div>

                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            {showResourceSelector ? (
                                <label className="grid gap-2 text-sm text-[var(--template-text-secondary)]">
                                    {adapter.reservationProjection.secondaryEntityLabel ?? "Resource"}
                                    <select
                                        value={selectedResourceId}
                                        onChange={(event) => setSelectedResourceId(event.target.value)}
                                        className={selectClass}
                                    >
                                        <option value="">{t.select}</option>
                                        {availableResources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}
                                    </select>
                                </label>
                            ) : null}

                            {showLocationSelector ? (
                                <label className="grid gap-2 text-sm text-[var(--template-text-secondary)]">
                                    {t.location}
                                    <select
                                        value={selectedLocationId}
                                        onChange={(event) => setSelectedLocationId(event.target.value)}
                                        className={selectClass}
                                    >
                                        <option value="">{t.select}</option>
                                        {availableLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                                    </select>
                                </label>
                            ) : null}

                            {adapter.availabilityPolicy.supportsCapacity ? (
                                <label className="grid gap-2 text-sm text-[var(--template-text-secondary)] md:col-span-2">
                                    {t.partySize}
                                    <Input
                                        type="number"
                                        min={1}
                                        value={partySize}
                                        onChange={(event) => setPartySize(Number(event.target.value || 1))}
                                        className={inputClass}
                                    />
                                </label>
                            ) : null}
                        </div>

                        {/* Availability slots */}
                        <div
                            className="mt-6 min-w-0 rounded-2xl border border-[var(--template-border-soft)] bg-transparent p-4 sm:rounded-3xl sm:p-5"
                            data-booking-availability-state={
                                isAvailabilityPending ? "loading" : availability ? "ready" : "idle"
                            }
                        >
                            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs uppercase tracking-[0.22em] text-[var(--template-text-subtle)]">{t.availabilityPreview}</p>
                                    <h3 className="mt-2 text-lg font-semibold text-[var(--template-text-primary)]">{t.slotsUpdate}</h3>
                                </div>
                                {isAvailabilityPending ? <span className="text-sm text-[var(--template-text-secondary)]">{t.updating}</span> : null}
                            </div>
                            {availability?.rulesNotices?.length ? (
                                <div className="mt-4 rounded-2xl border p-4 text-sm text-[var(--template-text-secondary)]" style={{ borderColor: "color-mix(in oklch, var(--template-accent) 20%, transparent)", background: "color-mix(in oklch, var(--template-accent) 6%, transparent)" }}>
                                    {availability.rulesNotices.join(" ")}
                                </div>
                            ) : null}
                            {availability && availabilityWindowStart && new Date(availabilityWindowStart).getTime() > Date.now() + 8 * 24 * 60 * 60 * 1000 ? (
                                <div className="mt-4 rounded-2xl border p-4 text-sm text-[var(--template-text-secondary)]" style={{ borderColor: "color-mix(in oklch, var(--template-accent) 20%, transparent)", background: "color-mix(in oklch, var(--template-accent) 6%, transparent)" }}>
                                    {t.nextAvailabilityOpens(new Date(availabilityWindowStart).toLocaleDateString(bcp47Locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}
                                </div>
                            ) : null}
                            {availability && !isAvailabilityPending && !availability.rulesNotices?.length && availability.dateSlots.every((slot) => slot.status !== "available") ? (
                                <div className="mt-4 rounded-2xl border p-4 text-sm text-[var(--template-text-secondary)]" style={{ borderColor: "color-mix(in oklch, var(--template-accent) 20%, transparent)", background: "color-mix(in oklch, var(--template-accent) 6%, transparent)" }}>
                                    {t.noOpenSlots}
                                </div>
                            ) : null}
                            {availability && availability.dateSlots.length > 0 ? (() => {
                                const viewerTz = detectViewerTimezone();
                                const businessTz = availability.businessTimezone;
                                const showDualZone = Boolean(businessTz) && businessTz !== viewerTz;
                                // Group slots by viewer-local date once so the
                                // day strip and time grid both work from the
                                // same map without recomputing.
                                const groups = new Map<string, typeof availability.dateSlots>();
                                for (const slot of availability.dateSlots) {
                                    const key = viewerLocalYmd(slot.start, viewerTz);
                                    const list = groups.get(key) ?? [];
                                    list.push(slot);
                                    groups.set(key, list);
                                }
                                const sortedKeys = Array.from(groups.keys()).sort();
                                // Resolve the active day. Falls back to the
                                // first day with availability so the picker
                                // never renders an empty time grid.
                                const firstWithAvailable = sortedKeys.find((k) =>
                                    (groups.get(k) ?? []).some((s) => s.status === "available"),
                                );
                                const activeDayKey = (selectedDayKey && groups.has(selectedDayKey))
                                    ? selectedDayKey
                                    : firstWithAvailable ?? sortedKeys[0];
                                const activeDaySlots = groups.get(activeDayKey) ?? [];

                                return (
                                    <>
                                        <p className="mt-4 text-xs text-[var(--template-text-subtle)]">
                                            {showDualZone && businessTz
                                                ? t.timezoneDualNote(viewerTz, businessTz)
                                                : t.timezoneSameNote(viewerTz)}
                                        </p>

                                        {/*
                                          * Day strip — horizontal scroller of compact day
                                          * cards. Replaces the previous vertical stack of
                                          * full-width day groups, which forced operators to
                                          * scroll past every day to find a workable slot.
                                          * Each card is ~80×64 px and shows weekday + day
                                          * number + count of available slots.
                                          */}
                                        <div className="mt-4 -mx-1 flex gap-2 overflow-x-auto pb-2 px-1 [scrollbar-width:thin]">
                                            {sortedKeys.map((dayKey) => {
                                                const slotsForDay = groups.get(dayKey) ?? [];
                                                const availableCount = slotsForDay.filter((s) => s.status === "available").length;
                                                const isActive = dayKey === activeDayKey;
                                                const isDisabled = availableCount === 0;
                                                const anchor = new Date(`${dayKey}T12:00:00Z`);
                                                const weekday = anchor.toLocaleDateString(bcp47Locale, { timeZone: viewerTz, weekday: "short" });
                                                const dayNum = anchor.toLocaleDateString(bcp47Locale, { timeZone: viewerTz, day: "numeric" });
                                                const monthShort = anchor.toLocaleDateString(bcp47Locale, { timeZone: viewerTz, month: "short" });
                                                return (
                                                    <button
                                                        key={dayKey}
                                                        type="button"
                                                        disabled={isDisabled}
                                                        onClick={() => setSelectedDayKey(dayKey)}
                                                        className={`flex shrink-0 flex-col items-center justify-center rounded-2xl border px-3 py-2 transition-all min-w-[68px] ${isDisabled ? "cursor-not-allowed opacity-40" : "hover:border-[var(--template-accent)]/40"}`}
                                                        style={isActive ? {
                                                            borderColor: "var(--template-accent)",
                                                            background: "color-mix(in oklch, var(--template-accent) 12%, transparent)",
                                                        } : {
                                                            borderColor: "var(--template-border-soft)",
                                                            background: "transparent",
                                                        }}
                                                        aria-pressed={isActive}
                                                        aria-label={
                                                            locale === "nl"
                                                                 ? `${weekday} ${dayNum} ${monthShort}, ${availableCount} beschikbare slot(s)`
                                                                 : locale === "ar"
                                                                     ? `${weekday} ${dayNum} ${monthShort}، ${availableCount} موعد متاح`
                                                                     : `${weekday} ${dayNum} ${monthShort}, ${availableCount} available slot${availableCount === 1 ? "" : "s"}`
                                                         }
                                                    >
                                                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--template-text-subtle)]">
                                                            {weekday}
                                                        </span>
                                                        <span className="text-lg font-semibold leading-tight text-[var(--template-text-primary)]">
                                                            {dayNum}
                                                        </span>
                                                        <span className="text-[10px] text-[var(--template-text-subtle)]">
                                                            {monthShort}
                                                        </span>
                                                        <span className="mt-1 text-[10px] font-medium text-[var(--template-text-accent-strong)]">
                                                            {availableCount > 0 ? `${availableCount} ${locale === "nl" ? "open" : locale === "ar" ? "متاح" : "open"}` : "—"}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/*
                                          * Time grid — compact pills for the active day only.
                                          * Replaces the previous 3-column big-card layout
                                          * (~3 slots/row, multi-line) with a 4–6 column dense
                                          * grid (~6 slots/row, single-line), cutting vertical
                                          * scroll dramatically on workspaces with many slots.
                                          */}
                                        <div className="mt-5">
                                             <p className="mb-2 text-sm font-semibold text-[var(--template-text-primary)]">
                                                 {formatGroupHeading(activeDayKey, bcp47Locale, viewerTz)}
                                            </p>
                                             <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
                                                {activeDaySlots.map((slot) => {
                                                    const selected = slot.start === selectedSlot;
                                                    const viewerTime = formatTimeInTz(slot.start, bcp47Locale, viewerTz);
                                                    const businessTime = showDualZone && businessTz
                                                        ? formatTimeInTz(slot.start, bcp47Locale, businessTz)
                                                        : null;
                                                    const isAvailable = slot.status === "available";
                                                    return (
                                                        <button
                                                            key={slot.start}
                                                            type="button"
                                                            disabled={!isAvailable}
                                                            onClick={() => handleSlotSelected(slot.start)}
                                                            title={!isAvailable ? (slot.reason ?? slot.status.replace(/_/g, " ")) : (businessTime && businessTz ? `${viewerTime} · ${t.businessTimeLabel(businessTime, businessTz)}` : viewerTime)}
                                                            className={`rounded-xl border px-2 py-2 text-center transition-all ${!isAvailable ? "cursor-not-allowed opacity-40" : "hover:border-[var(--template-accent)]/40"}`}
                                                            style={selected ? {
                                                                borderColor: "var(--template-accent)",
                                                                background: "color-mix(in oklch, var(--template-accent) 12%, transparent)",
                                                            } : {
                                                                borderColor: "var(--template-border-soft)",
                                                                background: "transparent",
                                                            }}
                                                        >
                                                            <span className="block text-sm font-medium text-[var(--template-text-primary)]">{viewerTime}</span>
                                                            {businessTime && businessTz ? (
                                                                <span className="mt-0.5 block text-[10px] text-[var(--template-text-subtle)]">
                                                                    {businessTime}
                                                                </span>
                                                            ) : null}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                );
                            })() : null}
                        </div>
                    </section>
                    ) : null}
                </div>

                {/* Right column */}
                <section className="min-w-0 space-y-6">
                    {/* Step 3 — Contact details */}
                    {showContactStep ? (
                    <div className="rounded-[22px] border border-[var(--template-border-soft)] [background:var(--template-surface-glass)] p-4 shadow-[var(--template-depth-md)] backdrop-blur-[16px] sm:rounded-[30px] sm:p-6 md:p-8">
                        <div className="flex min-w-0 items-start gap-3 sm:items-center">
                            <div className="shrink-0 rounded-2xl border p-3 text-[var(--template-text-accent-strong)]" style={{ borderColor: "color-mix(in oklch, var(--template-accent) 25%, transparent)", background: "color-mix(in oklch, var(--template-accent) 10%, transparent)" }}>
                                <UserRound className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs uppercase tracking-[0.22em] text-[var(--template-text-subtle)]">{t.step3}</p>
                                <h2 className="text-xl font-bold tracking-tight text-[var(--template-text-primary)] sm:text-2xl">{detailHeading}</h2>
                            </div>
                        </div>

                        <div className="mt-6 grid gap-4">
                            <Input placeholder={t.fullName} value={customerName} onFocus={trackIntakeStarted} onChange={(event) => setCustomerName(event.target.value)} className={inputClass} />
                            <Input placeholder={t.email} type="email" value={customerEmail} onFocus={trackIntakeStarted} onChange={(event) => setCustomerEmail(event.target.value)} className={inputClass} />
                            {emailSuggestion && !emailSuggestionDismissed && customerEmail !== emailSuggestion && (
                                <div
                                    className="relative flex flex-col gap-2.5 rounded-xl border p-3.5 text-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2"
                                    style={{
                                        borderColor: "color-mix(in oklch, var(--template-accent) 25%, transparent)",
                                        background: "color-mix(in oklch, var(--template-accent) 8%, transparent)"
                                    }}
                                >
                                    <div className="flex items-start gap-2.5">
                                        <Sparkles className="h-4 w-4 shrink-0 text-[var(--template-text-accent-strong)] mt-0.5" />
                                        <div className="flex-1 text-[var(--template-text-secondary)]">
                                            {t.didYouMean} <strong className="text-[var(--template-text-primary)]">{emailSuggestion}</strong>?
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-4 text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setEmailSuggestionDismissed(true)}
                                            className="font-medium text-[var(--template-text-subtle)] hover:text-[var(--template-text-secondary)] transition"
                                        >
                                            {t.noContinue}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCustomerEmail(emailSuggestion);
                                                setEmailDomainSuggestionAccepted(true);
                                            }}
                                            className="rounded-lg bg-[var(--template-accent)] px-3 py-1.5 font-semibold text-white shadow-sm hover:opacity-90 transition active:scale-95"
                                        >
                                            {t.yesCorrectIt}
                                        </button>
                                    </div>
                                </div>
                            )}
                            <Input placeholder={t.phone} value={customerPhone} onFocus={trackIntakeStarted} onChange={(event) => setCustomerPhone(event.target.value)} className={inputClass} />

                            {activeIntakeFields.map((field) => (
                                <label key={field.id} className="grid gap-2 text-sm text-[var(--template-text-secondary)]">
                                    {translateFieldLabel(field.id, field.label, locale)}
                                    {field.type === "textarea" ? (
                                        <Textarea
                                             rows={4}
                                             value={intakeValues[field.id] ?? ""}
                                             onFocus={trackIntakeStarted}
                                             onChange={(event) => setIntakeValue(field.id, event.target.value)}
                                            className={inputClass}
                                        />
                                    ) : field.type === "select" || field.type === "radio" ? (
                                         <select
                                             value={intakeValues[field.id] ?? ""}
                                             onFocus={trackIntakeStarted}
                                             onChange={(event) => setIntakeValue(field.id, event.target.value)}
                                            className={selectClass}
                                        >
                                            <option value="">{t.select}</option>
                                            {field.options?.map((option) => (
                                                <option key={option} value={option}>
                                                    {translateOptionLabel(field.id, option, locale)}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <Input
                                             type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                                             value={intakeValues[field.id] ?? ""}
                                             onFocus={trackIntakeStarted}
                                             onChange={(event) => setIntakeValue(field.id, event.target.value)}
                                            className={inputClass}
                                        />
                                    )}
                                </label>
                            ))}

                            <label className="rounded-2xl border p-4 text-sm text-[var(--template-text-secondary)]" style={{ borderColor: "color-mix(in oklch, var(--template-accent) 24%, transparent)", background: "color-mix(in oklch, var(--template-accent) 6%, transparent)" }}>
                                <div className="flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        required
                                        checked={privacyAccepted}
                                        onChange={(event) => setPrivacyAccepted(event.target.checked)}
                                        className="mt-1 h-4 w-4 rounded border-[var(--template-border-soft)] accent-[var(--template-accent)]"
                                    />
                                    <span>
                                        {privacyUrl ? <><a href={privacyUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{t.privacyConsent}</a></> : t.privacyConsent}
                                    </span>
                                </div>
                            </label>

                            {offersAccountCreation ? (
                                <label className="rounded-2xl border p-4 text-sm text-[var(--template-text-secondary)]" style={{ borderColor: "color-mix(in oklch, var(--template-accent) 20%, transparent)", background: "color-mix(in oklch, var(--template-accent) 5%, transparent)" }}>
                                    <div className="flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            checked={accountCreationApproved}
                                            onChange={(event) => setAccountCreationApproved(event.target.checked)}
                                            className="mt-1 h-4 w-4 rounded border-[var(--template-border-soft)] accent-[var(--template-accent)]"
                                        />
                                        <span>{t.accountConsent}</span>
                                    </div>
                                </label>
                            ) : null}

                            <label className="rounded-2xl border p-4 text-sm text-[var(--template-text-secondary)]" style={{ borderColor: "color-mix(in oklch, var(--template-accent) 16%, transparent)", background: "color-mix(in oklch, var(--template-accent) 4%, transparent)" }}>
                                <div className="flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        checked={marketingConsent}
                                        onChange={(event) => setMarketingConsent(event.target.checked)}
                                        className="mt-1 h-4 w-4 rounded border-[var(--template-border-soft)] accent-[var(--template-accent)]"
                                    />
                                    <span>{t.marketingConsent}</span>
                                </div>
                            </label>

                            {/* Honeypot — hidden from real users */}
                            <div className="hidden" aria-hidden="true">
                                <label>
                                    Company website
                                    <input
                                        tabIndex={-1}
                                        autoComplete="off"
                                        value={bookingHoneypot}
                                        onChange={(event) => setBookingHoneypot(event.target.value)}
                                    />
                                </label>
                            </div>
                        </div>

                        <Button
                            className="mt-6 h-12 w-full rounded-xl text-base border border-[var(--template-border-accent-soft)] text-white shadow-[var(--template-depth-glow)] disabled:opacity-50"
                            style={{ background: `linear-gradient(to right, var(--template-gradient-from), var(--template-gradient-to))` }}
                            onClick={handleSubmit}
                            disabled={isSubmissionPending || !selectedSlot}
                        >
                            {isSubmissionPending
                                ? t.submittingReservation
                                : selectedServicePaymentRequired
                                    ? t.reserveAndPay
                                    : t.requestReservation}
                            <ArrowRight className="h-4 w-4 ms-2 rtl-flip" />
                        </Button>

                        {status ? (
                            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                                status.tone === "success"
                                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                                    : "border-red-500/20 bg-red-500/10 text-red-400"
                            }`}>
                                {status.message}
                            </div>
                        ) : null}

                        {paypalReturnNotice ? (
                            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                                paypalReturnNotice.tone === "success"
                                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                                    : "border-amber-500/20 bg-amber-500/10 text-amber-500"
                            }`}>
                                {paypalReturnNotice.message}
                            </div>
                        ) : null}

                        {submission ? (
                            <div className="mt-4 min-w-0 rounded-2xl border p-4 sm:rounded-3xl sm:p-5" style={{ borderColor: "color-mix(in oklch, var(--template-accent) 20%, transparent)", background: "color-mix(in oklch, var(--template-accent) 6%, transparent)" }}>
                                <div className="flex min-w-0 items-start gap-2 text-[var(--template-text-accent-strong)] sm:items-center">
                                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                                    <span className="min-w-0 break-words">{t.reservationReference} {submission.reference}</span>
                                 </div>
                                 <ul className="mt-3 space-y-2 text-sm text-[var(--template-text-secondary)]">
                                     {t.nextSteps[submission.nextStepsKind](submission.reference, submission.payment?.provider).map((step) => (
                                         <li key={step}>{step}</li>
                                     ))}
                                    {submission.consultationAccountProvisioned ? (
                                        <li>{t.nextStepsConsultationAccount}</li>
                                    ) : null}
                                 </ul>
                                 {submission.payment ? (
                                     <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: "color-mix(in oklch, var(--template-accent) 30%, transparent)", background: "color-mix(in oklch, var(--template-accent) 4%, transparent)" }}>
                                         <h3 className="text-base font-semibold text-[var(--template-text-primary)]">{t.paymentRequiredTitle(submission.payment.provider)}</h3>
                                         <p className="mt-1 text-sm text-[var(--template-text-secondary)]">{t.paymentRequiredBody(submission.payment.provider)}</p>
                                         {t.paymentProviderBenefit(submission.payment.provider) ? (
                                             <p className="mt-2 text-xs leading-5 text-[var(--template-text-subtle)]">
                                                 {t.paymentProviderBenefit(submission.payment.provider)}
                                             </p>
                                         ) : null}
                                         <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="text-end text-[var(--template-text-primary)]">
                                                <div className="text-2xl font-bold">{formatPrice(submission.payment.grossAmountCents, submission.payment.currency)}</div>
                                                <div className="mt-1 text-xs text-[var(--template-text-subtle)]">
                                                    {formatPrice(submission.payment.netAmountCents, submission.payment.currency)} {priceLabels.excl} · {formatPrice(submission.payment.vatAmountCents, submission.payment.currency)} {priceLabels.vat}
                                                </div>
                                            </div>
                                            <a
                                                href={submission.payment.paymentUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold text-white shadow-[var(--template-depth-glow)]"
                                                style={{
                                                    borderColor: "var(--template-border-accent-soft)",
                                                    background: `linear-gradient(to right, var(--template-gradient-from), var(--template-gradient-to))`,
                                                }}
                                             >
                                                 {t.payNowLabel(submission.payment.provider)}
                                                 <ExternalLink className="h-4 w-4 rtl-flip" />
                                             </a>
                                         </div>
                                          {submission.payment.provider === "manual_revolut_pro" ? (
                                          <div className="mt-4 min-w-0 rounded-xl border p-3" style={{ borderColor: "color-mix(in oklch, var(--template-accent) 25%, transparent)", background: "color-mix(in oklch, var(--template-accent) 3%, transparent)" }}>
                                              <p className="text-xs uppercase tracking-[0.18em] text-[var(--template-text-subtle)]">{t.paymentReferenceLabel}</p>
                                              <div className="mt-1 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                 <code className="min-w-0 select-all break-all text-base font-bold tracking-wider text-[var(--template-text-primary)] sm:text-lg">{submission.payment.paymentReference}</code>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            await navigator.clipboard.writeText(submission.payment!.paymentReference);
                                                            setReferenceCopied(true);
                                                            window.setTimeout(() => setReferenceCopied(false), 2000);
                                                        } catch {
                                                            setReferenceCopied(false);
                                                        }
                                                    }}
                                                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--template-border-soft)] px-3 py-1.5 text-xs font-medium text-[var(--template-text-secondary)] hover:bg-black/5"
                                                >
                                                    <Copy className="h-3.5 w-3.5" />
                                                    {referenceCopied ? t.paymentReferenceCopied : t.paymentReferenceCopy}
                                                 </button>
                                             </div>
                                         </div>
                                          ) : null}
                                         {t.paymentManualConfirmationNote(submission.payment.provider) ? (
                                             <p className="mt-3 text-xs leading-5 text-[var(--template-text-secondary)]">
                                                 {t.paymentManualConfirmationNote(submission.payment.provider)}
                                             </p>
                                         ) : null}
                                        <p className="mt-2 text-xs leading-5 text-[var(--template-text-subtle)]">
                                            {t.paymentDeadlineNote(
                                                new Intl.DateTimeFormat(getLocaleBcp47(locale), {
                                                    dateStyle: "medium",
                                                    timeStyle: "short",
                                                }).format(new Date(submission.payment.deadlineAt)),
                                            )}
                                        </p>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                    ) : null}

                </section>
            </div>
        </div>
    );
}
