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

export default function NonprofitContact({ config, locale }: ThemeSubPageProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  useScrollReveal(sectionRef, { y: 30, stagger: 0.1 });

  const contact = config.pages.contact;

  return (
    <section ref={sectionRef} className="bg-emerald-50 py-14 md:py-20">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <motion.header initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }}>
          <p data-animate className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">{contact.title[locale]}</p>
          <h1 data-animate className="mt-3 text-3xl font-bold text-emerald-950 md:text-5xl">{contact.subtitle[locale]}</h1>
          <p data-animate className="mt-4 max-w-3xl text-emerald-900/80">Reach out to partner, volunteer, refer a case, or support an active community program.</p>
        </motion.header>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <form data-animate className="rounded-2xl border border-emerald-200 bg-white p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold text-emerald-950">Get Involved</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <input className="rounded-lg border border-emerald-300 px-3 py-2 text-sm" placeholder="Name" />
              <input className="rounded-lg border border-emerald-300 px-3 py-2 text-sm" placeholder="Email" />
              <select className="rounded-lg border border-emerald-300 px-3 py-2 text-sm md:col-span-2">
                <option>Interest</option>
                <option>Volunteer</option>
                <option>Partnership</option>
                <option>Donation support</option>
                <option>Program referral</option>
              </select>
            </div>
            <textarea className="mt-4 min-h-28 w-full rounded-lg border border-emerald-300 px-3 py-2 text-sm" placeholder="Share context and how you'd like to collaborate" />
            <button type="button" className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800">Send Message</button>
          </form>

          <aside data-animate className="rounded-2xl border border-teal-200 bg-teal-50 p-6">
            <h3 className="font-semibold text-emerald-950">Community office</h3>
            <p className="mt-2 text-sm text-emerald-900/80">Mon–Fri: 09:00–17:00</p>
            <p className="mt-1 text-sm text-emerald-900/80">Hotline for urgent referrals available daily</p>
            <p className="mt-4 text-sm text-emerald-900/80">Response SLA: within 24 hours for standard requests.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}

