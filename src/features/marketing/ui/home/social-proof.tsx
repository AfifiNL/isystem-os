"use client";

import { ScrollReveal } from "@/shared/ui/animations/scroll-reveal";
import { Counter } from "@/shared/ui/animations/counter";
import { useTemplate } from "@/features/templates/template-provider";
import type { Locale } from "@/features/templates/types";
import { pickLocaleText } from "@/shared/lib/i18n/resolve";

const METRICS = [
    { end: 50, suffix: "+", label: "Articles Published" },
    { end: 15, suffix: "K+", label: "Monthly Readers" },
    { end: 8, suffix: "+", label: "Micro-SaaS Built" },
    { end: 200, suffix: "+", label: "Hours of Video" },
];

export function SocialProof({ title, subtitle }: { title?: Record<Locale, string>; subtitle?: Record<Locale, string> }) {
    const { locale } = useTemplate();

    return (
        <section className="py-20 md:py-28 bg-muted/30 border-y border-border/30">
            <div className="container mx-auto max-w-6xl px-4 md:px-6">
                <ScrollReveal className="text-center mb-14">
                    <p className="text-sm font-semibold uppercase tracking-wider text-[var(--template-primary)] mb-3">
                        {pickLocaleText(subtitle, locale, "Impact")}
                    </p>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                        {pickLocaleText(title, locale, "Numbers that speak")}
                    </h2>
                </ScrollReveal>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    {METRICS.map((metric, i) => (
                        <ScrollReveal key={metric.label} delay={i * 0.1} className="text-center">
                            <div className="text-4xl sm:text-5xl font-extrabold text-foreground mb-2">
                                <Counter
                                    end={metric.end}
                                    suffix={metric.suffix}
                                    duration={2.2}
                                />
                            </div>
                            <p className="text-sm text-muted-foreground font-medium">
                                {metric.label}
                            </p>
                        </ScrollReveal>
                    ))}
                </div>
            </div>
        </section>
    );
}
