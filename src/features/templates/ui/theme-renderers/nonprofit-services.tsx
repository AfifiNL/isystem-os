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

export default function NonprofitServices({ config, locale }: ThemeSubPageProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  useScrollReveal(rootRef, { y: 30, stagger: 0.1 });

  const services = config.pages.services;

  return (
    <section ref={rootRef} className="bg-emerald-50 py-14 md:py-20">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <motion.header initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }}>
          <p data-animate className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">{pickLocaleText(services?.title, locale, "Services")}</p>
          <h1 data-animate className="mt-3 text-3xl font-bold text-emerald-950 md:text-5xl">{pickLocaleText(services?.subtitle, locale, "Programs & support services")}</h1>
          <p data-animate className="mt-4 max-w-3xl text-emerald-900/80">{pickLocaleText(services?.description, locale, "Community-centered programs designed for long-term impact.")}</p>
        </motion.header>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {[
            ["Family Support", "Guidance, referrals, and practical assistance for households."],
            ["Youth Programs", "After-school mentoring, skills building, and safe spaces."],
            ["Food Access", "Distribution partnerships and nutrition-focused community drives."],
            ["Volunteer Mobilization", "Training and deployment for local service initiatives."],
          ].map(([title, copy]) => (
            <motion.article
              key={title}
              data-animate
              className="rounded-2xl border border-emerald-200 bg-white p-6"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35 }}
            >
              <h2 className="text-xl font-semibold text-emerald-950">{title}</h2>
              <p className="mt-2 text-emerald-900/80">{copy}</p>
            </motion.article>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Local Chapters", "Neighborhood action", "Volunteer-led programs"],
            ["Partnership Track", "NGO/corporate collaboration", "Joint campaigns + reporting"],
            ["Strategic Impact", "Long-term interventions", "Multi-year planning + measurement"],
          ].map(([tier, subtitle, details]) => (
            <div key={tier} data-animate className="rounded-xl border border-teal-200 bg-teal-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">{tier}</p>
              <h3 className="mt-2 font-semibold text-emerald-950">{subtitle}</h3>
              <p className="mt-2 text-sm text-emerald-900/80">{details}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

