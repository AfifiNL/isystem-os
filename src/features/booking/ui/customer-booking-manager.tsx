"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import {
    manageCustomerBookingAction,
    type CustomerBookingManagementActionState,
    type CustomerBookingManagementView,
} from "@/features/booking/actions/customer-management";

const INITIAL_CUSTOMER_BOOKING_MANAGEMENT_STATE: CustomerBookingManagementActionState = {
    success: false,
    outcome: "idle",
    message: null,
};

const COPY = {
    en: {
        eyebrow: "Secure booking management",
        title: "Manage your booking",
        current: "Current appointment",
        reference: "Reference",
        status: "Status",
        email: "Email",
        location: "Location",
        meeting: "Meeting",
        joinMeeting: "Join meeting",
        meetingPending: "Meeting details are being prepared and will be emailed before confirmation.",
        reschedule: "Choose a new time",
        rescheduleButton: "Change booking time",
        review: "Requires workspace confirmation",
        direct: "Confirms immediately",
        cancelTitle: "Cancel this booking",
        cancelBody: "Cancellation is immediate. A verified payment is not refunded automatically; the team reviews refunds separately.",
        cancelButton: "Cancel booking",
        confirmCancel: "Cancel this booking? This cannot be undone.",
        noSlots: "No alternative times are currently available. Reply to your booking email for help.",
    },
    nl: {
        eyebrow: "Veilig boekingsbeheer",
        title: "Beheer uw boeking",
        current: "Huidige afspraak",
        reference: "Referentie",
        status: "Status",
        email: "E-mail",
        location: "Locatie",
        meeting: "Vergadering",
        joinMeeting: "Deelnemen aan de vergadering",
        meetingPending: "De vergadergegevens worden voorbereid en vóór de bevestiging per e-mail verzonden.",
        reschedule: "Kies een nieuw moment",
        rescheduleButton: "Boeking verplaatsen",
        review: "Bevestiging door de werkruimte nodig",
        direct: "Wordt direct bevestigd",
        cancelTitle: "Deze boeking annuleren",
        cancelBody: "De annulering is direct. Een geverifieerde betaling wordt niet automatisch terugbetaald; het team beoordeelt terugbetalingen afzonderlijk.",
        cancelButton: "Boeking annuleren",
        confirmCancel: "Deze boeking annuleren? Dit kan niet ongedaan worden gemaakt.",
        noSlots: "Er zijn momenteel geen alternatieve momenten beschikbaar. Reageer op uw boekingsmail voor hulp.",
    },
    ar: {
        eyebrow: "إدارة الحجز الآمنة",
        title: "إدارة حجزك",
        current: "الموعد الحالي",
        reference: "المرجع",
        status: "الحالة",
        email: "البريد الإلكتروني",
        location: "الموقع",
        meeting: "الاجتماع",
        joinMeeting: "انضم إلى الاجتماع",
        meetingPending: "يتم إعداد تفاصيل الاجتماع وستُرسل عبر البريد الإلكتروني قبل التأكيد.",
        reschedule: "اختر موعدًا جديدًا",
        rescheduleButton: "تغيير موعد الحجز",
        review: "يتطلب تأكيد فريق العمل",
        direct: "يتم تأكيده فورًا",
        cancelTitle: "إلغاء هذا الحجز",
        cancelBody: "يتم الإلغاء فورًا. لا يتم رد الدفعة المتحقق منها تلقائيًا؛ يراجع الفريق طلبات الاسترداد بشكل منفصل.",
        cancelButton: "إلغاء الحجز",
        confirmCancel: "هل تريد إلغاء هذا الحجز؟ لا يمكن التراجع عن ذلك.",
        noSlots: "لا توجد مواعيد بديلة متاحة حاليًا. رد على رسالة الحجز للحصول على المساعدة.",
    },
} as const;

export function CustomerBookingManager({
    token,
    view,
}: {
    token: string;
    view: CustomerBookingManagementView;
}) {
    const t = COPY[view.locale];
    const router = useRouter();
    const refreshedOutcome = useRef<string | null>(null);
    const [state, formAction, pending] = useActionState(
        manageCustomerBookingAction,
        INITIAL_CUSTOMER_BOOKING_MANAGEMENT_STATE,
    );
    const dateLocale = view.locale === "nl" ? "nl-NL" : view.locale === "ar" ? "ar" : "en-GB";
    const formatter = new Intl.DateTimeFormat(dateLocale, {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: view.timezone,
    });

    useEffect(() => {
        if (state.success && refreshedOutcome.current !== state.outcome) {
            refreshedOutcome.current = state.outcome;
            router.refresh();
        }
    }, [router, state.outcome, state.success]);

    return (
        <main
            dir={view.locale === "ar" ? "rtl" : "ltr"}
            className="min-h-screen bg-slate-950 px-5 py-16 text-slate-100"
        >
            <div className="mx-auto max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">{t.eyebrow}</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">{t.title}</h1>

                {state.message ? (
                    <div
                        role="status"
                        className={`mt-6 rounded-2xl border px-5 py-4 text-sm ${
                            state.success
                                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                                : "border-rose-400/30 bg-rose-400/10 text-rose-100"
                        }`}
                    >
                        {state.message}
                    </div>
                ) : null}

                <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
                    <h2 className="text-lg font-semibold">{view.serviceTitle}</h2>
                    <p className="mt-2 text-sm text-slate-300">
                        {t.current}: {formatter.format(new Date(view.scheduledStart))}
                    </p>
                    <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                        <div>
                            <dt className="text-slate-500">{t.reference}</dt>
                            <dd className="mt-1 font-mono text-slate-200">{view.publicReference}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">{t.status}</dt>
                            <dd className="mt-1 text-slate-200">{view.status.replaceAll("_", " ")}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">{t.email}</dt>
                            <dd className="mt-1 text-slate-200">{view.maskedEmail}</dd>
                        </div>
                    </dl>
                    {(view.joinUrl || view.locationName || view.locationInstructions || view.locationMode === "remote") ? (
                        <div className="mt-5 border-t border-white/10 pt-5 text-sm text-slate-300">
                            <p className="font-medium text-slate-100">
                                {view.joinUrl ? t.meeting : t.location}
                            </p>
                            {view.joinUrl ? (
                                <a
                                    href={view.joinUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-3 inline-flex rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
                                >
                                    {t.joinMeeting}
                                </a>
                            ) : view.locationMode === "remote" ? (
                                <p className="mt-2 leading-6">{t.meetingPending}</p>
                            ) : null}
                            {view.locationName ? <p className="mt-2 font-medium text-slate-100">{view.locationName}</p> : null}
                            {view.locationInstructions ? <p className="mt-2 whitespace-pre-line leading-6">{view.locationInstructions}</p> : null}
                        </div>
                    ) : null}
                </section>

                {view.canReschedule ? (
                    <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                        <h2 className="text-lg font-semibold">{t.reschedule}</h2>
                        {view.availableSlots.length > 0 ? (
                            <form action={formAction} className="mt-4 space-y-4">
                                <input type="hidden" name="operation" value="reschedule" />
                                <input type="hidden" name="token" value={token} />
                                <label className="block">
                                    <span className="sr-only">{t.reschedule}</span>
                                    <select
                                        name="scheduledStart"
                                        required
                                        defaultValue=""
                                        className="w-full rounded-xl border border-white/15 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300"
                                    >
                                        <option value="" disabled>{t.reschedule}</option>
                                        {view.availableSlots.map((slot) => (
                                            <option key={slot.start} value={slot.start}>
                                                {formatter.format(new Date(slot.start))} — {slot.requiresReview ? t.review : t.direct}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <button
                                    type="submit"
                                    disabled={pending}
                                    className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
                                >
                                    {t.rescheduleButton}
                                </button>
                            </form>
                        ) : (
                            <p className="mt-3 text-sm leading-6 text-slate-300">{t.noSlots}</p>
                        )}
                    </section>
                ) : null}

                {view.canCancel ? (
                    <section className="mt-6 rounded-3xl border border-rose-400/20 bg-rose-400/[0.05] p-6">
                        <h2 className="text-lg font-semibold">{t.cancelTitle}</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{t.cancelBody}</p>
                        <form
                            action={formAction}
                            className="mt-4"
                            onSubmit={(event) => {
                                if (!window.confirm(t.confirmCancel)) event.preventDefault();
                            }}
                        >
                            <input type="hidden" name="operation" value="cancel" />
                            <input type="hidden" name="token" value={token} />
                            <button
                                type="submit"
                                disabled={pending}
                                className="rounded-xl border border-rose-300/50 px-5 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/10 disabled:cursor-wait disabled:opacity-60"
                            >
                                {t.cancelButton}
                            </button>
                        </form>
                    </section>
                ) : (
                    <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-slate-300">
                        {view.policyReason}
                    </p>
                )}
            </div>
        </main>
    );
}
