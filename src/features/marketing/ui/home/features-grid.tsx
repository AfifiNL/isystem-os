"use client";

import { Brain, Code2, Cpu, Layers, Rocket, Zap } from "lucide-react";
import { ScrollReveal } from "@/shared/ui/animations/scroll-reveal";
import { StaggerGrid } from "@/shared/ui/animations/stagger-grid";
import { useTemplate } from "@/features/templates/template-provider";
import type { Locale } from "@/features/templates/types";
import { pickLocaleText } from "@/shared/lib/i18n/resolve";

const FEATURES = [
    {
        icon: Brain,
        title: "AI-First Strategy",
        description: "Leverage generative AI to produce research-backed content, code, and automation at scale.",
        gradient: "from-violet-600 to-purple-600",
    },
    {
        icon: Code2,
        title: "Vibe Coding",
        description: "Build production-grade tools through conversation, not traditional programming.",
        gradient: "from-indigo-600 to-blue-600",
    },
    {
        icon: Layers,
        title: "Full-Stack CMS",
        description: "AI-generated blog posts, video scripts, LinkedIn carousels, and Instagram content in one workflow.",
        gradient: "from-purple-600 to-pink-600",
    },
    {
        icon: Zap,
        title: "Instant Deployment",
        description: "Supabase backend, Next.js frontend, and edge functions — deploy in minutes, not weeks.",
        gradient: "from-amber-500 to-orange-600",
    },
    {
        icon: Rocket,
        title: "Micro-SaaS Builder",
        description: "Turn domain expertise into scalable products using AI orchestration and no-code workflows.",
        gradient: "from-emerald-500 to-teal-600",
    },
    {
        icon: Cpu,
        title: "Stealth CTO Mode",
        description: "Manage an entire tech stack without writing a line of code. Orchestrate, don't operate.",
        gradient: "from-rose-500 to-red-600",
    },
];

export function FeaturesGrid({ title }: { title?: Record<Locale, string> }) {
    const { locale } = useTemplate();

    return (
        <section className="py-24 md:py-32 relative">
            <div className="container mx-auto max-w-6xl px-4 md:px-6">
                <ScrollReveal className="text-center mb-16">
                    <p className="text-sm font-semibold uppercase tracking-wider text-[var(--template-primary)] mb-3">
                        Capabilities
                    </p>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
                        {pickLocaleText(title, locale, "Everything you need to orchestrate")}
                    </h2>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        From AI-driven content generation to full-stack deployment — a complete toolkit for the modern creator.
                    </p>
                </ScrollReveal>

                <StaggerGrid
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
                    stagger={0.1}
                >
                    {FEATURES.map((feature) => (
                        <div
                            key={feature.title}
                            className="group relative p-6 rounded-2xl border border-border/50 bg-card transition-all duration-300 hover:border-[var(--template-primary)] hover:shadow-xl"
                            style={{ visibility: "hidden" }}
                        >
                            <div
                                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg`}
                            >
                                <feature.icon className="h-5 w-5 text-white" />
                            </div>
                            <h3 className="text-base font-semibold mb-2 text-foreground">
                                {feature.title}
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {feature.description}
                            </p>
                            {/* Hover glow */}
                            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none" style={{ backgroundImage: `linear-gradient(to bottom right, var(--template-gradient-from), transparent)` }} />
                        </div>
                    ))}
                </StaggerGrid>
            </div>
        </section>
    );
}
