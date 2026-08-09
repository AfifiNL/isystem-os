"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function FaqAccordion({ faqs, surface = "default" }: { faqs: { question: string; answer: string }[], surface?: "inverse" | "default" }) {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    if (!faqs || faqs.length === 0) return null;

    const p = surface === "inverse" ? {
        containerOpen: "border-[var(--template-border-inverse)] bg-white/5",
        containerClosed: "border-[var(--template-border-inverse)] bg-transparent hover:bg-white/5",
        textQ: "text-[var(--template-text-inverse)]",
        textA: "text-[var(--template-text-inverse-muted)]",
        icon: "text-[var(--template-text-inverse-muted)]",
        iconOpen: "text-[var(--template-text-inverse)]",
    } : {
        containerOpen: "border-primary/50 bg-primary/[0.02]",
        containerClosed: "border-border/50 bg-card hover:bg-muted/30",
        textQ: "text-foreground",
        textA: "text-muted-foreground",
        icon: "text-muted-foreground",
        iconOpen: "text-primary",
    };

    return (
        <section className={`my-16 border-t pt-12 ${surface === "inverse" ? "border-[var(--template-border-inverse)]" : "border-border/50"}`}>
            <h2 className={`text-2xl font-semibold mb-8 tracking-tight ${surface === "inverse" ? "text-[var(--template-text-inverse)]" : "text-foreground"}`}>Frequently Asked Questions</h2>
            <div className="space-y-4">
                {faqs.map((faq, index) => {
                    const isOpen = openIndex === index;
                    return (
                        <div
                            key={index}
                            className={`border rounded-lg transition-colors duration-200 overflow-hidden ${
                                isOpen ? p.containerOpen : p.containerClosed
                            }`}
                        >
                            <button
                                type="button"
                                onClick={() => setOpenIndex(isOpen ? null : index)}
                                className="w-full flex items-center justify-between p-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                                aria-expanded={isOpen}
                            >
                                <span className={`text-[17px] font-medium leading-tight pr-8 ${p.textQ}`}>
                                    {faq.question}
                                </span>
                                <div className={`shrink-0 transition-transform duration-300 ${isOpen ? `rotate-180 ${p.iconOpen}` : p.icon}`}>
                                    <ChevronDown className="h-5 w-5" />
                                </div>
                            </button>

                            <div
                                className={`transition-all duration-300 ease-in-out ${
                                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                                } grid`}
                            >
                                <div className="overflow-hidden">
                                    <div className={`p-5 pt-0 text-[16px] leading-relaxed ${p.textA}`}>
                                        {faq.answer}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
