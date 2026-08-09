"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, Cpu, Loader2, Rocket, TrendingUp } from "lucide-react";
import { runStackRecommender } from "./actions";
import { ToolUnlockModal } from "../shared/ui/ToolUnlockModal";
import { useToolUnlock } from "../shared/use-tool-unlock";
import { STACK_INDUSTRIES, STACK_PAINS, type StackInput, type StackRecommendation, type StackTier } from "./catalog";
import { AFFILIATES } from "../shared/affiliates";
import { EmailGate } from "../shared/ui/EmailGate";
import { HoneypotField, useFormStartedAt } from "../shared/ui/anti-abuse-fields";
import { getToolClientStrings } from "../shared/client-i18n";
import type { ToolLocale } from "../shared/types";
import {
    ToolCheckboxButton,
    ToolField,
    ToolPanel,
    ToolPrimaryButton,
    ToolPrintSummary,
    ToolRange,
    ToolResultCallout,
    ToolSegmented,
    ToolSelect,
} from "../shared/ui/primitives";

const INDUSTRY_LABEL: Record<ToolLocale, Record<(typeof STACK_INDUSTRIES)[number], string>> = {
    en: { agency: "Agency / consultancy", consultant: "Independent consultant", ecommerce: "E-commerce", "real-estate": "Real estate", "law-firm": "Law firm", "dental-clinic": "Dental / medical", restaurant: "Restaurant", saas: "SaaS / tech", trades: "Trades / field service", other: "Other" },
    nl: { agency: "Agency / consultancy", consultant: "Zelfstandig consultant", ecommerce: "E-commerce", "real-estate": "Vastgoed", "law-firm": "Advocatenkantoor", "dental-clinic": "Tandarts / medisch", restaurant: "Restaurant", saas: "SaaS / tech", trades: "Vakman / field service", other: "Anders" },
    ar: { agency: "وكالة / استشارة", consultant: "مستشار مستقل", ecommerce: "تجارة إلكترونية", "real-estate": "عقارات", "law-firm": "مكتب محاماة", "dental-clinic": "أسنان / طبي", restaurant: "مطعم", saas: "SaaS / تقنية", trades: "حِرَف / خدمات ميدانية", other: "غير ذلك" },
};

const PAIN_LABEL: Record<ToolLocale, Record<(typeof STACK_PAINS)[number], string>> = {
    en: { "lead-gen": "Lead generation", support: "Customer support", content: "Content / SEO", scheduling: "Scheduling", reporting: "Reporting", compliance: "GDPR / compliance", "sales-followup": "Sales follow-up", ops: "Internal ops" },
    nl: { "lead-gen": "Leadgeneratie", support: "Klantsupport", content: "Content / SEO", scheduling: "Planning", reporting: "Rapportage", compliance: "GDPR / compliance", "sales-followup": "Sales-opvolging", ops: "Interne operatie" },
    ar: { "lead-gen": "توليد العملاء", support: "دعم العملاء", content: "المحتوى / SEO", scheduling: "الجدولة", reporting: "التقارير", compliance: "GDPR / الامتثال", "sales-followup": "متابعة المبيعات", ops: "العمليات الداخلية" },
};

const TIER_ICON: Record<StackTier["label"], React.ReactNode> = {
    Starter: <Rocket className="size-5 text-cyan-300" aria-hidden />,
    Growth: <TrendingUp className="size-5 text-cyan-300" aria-hidden />,
    Automation: <Cpu className="size-5 text-cyan-300" aria-hidden />,
};

export function StackRecommenderClient({ locale }: { locale: ToolLocale }) {
    const t = getToolClientStrings(locale);
    const [form, setForm] = useState<StackInput>({
        industry: "agency",
        teamSize: "2-5",
        monthlyBudgetEur: 300,
        pains: ["lead-gen", "sales-followup"],
        techComfort: "medium",
    });
    const [result, setResult] = useState<StackRecommendation | null>(null);
    const [leadId, setLeadId] = useState<string | null>(null);
    const [shareToken, setShareToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const [honeypot, setHoneypot] = useState("");
    const formStartedAt = useFormStartedAt();

    const unlock = useToolUnlock(runStackRecommender);

    function processResult(res: Awaited<ReturnType<typeof runStackRecommender>>) {
        if (!res.ok || !res.data) {
            if (!res.requiresSubscription) setError(res.error ?? "Could not recommend a stack.");
            return;
        }
        setError(null);
        setResult(res.data.result);
        setLeadId(res.data.leadId);
        setShareToken(res.data.shareToken);
        window.scrollTo({ top: window.scrollY + 200, behavior: "smooth" });
    }

    useEffect(() => unlock.onResult(processResult), [unlock]);

    function submit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
            const res = await unlock.run({ ...form, website: honeypot, formStartedAt });
            processResult(res);
        });
    }

    const shareUrl = shareToken && typeof window !== "undefined" ? `${window.location.origin}/tools/share/${shareToken}` : undefined;

    return (
        <div className="space-y-6">
            <ToolUnlockModal
                open={unlock.modalOpen}
                tool="ai-stack-recommender"
                toolName="AI Stack Recommender"
                locale={locale}
                onClose={unlock.closeModal}
                onUnlocked={unlock.retryAfterUnlock}
            />
            <ToolPanel hideOnPrint>
                <form onSubmit={submit} className="relative space-y-6">
                    <HoneypotField value={honeypot} onChange={setHoneypot} />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <ToolField label={t.industry}>
                            <ToolSelect
                                value={form.industry}
                                onChange={(e) => setForm({ ...form, industry: e.target.value as StackInput["industry"] })}
                            >
                                {STACK_INDUSTRIES.map((i) => (
                                    <option key={i} value={i}>{INDUSTRY_LABEL[locale][i]}</option>
                                ))}
                            </ToolSelect>
                        </ToolField>
                        <ToolField label={t.teamSize}>
                            <ToolSegmented
                                value={form.teamSize}
                                onChange={(v) => setForm({ ...form, teamSize: v })}
                            options={[
                                { value: "solo", label: "Solo" },
                                { value: "2-5", label: "2–5" },
                                    { value: "6-15", label: "6–15" },
                                    { value: "16-50", label: "16–50" },
                                { value: "50+", label: "50+" },
                            ]}
                            />
                        </ToolField>
                    </div>

                    <ToolRange
                        label={t.monthlySoftwareBudget}
                        value={form.monthlyBudgetEur}
                        onChange={(v) => setForm({ ...form, monthlyBudgetEur: v })}
                        min={0}
                        max={2000}
                        step={50}
                        suffix=" €"
                    />

                    <ToolField label={t.painPoints}>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {STACK_PAINS.map((p) => (
                                <ToolCheckboxButton
                                    key={p}
                                    checked={form.pains.includes(p)}
                                    onChange={() => setForm({
                                        ...form,
                                        pains: form.pains.includes(p)
                                            ? form.pains.filter((x) => x !== p)
                                            : [...form.pains, p],
                                    })}
                                >
                                    {PAIN_LABEL[locale][p]}
                                </ToolCheckboxButton>
                            ))}
                        </div>
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
                        <p role="alert" className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-200">
                            {error}
                        </p>
                    ) : null}

                    <ToolPrimaryButton
                        type="submit"
                        disabled={pending}
                        iconLeft={pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    >
                        {pending ? t.buildingStack : t.recommendStack}
                    </ToolPrimaryButton>
                </form>
            </ToolPanel>

            {result ? (
                <>
                    <ToolResultCallout
                        eyebrow={`Your stack · budget ${result.budgetVerdict}`}
                        headline="Pick the tier that fits where you are right now."
                        body={result.sequenceNote}
                    />

                    <div className="grid gap-4 lg:grid-cols-3">
                        {result.tiers.map((tier) => (
                            <ToolPanel key={tier.label} className="flex h-full flex-col">
                                <header className="mb-3 flex items-center gap-2">
                                    {TIER_ICON[tier.label]}
                                    <h3 className="text-lg font-bold text-white print:text-slate-900">{tier.label}</h3>
                                </header>
                                <p className="mb-4 text-sm leading-relaxed text-slate-300 print:text-slate-700">{tier.summary}</p>
                                <ul className="flex-1 space-y-2">
                                    {tier.items.map((item) => {
                                        const affiliate = AFFILIATES[item.affiliateId];
                                        return (
                                            <li key={item.affiliateId} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm print:border-slate-300 print:bg-white">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-white print:text-slate-900">{item.name}</p>
                                                        <p className="mt-0.5 text-xs leading-relaxed text-slate-400 print:text-slate-700">{item.purpose}</p>
                                                    </div>
                                                    {affiliate ? (
                                                        <Link
                                                            href={affiliate.url}
                                                            target="_blank"
                                                            rel="sponsored nofollow noopener"
                                                            className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-cyan-400/10 hover:text-cyan-300 print:hidden"
                                                            aria-label={`Open ${item.name}`}
                                                        >
                                                            <ArrowUpRight className="size-4" aria-hidden />
                                                        </Link>
                                                    ) : null}
                                                </div>
                                                <p className="mt-1 text-[11px] uppercase tracking-wider text-slate-500 print:text-slate-700">
                                                    €{item.estMonthlyEur} / mo · {item.setupHours}h setup
                                                </p>
                                            </li>
                                        );
                                    })}
                                </ul>
                                <p className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-100 print:border-slate-300 print:bg-slate-50 print:text-slate-900">
                                    Total: €{tier.monthlyCostEur} / mo · {tier.setupHours}h setup
                                </p>
                            </ToolPanel>
                        ))}
                    </div>

                    <EmailGate leadId={leadId} locale={locale} shareUrl={shareUrl} />

                    <ToolPrintSummary title="Your recommended stack · iSystem.ai">
                        <p>{result.sequenceNote}</p>
                        {result.tiers.map((tier) => (
                            <div key={tier.label} className="mt-3">
                                <p className="font-semibold">{tier.label} — €{tier.monthlyCostEur}/mo · {tier.setupHours}h setup</p>
                                <ul className="ml-5 list-disc">
                                    {tier.items.map((i) => (
                                        <li key={i.affiliateId}>{i.name} — {i.purpose}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </ToolPrintSummary>
                </>
            ) : null}
        </div>
    );
}
