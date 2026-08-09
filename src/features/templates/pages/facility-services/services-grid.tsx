"use client";

import { useLocale } from "@/features/templates/template-provider";
import { StaggerGrid } from "@/shared/ui/animations/stagger-grid";
import { ScrollReveal } from "@/shared/ui/animations/scroll-reveal";
import { Building2, Coffee, Users, Package, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Locale } from "@/features/templates/types";
import { pickLocaleText } from "@/shared/lib/i18n/resolve";
import { localizeHref } from "@/shared/lib/i18n/routing";

const SERVICES = [
    {
        id: "cleaning",
        icon: Building2,
        title: {
            en: "Cleaning & Maintenance",
            nl: "Schoonmaak & Onderhoud"
        },
        description: {
            en: "Daily janitorial services and routine building maintenance ensuring pristine, operational workspaces.",
            nl: "Dagelijkse schoonmaak en routine-onderhoud aan gebouwen voor smetteloze, operationele werkplekken."
        }
    },
    {
        id: "catering",
        icon: Coffee,
        title: {
            en: "Catering & Hospitality",
            nl: "Catering & Hospitality"
        },
        description: {
            en: "Full-service canteen operations, premium hydration, and tailored food solutions for your workforce.",
            nl: "Volledige kantine-exploitatie, premium hydratatie en op maat gemaakte voedingsoplossingen voor uw medewerkers."
        }
    },
    {
        id: "reception",
        icon: Users,
        title: {
            en: "Reception & Front Office",
            nl: "Receptie & Front Office"
        },
        description: {
            en: "Professional visitor management and a centralized Help Desk for seamless logistic support.",
            nl: "Professioneel bezoekersbeheer en een gecentraliseerde Helpdesk voor naadloze logistieke ondersteuning."
        }
    },
    {
        id: "logistics",
        icon: Package,
        title: {
            en: "Logistics & Support",
            nl: "Logistiek & Ondersteuning"
        },
        description: {
            en: "Smart inventory control, mail operations, and internal move management to keep business flowing.",
            nl: "Slim voorraadbeheer, postverwerking en intern verhuisbeheer om uw bedrijfsvoering vloeiend te houden."
        }
    }
];

export function ServicesGrid() {
    const locale = useLocale() as Locale;

    return (
        <section className="py-24 bg-background border-y border-border/40">
            <div className="container mx-auto px-4 md:px-6">
                <ScrollReveal>
                    <div className="max-w-3xl mb-16">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--template-primary)] mb-4">
                            {locale === "en" ? "Our Core Pillars" : "Onze Kernpijlers"}
                        </h2>
                        <p className="text-3xl md:text-5xl font-extrabold text-foreground leading-tight">
                            {locale === "en" ? "Integrated Facility Management" : "Integraal Facilitair Management"}
                        </p>
                    </div>
                </ScrollReveal>

                <StaggerGrid>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {SERVICES.map((service) => {
                            const Icon = service.icon;
                            return (
                                <Link
                                    href={localizeHref(locale, `/services#${service.id}`)}
                                    key={service.id}
                                    className="group relative flex flex-col p-8 bg-muted/20 border border-border/50 hover:border-[var(--template-primary)] hover:bg-card hover:shadow-lg transition-all duration-500 overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--template-primary)] opacity-0 group-hover:opacity-5 transition-opacity rounded-bl-[100px]" />

                                    <div className="h-12 w-12 bg-background border border-border flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                                        <Icon className="h-5 w-5 text-[var(--template-primary)]" />
                                    </div>

                                    <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-[var(--template-primary)] transition-colors">
                                        {pickLocaleText(service.title, locale)}
                                    </h3>

                                    <p className="text-muted-foreground leading-relaxed text-sm flex-1 mb-6">
                                        {pickLocaleText(service.description, locale)}
                                    </p>

                                    <div className="mt-auto flex items-center font-medium text-xs uppercase tracking-widest text-muted-foreground group-hover:text-[var(--template-primary)] transition-colors">
                                        {locale === "en" ? "Explore" : "Ontdek"}
                                        <ArrowRight className="h-4 w-4 ms-2 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </StaggerGrid>
            </div>
        </section>
    );
}
