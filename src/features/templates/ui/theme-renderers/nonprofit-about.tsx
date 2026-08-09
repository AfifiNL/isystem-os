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

export default function NonprofitAbout({ config, locale }: ThemeSubPageProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  useScrollReveal(containerRef, { y: 30, stagger: 0.12 });

  const about = config.pages.about;

  return (
    <section ref={containerRef} className="bg-emerald-50 py-14 md:py-20">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <motion.header initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <p data-animate className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">{pickLocaleText(about.title, locale)}</p>
          <h1 data-animate className="mt-3 text-3xl font-bold text-emerald-950 md:text-5xl">{pickLocaleText(about.headline, locale)}</h1>
          <p data-animate className="mt-4 max-w-3xl text-emerald-900/80">{pickLocaleText(about.description, locale)}</p>
        </motion.header>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <article data-animate className="rounded-2xl border border-emerald-200 bg-white p-6">
            <h2 className="text-xl font-semibold text-emerald-950">Our Story</h2>
            <p className="mt-3 text-emerald-900/80">We were founded by community advocates to bridge local needs with practical support programs in education, food security, and family wellbeing.</p>
          </article>
          <article data-animate className="rounded-2xl border border-teal-200 bg-teal-50 p-6">
            <h2 className="text-xl font-semibold text-emerald-950">Mission</h2>
            <p className="mt-3 text-emerald-900/80">Create lasting impact through community-led initiatives, transparent stewardship, and strong volunteer partnerships.</p>
          </article>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["Team", "Case workers, program managers, and local volunteers serving year-round."],
            ["Credentials", "Registered nonprofit governance, audited reporting, and trusted donor network."],
            ["Impact", "Thousands of service hours delivered with measurable community outcomes."],
          ].map(([title, value]) => (
            <motion.div
              key={title}
              data-animate
              className="rounded-xl border border-emerald-200 bg-white p-5"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <h3 className="font-semibold text-emerald-950">{title}</h3>
              <p className="mt-2 text-sm text-emerald-900/80">{value}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

