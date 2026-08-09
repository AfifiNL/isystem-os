"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarCheck, CheckCircle2, Clock4, Gauge, Loader2, Sparkles } from "lucide-react";
import { runAutomationScanner } from "./actions";
import {
    INDUSTRY_OPTIONS,
    RECURRING_TASK_OPTIONS,
    TEAM_SIZE_OPTIONS,
    type AutomationScannerInput,
} from "./schema";
import type { AutomationScannerResult } from "./scoring";
import { EmailGate } from "../shared/ui/EmailGate";
import { ToolUnlockModal } from "../shared/ui/ToolUnlockModal";
import { useToolUnlock } from "../shared/use-tool-unlock";
import { HoneypotField, useFormStartedAt } from "../shared/ui/anti-abuse-fields";
import { getToolClientStrings } from "../shared/client-i18n";
import { getToolsChrome } from "../shared/i18n";
import type { ToolLocale } from "../shared/types";
import {
    ToolCheckboxButton,
    ToolField,
    ToolInput,
    ToolPanel,
    ToolPrimaryButton,
    ToolPrintSummary,
    ToolRange,
    ToolResultCallout,
    ToolSecondaryButton,
    ToolSegmented,
    ToolSelect,
    ToolStatTile,
} from "../shared/ui/primitives";

const INDUSTRY_LABEL: Record<ToolLocale, Record<(typeof INDUSTRY_OPTIONS)[number], string>> = {
    en: {
        agency: "Agency / consultancy", ecommerce: "E-commerce", consultant: "Independent consultant",
        "real-estate": "Real estate", "law-firm": "Law firm", "dental-clinic": "Dental / medical clinic",
        restaurant: "Restaurant / hospitality", saas: "SaaS / tech", trades: "Trades / field services", other: "Other",
    },
    nl: {
        agency: "Agency / consultancy", ecommerce: "E-commerce", consultant: "Zelfstandig consultant",
        "real-estate": "Vastgoed", "law-firm": "Advocatenkantoor", "dental-clinic": "Tandarts / medische kliniek",
        restaurant: "Horeca", saas: "SaaS / tech", trades: "Vakman / field services", other: "Anders",
    },
    ar: {
        agency: "وكالة / استشارة", ecommerce: "تجارة إلكترونية", consultant: "مستشار مستقل",
        "real-estate": "عقارات", "law-firm": "مكتب محاماة", "dental-clinic": "عيادة أسنان / طبية",
        restaurant: "مطاعم / ضيافة", saas: "SaaS / تقنية", trades: "حِرَف / خدمات ميدانية", other: "غير ذلك",
    },
};

const TASK_LABEL: Record<ToolLocale, Record<(typeof RECURRING_TASK_OPTIONS)[number], string>> = {
    en: { "lead-intake": "Lead intake", scheduling: "Scheduling", invoicing: "Invoicing", quotes: "Quotes", support: "Support", reviews: "Reviews", "social-posting": "Social posting", "report-building": "Reporting", "data-entry": "Data entry", onboarding: "Onboarding" },
    nl: { "lead-intake": "Lead intake", scheduling: "Planning", invoicing: "Facturatie", quotes: "Offertes", support: "Support", reviews: "Reviews", "social-posting": "Socials", "report-building": "Rapportage", "data-entry": "Data-entry", onboarding: "Onboarding" },
    ar: { "lead-intake": "استقبال العملاء", scheduling: "الجدولة", invoicing: "الفوترة", quotes: "العروض", support: "الدعم", reviews: "التقييمات", "social-posting": "النشر الاجتماعي", "report-building": "التقارير", "data-entry": "إدخال البيانات", onboarding: "تأهيل العملاء" },
};

interface FormState extends AutomationScannerInput {
    currentStackRaw: string;
}

const INITIAL: Record<ToolLocale, FormState> = {
    en: { industry: "agency", teamSize: "2-5", monthlyLeads: 50, avgHourlyCostEur: 45, repetitiveHoursPerWeek: 12, monthlyCustomerInquiries: 120, repeatedQuestionsPercent: 60, currentStack: [], currentStackRaw: "", recurringTasks: ["lead-intake", "support"], biggestPainPoint: "Lead follow-up is inconsistent and we drop deals when we get busy.", techComfort: "medium" },
    nl: { industry: "agency", teamSize: "2-5", monthlyLeads: 50, avgHourlyCostEur: 45, repetitiveHoursPerWeek: 12, monthlyCustomerInquiries: 120, repeatedQuestionsPercent: 60, currentStack: [], currentStackRaw: "", recurringTasks: ["lead-intake", "support"], biggestPainPoint: "Lead-opvolging is inconsistent en we verliezen deals als het druk wordt.", techComfort: "medium" },
    ar: { industry: "agency", teamSize: "2-5", monthlyLeads: 50, avgHourlyCostEur: 45, repetitiveHoursPerWeek: 12, monthlyCustomerInquiries: 120, repeatedQuestionsPercent: 60, currentStack: [], currentStackRaw: "", recurringTasks: ["lead-intake", "support"], biggestPainPoint: "متابعة العملاء غير منتظمة ونفقد صفقات حين ينشغل الفريق.", techComfort: "medium" },
};

function fmt(n: number): string {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n));
}

function difficultyAccent(d: "easy" | "medium" | "hard"): string {
    return d === "easy"
        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
        : d === "medium"
            ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
            : "border-rose-400/40 bg-rose-400/10 text-rose-200";
}

interface Props { locale: ToolLocale }

export function AutomationScannerClient({ locale }: Props) {
    const t = getToolClientStrings(locale);
    const [form, setForm] = useState<FormState>(INITIAL[locale]);
    const [result, setResult] = useState<AutomationScannerResult | null>(null);
    const [leadId, setLeadId] = useState<string | null>(null);
    const [shareToken, setShareToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const [honeypot, setHoneypot] = useState("");
    const formStartedAt = useFormStartedAt();

    const shareUrl = useMemo(
        () => (shareToken && typeof window !== "undefined" ? `${window.location.origin}/tools/share/${shareToken}` : undefined),
        [shareToken],
    );

    function toggleTask(taskId: (typeof RECURRING_TASK_OPTIONS)[number]) {
        setForm((prev) => ({
            ...prev,
            recurringTasks: prev.recurringTasks.includes(taskId)
                ? prev.recurringTasks.filter((task) => task !== taskId)
                : [...prev.recurringTasks, taskId],
        }));
    }

    const unlock = useToolUnlock(runAutomationScanner);

    function processResult(res: Awaited<ReturnType<typeof runAutomationScanner>>) {
        if (!res.ok || !res.data) {
            // requiresSubscription opens the modal automatically inside the
            // hook; we only render the inline error for other failures.
            if (!res.requiresSubscription) setError(res.error ?? t.networkError);
            return;
        }
        setError(null);
        setResult(res.data.result);
        setLeadId(res.data.leadId);
        setShareToken(res.data.shareToken);
        window.scrollTo({ top: window.scrollY + 200, behavior: "smooth" });
    }

    // Route post-unlock retry results back through the same handler so the
    // user lands on results without a second click after subscribing.
    useEffect(() => unlock.onResult(processResult),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [unlock]
    );

    function submit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        const currentStack = form.currentStackRaw
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 20);
        const payload: AutomationScannerInput = {
            industry: form.industry,
            teamSize: form.teamSize,
            monthlyLeads: form.monthlyLeads,
            avgHourlyCostEur: form.avgHourlyCostEur,
            repetitiveHoursPerWeek: form.repetitiveHoursPerWeek,
            monthlyCustomerInquiries: form.monthlyCustomerInquiries,
            repeatedQuestionsPercent: form.repeatedQuestionsPercent,
            currentStack,
            recurringTasks: form.recurringTasks,
            biggestPainPoint: form.biggestPainPoint,
            techComfort: form.techComfort,
            website: honeypot,
            formStartedAt,
        };
        startTransition(async () => {
            const res = await unlock.run(payload);
            processResult(res);
        });
    }

    const unlockModal = (
        <ToolUnlockModal
            open={unlock.modalOpen}
            tool="automation-scanner"
            toolName="Automation Scanner"
            locale={locale}
            onClose={unlock.closeModal}
            onUnlocked={unlock.retryAfterUnlock}
        />
    );

    if (result) {
        return (
            <>
                <ScannerResultView
                    locale={locale}
                    result={result}
                    leadId={leadId}
                    shareUrl={shareUrl}
                    onReset={() => {
                        setResult(null);
                        setLeadId(null);
                        setShareToken(null);
                    }}
                />
                {unlockModal}
            </>
        );
    }

    return (
        <ToolPanel hideOnPrint>
            {unlockModal}
            <form onSubmit={submit} className="relative space-y-6">
                <HoneypotField value={honeypot} onChange={setHoneypot} />
                <div className="grid gap-4 sm:grid-cols-2">
                    <ToolField label={t.industry} htmlFor="scanner-industry">
                        <ToolSelect
                            id="scanner-industry"
                            value={form.industry}
                            onChange={(e) => setForm({ ...form, industry: e.target.value as FormState["industry"] })}
                        >
                            {INDUSTRY_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>{INDUSTRY_LABEL[locale][opt]}</option>
                            ))}
                        </ToolSelect>
                    </ToolField>
                    <ToolField label={t.teamSize}>
                        <ToolSegmented
                            value={form.teamSize}
                            onChange={(v) => setForm({ ...form, teamSize: v })}
                            options={TEAM_SIZE_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
                        />
                    </ToolField>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <ToolField label={t.monthlyLeads} helper={t.monthlyLeadsHelper} htmlFor="scanner-leads">
                        <ToolInput id="scanner-leads" type="number" min={0} max={50000}
                            value={form.monthlyLeads}
                            onChange={(e) => setForm({ ...form, monthlyLeads: Number(e.target.value) })} />
                    </ToolField>
                    <ToolField label={t.avgHourlyCost} helper={t.avgHourlyCostHelper} htmlFor="scanner-rate">
                        <ToolInput id="scanner-rate" type="number" min={5} max={500}
                            value={form.avgHourlyCostEur}
                            onChange={(e) => setForm({ ...form, avgHourlyCostEur: Number(e.target.value) })} />
                    </ToolField>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <ToolField label={t.repetitiveHours} helper={t.repetitiveHoursHelper} htmlFor="scanner-hours">
                        <ToolInput id="scanner-hours" type="number" min={0} max={200}
                            value={form.repetitiveHoursPerWeek}
                            onChange={(e) => setForm({ ...form, repetitiveHoursPerWeek: Number(e.target.value) })} />
                    </ToolField>
                    <ToolField label={t.monthlyCustomerInquiries} helper={t.monthlyCustomerInquiriesHelper} htmlFor="scanner-inq">
                        <ToolInput id="scanner-inq" type="number" min={0} max={50000}
                            value={form.monthlyCustomerInquiries}
                            onChange={(e) => setForm({ ...form, monthlyCustomerInquiries: Number(e.target.value) })} />
                    </ToolField>
                </div>

                <ToolRange
                    label={t.repeatedQuestionsPercent}
                    helper={t.repeatedQuestionsHelper}
                    value={form.repeatedQuestionsPercent}
                    onChange={(v) => setForm({ ...form, repeatedQuestionsPercent: v })}
                    min={0} max={100} step={5} suffix="%"
                />

                <ToolField label={t.recurringTasks}>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                        {RECURRING_TASK_OPTIONS.map((task) => (
                            <ToolCheckboxButton
                                key={task}
                                checked={form.recurringTasks.includes(task)}
                                onChange={() => toggleTask(task)}
                            >
                                <span className="flex items-center gap-1.5">
                                    {form.recurringTasks.includes(task) ? (
                                        <CheckCircle2 className="size-3.5 text-cyan-300" aria-hidden />
                                    ) : (
                                        <span className="size-3.5 rounded-full border border-white/20" aria-hidden />
                                    )}
                                    {TASK_LABEL[locale][task]}
                                </span>
                            </ToolCheckboxButton>
                        ))}
                    </div>
                </ToolField>

                <ToolField label={t.currentTools} htmlFor="scanner-stack">
                    <ToolInput id="scanner-stack" type="text" value={form.currentStackRaw}
                        onChange={(e) => setForm({ ...form, currentStackRaw: e.target.value })}
                        placeholder="HubSpot, Gmail, Slack, Notion…" maxLength={400} />
                </ToolField>

                <ToolField label={t.techComfort}>
                    <ToolSegmented
                        value={form.techComfort}
                        onChange={(v) => setForm({ ...form, techComfort: v })}
                        options={[
                            { value: "low", label: t.techLow },
                            { value: "medium", label: t.techMedium },
                            { value: "high", label: t.techHigh },
                        ]}
                    />
                </ToolField>

                {error ? (
                    <p role="alert" className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>
                ) : null}

                <div className="flex flex-col items-start gap-2">
                    <ToolPrimaryButton
                        type="submit"
                        disabled={pending}
                        iconLeft={pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                        iconRight={!pending ? <ArrowRight className="size-4" aria-hidden /> : null}
                    >
                        {pending ? t.generatingRoadmap : t.generateRoadmap}
                    </ToolPrimaryButton>
                </div>
            </form>
        </ToolPanel>
    );
}

function ScannerResultView({
    locale,
    result,
    leadId,
    shareUrl,
    onReset,
}: {
    locale: ToolLocale;
    result: AutomationScannerResult;
    leadId: string | null;
    shareUrl: string | undefined;
    onReset: () => void;
}) {
    const t = getToolClientStrings(locale);
    const chrome = getToolsChrome(locale).stat;
    return (
        <div className="space-y-6">
            <ToolResultCallout eyebrow={t.yourRoadmap} headline={t.topAutomations}>
                <div className="grid gap-4 sm:grid-cols-3">
                    <ToolStatTile label={chrome.readiness} value={`${result.readinessScore}/100`} hint={result.readinessLabel} accent="cyan" />
                    <ToolStatTile label={chrome.hoursPerMonth} value={`${fmt(result.monthlyHoursReclaimable)}h`} accent="violet" />
                    <ToolStatTile label={chrome.yearlySavings} value={`€${fmt(result.yearlyEurReclaimable)}`} hint={`€${fmt(result.monthlyEurSaved)} / mo`} accent="cyan" />
                </div>
            </ToolResultCallout>

            <ToolPanel>
                <div className="mb-4 flex items-center gap-2 text-cyan-300">
                    <Sparkles className="size-4" aria-hidden />
                    <span className="text-xs font-semibold uppercase tracking-[0.18em]">{t.topAutomations}</span>
                </div>
                <h2 className="text-xl font-bold text-white print:text-slate-900">{t.rankedBySavings}</h2>
                <ol className="mt-5 space-y-3">
                    {result.recommendations.map((rec, idx) => (
                        <li key={rec.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 print:border-slate-300 print:bg-white">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-white print:text-slate-900">
                                        <span className="text-cyan-300 print:text-slate-700">{idx + 1}.</span> {rec.title}
                                    </p>
                                    <p className="mt-1 text-sm leading-relaxed text-slate-300 print:text-slate-700">{rec.summary}</p>
                                </div>
                                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wider ${difficultyAccent(rec.difficulty)} print:bg-slate-100 print:text-slate-700 print:border-slate-300`}>
                                    {rec.difficulty}
                                </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-3 text-xs">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400/10 px-2.5 py-1 text-cyan-200 print:bg-slate-100 print:text-slate-700">
                                    <Clock4 className="size-3" aria-hidden /> {fmt(rec.monthlyHoursSaved)}h / mo
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-400/10 px-2.5 py-1 text-violet-200 print:bg-slate-100 print:text-slate-700">
                                    <BadgeCheck className="size-3" aria-hidden /> €{fmt(rec.monthlyEurSaved)} / mo
                                </span>
                            </div>
                        </li>
                    ))}
                </ol>
                <p className="mt-5 rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-4 text-sm leading-relaxed text-cyan-100 print:border-slate-300 print:bg-slate-50 print:text-slate-900">
                    <Gauge className="mb-1 inline-block size-4" aria-hidden /> {result.stackSummary}
                </p>
            </ToolPanel>

            <EmailGate leadId={leadId} locale={locale} shareUrl={shareUrl} />

            <div className="flex flex-wrap items-center gap-3 print:hidden">
                <Link
                    href="/booking"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-cyan-500 px-7 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.35)] transition-all hover:bg-cyan-400 hover:shadow-[0_0_36px_rgba(6,182,212,0.55)]"
                >
                    <CalendarCheck className="size-4" aria-hidden /> {t.bookFreeAudit}
                </Link>
                <ToolSecondaryButton type="button" onClick={onReset}>
                    {t.runDifferent}
                </ToolSecondaryButton>
            </div>

            <ToolPrintSummary title="iSystem.ai">
                <p>
                            {t.score} <strong>{result.readinessScore}/100</strong> · €{fmt(result.monthlyEurSaved)} / mo · €{fmt(result.yearlyEurReclaimable)} / year.
                </p>
                <ol className="mt-3 list-decimal pl-5">
                    {result.recommendations.map((rec) => (
                        <li key={rec.id} className="mt-1">
                            <strong>{rec.title}</strong> — €{fmt(rec.monthlyEurSaved)}/mo · {rec.difficulty}
                        </li>
                    ))}
                </ol>
                <p className="mt-3">{result.stackSummary}</p>
            </ToolPrintSummary>
        </div>
    );
}
