"use client";

import { useLocale } from "@/features/templates/template-provider";
import { ScrollReveal } from "@/shared/ui/animations/scroll-reveal";
import { StaggerGrid } from "@/shared/ui/animations/stagger-grid";
import { Quote } from "lucide-react";
import { Locale } from "@/features/templates/types";
import { pickLocaleText } from "@/shared/lib/i18n/resolve";

const TESTIMONIALS = [
    {
        name: "Sarah V.",
        role: { en: "Office Manager, TechHub", nl: "Office Manager, TechHub" },
        content: {
            en: "Facility Services Demo transformed our chaotic multi-vendor setup into a single, seamless operation. Their cleaning and maintenance teams are invisible yet perfectly effective.",
            nl: "Facility Services Demo veranderde onze chaotische multi-vendor opzet in een enkele, naadloze operatie. Hun schoonmaak- en onderhoudsteams zijn onzichtbaar maar perfect effectief."
        }
    },
    {
        name: "Mark D.",
        role: { en: "Operations Director, Finance Corp", nl: "Operations Director, Finance Corp" },
        content: {
            en: "The integrated service model they proposed was exactly what we needed. One point of accountability has saved us dozens of hours a month in administrative overhead.",
            nl: "Het geïntegreerde dienstenmodel dat ze aandroegen was precies wat we nodig hadden. Eén aanspreekpunt heeft ons tientallen uren per maand aan administratieve overhead bespaard."
        }
    },
    {
        name: "Elena R.",
        role: { en: "HR Lead, Creative Agency", nl: "HR Lead, Creative Agency" },
        content: {
            en: "Their catering and hospitality staff feel like an extension of our own team. Always smiling, always professional, and the food quality is outstanding.",
            nl: "Hun catering en hospitality personeel voelt als een verlengstuk van ons eigen team. Altijd lachend, altijd professioneel en de voedselkwaliteit is uitstekend."
        }
    }
];

export function TestimonialsCarousel() {
    const locale = useLocale() as Locale;

    return (
        <section className="py-24 bg-muted/10 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-[var(--template-primary)]/5 rounded-full blur-3xl" />

            <div className="container mx-auto px-4 md:px-6 relative z-10">
                <ScrollReveal>
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--template-primary)] mb-4">
                            {locale === "en" ? "Client Success" : "Klantensucces"}
                        </h2>
                        <p className="text-3xl md:text-5xl font-extrabold text-foreground mb-6">
                            {locale === "en" ? "Trusted by Amsterdam's Best" : "Vertrouwd door de Beste Bedrijven"}
                        </p>
                    </div>
                </ScrollReveal>

                <StaggerGrid>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                        {TESTIMONIALS.map((t, i) => (
                            <div key={i} className="bg-background p-8 border border-border/60 shadow-sm relative group hover:border-[var(--template-primary)] transition-colors">
                                <Quote className="absolute top-6 right-6 h-8 w-8 text-[var(--template-primary)]/20 group-hover:text-[var(--template-primary)]/40 transition-colors" />

                                <p className="text-muted-foreground leading-relaxed italic mb-8 relative z-10">
                                    &quot;{pickLocaleText(t.content, locale)}&quot;
                                </p>

                                <div className="mt-auto border-t border-border/50 pt-6">
                                    <div className="font-bold text-foreground">{t.name}</div>
                                    <div className="text-sm text-[var(--template-primary)]">{pickLocaleText(t.role, locale)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </StaggerGrid>
            </div>
        </section>
    );
}
