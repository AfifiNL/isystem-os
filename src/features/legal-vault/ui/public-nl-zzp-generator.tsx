"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, Download, FileText, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { renderTemplate } from "@/features/legal-vault/lib/render-template";
import type { ToolLocale } from "@/features/tools/shared/types";
import { localizeHref } from "@/shared/lib/i18n/routing";
import {
    ToolField,
    ToolInput,
    ToolPanel,
    ToolPrimaryButton,
    ToolSecondaryButton,
    ToolTextarea,
} from "@/features/tools/shared/ui/primitives";

// Embedded DVO body — kept in sync with the system template seeded in
// supabase/migrations/20260518110000_legal_vault_system_templates.sql so the
// public lead-magnet output matches what operators get inside the dashboard.
const DVO_BODY = `## Dienstverleningsovereenkomst

**Tussen**

{{provider_name}}, gevestigd te {{provider_city}}, KvK-nummer {{provider_kvk}}, BTW-id {{provider_vat}} (hierna: **Opdrachtnemer**),

**en**

{{client_name}}, gevestigd te {{client_city}}, KvK-nummer {{client_kvk}} (hierna: **Opdrachtgever**).

### 1. Opdracht
Opdrachtnemer voert voor Opdrachtgever de volgende werkzaamheden uit: {{scope}}.

### 2. Aard van de overeenkomst
Deze overeenkomst is een opdracht in de zin van artikel 7:400 BW. Tussen partijen ontstaat geen arbeidsovereenkomst. Opdrachtnemer is vrij in de wijze waarop hij de werkzaamheden inricht en bepaalt zelfstandig zijn werktijden. Er is geen gezagsverhouding en Opdrachtnemer mag zich, na overleg, vrijelijk laten vervangen door een gekwalificeerde derde.

### 3. Duur en einde
De overeenkomst gaat in op {{effective_date}} en eindigt op {{expires_at}}, of zoveel eerder als de opdracht is voltooid. Elk der partijen kan met inachtneming van een opzegtermijn van {{notice_period_days}} dagen tussentijds opzeggen.

### 4. Vergoeding
Opdrachtgever betaalt een vergoeding van € {{rate_amount}} ({{rate_basis}}), exclusief 21 % BTW. Facturen worden maandelijks achteraf verzonden en zijn betaalbaar binnen {{payment_term_days}} dagen na factuurdatum.

### 5. Aansprakelijkheid
De aansprakelijkheid van Opdrachtnemer voor schade is beperkt tot het bedrag dat in het betreffende geval onder de beroepsaansprakelijkheidsverzekering van Opdrachtnemer wordt uitgekeerd, vermeerderd met het eigen risico. Indien om welke reden dan ook geen uitkering plaatsvindt, is de aansprakelijkheid beperkt tot het bedrag van de in het lopende kalenderjaar gefactureerde vergoeding, met een maximum van € 25.000.

### 6. Geheimhouding
Partijen verplichten zich tot geheimhouding van alle vertrouwelijke informatie die zij in het kader van deze overeenkomst van elkaar verkrijgen. Deze verplichting blijft van kracht tot vijf jaar na beëindiging van de overeenkomst.

### 7. Toepasselijk recht
Op deze overeenkomst is uitsluitend Nederlands recht van toepassing. Geschillen worden voorgelegd aan de bevoegde rechter in het arrondissement waar Opdrachtnemer is gevestigd.

---

**Opdrachtnemer:** {{provider_name}}
**Opdrachtgever:** {{client_name}}
**Datum:** {{effective_date}}`;

interface FieldConfig {
    key: string;
    label: Record<ToolLocale, string>;
    helper?: Record<ToolLocale, string>;
    type?: "text" | "textarea" | "date" | "number";
    required?: boolean;
    defaultValue?: string;
    placeholder?: Record<ToolLocale, string>;
}

const FIELDS: FieldConfig[] = [
    { key: "provider_name", label: { en: "Contractor name", nl: "Naam opdrachtnemer", ar: "اسم مقدم الخدمة" }, required: true, placeholder: { en: "e.g. Example Consulting B.V.", nl: "bijv. Voorbeeld Advies B.V.", ar: "مثال: شركة الاستشارات" } },
    { key: "provider_city", label: { en: "Contractor city", nl: "Vestigingsplaats opdrachtnemer", ar: "مدينة مقدم الخدمة" }, required: true, placeholder: { en: "Breda", nl: "Breda", ar: "Breda" } },
    { key: "provider_kvk", label: { en: "Contractor KvK number", nl: "KvK-nummer opdrachtnemer", ar: "رقم KvK لمقدم الخدمة" }, required: true },
    { key: "provider_vat", label: { en: "Contractor BTW-id", nl: "BTW-id opdrachtnemer", ar: "رقم BTW لمقدم الخدمة" }, required: true, placeholder: { en: "NL...B01", nl: "NL...B01", ar: "NL...B01" } },
    { key: "client_name", label: { en: "Client name", nl: "Naam opdrachtgever", ar: "اسم العميل" }, required: true },
    { key: "client_city", label: { en: "Client city", nl: "Vestigingsplaats opdrachtgever", ar: "مدينة العميل" }, required: true },
    { key: "client_kvk", label: { en: "Client KvK number", nl: "KvK-nummer opdrachtgever", ar: "رقم KvK للعميل" }, helper: { en: "Optional when the client has no KvK number.", nl: "Optioneel als de opdrachtgever geen KvK-nummer heeft.", ar: "اختياري إذا لم يكن لدى العميل رقم KvK." } },
    { key: "scope", label: { en: "Description of services", nl: "Omschrijving werkzaamheden", ar: "وصف الخدمات" }, type: "textarea", required: true, placeholder: { en: "Describe the deliverables, boundaries, and expected result.", nl: "Beschrijf de deliverables, grenzen en het verwachte resultaat.", ar: "صف المخرجات والحدود والنتيجة المتوقعة." } },
    { key: "effective_date", label: { en: "Start date", nl: "Ingangsdatum", ar: "تاريخ البدء" }, type: "date", required: true },
    { key: "expires_at", label: { en: "End date", nl: "Einddatum", ar: "تاريخ الانتهاء" }, type: "date", helper: { en: "Leave blank for an open-ended assignment.", nl: "Laat leeg voor een opdracht zonder vaste einddatum.", ar: "اتركه فارغًا لعقد غير محدد النهاية." } },
    { key: "notice_period_days", label: { en: "Notice period (days)", nl: "Opzegtermijn (dagen)", ar: "مهلة الإنهاء (أيام)" }, type: "number", defaultValue: "30" },
    { key: "rate_amount", label: { en: "Fee (EUR, excl. BTW)", nl: "Tarief (EUR, excl. BTW)", ar: "الأجر باليورو دون BTW" }, required: true, placeholder: { en: "120", nl: "120", ar: "120" } },
    { key: "rate_basis", label: { en: "Fee basis", nl: "Tariefbasis", ar: "أساس الأجر" }, defaultValue: "per uur", placeholder: { en: "per hour / per project", nl: "per uur / per project", ar: "بالساعة / بالمشروع" } },
    { key: "payment_term_days", label: { en: "Payment term (days)", nl: "Betalingstermijn (dagen)", ar: "مدة السداد (أيام)" }, type: "number", defaultValue: "14" },
];

const COPY: Record<ToolLocale, {
    progress: string;
    requiredComplete: (done: number, total: number) => string;
    formTitle: string;
    formBody: string;
    previewTitle: string;
    previewBody: string;
    primaryReady: string;
    primaryDisabled: string;
    secondary: string;
    managedLink: string;
    browserOnly: string;
    noSignup: string;
    wetDba: string;
    vat: string;
    disclaimer: string;
    overlayTitle: string;
    overlayBody: string;
    print: string;
    close: string;
    previewBadge: string;
    startDatePastError: string;
    endDatePastError: string;
    endBeforeStartError: string;
}> = {
    en: {
        progress: "Completion",
        requiredComplete: (done, total) => `${done}/${total} required fields complete`,
        formTitle: "Build the agreement",
        formBody: "Fill the commercial details once. The preview updates instantly and stays local to this browser session.",
        previewTitle: "Live agreement preview",
        previewBody: "The text below mirrors the downloadable version. Review names, dates, scope, fee basis, and payment terms before printing.",
        primaryReady: "Preview & save PDF",
        primaryDisabled: "Complete required fields",
        secondary: "Review full preview",
        managedLink: "Manage signing, retention, and bookkeeping in your workspace",
        browserOnly: "Browser-only rendering",
        noSignup: "No signup required",
        wetDba: "Wet DBA-aware clauses",
        vat: "21% BTW language",
        disclaimer: "Informational tool only; not legal advice. For client-specific clauses, e-signing, an audit trail, and seven-year retention, use a managed legal workspace or consult a Dutch legal professional.",
        overlayTitle: "Print-ready service agreement",
        overlayBody: "Use your browser's print dialog and choose “Save as PDF”.",
        print: "Print / save as PDF",
        close: "Close",
        previewBadge: "Generated locally",
        startDatePastError: "Start date cannot be in the past.",
        endDatePastError: "End date cannot be in the past.",
        endBeforeStartError: "End date cannot be before the start date.",
    },
    nl: {
        progress: "Voortgang",
        requiredComplete: (done, total) => `${done}/${total} verplichte velden ingevuld`,
        formTitle: "Bouw de overeenkomst",
        formBody: "Vul de commerciële gegevens één keer in. Het voorbeeld werkt direct bij en blijft lokaal in deze browsersessie.",
        previewTitle: "Live voorbeeld van de overeenkomst",
        previewBody: "De tekst hieronder is gelijk aan de printversie. Controleer namen, data, scope, tariefbasis en betaaltermijn voor je print.",
        primaryReady: "Bekijk & bewaar als PDF",
        primaryDisabled: "Vul verplichte velden in",
        secondary: "Bekijk volledig voorbeeld",
        managedLink: "Beheer ondertekening, bewaarplicht en boekhouding in je werkruimte",
        browserOnly: "Browser-only rendering",
        noSignup: "Geen registratie nodig",
        wetDba: "Wet DBA-bewuste clausules",
        vat: "21% BTW-taal",
        disclaimer: "Informatieve tool; geen juridisch advies. Voor klantspecifieke clausules, e-signing, een audit trail en zeven jaar bewaarplicht gebruik je een beheerde juridische werkruimte of raadpleeg je een Nederlandse jurist.",
        overlayTitle: "Printklare dienstverleningsovereenkomst",
        overlayBody: "Gebruik de printdialoog van je browser en kies “Bewaar als PDF”.",
        print: "Print / bewaar als PDF",
        close: "Sluiten",
        previewBadge: "Lokaal gegenereerd",
        startDatePastError: "Ingangsdatum mag niet in het verleden liggen.",
        endDatePastError: "Einddatum mag niet in het verleden liggen.",
        endBeforeStartError: "Einddatum mag niet vóór de ingangsdatum liggen.",
    },
    ar: {
        progress: "التقدّم",
        requiredComplete: (done, total) => `${done}/${total} حقول إلزامية مكتملة`,
        formTitle: "أنشئ العقد",
        formBody: "املأ التفاصيل التجارية مرة واحدة. تتحدّث المعاينة فورًا وتبقى محليًا في جلسة المتصفح هذه.",
        previewTitle: "معاينة مباشرة للعقد",
        previewBody: "النص أدناه يطابق نسخة الطباعة. راجع الأسماء والتواريخ والنطاق والأجر ومدة السداد قبل الطباعة.",
        primaryReady: "معاينة وحفظ PDF",
        primaryDisabled: "أكمل الحقول الإلزامية",
        secondary: "راجع المعاينة كاملة",
        managedLink: "أدر التوقيع والحفظ والمحاسبة داخل مساحة عملك",
        browserOnly: "يعمل داخل المتصفح فقط",
        noSignup: "لا يحتاج تسجيلًا",
        wetDba: "بنود تراعي Wet DBA",
        vat: "صياغة BTW 21٪",
        disclaimer: "أداة معلوماتية فقط وليست نصيحة قانونية. للبنود الخاصة بالعميل والتوقيع الإلكتروني وسجل التدقيق والحفظ لسبع سنوات، استخدم مساحة عمل قانونية مُدارة أو استشر مختصًا قانونيًا هولنديًا.",
        overlayTitle: "عقد خدمات جاهز للطباعة",
        overlayBody: "استخدم نافذة الطباعة في المتصفح واختر “Save as PDF”.",
        print: "طباعة / حفظ PDF",
        close: "إغلاق",
        previewBadge: "مولّد محليًا",
        startDatePastError: "لا يمكن أن يكون تاريخ البدء في الماضي.",
        endDatePastError: "لا يمكن أن يكون تاريخ الانتهاء في الماضي.",
        endBeforeStartError: "لا يمكن أن يكون تاريخ الانتهاء قبل تاريخ البدء.",
    },
};

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

export function NlZzpAgreementGenerator({ locale = "en" }: { locale?: ToolLocale }) {
    const copy = COPY[locale];
    const [values, setValues] = useState<Record<string, string>>(() => {
        const init: Record<string, string> = {};
        for (const f of FIELDS) init[f.key] = f.defaultValue ?? "";
        return init;
    });
    const [showPreview, setShowPreview] = useState(false);
    const minDate = useMemo(() => todayIso(), []);
    const dateErrors = useMemo(() => {
        const errors: Record<string, string> = {};
        const start = values.effective_date;
        const end = values.expires_at;

        if (start && start < minDate) {
            errors.effective_date = copy.startDatePastError;
        }
        if (end && end < minDate) {
            errors.expires_at = copy.endDatePastError;
        } else if (start && end && end < start) {
            errors.expires_at = copy.endBeforeStartError;
        }

        return errors;
    }, [copy.endBeforeStartError, copy.endDatePastError, copy.startDatePastError, minDate, values.effective_date, values.expires_at]);
    const effectiveMinDate = values.effective_date && values.effective_date > minDate ? values.effective_date : minDate;

    const filledOut = useMemo(
        () => FIELDS.filter((f) => f.required).every((f) => (values[f.key] ?? "").trim().length > 0) && Object.keys(dateErrors).length === 0,
        [dateErrors, values],
    );
    const requiredFields = FIELDS.filter((f) => f.required);
    const completedRequired = requiredFields.filter((f) => (values[f.key] ?? "").trim().length > 0).length;
    const completionPercent = Math.round((completedRequired / requiredFields.length) * 100);

    const renderedHtml = useMemo(
        () => htmlFromMarkdown(renderTemplate(DVO_BODY, values)),
        [values],
    );

    function update(key: string, value: string) {
        setValues((prev) => ({ ...prev, [key]: value }));
    }

    return (
        <div className="space-y-6">
            <ToolPanel tone="highlight" hideOnPrint className="relative overflow-hidden">
                <div className="grid gap-4 sm:grid-cols-4">
                    {[
                        { icon: LockKeyhole, label: copy.browserOnly },
                        { icon: BadgeCheck, label: copy.noSignup },
                        { icon: ShieldCheck, label: copy.wetDba },
                        { icon: FileText, label: copy.vat },
                    ].map((item) => {
                        const Icon = item.icon;
                        return (
                            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <Icon className="size-5 text-cyan-200" aria-hidden />
                                <p className="mt-3 text-sm font-semibold leading-snug text-white">{item.label}</p>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                        <span>{copy.progress}</span>
                        <span>{completionPercent}%</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.65)] transition-all" style={{ width: `${completionPercent}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-white">{copy.requiredComplete(completedRequired, requiredFields.length)}</p>
                </div>
            </ToolPanel>

            <div className="grid gap-6 xl:grid-cols-[minmax(560px,0.95fr)_minmax(520px,1.05fr)] xl:items-start">
                <ToolPanel hideOnPrint>
                    <div className="mb-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{copy.formTitle}</p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-300">{copy.formBody}</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        {FIELDS.map((field) => (
                            <Field
                                key={field.key}
                                config={field}
                                locale={locale}
                                minDate={minDate}
                                effectiveMinDate={effectiveMinDate}
                                error={dateErrors[field.key]}
                                value={values[field.key] ?? ""}
                                onChange={(v) => update(field.key, v)}
                            />
                        ))}
                    </div>

                    <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                        <ToolPrimaryButton
                            type="button"
                            onClick={() => setShowPreview(true)}
                            disabled={!filledOut}
                            iconLeft={<Download className="size-4" aria-hidden />}
                        >
                            {filledOut ? copy.primaryReady : copy.primaryDisabled}
                        </ToolPrimaryButton>
                        <ToolSecondaryButton
                            type="button"
                            onClick={() => setShowPreview(true)}
                            iconLeft={<FileText className="size-4" aria-hidden />}
                        >
                            {copy.secondary}
                        </ToolSecondaryButton>
                    </div>

                    <Link
                        href={localizeHref(locale, "/booking")}
                        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 transition-colors hover:text-cyan-200"
                    >
                        {copy.managedLink} <ArrowRight className="size-4" aria-hidden />
                    </Link>
                    <p className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-xs leading-relaxed text-amber-100">
                        {copy.disclaimer}
                    </p>
                </ToolPanel>

                <ToolPanel className="xl:sticky xl:top-6 xl:self-start">
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{copy.previewTitle}</p>
                            <p className="mt-2 text-sm leading-relaxed text-slate-300">{copy.previewBody}</p>
                        </div>
                        <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold text-emerald-200 sm:inline-flex">
                            <CheckCircle2 className="size-3.5" aria-hidden /> {copy.previewBadge}
                        </span>
                    </div>
                    <div tabIndex={0} className="max-h-[760px] overflow-y-auto rounded-2xl border border-white/10 bg-white p-5 text-slate-950 shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50">
                        <article
                            className="prose prose-sm max-w-none prose-headings:text-slate-950 prose-p:text-slate-700 prose-strong:text-slate-950"
                            dangerouslySetInnerHTML={{ __html: renderedHtml }}
                        />
                    </div>
                </ToolPanel>
            </div>

            {showPreview ? (
                <PrintOverlay html={renderedHtml} locale={locale} onClose={() => setShowPreview(false)} />
            ) : null}
        </div>
    );
}

function Field({
    config,
    locale,
    minDate,
    effectiveMinDate,
    error,
    value,
    onChange,
}: {
    config: FieldConfig;
    locale: ToolLocale;
    minDate: string;
    effectiveMinDate: string;
    error?: string;
    value: string;
    onChange: (value: string) => void;
}) {
    const id = `zzp-${config.key}`;
    const dateMin = config.type === "date" ? (config.key === "expires_at" ? effectiveMinDate : minDate) : undefined;
    return (
        <div className={config.type === "textarea" ? "sm:col-span-2" : undefined}>
            <ToolField
                label={`${config.label[locale]}${config.required ? " *" : ""}`}
                helper={config.helper?.[locale]}
                htmlFor={id}
            >
                {config.type === "textarea" ? (
                    <ToolTextarea
                        id={id}
                        rows={4}
                        value={value}
                        placeholder={config.placeholder?.[locale]}
                        onChange={(e) => onChange(e.target.value)}
                    />
                ) : config.type === "date" ? (
                    <div className="group relative">
                        <ToolInput
                            id={id}
                            type="date"
                            value={value}
                            min={dateMin}
                            aria-invalid={error ? true : undefined}
                            className="min-h-12 cursor-pointer pr-12 text-slate-100 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-12 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                            onChange={(e) => onChange(e.target.value)}
                        />
                        <CalendarDays
                            className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-cyan-200 transition-colors group-focus-within:text-cyan-100 group-hover:text-cyan-100"
                            aria-hidden
                        />
                    </div>
                ) : (
                    <ToolInput
                        id={id}
                        type={config.type ?? "text"}
                        value={value}
                        placeholder={config.placeholder?.[locale]}
                        onChange={(e) => onChange(e.target.value)}
                    />
                )}
            </ToolField>
            {error ? <p className="mt-1.5 text-xs font-medium text-rose-200">{error}</p> : null}
        </div>
    );
}

function PrintOverlay({ html, locale, onClose }: { html: string; locale: ToolLocale; onClose: () => void }) {
    const copy = COPY[locale];
    const overlay = (
        <div
            className="zzp-print-root fixed inset-x-0 bottom-0 top-20 z-[120] flex items-start justify-center overflow-y-auto bg-slate-950/85 p-4 backdrop-blur-sm sm:top-24 print:static print:block print:bg-white print:p-0"
            onClick={onClose}
        >
            <style jsx global>{`
                @media print {
                    @page {
                        margin: 14mm 16mm;
                        size: A4;
                    }

                    html,
                    body {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        min-height: auto !important;
                        overflow: visible !important;
                        background: #fff !important;
                    }

                    body > *:not(.zzp-print-root) {
                        display: none !important;
                    }

                    .zzp-print-root,
                    .zzp-print-root * {
                        box-shadow: none !important;
                    }

                    .zzp-print-root {
                        display: block !important;
                        position: static !important;
                        inset: auto !important;
                        width: 100% !important;
                        min-height: auto !important;
                        height: auto !important;
                        overflow: visible !important;
                        padding: 0 !important;
                        background: #fff !important;
                        backdrop-filter: none !important;
                    }

                    .zzp-print-shell {
                        display: block !important;
                        width: 100% !important;
                        max-width: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        border: 0 !important;
                        border-radius: 0 !important;
                        box-shadow: none !important;
                        background: #fff !important;
                    }

                    .zzp-contract-print {
                        display: block !important;
                        color: #0f172a !important;
                        font-family: Georgia, "Times New Roman", serif !important;
                        font-size: 11pt !important;
                        line-height: 1.58 !important;
                        max-width: none !important;
                        margin: 0 !important;
                    }

                    .zzp-contract-print > h2:first-child {
                        margin: 0 0 12mm !important;
                        color: #020617 !important;
                        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
                        font-size: 22pt !important;
                        line-height: 1.15 !important;
                        break-after: avoid-page !important;
                        page-break-after: avoid !important;
                    }

                    .zzp-contract-print h2,
                    .zzp-contract-print h3 {
                        margin: 8mm 0 3mm !important;
                        color: #020617 !important;
                        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
                        font-size: 13pt !important;
                        line-height: 1.25 !important;
                        break-after: avoid-page !important;
                        page-break-after: avoid !important;
                    }

                    .zzp-contract-print p {
                        margin: 0 0 4mm !important;
                        color: #1e293b !important;
                        break-inside: avoid-page;
                        page-break-inside: avoid;
                        orphans: 3;
                        widows: 3;
                    }

                    .zzp-contract-print strong {
                        color: #020617 !important;
                    }

                    .zzp-contract-print hr {
                        margin: 10mm 0 6mm !important;
                        border: 0 !important;
                        border-top: 1px solid #cbd5e1 !important;
                        break-after: avoid-page !important;
                        page-break-after: avoid !important;
                    }
                }
            `}</style>
            <div
                className="zzp-print-shell w-full max-w-3xl rounded-3xl bg-white p-5 text-black shadow-[0_30px_120px_rgba(0,0,0,0.45)] sm:p-8 print:m-0 print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="sticky top-0 z-10 mb-6 flex flex-col gap-4 border-b border-slate-200 bg-white/95 pb-5 pt-1 backdrop-blur print:hidden sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Legal workspace</p>
                        <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">{copy.overlayTitle}</h2>
                        <p className="mt-1 text-sm text-slate-600">{copy.overlayBody}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-cyan-500 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
                        >
                            <Download className="size-4" aria-hidden /> {copy.print}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            <X className="size-4" aria-hidden /> {copy.close}
                        </button>
                    </div>
                </div>
                <article
                    className="zzp-contract-print prose prose-sm max-w-none prose-headings:text-slate-950 prose-p:text-slate-700 prose-strong:text-slate-950"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </div>
        </div>
    );

    if (typeof document === "undefined") {
        return null;
    }

    return createPortal(overlay, document.body);
}

function htmlFromMarkdown(input: string): string {
    const lines = input.split(/\r?\n/);
    const out: string[] = [];
    for (const raw of lines) {
        const line = raw.trimEnd();
        if (/^#{1,6}\s/.test(line)) {
            const level = (line.match(/^#+/) ?? [""])[0].length;
            out.push(`<h${level}>${inlineFormat(line.replace(/^#+\s*/, ""))}</h${level}>`);
        } else if (line === "---") {
            out.push("<hr />");
        } else if (line.trim() === "") {
            out.push("");
        } else {
            out.push(`<p>${inlineFormat(line)}</p>`);
        }
    }
    return out.join("\n");
}

function inlineFormat(value: string): string {
    return value
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`([^`]+)`/g, "<code>$1</code>");
}
