"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import { Button } from "@/shared/ui/button";
import { useTemplate } from "@/features/templates/template-provider";
import { scrubReveal, scrubTimeline, scrubCards } from "@/features/templates/ui/theme-renderers/gsap-utils";
import { IdeaMatrix } from "@/features/templates/ui/svgs/personal-brand/IdeaMatrix";
import { CircuitBoard } from "@/features/templates/ui/svgs/personal-brand/CircuitBoard";
import { BrokenPipeline } from "@/features/templates/ui/svgs/personal-brand/BrokenPipeline";
import { AgentFleet } from "@/features/templates/ui/svgs/personal-brand/AgentFleet";

interface ThemeHomeProps {
    workspace: {
        id: string;
        name: string;
        slug: string;
        theme_id: string | null;
    };
    dictionary: Record<string, unknown>;
    locale: string;
}

export function PersonalBrandHome({ dictionary }: ThemeHomeProps) {
    useTemplate();
    const containerRef = useRef<HTMLDivElement>(null);

    const dict = dictionary as Record<string, Record<string, unknown>>;
    const themeDict = dict.personal_brand || {};
    const pbHero = (themeDict.hero as Record<string, string>) || {};
    const pbStats = (themeDict.stats as { items: Record<string, string>[] }) || { items: [] };
    const pbProblem = (themeDict.problem as Record<string, string>) || {};
    const pbSolution = (themeDict.solution as { subtitle?: string; title?: string; description?: string; items: Record<string, string>[] }) || { items: [] };
    const pbYoutube = (themeDict.youtube as { subtitle?: string; title?: string; description?: string; videos: Record<string, string>[] }) || { videos: [] };
    const pbAbout = (themeDict.about as Record<string, string>) || {};
    const pbNewsletter = (themeDict.newsletter as Record<string, string>) || {};

    useGSAP(
        () => {
            if (!containerRef.current) return;

            // 1. Hero Reveal
            const heroSection = containerRef.current.querySelector("#pb-hero");
            if (heroSection) {
                scrubReveal(
                    heroSection,
                    ".hero-element",
                    { y: 50, opacity: 0 },
                    { y: 0, opacity: 1 },
                    { startOffset: "top 95%", endOffset: "top 30%", stagger: 0.1 }
                );
            }

            // 2. Problem Section Timeline (Vibe Ceiling)
            const problemSection = containerRef.current.querySelector("#problem");
            if (problemSection) {
                const tl = scrubTimeline(problemSection, { startOffset: "top 80%", endOffset: "center center" });
                tl.fromTo(
                    problemSection.querySelectorAll(".prob-text"),
                    { x: -50, opacity: 0 },
                    { x: 0, opacity: 1, stagger: 0.15 }
                );
                tl.fromTo(
                    problemSection.querySelector(".prob-visual"),
                    { scale: 0.8, opacity: 0, rotation: -10 },
                    { scale: 1, opacity: 1, rotation: 0 },
                    "<"
                );
            }

            // 3. Solution Section Cards (Stealth CTO Methodology)
            const solutionSection = containerRef.current.querySelector("#solution");
            if (solutionSection) {
                scrubCards(solutionSection, ".solution-card", {
                    y: 60,
                    startOffset: "top 75%",
                    endOffset: "center center",
                    stagger: 0.2
                });
            }

            // 4. YouTube Section Timeline
            const ytSection = containerRef.current.querySelector("#youtube");
            if (ytSection) {
                const tl = scrubTimeline(ytSection, { startOffset: "top 80%", endOffset: "center center" });
                tl.fromTo(
                    ytSection.querySelectorAll(".yt-header"),
                    { y: 30, opacity: 0 },
                    { y: 0, opacity: 1, stagger: 0.1 }
                );
                scrubCards(ytSection, ".yt-card", {
                    y: 40,
                    startOffset: "top 60%",
                    endOffset: "center center",
                    stagger: 0.15
                });
            }

            // 5. About Section
            const aboutSection = containerRef.current.querySelector("#about");
            if (aboutSection) {
                scrubReveal(
                    aboutSection,
                    ".about-element",
                    { y: 40, opacity: 0 },
                    { y: 0, opacity: 1 },
                    { startOffset: "top 80%", endOffset: "center center", stagger: 0.1 }
                );
            }

            // 6. Newsletter Reveal
            const ctaSection = containerRef.current.querySelector("#newsletter");
            if (ctaSection) {
                scrubReveal(
                    ctaSection,
                    ".cta-content",
                    { scale: 0.9, opacity: 0 },
                    { scale: 1, opacity: 1 },
                    { startOffset: "top 85%", endOffset: "center center" }
                );
            }
        },
        { scope: containerRef }
    );

    return (
        <div ref={containerRef} className="bg-stone-50 text-stone-900 font-sans overflow-x-hidden pt-16 selection:bg-rose-500/20">

            {/* 1. HERO SECTION */}
            <section id="pb-hero" className="relative min-h-[90vh] flex flex-col justify-center py-20 px-6 overflow-hidden">
                {/* Abstract Background SVG Pattern */}
                <div className="absolute top-0 right-0 -me-40 -mt-20 w-[600px] h-[600px] opacity-[0.04] text-stone-400 pointer-events-none hero-element">
                    <CircuitBoard />
                </div>
                <div className="absolute bottom-0 left-0 -ms-20 -mb-20 w-[400px] h-[400px] opacity-[0.04] text-stone-400 pointer-events-none hero-element">
                    <CircuitBoard />
                </div>

                <div className="container mx-auto max-w-6xl relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8">
                        <div className="hero-element inline-block px-4 py-1.5 rounded-full bg-stone-200/50 border border-stone-200 text-stone-700 text-sm font-medium uppercase tracking-widest backdrop-blur-sm">
                            {pbHero.badge || "Stealth CTO Framework"}
                        </div>
                        <h1 className="hero-element text-5xl md:text-7xl font-serif font-bold leading-tight tracking-tight text-stone-900">
                            {pbHero.title || "Become the Stealth CTO."}
                        </h1>
                        <p className="hero-element text-lg md:text-xl text-stone-600 max-w-lg leading-relaxed font-light">
                            {pbHero.subtitle || "Build bespoke micro-SaaS and powerful internal tools with AI — no syntax required."}
                        </p>
                        <div className="hero-element flex flex-col sm:flex-row gap-4 pt-4">
                            <Button size="lg" className="bg-stone-900 hover:bg-stone-800 text-white rounded-full px-8 h-14 text-base" asChild>
                                <Link href="#solution">
                                    Explore Methodology
                                    <ArrowRight className="ms-2 w-4 h-4" />
                                </Link>
                            </Button>
                            <Button size="lg" variant="outline" className="rounded-full border-stone-300 text-stone-800 hover:bg-stone-200 px-8 h-14 text-base" asChild>
                                <Link href="#youtube">
                                    <Play className="me-2 w-4 h-4" />
                                    {pbHero.video_placeholder || "Watch Masterclass"}
                                </Link>
                            </Button>
                        </div>

                        {/* Stats mini-grid */}
                        <div className="hero-element grid grid-cols-2 sm:grid-cols-4 gap-6 pt-12 border-t border-stone-200 mt-12 w-full max-w-xl">
                            {pbStats.items && pbStats.items.map((stat: Record<string, string>, i: number) => (
                                <div key={i} className="flex flex-col">
                                    <span className="text-3xl font-serif font-bold text-stone-900">{stat.value}</span>
                                    <span className="text-xs font-medium text-stone-500 uppercase tracking-widest mt-1">{stat.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="hero-element relative aspect-[4/5] lg:aspect-square rounded-[2rem] overflow-hidden shadow-2xl shadow-stone-900/10 border border-stone-200/50">
                        {/* Hero visual */}
                        <Image
                            src="/stealth-cto-hero.png"
                            alt="AI Agent Orchestration — Stealth CTO"
                            width={1200}
                            height={1500}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-stone-900/60 to-transparent">
                            <div className="bg-white/80 backdrop-blur-md border border-stone-200 p-4 rounded-xl flex items-center gap-4 shadow-sm">
                                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                                    <Terminal className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-stone-900">Agent Orchestration</div>
                                    <div className="text-xs text-stone-500">Cursor + Claude Code Status: Active</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 2. PROBLEM SECTION (THE VIBE CEILING) */}
            <section id="problem" className="py-24 md:py-32 px-6 bg-white border-y border-stone-200">
                <div className="container mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
                    <div className="order-2 lg:order-1 prob-visual relative aspect-square bg-stone-50 rounded-[3rem] p-8 md:p-12 flex items-center justify-center border border-stone-100 shadow-inner">
                        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 opacity-30 z-0">
                            <BrokenPipeline className="w-64 h-64 text-rose-400" />
                        </div>
                        <div className="relative z-10 w-full bg-white p-6 md:p-8 rounded-2xl shadow-xl shadow-stone-900/5 border border-stone-100 transform -rotate-2">
                            <div className="flex items-center gap-3 mb-4 text-rose-600">
                                <Shield className="w-5 h-5" />
                                <span className="font-mono text-sm font-bold">Error: Vibe Ceiling Reached</span>
                            </div>
                            <div className="font-mono text-xs text-stone-500 space-y-2">
                                <p>{">"} Agent overloaded with context.</p>
                                <p>{">"} Hallucination detected in Database routing schema.</p>
                                <p>{">"} Attempting simple fix...</p>
                                <p className="text-rose-500 font-bold">{">"} FATAL: Schema deleted. API credits exhausted.</p>
                            </div>
                        </div>
                    </div>
                    <div className="order-1 lg:order-2 space-y-8">
                        <div className="prob-text text-sm font-bold tracking-widest text-rose-600 uppercase">
                            {pbProblem.subtitle || "The Vibe Ceiling"}
                        </div>
                        <h2 className="prob-text text-4xl md:text-5xl font-serif font-bold text-stone-900 leading-tight">
                            {pbProblem.title || "Vibe Coding is Pure Magic. Until it Becomes an Architectural Nightmare."}
                        </h2>
                        <div className="prob-text text-lg md:text-xl text-stone-600 leading-relaxed font-light">
                            <p>
                                {pbProblem.description || "Once your application scales beyond a single landing page, the magic hits a brutal limitation..."}
                            </p>
                        </div>
                        <blockquote className="prob-text border-s-2 border-stone-300 ps-6 italic text-stone-500 text-lg">
                            &quot;{pbProblem.quote || "A novice vibe coder just says 'fix the app.' A Stealth CTO provides the exact architectural roadmap."}&quot;
                        </blockquote>
                    </div>
                </div>
            </section>

            {/* 3. SOLUTION SECTION (THE STEALTH CTO METHODOLOGY) */}
            <section id="solution" className="py-24 md:py-32 px-6">
                <div className="container mx-auto max-w-6xl">
                    <div className="text-center mb-16 md:mb-20 space-y-6 max-w-3xl mx-auto">
                        <div className="text-sm font-bold tracking-widest text-stone-500 uppercase">
                            {pbSolution.subtitle || "The Stealth CTO Methodology"}
                        </div>
                        <h2 className="text-4xl md:text-6xl font-serif font-bold text-stone-900">
                            {pbSolution.title || "Stop Typing Syntax. Start Orchestrating Systems."}
                        </h2>
                        <p className="text-lg md:text-xl text-stone-600 font-light">
                            {pbSolution.description || "A Stealth CTO does not write code. They manage a fleet of elite, autonomous AI agents."}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {pbSolution.items && pbSolution.items.map((item: Record<string, string>, i: number) => {
                            const icons = [<Code key={0} />, <Cpu key={1} />, <Database key={2} />, <Cloud key={3} />];
                            return (
                                <div key={i} className="solution-card bg-white rounded-[2rem] p-8 lg:p-12 border border-stone-200 shadow-sm relative overflow-hidden group hover:shadow-xl hover:border-stone-300 transition-all duration-300">
                                    <div className="absolute top-0 right-0 w-64 h-64 -me-16 -mt-16 opacity-5 text-violet-600 group-hover:opacity-10 transition-opacity">
                                        <AgentFleet />
                                    </div>
                                    <div className="relative z-10 w-full sm:w-5/6">
                                        <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-900 mb-8 border border-stone-200 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                                            {icons[i % 4]}
                                        </div>
                                        <h3 className="text-2xl font-bold mb-4 font-serif text-stone-900">{item.name}</h3>
                                        <p className="text-stone-600 leading-relaxed font-light">{item.description}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* 4. YOUTUBE BRIDGE SECTION */}
            <section id="youtube" className="py-24 md:py-32 px-6 bg-stone-900 text-stone-50 border-y border-stone-800 relative overflow-hidden">
                <div className="absolute inset-0 opacity-5 pointer-events-none">
                    <CircuitBoard className="w-full h-full text-white" />
                </div>
                <div className="container mx-auto max-w-6xl relative z-10">
                    <div className="mb-16 md:mb-20 space-y-6 max-w-3xl yt-header text-center mx-auto">
                        <div className="text-sm font-bold tracking-widest text-stone-400 uppercase flex items-center justify-center gap-2">
                            <Youtube className="w-5 h-5 text-red-500" /> {pbYoutube.subtitle || "The YouTube Bridge"}
                        </div>
                        <h2 className="text-4xl md:text-6xl font-serif font-bold text-white">
                            {pbYoutube.title || "Watch the Process."}
                        </h2>
                        <p className="text-lg md:text-xl text-stone-300 font-light">
                            {pbYoutube.description || "Theoretical knowledge is entirely useless without raw execution. On my YouTube channel, I pull back the curtain."}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {pbYoutube.videos && pbYoutube.videos.map((video: Record<string, string>, i: number) => (
                            <a key={i} href={video.href || "#"} target="_blank" rel="noopener noreferrer" className="yt-card group flex flex-col bg-stone-800/50 hover:bg-stone-800 rounded-3xl overflow-hidden border border-stone-700 transition-colors cursor-pointer">
                                <div className="aspect-video bg-stone-950 relative flex items-center justify-center overflow-hidden">
                                    <Youtube className="w-12 h-12 text-stone-700 group-hover:text-red-500 transition-colors z-10" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950 border-t border-stone-800 opacity-50 z-0"></div>
                                </div>
                                <div className="p-8 flex flex-col flex-grow">
                                    <h3 className="text-lg font-medium text-stone-100 mb-6 leading-relaxed">
                                        {video.title}
                                    </h3>
                                    <div className="mt-auto pt-4 border-t border-stone-700/50">
                                        <span className="text-stone-400 group-hover:text-white transition-colors text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
                                            {video.link_text} <ArrowRight className="w-4 h-4" />
                                        </span>
                                    </div>
                                </div>
                            </a>
                        ))}
                    </div>

                    <div className="mt-16 text-center yt-header">
                        <Button size="lg" className="bg-white hover:bg-stone-200 text-stone-950 rounded-full px-12 h-14 text-base font-bold shadow-xl shadow-white/5">
                            Subscribe to the Channel
                        </Button>
                    </div>
                </div>
            </section>

            {/* 5. ABOUT SECTION */}
            <section id="about" className="py-24 md:py-32 px-6">
                <div className="container mx-auto max-w-4xl text-center space-y-8">
                    <div className="about-element text-sm font-bold tracking-widest text-stone-500 uppercase">
                        {pbAbout.title || "About"}
                    </div>
                    <h2 className="about-element text-4xl md:text-5xl font-serif font-bold text-stone-900 leading-tight">
                        {pbAbout.headline || "From Global Educator to AI Product Visionary"}
                    </h2>
                    <div className="about-element text-lg md:text-xl text-stone-600 leading-relaxed font-light space-y-6 max-w-3xl mx-auto pt-6">
                        <p>{pbAbout.description}</p>
                        <p>{pbAbout.philosophy_p1}</p>
                        <p className="font-semibold text-stone-900 border-s-4 border-stone-300 ps-6 italic">{pbAbout.philosophy_p2}</p>
                    </div>
                </div>
            </section>

            {/* 6. NEWSLETTER CTA */}
            <section id="newsletter" className="py-24 px-6 md:mb-20">
                <div className="container mx-auto max-w-5xl text-center cta-content bg-stone-900 text-stone-50 rounded-[3rem] p-8 md:p-24 shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center">
                        <IdeaMatrix className="w-full h-full text-white transform scale-150 relative top-20" />
                    </div>

                    <div className="relative z-10 max-w-3xl mx-auto">
                        <Mail className="w-12 h-12 text-stone-400 mx-auto mb-8" />
                        <h2 className="text-4xl md:text-6xl font-serif font-bold mb-6 text-white leading-tight">
                            {pbNewsletter.title || "Are You Ready to Orchestrate?"}
                        </h2>
                        <p className="text-lg md:text-xl text-stone-400 mb-12 font-light max-w-2xl mx-auto">
                            {pbNewsletter.description || "The market is not waiting for you to learn Python. Grab your free Stealth CTO Toolkit today."}
                        </p>
                        <NewsletterForm placeholder={pbNewsletter.placeholder || "Enter your best email address"} buttonText={pbNewsletter.button_text || "Grab Toolkit"} templateId="personal-brand" />
                    </div>
                </div>
            </section>
        </div>
    );
}

function ArrowRight(props: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
        </svg>
    );
}

function Play(props: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={props.className} aria-hidden="true">
            <path d="M8 5.5v13a1 1 0 0 0 1.55.83l10-6.5a1 1 0 0 0 0-1.66l-10-6.5A1 1 0 0 0 8 5.5Z" />
        </svg>
    );
}

function Terminal(props: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
            <path d="m4 17 6-5-6-5" />
            <path d="M12 19h8" />
        </svg>
    );
}

function Shield(props: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
            <path d="M12 3s6 2 8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6c2-1 8-3 8-3Z" />
            <path d="m9.5 12.5 1.8 1.8 3.4-3.4" />
        </svg>
    );
}

function Mail(props: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
        </svg>
    );
}

function Youtube(props: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={props.className} aria-hidden="true">
            <path d="M23 12.3c0 2.2-.3 4.3-.7 5.5a3.2 3.2 0 0 1-2.2 2.2c-1.9.5-8.1.5-8.1.5s-6.2 0-8.1-.5a3.2 3.2 0 0 1-2.2-2.2C1.3 16.6 1 14.5 1 12.3s.3-4.3.7-5.5a3.2 3.2 0 0 1 2.2-2.2C5.8 4 12 4 12 4s6.2 0 8.1.6a3.2 3.2 0 0 1 2.2 2.2c.4 1.2.7 3.3.7 5.5Zm-13.2 3.9 6.3-3.9-6.3-3.9z" />
        </svg>
    );
}

function Code(props: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
            <path d="m8 16-4-4 4-4" />
            <path d="m16 8 4 4-4 4" />
            <path d="m14 4-4 16" />
        </svg>
    );
}

function Cpu(props: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
            <rect x="7" y="7" width="10" height="10" rx="2" />
            <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
        </svg>
    );
}

function Database(props: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
            <ellipse cx="12" cy="6" rx="7" ry="3" />
            <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
            <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
        </svg>
    );
}

function Cloud(props: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
            <path d="M6 19h11a4 4 0 1 0-.9-7.9A5.5 5.5 0 0 0 5.4 12 3.5 3.5 0 0 0 6 19Z" />
        </svg>
    );
}

/* ── Newsletter Form Sub-Component ── */
function NewsletterForm({ placeholder, buttonText, templateId }: { placeholder: string; buttonText: string; templateId: string }) {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!email) return;
        setStatus("loading");
        try {
            const res = await fetch("/api/newsletter/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, templateId }),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus("success");
                setMessage(data.message || "You're in! Check your inbox.");
                setEmail("");
            } else {
                setStatus("error");
                setMessage(data.error || "Something went wrong. Please try again.");
            }
        } catch {
            setStatus("error");
            setMessage("Network error. Please try again.");
        }
    }

    if (status === "success") {
        return (
            <div className="text-center py-4">
                <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full px-6 py-3 text-sm font-medium">
                    ✓ {message}
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-2xl mx-auto">
            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={placeholder}
                required
                className="bg-stone-800 border border-stone-700 text-white rounded-full px-8 py-5 outline-none focus:ring-2 focus:ring-stone-500 flex-1 placeholder:text-stone-500 w-full"
            />
            <Button
                type="submit"
                disabled={status === "loading"}
                className="bg-white hover:bg-stone-200 text-stone-900 rounded-full px-10 py-5 h-auto text-base font-bold w-full sm:w-auto disabled:opacity-60"
            >
                {status === "loading" ? "Sending..." : buttonText}
            </Button>
            {status === "error" && (
                <p className="text-red-400 text-sm mt-2 w-full text-center">{message}</p>
            )}
        </form>
    );
}
