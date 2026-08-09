import type { ToolSlug } from "../types";
import type { AutomationScannerResult } from "../../automation-scanner/scoring";
import type { RoiResult } from "../../roi-calculator/compute";
import type { StackRecommendation } from "../../stack-recommender/catalog";
import type { AiVisibilityResult } from "../../ai-visibility/compute";
import type { SupportResult } from "../../support-readiness/compute";
import type { GdprResult } from "../../gdpr-scanner/compute";
import type { ConversionResult } from "../../conversion-audit/compute";
import { ToolStatTile } from "./primitives";

interface Props {
    tool: ToolSlug;
    result: unknown;
}

function fmt(n: number): string {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n));
}

function bodyClass(extra: string = ""): string {
    return `text-slate-200 print:text-slate-900 ${extra}`.trim();
}

/**
 * Server-rendered, locale-agnostic summary of any tool's result for the share
 * page. Each result type maps to a tailored block; we never interpolate
 * untrusted strings as HTML — everything goes through React.
 */
export function SharedResultRenderer({ tool, result }: Props) {
    switch (tool) {
        case "automation-scanner": {
            const r = result as AutomationScannerResult;
            return (
                <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <ToolStatTile label="Readiness" value={`${r.readinessScore}/100`} hint={r.readinessLabel} accent="cyan" />
                        <ToolStatTile label="Hours / month" value={`${fmt(r.monthlyHoursReclaimable)}h`} accent="violet" />
                        <ToolStatTile label="Yearly savings" value={`€${fmt(r.yearlyEurReclaimable)}`} accent="cyan" />
                    </div>
                    <ol className="space-y-2">
                        {r.recommendations.map((rec, i) => (
                            <li
                                key={rec.id}
                                className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed print:border-slate-300 print:bg-white"
                            >
                                <p className="font-semibold text-white print:text-slate-900">
                                    <span className="text-cyan-300 print:text-slate-700">{i + 1}.</span> {rec.title}
                                </p>
                                <p className={bodyClass("mt-1")}>{rec.summary}</p>
                                <p className="mt-2 text-xs text-slate-400 print:text-slate-700">
                                    €{fmt(rec.monthlyEurSaved)} / mo · {rec.difficulty}
                                </p>
                            </li>
                        ))}
                    </ol>
                    <p className={bodyClass("rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-4 print:border-slate-300 print:bg-slate-50")}>
                        {r.stackSummary}
                    </p>
                </div>
            );
        }
        case "automation-roi-calculator": {
            const r = result as RoiResult;
            return (
                <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-4">
                        <ToolStatTile label="Monthly waste" value={`€${fmt(r.monthlyWastedCostEur)}`} accent="cyan" />
                        <ToolStatTile label="Yearly savings" value={`€${fmt(r.yearlyAutomatedSavingsEur)}`} accent="violet" />
                        <ToolStatTile label="Net year 1" value={`€${fmt(r.netYearlySavingsEur)}`} accent="cyan" />
                        <ToolStatTile label="Payback" value={r.paybackMonths !== null ? `${r.paybackMonths}m` : "—"} accent="neutral" />
                    </div>
                    <table className="w-full text-sm">
                        <thead className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-400 print:text-slate-700">
                            <tr>
                                <th className="py-2 font-medium">Task</th>
                                <th className="py-2 text-right font-medium">h/mo</th>
                                <th className="py-2 text-right font-medium">€/year if automated</th>
                            </tr>
                        </thead>
                        <tbody className={bodyClass("divide-y divide-white/5 print:divide-slate-200")}>
                            {r.tasks.map((t, i) => (
                                <tr key={i}>
                                    <td className="py-2.5">{t.name}</td>
                                    <td className="py-2.5 text-right">{fmt(t.monthlyHours)}</td>
                                    <td className="py-2.5 text-right font-semibold text-cyan-300 print:text-slate-900">
                                        €{fmt(t.yearlyAutomatedSavingsEur)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }
        case "ai-stack-recommender": {
            const r = result as StackRecommendation;
            return (
                <div className="space-y-4">
                    <p className={bodyClass("rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-4 text-sm print:border-slate-300 print:bg-slate-50")}>{r.sequenceNote}</p>
                    {r.tiers.map((tier) => (
                        <section
                            key={tier.label}
                            className="rounded-2xl border border-white/10 bg-white/5 p-4 print:border-slate-300 print:bg-white"
                        >
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300 print:text-slate-700">
                                {tier.label} · €{tier.monthlyCostEur}/mo · {tier.setupHours}h setup
                            </p>
                            <ul className={bodyClass("mt-2 ml-5 list-disc text-sm")}>
                                {tier.items.map((i) => (
                                    <li key={i.affiliateId}>
                                        <strong className="text-white print:text-slate-900">{i.name}</strong> — {i.purpose}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            );
        }
        case "ai-visibility-checker": {
            const r = result as AiVisibilityResult;
            return (
                <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <ToolStatTile label="Score" value={`${r.overallScore}/100`} accent="cyan" />
                        <ToolStatTile label="Readiness" value={r.citationReadiness} accent="violet" />
                        <ToolStatTile label="Checks" value={`${r.checks.length}`} accent="neutral" />
                    </div>
                    <p className={bodyClass("whitespace-pre-line rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-4 text-sm print:border-slate-300 print:bg-slate-50")}>{r.prose}</p>
                    <p className="text-sm text-slate-400 print:text-slate-700">
                        URL: <code className="text-cyan-300 print:text-slate-900">{r.finalUrl}</code>
                    </p>
                    <ul className={bodyClass("space-y-2 text-sm")}>
                        {r.checks.map((c) => (
                            <li key={c.id} className="rounded-xl border border-white/10 bg-white/5 p-3 print:border-slate-300 print:bg-white">
                                <span className="font-semibold capitalize text-white print:text-slate-900">[{c.status}]</span>{" "}
                                <span className="font-medium text-white print:text-slate-900">{c.label}</span> — {c.detail}
                            </li>
                        ))}
                    </ul>
                </div>
            );
        }
        case "support-automation-readiness": {
            const r = result as SupportResult;
            return (
                <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <ToolStatTile label="Readiness" value={`${r.readinessScore}/100`} accent="cyan" />
                        <ToolStatTile label="Hours / month" value={`${r.monthlyHoursSaved}h`} accent="violet" />
                        <ToolStatTile label="€ / month" value={`€${fmt(r.monthlyEurSaved)}`} accent="cyan" />
                    </div>
                    <p className={bodyClass("rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-4 text-sm print:border-slate-300 print:bg-slate-50")}>
                        Recommended: <strong className="text-white print:text-slate-900">{r.recommendedApproach}</strong>
                    </p>
                    {r.pitfalls.length > 0 ? (
                        <ul className={bodyClass("ml-5 list-disc text-sm")}>
                            {r.pitfalls.map((x, i) => <li key={i}>{x}</li>)}
                        </ul>
                    ) : null}
                    <ul className={bodyClass("ml-5 list-disc text-sm")}>
                        {r.rationale.map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                </div>
            );
        }
        case "gdpr-cookie-scanner": {
            const r = result as GdprResult;
            return (
                <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <ToolStatTile label="Risk score" value={`${r.riskScore}/100`} hint={r.overallRisk} accent="cyan" />
                        <ToolStatTile label="Cookie banner" value={r.cookieBanner.detected ? "Yes" : "No"} hint={r.cookieBanner.vendor ?? undefined} accent="violet" />
                        <ToolStatTile label="Trackers" value={`${r.trackers.length}`} accent="neutral" />
                    </div>
                    <ul className={bodyClass("space-y-2 text-sm")}>
                        {r.findings.map((f) => (
                            <li key={f.id} className="rounded-xl border border-white/10 bg-white/5 p-3 print:border-slate-300 print:bg-white">
                                <span className="font-semibold uppercase tracking-wider text-white print:text-slate-900">[{f.severity}]</span>{" "}
                                <span className="font-medium text-white print:text-slate-900">{f.label}</span> — {f.detail}
                            </li>
                        ))}
                    </ul>
                </div>
            );
        }
        case "conversion-audit": {
            const r = result as ConversionResult;
            return (
                <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <ToolStatTile label="Score" value={`${r.score}/100`} accent="cyan" />
                        <ToolStatTile label="Grade" value={r.grade} accent="violet" />
                        <ToolStatTile label="Trust signals" value={`${r.trustSignalCount}`} hint={`CTA: ${r.ctaStrength}`} accent="neutral" />
                    </div>
                    <p className="text-sm text-slate-400 print:text-slate-700">
                        URL: <code className="text-cyan-300 print:text-slate-900">{r.finalUrl}</code>
                    </p>
                    <ul className={bodyClass("space-y-2 text-sm")}>
                        {r.checks.map((c) => (
                            <li key={c.id} className="rounded-xl border border-white/10 bg-white/5 p-3 print:border-slate-300 print:bg-white">
                                <span className="font-semibold capitalize text-white print:text-slate-900">[{c.status}]</span>{" "}
                                <span className="font-medium text-white print:text-slate-900">{c.label}</span> — {c.detail}
                            </li>
                        ))}
                    </ul>
                </div>
            );
        }
        case "review-response-generator":
            return (
                <p className={bodyClass("rounded-2xl border border-white/10 bg-white/5 p-4 text-sm")}>
                    Review responses are not shareable for privacy reasons.
                </p>
            );
        default:
            return null;
    }
}
