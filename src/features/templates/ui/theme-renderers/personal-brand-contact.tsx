"use client";

import { useRef, useState } from "react";
import type { Locale, TemplateConfig } from "@/features/templates/types";
import { useGSAP } from "@gsap/react";
import { Button } from "@/shared/ui/button";
import { scrubReveal, scrubTimeline } from "@/features/templates/ui/theme-renderers/gsap-utils";
import { IdeaMatrix } from "@/features/templates/ui/svgs/personal-brand/IdeaMatrix";
import { pickLocaleText } from "@/shared/lib/i18n/resolve";

interface ThemeSubPageProps {
  config: TemplateConfig;
  dictionary: Record<string, string>;
  locale: Locale;
}

export default function PersonalBrandContact({ config, locale }: ThemeSubPageProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useGSAP(() => {
    if (!containerRef.current) return;

    // Contact Header Reveal
    scrubReveal(
      containerRef.current,
      ".contact-header-item",
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1 },
      { startOffset: "top 90%", endOffset: "top 40%", stagger: 0.1 }
    );

    // Form and Info split Timeline
    const contentSplit = containerRef.current.querySelector("#pb-contact-content");
    if (contentSplit) {
      const tl = scrubTimeline(contentSplit, { startOffset: "top 80%", endOffset: "center center" });
      tl.fromTo(
        contentSplit.querySelector(".contact-info"),
        { opacity: 0, x: -40 },
        { opacity: 1, x: 0 }
      );
      tl.fromTo(
        contentSplit.querySelector(".contact-form"),
        { opacity: 0, x: 40 },
        { opacity: 1, x: 0 },
        "<0.1"
      );
    }
  }, { scope: containerRef });

  const contact = config.pages.contact;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsSubmitting(false);
  };

  return (
    <section ref={containerRef} className="bg-amber-50/10 py-20 md:py-32 overflow-hidden border-t border-amber-100">
      <div className="container mx-auto max-w-6xl px-6">
        <header className="mb-20 text-center max-w-3xl mx-auto">
          <p className="contact-header-item text-sm font-bold uppercase tracking-[0.2em] text-amber-600 mb-4">
            {pickLocaleText(contact?.subtitle, locale, "Connect")}
          </p>
          <h1 className="contact-header-item text-4xl md:text-6xl font-serif font-bold text-stone-900 leading-tight">
            {pickLocaleText(contact?.title, locale, "Let's build something beautiful.")}
          </h1>
        </header>

        <div id="pb-contact-content" className="grid gap-16 lg:grid-cols-2">
          {/* Info Side */}
          <div className="contact-info space-y-10 relative">
            <div className="absolute top-0 left-0 w-64 h-64 -translate-y-12 -translate-x-12 opacity-15 text-amber-500 z-0 pointer-events-none">
              <IdeaMatrix />
            </div>

            <div className="relative z-10 space-y-6">
              <h2 className="text-3xl font-serif font-bold text-stone-900">Reach out</h2>
              <p className="text-lg text-stone-600 leading-relaxed max-w-md">
                Whether you are looking for a visionary keynote speaker, a fractional leader, or just want to jam on some wild ideas. Send a message and let&apos;s start the conversation.
              </p>
            </div>

            <div className="relative z-10 grid gap-6">
              <div className="p-6 bg-white rounded-2xl border border-amber-100 shadow-sm flex items-start gap-4 hover:border-amber-300 transition-colors">
                <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-xl">🎙️</span>
                </div>
                <div>
                  <h3 className="font-bold text-stone-900">Speaking & Press</h3>
                  <a href="mailto:speaking@example.com" className="text-amber-600 hover:text-amber-700 mt-1 block">speaking@example.com</a>
                </div>
              </div>
              <div className="p-6 bg-white rounded-2xl border border-amber-100 shadow-sm flex items-start gap-4 hover:border-amber-300 transition-colors">
                <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-xl">🤝</span>
                </div>
                <div>
                  <h3 className="font-bold text-stone-900">Partnerships</h3>
                  <a href="mailto:hello@example.com" className="text-amber-600 hover:text-amber-700 mt-1 block">hello@example.com</a>
                </div>
              </div>
            </div>
          </div>

          {/* Form Side */}
          <div className="contact-form bg-white rounded-[2.5rem] p-10 md:p-12 shadow-2xl shadow-amber-900/5 border border-amber-100/50">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium text-stone-700">Name</label>
                  <input
                    id="name"
                    required
                    className="w-full h-12 px-4 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-stone-700">Email</label>
                  <input
                    id="email"
                    type="email"
                    required
                    className="w-full h-12 px-4 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="subject" className="text-sm font-medium text-stone-700">Subject</label>
                <select
                  id="subject"
                  className="w-full h-12 px-4 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                >
                  <option>Speaking Engagements</option>
                  <option>Consulting / Mentorship</option>
                  <option>Podcast Invite</option>
                  <option>Just saying hi</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="message" className="text-sm font-medium text-stone-700">Message</label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  className="w-full p-4 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all resize-none"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-14 text-base font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-all shadow-md shadow-amber-600/20"
              >
                {isSubmitting ? "Sending..." : "Send Message"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
