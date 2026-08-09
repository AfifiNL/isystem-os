"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import type { Locale, TemplateConfig } from "@/features/templates/types";
import { useScrollReveal } from "@/shared/lib/gsap/use-scroll-reveal";

interface ThemeSubPageProps {
  config: TemplateConfig;
  dictionary: Record<string, string>;
  locale: Locale;
}

export default function EcommerceServices({ config, locale }: ThemeSubPageProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  useScrollReveal(sectionRef, { y: 28, stagger: 0.09 });

  const services = config.pages.services;

  return (
    <section ref={sectionRef} className="bg-zinc-50 py-14 md:py-20">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <motion.header initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }}>
          <p data-animate className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-700">{services?.title[locale] ?? "Services"}</p>
          <h1 data-animate className="mt-3 text-3xl font-bold text-zinc-900 md:text-5xl">{services?.subtitle[locale] ?? "Products & shopping services"}</h1>
          <p data-animate className="mt-4 max-w-3xl text-zinc-600">{services?.description[locale] ?? "Curated product collections, gifting options, and premium support."}</p>
        </motion.header>

        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            ["Essentials", "Everyday bestsellers with fast dispatch."],
            ["Premium", "Top-rated products with extended guarantees."],
            ["Bundles", "Value packs designed around customer use cases."],
            ["Gift Sets", "Ready-to-send packages for occasions and teams."],
          ].map(([title, desc]) => (
            <motion.article
              key={title}
              data-animate
              className="rounded-2xl border border-zinc-200 bg-white p-5"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35 }}
            >
              <h2 className="font-semibold text-zinc-900">{title}</h2>
              <p className="mt-2 text-sm text-zinc-600">{desc}</p>
            </motion.article>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Standard", "Reliable checkout and shipping", "Curated catalog + order tracking"],
            ["Plus", "Enhanced support", "Priority handling + tailored recommendations"],
            ["Business", "For teams and resellers", "Bulk ordering + dedicated account support"],
          ].map(([tier, subtitle, details]) => (
            <div key={tier} data-animate className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">{tier}</p>
              <h3 className="mt-2 font-semibold text-zinc-900">{subtitle}</h3>
              <p className="mt-2 text-sm text-zinc-700">{details}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

