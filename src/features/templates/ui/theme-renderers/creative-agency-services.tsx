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

export default function CreativeAgencyServices({ config, locale }: ThemeSubPageProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  useScrollReveal(rootRef, { y: 34, stagger: 0.1 });

  const services = config.pages.services;

  return (
    <section ref={rootRef} className="bg-violet-50 py-14 md:py-20">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <motion.header initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }}>
          <p data-animate className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-700">{pickLocaleText(services?.title, locale, "Services")}</p>
          <h1 data-animate className="mt-3 text-3xl font-bold text-violet-950 md:text-5xl">{pickLocaleText(services?.subtitle, locale, "Creative capabilities")}</h1>
          <p data-animate className="mt-4 max-w-3xl text-violet-900/80">{pickLocaleText(services?.description, locale, "Brand, design, and growth services built as scalable creative systems.")}</p>
        </motion.header>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {[
            ["Brand Strategy", "Positioning, voice, audience architecture, and brand narrative."],
            ["Visual Identity", "Logo systems, typography, design tokens, and art direction."],
            ["Web & Product Design", "UX/UI flows, responsive pages, and conversion-focused interfaces."],
            ["Content & Campaigns", "Launch assets, social formats, and performance creative cycles."],
          ].map(([title, body]) => (
            <motion.article
              key={title}
              data-animate
              className="rounded-2xl border border-violet-200 bg-white p-6"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35 }}
            >
              <h2 className="text-xl font-semibold text-violet-950">{title}</h2>
              <p className="mt-2 text-violet-900/80">{body}</p>
            </motion.article>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Sprint", "Fast-turn creative direction", "2-week focused package"],
            ["Studio", "Ongoing design partnership", "Monthly retainers + campaign support"],
            ["Scale", "End-to-end brand systems", "Cross-channel execution + optimization"],
          ].map(([tier, subtitle, details]) => (
            <div key={tier} data-animate className="rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">{tier}</p>
              <h3 className="mt-2 font-semibold text-violet-950">{subtitle}</h3>
              <p className="mt-2 text-sm text-violet-900/80">{details}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

