"use client";

import { ScrollReveal } from "@/shared/ui/animations/scroll-reveal";
import { Button } from "@/shared/ui/button";
import { Mail, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTemplate } from "@/features/templates/template-provider";
import { pickLocaleText } from "@/shared/lib/i18n/resolve";

export function NewsletterCTA() {
    const { config, locale } = useTemplate();
    const { newsletter } = config.pages;

    return (
        <section className="py-24 md:py-32">
            <div className="container mx-auto max-w-6xl px-4 md:px-6">
                <ScrollReveal>
                    <div className="relative rounded-3xl border border-border/50 bg-card p-10 md:p-16 text-center overflow-hidden">
                        {/* Background decoration */}
                        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: `linear-gradient(to bottom right, var(--template-gradient-from), var(--template-gradient-to))` }} />

                        <div className="relative z-10 w-fit mx-auto">
                            {/* Blur flares */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full opacity-20 blur-2xl pointer-events-none" style={{ backgroundImage: `linear-gradient(to right, var(--template-gradient-from), var(--template-gradient-to))` }} />

                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl relative z-10" style={{ backgroundImage: `linear-gradient(to right, var(--template-gradient-from), var(--template-gradient-to))` }}>
                                <Mail className="h-6 w-6 text-white" />
                            </div>
                        </div>

                        <div className="relative z-10">
                            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                                {pickLocaleText(newsletter.title, locale)}
                            </h2>
                            <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
                                {pickLocaleText(newsletter.description, locale)}
                            </p>
                            <Button
                                asChild
                                size="lg"
                                className="text-white shadow-xl border-0 rounded-xl h-12 px-8 text-base hover:brightness-110"
                                style={{ backgroundImage: `linear-gradient(to right, var(--template-gradient-from), var(--template-gradient-to))` }}
                            >
                                <Link href="/newsletter">
                                    Subscribe Now
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </ScrollReveal>
            </div>
        </section>
    );
}
