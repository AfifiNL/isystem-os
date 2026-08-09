import { CheckCircle2, ExternalLink, Layers3, ShieldCheck, Sparkles, TimerReset } from "lucide-react";
import type { PublicEvidenceCategory, PublicEvidenceSource, PublicEvidenceSummary } from "@/features/source-intelligence/public";
import {
    getPublicEvidenceSurfaceClasses,
    type PublicEvidenceSurface,
} from "./public-evidence-visuals";

type Locale = "en" | "nl" | "ar";

const COPY: Record<Locale, {
    reviewed: string;
    sources: string;
    primary: string;
    updated: string;
    drawerTitle: string;
    drawerIntro: string;
    taxonomy: string;
    categoryLabels: Record<PublicEvidenceCategory, string>;
}> = {
    en: {
        reviewed: "reviewed",
        sources: "sources",
        primary: "primary / near-primary",
        updated: "updated this week",
        drawerTitle: "Evidence used",
        drawerIntro: "Public-safe evidence behind this article. External sources, author frameworks, and scenario models are separated so reader trust does not depend on inflated claims.",
        taxonomy: "evidence taxonomy",
        categoryLabels: {
            external_source: "external source",
            author_framework: "author framework",
            scenario_model: "scenario model",
            context_source: "context source",
        },
    },
    nl: {
        reviewed: "beoordeelde",
        sources: "bronnen",
        primary: "primair / bijna primair",
        updated: "deze week bijgewerkt",
        drawerTitle: "Gebruikte bronnen",
        drawerIntro: "Publiek veilige bewijsvoering achter dit artikel. Externe bronnen, auteurskaders en scenariomodellen blijven gescheiden zodat vertrouwen niet leunt op opgeblazen claims.",
        taxonomy: "bewijstaxonomie",
        categoryLabels: {
            external_source: "externe bron",
            author_framework: "auteurskader",
            scenario_model: "scenariomodel",
            context_source: "contextbron",
        },
    },
    ar: {
        reviewed: "مراجَعة",
        sources: "مصادر",
        primary: "أولي / قريب من الأولي",
        updated: "محدّث هذا الأسبوع",
        drawerTitle: "الأدلة المستخدمة",
        drawerIntro: "أدلة آمنة للنشر خلف هذا المقال. نفصل بين المصادر الخارجية وأطر الكاتب ونماذج السيناريو حتى لا يعتمد الثقة على ادعاءات مبالغ فيها.",
        taxonomy: "تصنيف الأدلة",
        categoryLabels: {
            external_source: "مصدر خارجي",
            author_framework: "إطار الكاتب",
            scenario_model: "نموذج سيناريو",
            context_source: "مصدر سياقي",
        },
    },
};

function dateLabel(value: string | null, locale: Locale) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : locale === "ar" ? "ar-EG" : "en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date);
}

function qualityLabel(source: PublicEvidenceSource) {
    const quality = source.quality ? source.quality.replace(/_/g, " ") : "reviewed";
    const tier = source.trustTier ? source.trustTier.replace(/_/g, " ") : null;
    return tier ? `${quality} · ${tier}` : quality;
}

function taxonomyLabels(summary: PublicEvidenceSummary, locale: Locale) {
    const copy = COPY[locale] ?? COPY.en;
    return summary.evidenceTaxonomy.map((category) => copy.categoryLabels[category]).filter(Boolean);
}

export function PublicEvidenceBadges({
    summary,
    locale = "en",
    compact = false,
    surface = "dark",
}: {
    summary?: PublicEvidenceSummary | null;
    locale?: Locale;
    compact?: boolean;
    surface?: PublicEvidenceSurface;
}) {
    if (!summary || summary.verifiedSourceCount <= 0) return null;
    const copy = COPY[locale] ?? COPY.en;
    const classes = getPublicEvidenceSurfaceClasses(surface);
    const badgeBase = "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold uppercase tracking-[0.12em]";

    return (
        <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "text-[10px]" : "text-[11px]"}`} aria-label="Evidence summary">
            <span className={`${badgeBase} ${classes.badges[0]}`}>
                <CheckCircle2 className="h-3 w-3" /> {summary.verifiedSourceCount} {copy.reviewed} {copy.sources}
            </span>
            {summary.hasPrimaryOrNearPrimary ? (
                <span className={`${badgeBase} ${classes.badges[1]}`}>
                    <ShieldCheck className="h-3 w-3" /> {copy.primary}
                </span>
            ) : null}
            {summary.updatedThisWeek ? (
                <span className={`${badgeBase} ${classes.badges[2]}`}>
                    <TimerReset className="h-3 w-3" /> {copy.updated}
                </span>
            ) : null}
            {summary.evidenceTaxonomy?.length ? (
                <span className={`${badgeBase} ${classes.badges[3]}`}>
                    <Layers3 className="h-3 w-3" /> {taxonomyLabels(summary, locale).join(" · ") || copy.taxonomy}
                </span>
            ) : null}
        </div>
    );
}

export function PublicEvidenceDrawer({
    sources,
    locale = "en",
    surface = "dark",
}: {
    sources: PublicEvidenceSource[];
    locale?: Locale;
    surface?: PublicEvidenceSurface;
}) {
    const copy = COPY[locale] ?? COPY.en;
    const classes = getPublicEvidenceSurfaceClasses(surface);
    if (sources.length === 0) return null;

    return (
        <details className={`group mt-12 overflow-hidden rounded-2xl border ${classes.drawer}`}>
            <summary className={`flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold transition ${classes.summary}`}>
                <span className="inline-flex items-center gap-2">
                    <Sparkles className={`h-4 w-4 ${classes.summaryIcon}`} /> {copy.drawerTitle}
                </span>
                <span className={`text-xs font-medium group-open:hidden ${classes.summaryCount}`}>{sources.length} {copy.sources}</span>
            </summary>
            <div className={`border-t px-5 py-5 ${classes.content}`}>
                <div className="mt-4 grid gap-3">
                    {sources.map((source) => {
                        const date = dateLabel(source.publishedAt ?? source.retrievedAt, locale);
                        return (
                            <a
                                key={source.id}
                                href={source.citationUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={`group/source rounded-xl border p-4 transition ${classes.source}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className={`text-sm font-semibold leading-6 ${classes.title}`}>{source.title}</p>
                                        <p className={`mt-1 text-xs ${classes.publisher}`}>{source.publisher ?? "Source"}{date ? ` · ${date}` : ""}</p>
                                    </div>
                                    <ExternalLink className={`h-4 w-4 shrink-0 ${classes.sourceIcon}`} />
                                </div>
                                <p className={`mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] ${classes.meta}`}>
                                    {copy.categoryLabels[source.evidenceCategory]} · {qualityLabel(source)} · {source.evidenceType.replace(/_/g, " ")}
                                </p>
                            </a>
                        );
                    })}
                </div>
            </div>
        </details>
    );
}
