"use client";

import Link from "next/link";
import { ArrowRight, TrendingUp } from "lucide-react";
import { useLocale } from "@/features/templates/template-provider";
import { ScrollReveal } from "@/shared/ui/animations/scroll-reveal";
import { StaggerGrid } from "@/shared/ui/animations/stagger-grid";
import { Locale } from "@/features/templates/types";
import { pickLocaleText } from "@/shared/lib/i18n/resolve";
import { localizeHref } from "@/shared/lib/i18n/routing";

const FEATURED_PROJECTS = [
    {
        title: {
            en: "Zuidas Corporate HQ — Full Facility Takeover",
            nl: "Zuidas Bedrijfs-HQ — Volledige Facilitaire Overname",
        },
        description: {
            en: "Consolidated 5 separate vendors into one seamless facility contract, reducing overhead by 40%.",
            nl: "5 leveranciers geconsolideerd in één naadloos facilitair contract, overhead verlaagd met 40%.",
        },
        metric: "40%",
        metricLabel: { en: "Cost reduction", nl: "Kostenverlaging" },
        pillars: ["Cleaning", "Reception", "Logistics"],
    },
    {
        title: {
            en: "TechHub Amsterdam — Campus Catering",
            nl: "TechHub Amsterdam — Campus Catering",
        },
        description: {
            en: "Deployed a full hospitality solution for a 2,000-person tech campus, serving 4,500+ meals daily.",
            nl: "Volledige hospitality-oplossing voor een techcampus van 2.000 personen, dagelijks 4.500+ maaltijden.",
        },
        metric: "4,500+",
        metricLabel: { en: "Daily meals", nl: "Dagelijkse maaltijden" },
        pillars: ["Catering", "Reception"],
    },
    {
        title: {
            en: "Financial District — Multi-Tenant Tower",
            nl: "Financieel District — Multi-Tenant Toren",
        },
        description: {
            en: "Managing cleaning and logistics for a 25-floor tower, handling 200+ weekly service requests at 98.5% SLA.",
            nl: "Schoonmaak en logistiek voor een kantoortoren van 25 verdiepingen, 200+ wekelijkse verzoeken met 98,5% SLA.",
        },
        metric: "98.5%",
        metricLabel: { en: "SLA compliance", nl: "SLA-compliance" },
        pillars: ["Cleaning", "Logistics"],
    },
];

export function ProjectsPreview() {
    const locale = useLocale() as Locale;

    return (
        <section className="py-24 md:py-32 bg-muted/10">
            <div className="container mx-auto max-w-6xl px-4 md:px-6">
                <ScrollReveal>
                    <div className="flex items-end justify-between mb-12">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-wider text-[var(--template-primary)] mb-3">
                                {locale === "en" ? "Proven Results" : "Bewezen Resultaten"}
                            </p>
                            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                                {locale === "en" ? "Recent Case Studies" : "Recente Casestudies"}
                            </h2>
                            <p className="text-lg text-muted-foreground max-w-2xl">
                                {locale === "en"
                                    ? "See exactly how we help businesses streamline their facility operations."
                                    : "Ontdek hoe we bedrijven helpen hun facilitaire processen te stroomlijnen."
                                }
                            </p>
                        </div>
                        <Link
                            href={localizeHref(locale, "/projects")}
                            className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-[var(--template-primary)] hover:underline"
                        >
                            {locale === "en" ? "View all case studies" : "Bekijk alle casestudies"}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </ScrollReveal>

                <StaggerGrid>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {FEATURED_PROJECTS.map((project, i) => (
                            <Link
                                key={i}
                                href={localizeHref(locale, "/projects")}
                                className="group flex flex-col border border-border/50 bg-card overflow-hidden hover:border-[var(--template-primary)] hover:shadow-xl transition-all duration-300"
                            >
                                {/* Metric Hero */}
                                <div className="p-6 flex items-center gap-4" style={{ background: `linear-gradient(135deg, var(--template-gradient-from), var(--template-gradient-to))` }}>
                                    <TrendingUp className="h-6 w-6 text-white/80" />
                                    <div>
                                        <div className="text-3xl font-extrabold text-white">{project.metric}</div>
                                        <div className="text-xs text-white/70 uppercase tracking-wider">{pickLocaleText(project.metricLabel, locale)}</div>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex flex-col flex-1 p-6">
                                    {/* Pillar badges */}
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {project.pillars.map((p) => (
                                            <span key={p} className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-[var(--template-primary)]/10 text-[var(--template-primary)]">
                                                {p}
                                            </span>
                                        ))}
                                    </div>

                                    <h3 className="font-bold text-foreground mb-2 leading-tight group-hover:text-[var(--template-primary)] transition-colors">
                                        {pickLocaleText(project.title, locale)}
                                    </h3>
                                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed flex-1">
                                        {pickLocaleText(project.description, locale)}
                                    </p>
                                    <span className="mt-4 text-xs font-medium text-[var(--template-primary)] inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                                        {locale === "en" ? "Read case study" : "Lees casestudie"}
                                        <ArrowRight className="h-3 w-3" />
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </StaggerGrid>

                <div className="mt-8 text-center sm:hidden">
                    <Link
                        href={localizeHref(locale, "/projects")}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-bold"
                        style={{ background: `linear-gradient(to right, var(--template-gradient-from), var(--template-gradient-to))` }}
                    >
                        {locale === "en" ? "View all case studies" : "Bekijk alle casestudies"}
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            </div>
        </section>
    );
}
