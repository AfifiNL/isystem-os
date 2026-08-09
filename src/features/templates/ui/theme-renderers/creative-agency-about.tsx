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

export default function CreativeAgencyAbout({ config, locale }: ThemeSubPageProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  useScrollReveal(sectionRef, { y: 32, stagger: 0.1 });

  const about = config.pages.about;

  return (
    <section ref={sectionRef} className="bg-violet-50 py-14 md:py-20">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p data-animate className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-700">{pickLocaleText(about.title, locale)}</p>
          <h1 data-animate className="mt-3 text-3xl font-bold text-violet-950 md:text-5xl">{pickLocaleText(about.headline, locale)}</h1>
          <p data-animate className="mt-4 max-w-3xl text-violet-900/75">{pickLocaleText(about.description, locale)}</p>
        </motion.header>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <article data-animate className="rounded-2xl border border-violet-200 bg-white p-6">
            <h2 className="text-xl font-semibold text-violet-950">Studio Story</h2>
            <p className="mt-3 text-violet-900/80">What started as a two-person branding studio became a multidisciplinary agency blending strategy, design systems, content production, and conversion-focused campaigns.</p>
          </article>
          <article data-animate className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-6">
            <h2 className="text-xl font-semibold text-violet-950">Mission</h2>
            <p className="mt-3 text-violet-900/80">Build distinctive brand worlds that move audiences from awareness to action through cohesive creative execution.</p>
          </article>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["Team", "Strategists, art directors, motion designers, and growth specialists."],
            ["Credentials", "Award-shortlisted campaigns with measurable lift in engagement and leads."],
            ["Approach", "Research-led discovery, rapid prototyping, and iterative optimization."],
          ].map(([title, copy]) => (
            <motion.div
              key={title}
              data-animate
              className="rounded-xl border border-violet-200 bg-white p-5"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35 }}
            >
              <h3 className="font-semibold text-violet-950">{title}</h3>
              <p className="mt-2 text-sm text-violet-900/80">{copy}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

