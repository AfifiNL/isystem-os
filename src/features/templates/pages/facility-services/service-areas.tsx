"use client";

import { useLocale } from "@/features/templates/template-provider";
import { ScrollReveal } from "@/shared/ui/animations/scroll-reveal";
import { StaggerGrid } from "@/shared/ui/animations/stagger-grid";
import { MapPin, CheckCircle2 } from "lucide-react";
import { Locale } from "@/features/templates/types";

const AREAS = [
    "Amsterdam Centrum",
    "Amsterdam Zuidas",
    "Amsterdam-Noord",
    "Schiphol Area",
    "Amstelveen",
    "Haarlem",
    "Utrecht",
    "Rotterdam",
];

export function ServiceAreas() {
    const locale = useLocale() as Locale;

    return (
        <section className="py-24 bg-[var(--template-primary)] text-[var(--template-primary-fg)] relative overflow-hidden">
            <div className="absolute inset-0 bg-black/10 z-0 pointer-events-none" />

            <div className="container mx-auto px-4 md:px-6 relative z-10">
                <div className="flex flex-col lg:flex-row gap-16 items-center">
                    {/* Text Content */}
                    <div className="w-full lg:w-1/2">
                        <ScrollReveal>
                            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--template-accent)] mb-4 flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                {locale === "en" ? "Operational Coverage" : "Operationele Dekking"}
                            </h2>
                            <p className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight">
                                {locale === "en"
                                    ? "Delivering Excellence Across the Netherlands"
                                    : "Uitmuntendheid in heel Nederland"
                                }
                            </p>
                            <p className="text-lg opacity-90 leading-relaxed mb-8 max-w-xl">
                                {locale === "en"
                                    ? "From high-end co-working spaces in the Zuidas to expansive corporate headquarters nationwide, our fleet is equipped for rapid-response deployement and consistent, standardized service."
                                    : "Van hoogwaardige co-working ruimtes op de Zuidas tot grote hoofdkantoren landelijk, onze vloot is uitgerust voor snelle inzet en consistente, gestandaardiseerde service."
                                }
                            </p>
                        </ScrollReveal>
                    </div>

                    {/* Areas Grid */}
                    <div className="w-full lg:w-1/2">
                        <StaggerGrid stagger={0.05}>
                            <div className="grid grid-cols-2 gap-4">
                                {AREAS.map((area, index) => (
                                    <div
                                        key={index}
                                        className="bg-white/10 backdrop-blur border border-white/20 p-4 rounded flex items-center gap-3 hover:bg-white/20 transition-colors"
                                    >
                                        <CheckCircle2 className="h-5 w-5 text-[var(--template-accent)]" />
                                        <span className="font-semibold">{area}</span>
                                    </div>
                                ))}
                            </div>
                        </StaggerGrid>
                    </div>
                </div>
            </div>
        </section>
    );
}
