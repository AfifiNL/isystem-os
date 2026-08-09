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

export default function RestaurantServices({ config, locale }: ThemeSubPageProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  useScrollReveal(sectionRef, { y: 30, stagger: 0.1 });

  const services = config.pages.services;

  return (
    <section ref={sectionRef} className="bg-amber-50 py-14 md:py-20">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <motion.header initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }}>
          <p data-animate className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">{pickLocaleText(services?.title, locale, "Services")}</p>
          <h1 data-animate className="mt-3 text-3xl font-bold text-stone-900 md:text-5xl">{pickLocaleText(services?.subtitle, locale, "Dining experiences")}</h1>
          <p data-animate className="mt-4 max-w-3xl text-stone-700">{pickLocaleText(services?.description, locale, "Signature dining, private events, and chef-led hospitality packages.")}</p>
        </motion.header>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {[
            ["À La Carte", "Seasonal menu with local ingredients and curated wine pairings."],
            ["Tasting Menu", "Multi-course chef journey featuring premium farm-to-table products."],
            ["Private Dining", "Custom menus for celebrations, business dinners, and groups."],
            ["Catering", "Off-site culinary service for corporate and social events."],
          ].map(([title, copy]) => (
            <motion.article
              key={title}
              data-animate
              className="rounded-2xl border border-amber-200 bg-white p-6"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35 }}
            >
              <h2 className="text-xl font-semibold text-stone-900">{title}</h2>
              <p className="mt-2 text-stone-700">{copy}</p>
            </motion.article>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Classic", "Flexible booking", "Popular dishes and beverage options"],
            ["Chef's Experience", "Curated tasting", "Premium pairings and table storytelling"],
            ["Event Package", "Group-first format", "Dedicated host + custom run-of-show"],
          ].map(([tier, sub, details]) => (
            <div key={tier} data-animate className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">{tier}</p>
              <h3 className="mt-2 font-semibold text-stone-900">{sub}</h3>
              <p className="mt-2 text-sm text-stone-700">{details}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

