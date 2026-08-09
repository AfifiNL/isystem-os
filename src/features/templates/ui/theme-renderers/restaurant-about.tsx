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

export default function RestaurantAbout({ config, locale }: ThemeSubPageProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  useScrollReveal(sectionRef, { y: 34, stagger: 0.11 });

  const about = config.pages.about;

  return (
    <section ref={sectionRef} className="bg-amber-50 py-14 md:py-20">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p data-animate className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">{about.title[locale]}</p>
          <h1 data-animate className="mt-3 text-3xl font-bold text-stone-900 md:text-5xl">{about.headline[locale]}</h1>
          <p data-animate className="mt-4 max-w-3xl text-stone-700">{about.description[locale]}</p>
        </motion.div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <article data-animate className="rounded-2xl border border-amber-200 bg-white p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold text-stone-900">Chef History</h2>
            <p className="mt-3 text-stone-700">Our head chef trained in Lyon and Copenhagen, then returned home to blend classical technique with seasonal Dutch ingredients. The kitchen team shares 40+ years of combined fine-dining experience.</p>
            <p className="mt-3 text-stone-700">Every menu cycle starts with tasting sessions and producer visits to keep flavor, texture, and storytelling aligned.</p>
          </article>
          <article data-animate className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <h2 className="text-xl font-semibold text-stone-900">Farm-to-Table Sourcing</h2>
            <p className="mt-3 text-stone-700">We source herbs, dairy, and vegetables directly from local farms within 80 km, with transparent seasonal procurement and low-waste prep workflows.</p>
          </article>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["Mission", "Serve memorable hospitality through local produce, craft cooking, and warm service."],
            ["Team", "Passionate chefs, sommeliers, and front-of-house hosts trained for consistency."],
            ["Credentials", "Featured by local dining guides and recipient of multiple neighborhood awards."],
          ].map(([title, body]) => (
            <motion.div
              key={title}
              data-animate
              className="rounded-xl border border-amber-200 bg-white p-5"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <h3 className="font-semibold text-stone-900">{title}</h3>
              <p className="mt-2 text-sm text-stone-700">{body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

