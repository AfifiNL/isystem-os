"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import type { Locale, TemplateConfig } from "@/features/templates/types";
import { useScrollReveal } from "@/shared/lib/gsap/use-scroll-reveal";
import { pickLocaleText } from "@/shared/lib/i18n/resolve";

interface ThemeSubPageProps {
  config: TemplateConfig;
  dictionary: Record<string, string>;
  locale: Locale;
}

export default function SaasProductServices({ config, locale }: ThemeSubPageProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  useScrollReveal(sectionRef, { y: 34, stagger: 0.1 });

  const services = config.pages.services;
  const heading = pickLocaleText(services?.subtitle, locale, "Product offerings");

  return (
    <section ref={sectionRef} className="bg-slate-950 py-14 text-slate-100 md:py-20">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <motion.header initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }}>
          <p data-animate className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">{pickLocaleText(services?.title, locale, "Services")}</p>
          <h1 data-animate className="mt-3 text-3xl font-bold md:text-5xl">{heading}</h1>
          <p data-animate className="mt-4 max-w-3xl text-slate-300">{pickLocaleText(services?.description, locale, "Modular SaaS capabilities from onboarding to advanced automation.")}</p>
        </motion.header>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {[
            ["Core Workspace", "Unified workflows, task orchestration, and team collaboration."],
            ["Analytics Layer", "Real-time dashboards, cohort views, and custom reporting."],
            ["Automation Engine", "Event-driven actions, no-code triggers, and lifecycle journeys."],
            ["Enterprise Controls", "SSO, role policies, audit trails, and compliance exports."],
          ].map(([title, copy]) => (
            <motion.article
              key={title}
              data-animate
              className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35 }}
            >
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="mt-2 text-slate-300">{copy}</p>
            </motion.article>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Starter", "Fast setup for small teams", "Core workflows + standard reports"],
            ["Growth", "Scaling operations", "Automation + advanced analytics"],
            ["Enterprise", "Complex organizations", "Security controls + custom integrations"],
          ].map(([tier, subtitle, desc]) => (
            <div key={tier} data-animate className="rounded-xl border border-cyan-900 bg-cyan-950/40 p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">{tier}</p>
              <h3 className="mt-2 font-semibold">{subtitle}</h3>
              <p className="mt-2 text-sm text-slate-300">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

