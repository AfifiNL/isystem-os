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

export default function RestaurantContact({ config, locale }: ThemeSubPageProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  useScrollReveal(sectionRef, { y: 30, stagger: 0.1 });

  const contact = config.pages.contact;

  return (
    <section ref={sectionRef} className="bg-amber-50 py-14 md:py-20">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <motion.header initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }}>
          <p data-animate className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">{contact.title[locale]}</p>
          <h1 data-animate className="mt-3 text-3xl font-bold text-stone-900 md:text-5xl">{contact.subtitle[locale]}</h1>
          <p data-animate className="mt-4 max-w-3xl text-stone-700">Reserve your table, request a private dining package, or contact us for seasonal chef events.</p>
        </motion.header>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <form data-animate className="rounded-2xl border border-amber-200 bg-white p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold text-stone-900">Reservation Request</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <input className="rounded-lg border border-amber-300 px-3 py-2 text-sm" placeholder="Full name" />
              <input className="rounded-lg border border-amber-300 px-3 py-2 text-sm" placeholder="Phone or email" />
              <input className="rounded-lg border border-amber-300 px-3 py-2 text-sm" placeholder="Date" />
              <input className="rounded-lg border border-amber-300 px-3 py-2 text-sm" placeholder="Time" />
              <input className="rounded-lg border border-amber-300 px-3 py-2 text-sm md:col-span-2" placeholder="Guests + dietary notes" />
            </div>
            <button type="button" className="mt-4 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800">Send Reservation</button>
          </form>

          <aside data-animate className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <h3 className="font-semibold text-stone-900">Visit us</h3>
            <p className="mt-2 text-sm text-stone-700">Canal District, Amsterdam</p>
            <p className="mt-1 text-sm text-stone-700">Tue–Sun: 17:00–23:00</p>
            <p className="mt-4 text-sm text-stone-700">Map context: 5 min from tram stop, nearby parking available, accessible entrance at rear patio.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}

