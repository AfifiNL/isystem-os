"use client";

import React, { useEffect, useState } from "react";

import type { Locale } from "@/features/templates/types";

const copy = {
    en: {
        name: "Name",
        email: "Email",
        company: "Company",
        requestType: "What do you need help with?",
        challenge: "What is happening in the operation today?",
        consent: "I would like to receive marketing updates and resources from this workspace. I can unsubscribe at any time.",
        submit: "Send inquiry",
        sending: "Sending…",
        error: "We could not send your inquiry. Please try again.",
    },
    nl: {
        name: "Naam",
        email: "E-mailadres",
        company: "Bedrijf",
        requestType: "Waarmee kunnen we helpen?",
        challenge: "Wat gebeurt er vandaag in de operatie?",
        consent: "Ik ontvang graag marketingupdates en resources van deze organisatie. Ik kan mij altijd uitschrijven.",
        submit: "Verstuur aanvraag",
        sending: "Versturen…",
        error: "Uw aanvraag kon niet worden verzonden. Probeer het opnieuw.",
    },
    ar: {
        name: "الاسم",
        email: "البريد الإلكتروني",
        company: "الشركة",
        requestType: "كيف يمكننا مساعدتك؟",
        challenge: "ماذا يحدث في عملياتك اليوم؟",
        consent: "أرغب في تلقي التحديثات والموارد التسويقية من هذه المؤسسة. يمكنني إلغاء الاشتراك في أي وقت.",
        submit: "إرسال الطلب",
        sending: "جارٍ الإرسال…",
        error: "تعذر إرسال طلبك. يرجى المحاولة مرة أخرى.",
    },
} as const;

type PublicContactFormLabels = Partial<{
    name: string;
    email: string;
    company: string;
    phone: string;
    requestType: string;
    requestTypePlaceholder: string;
    requestTypeOptions: string[];
    challenge: string;
    challengePlaceholder: string;
    consent: string;
    submit: string;
    sending: string;
    error: string;
    success: string;
}>;

const initialForm = {
    name: "",
    email: "",
    company: "",
    phone: "",
    requestType: "",
    challenge: "",
    website: "",
    marketingConsent: false,
};

export function PublicContactForm({
    locale,
    templateId,
    labels,
}: {
    locale: Locale;
    templateId: string;
    labels?: PublicContactFormLabels;
}) {
    const t = copy[locale] ?? copy.en;
    const formCopy = { ...t, ...labels };
    const [form, setForm] = useState(initialForm);
    const [formStartedAt, setFormStartedAt] = useState("");
    const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
    const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    useEffect(() => setFormStartedAt(new Date().toISOString()), []);

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        if (status === "sending") return;
        setStatus("sending");
        setMessage("");

        try {
            const response = await fetch("/api/contact/submit", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ ...form, submissionId, formStartedAt, locale, templateId }),
            });
            const result = await response.json() as { message?: string; error?: string };
            if (!response.ok) throw new Error(result.error || formCopy.error);
            setStatus("success");
            setMessage(result.message || formCopy.success || "");
            setForm(initialForm);
            setFormStartedAt(new Date().toISOString());
            setSubmissionId(crypto.randomUUID());
        } catch (error) {
            setStatus("error");
            setMessage(error instanceof Error ? error.message : formCopy.error);
        }
    }

    const fieldClass = "w-full rounded-[var(--public-radius-sm)] border border-[var(--public-line)] bg-white px-4 py-3 text-[var(--public-ink)] outline-none transition focus:border-[var(--public-action)] focus:ring-2 focus:ring-[color-mix(in_oklch,var(--public-action)_20%,transparent)]";

    return (
        <form onSubmit={submit} className="mt-8 grid gap-5" dir={locale === "ar" ? "rtl" : "ltr"}>
            <div className="absolute h-px w-px overflow-hidden" aria-hidden="true">
                <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></label>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">{formCopy.name}<input required className={fieldClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
                <label className="grid gap-2 text-sm font-medium">{formCopy.email}<input required type="email" className={fieldClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
                <label className="grid gap-2 text-sm font-medium">{formCopy.company}<input className={fieldClass} value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} /></label>
                {formCopy.phone ? <label className="grid gap-2 text-sm font-medium">{formCopy.phone}<input type="tel" autoComplete="tel" className={fieldClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label> : null}
                <label className="grid gap-2 text-sm font-medium">
                    {formCopy.requestType}
                    {formCopy.requestTypeOptions && formCopy.requestTypeOptions.length > 0 ? (
                        <select className={fieldClass} value={form.requestType} onChange={(event) => setForm({ ...form, requestType: event.target.value })}>
                            <option value="" disabled>{formCopy.requestTypePlaceholder || formCopy.requestType}</option>
                            {formCopy.requestTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                    ) : (
                        <input className={fieldClass} placeholder={formCopy.requestTypePlaceholder} value={form.requestType} onChange={(event) => setForm({ ...form, requestType: event.target.value })} />
                    )}
                </label>
            </div>
            <label className="grid gap-2 text-sm font-medium">{formCopy.challenge}<textarea rows={5} className={fieldClass} placeholder={formCopy.challengePlaceholder} value={form.challenge} onChange={(event) => setForm({ ...form, challenge: event.target.value })} /></label>
            <label className="flex items-start gap-3 text-sm leading-6 text-[var(--public-secondary)]">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={form.marketingConsent} onChange={(event) => setForm({ ...form, marketingConsent: event.target.checked })} />
                <span>{formCopy.consent}</span>
            </label>
            {status === "success" && <p role="status" className="rounded-[var(--public-radius-sm)] bg-emerald-50 p-4 text-sm text-emerald-900">{message}</p>}
            {status === "error" && <p role="alert" className="rounded-[var(--public-radius-sm)] bg-red-50 p-4 text-sm text-red-900">{message}</p>}
            <button type="submit" disabled={status === "sending"} className="isystem-public-button w-fit disabled:cursor-wait disabled:opacity-60">
                {status === "sending" ? formCopy.sending : formCopy.submit}
            </button>
        </form>
    );
}
