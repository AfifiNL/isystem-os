"use client";

import { useRef } from "react";
import { motion, type Variants } from "framer-motion";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { ScrollReveal } from "@/shared/ui/animations/scroll-reveal";
import { StaggerGrid } from "@/shared/ui/animations/stagger-grid";
import { Counter } from "@/shared/ui/animations/counter";
import {
    ArrowRight,
    Check,
    Zap,
    Shield,
    BarChart3,
    Users,
    Sparkles,
    Play,
    Quote,
    Star,
} from "lucide-react";
import { useTemplate } from "@/features/templates/template-provider";

gsap.registerPlugin(ScrollTrigger);

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

// Animation variants for Framer Motion
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2,
        },
    },
};

const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { duration: 0.5, ease: "easeOut" },
    },
};

export function SaasProductHome({ dictionary }: ThemeHomeProps) {
    useTemplate();
    const heroRef = useRef<HTMLElement>(null);
    const pricingRef = useRef<HTMLElement>(null);

    // GSAP hero animation
    useGSAP(
        () => {
            if (!heroRef.current) return;
            const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

            tl.fromTo("[data-saas-badge]", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 })
                .fromTo("[data-saas-title]", { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, "-=0.3")
                .fromTo("[data-saas-sub]", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, "-=0.4")
                .fromTo("[data-saas-cta]", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, "-=0.3")
                .fromTo("[data-saas-grid]", { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, "-=0.2");
        },
        { scope: heroRef }
    );

    // Pricing section scroll animation
    useGSAP(
        () => {
            if (!pricingRef.current) return;
            gsap.fromTo(
                pricingRef.current.querySelectorAll("[data-pricing-card]"),
                { y: 80, opacity: 0 },
                {
                    y: 0,
                    opacity: 1,
                    duration: 0.8,
                    stagger: 0.15,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: pricingRef.current,
                        start: "top 80%",
                    },
                }
            );
        },
        { scope: pricingRef }
    );

    const dict = dictionary as Record<string, Record<string, string | string[] | Record<string, string>>>;
    const homeDict = (dict.home as Record<string, string | string[]>) || {};
    const featuresDict = (dict.features as Record<string, string>) || {};
    const pricingDict = (dict.pricing as Record<string, string | Record<string, string>>) || {};
    const testimonialsDict = (dict.testimonials as Record<string, string | string[]>) || {};

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
            {/* Hero Section */}
            <section ref={heroRef} className="relative overflow-hidden pt-32 pb-20 px-4">
                {/* Animated background elements */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-violet-500/10 to-cyan-500/10 rounded-full blur-3xl" />
                </div>

                {/* Grid pattern overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

                <div className="container mx-auto max-w-6xl relative z-10">
                    {/* Badge */}
                    <motion.div
                        data-saas-badge
                        className="flex justify-center mb-8"
                        initial={{ opacity: 0, y: 30 }}
                    >
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-500/20 to-cyan-500/20 border border-violet-500/30 text-sm font-medium">
                            <Sparkles className="w-4 h-4 text-violet-400" />
                            {(homeDict.badge as string) || "New: AI-Powered Analytics"}
                        </span>
                    </motion.div>

                    {/* Title */}
                    <h1
                        data-saas-title
                        className="text-5xl md:text-6xl lg:text-7xl font-bold text-center mb-6 leading-tight"
                    >
                        <span className="bg-gradient-to-r from-white via-white to-slate-400 bg-clip-text text-transparent">
                            {(homeDict.title as string) || "Build Faster."}
                        </span>
                        <br />
                        <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
                            {(homeDict.titleHighlight as string) || "Scale Smarter."}
                        </span>
                    </h1>

                    {/* Subtitle */}
                    <p
                        data-saas-sub
                        className="text-xl text-slate-400 text-center max-w-2xl mx-auto mb-10"
                    >
                        {(homeDict.subtitle as string) ||
                            "The all-in-one platform that helps teams ship products 10x faster with AI-powered workflows."}
                    </p>

                    {/* CTA Buttons */}
                    <div data-saas-cta className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
                        <Button
                            size="lg"
                            className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white border-0 px-8 py-6 text-lg font-semibold shadow-lg shadow-violet-500/25"
                        >
                            {(homeDict.primaryCta as string) || "Start Free Trial"}
                            <ArrowRight className="ms-2 w-5 h-5" />
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-white px-8 py-6 text-lg"
                        >
                            <Play className="me-2 w-5 h-5" />
                            {(homeDict.secondaryCta as string) || "Watch Demo"}
                        </Button>
                    </div>

                    {/* Bento Grid Preview */}
                    <div data-saas-grid className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
                        {[
                            { size: "md:col-span-2", label: "Dashboard Preview", icon: BarChart3 },
                            { size: "", label: "Analytics", icon: Zap },
                            { size: "", label: "Team", icon: Users },
                            { size: "", label: "Security", icon: Shield },
                            { size: "md:col-span-2", label: "Integrations", icon: Sparkles },
                        ].map((item, index) => (
                            <motion.div
                                key={index}
                                className={`${item.size} bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-violet-500/50 transition-all duration-300 group cursor-pointer`}
                                whileHover={{ scale: 1.02, y: -4 }}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 + index * 0.1 }}
                            >
                                <item.icon className="w-8 h-8 text-violet-400 mb-4 group-hover:text-cyan-400 transition-colors" />
                                <div className="text-sm text-slate-400">{item.label}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-24 px-4 bg-slate-900/50">
                <div className="container mx-auto max-w-6xl">
                    <ScrollReveal>
                        <div className="text-center mb-16">
                            <h2 className="text-4xl md:text-5xl font-bold mb-4">
                                {(featuresDict.title as string) || "Powerful Features"}
                            </h2>
                            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                                {(featuresDict.subtitle as string) ||
                                    "Everything you need to build, deploy, and scale your products."}
                            </p>
                        </div>
                    </ScrollReveal>

                    <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            {
                                icon: Zap,
                                title: (featuresDict.feature1Title as string) || "Lightning Fast",
                                description:
                                    (featuresDict.feature1Desc as string) ||
                                    "Optimized for speed with sub-100ms response times globally.",
                            },
                            {
                                icon: Shield,
                                title: (featuresDict.feature2Title as string) || "Enterprise Security",
                                description:
                                    (featuresDict.feature2Desc as string) ||
                                    "SOC 2 compliant with end-to-end encryption for all data.",
                            },
                            {
                                icon: BarChart3,
                                title: (featuresDict.feature3Title as string) || "Advanced Analytics",
                                description:
                                    (featuresDict.feature3Desc as string) ||
                                    "Real-time insights and custom dashboards for your metrics.",
                            },
                            {
                                icon: Users,
                                title: (featuresDict.feature4Title as string) || "Team Collaboration",
                                description:
                                    (featuresDict.feature4Desc as string) ||
                                    "Work together seamlessly with real-time editing and comments.",
                            },
                            {
                                icon: Sparkles,
                                title: (featuresDict.feature5Title as string) || "AI-Powered",
                                description:
                                    (featuresDict.feature5Desc as string) ||
                                    "Smart suggestions and automation powered by machine learning.",
                            },
                            {
                                icon: Shield,
                                title: (featuresDict.feature6Title as string) || "99.9% Uptime",
                                description:
                                    (featuresDict.feature6Desc as string) ||
                                    "Reliable infrastructure with automatic failover and backups.",
                            },
                        ].map((feature, index) => (
                            <motion.div
                                key={index}
                                whileHover={{ y: -8, scale: 1.02 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Card className="h-full bg-slate-800/50 border-slate-700/50 hover:border-violet-500/50 transition-all duration-300">
                                    <CardHeader>
                                        <feature.icon className="w-10 h-10 text-violet-400 mb-2" />
                                        <CardTitle className="text-white">{feature.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <CardDescription className="text-slate-400 text-base">
                                            {feature.description}
                                        </CardDescription>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </StaggerGrid>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-20 px-4">
                <div className="container mx-auto max-w-5xl">
                    <motion.div
                        className="grid grid-cols-2 md:grid-cols-4 gap-8"
                        variants={containerVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-100px" }}
                    >
                        {[
                            { value: 10000, suffix: "+", label: "Active Users" },
                            { value: 99.9, suffix: "%", label: "Uptime" },
                            { value: 50, suffix: "M+", label: "API Calls/Day" },
                            { value: 150, suffix: "+", label: "Integrations" },
                        ].map((stat, index) => (
                            <motion.div key={index} className="text-center" variants={itemVariants}>
                                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                                    <Counter end={stat.value} suffix={stat.suffix} duration={2.5} />
                                </div>
                                <div className="text-slate-400">{stat.label}</div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* Pricing Section */}
            <section ref={pricingRef} className="py-24 px-4 bg-slate-900/50">
                <div className="container mx-auto max-w-6xl">
                    <ScrollReveal>
                        <div className="text-center mb-16">
                            <h2 className="text-4xl md:text-5xl font-bold mb-4">
                                {(pricingDict.title as string) || "Simple, Transparent Pricing"}
                            </h2>
                            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                                {(pricingDict.subtitle as string) ||
                                    "Start free and scale as you grow. No hidden fees."}
                            </p>
                        </div>
                    </ScrollReveal>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                        {[
                            {
                                name: "Starter",
                                price: "$0",
                                period: "/month",
                                description: "Perfect for getting started",
                                features: ["5 Projects", "10GB Storage", "Basic Analytics", "Email Support"],
                                cta: "Get Started",
                                popular: false,
                            },
                            {
                                name: "Pro",
                                price: "$29",
                                period: "/month",
                                description: "Best for growing teams",
                                features: [
                                    "Unlimited Projects",
                                    "100GB Storage",
                                    "Advanced Analytics",
                                    "Priority Support",
                                    "Custom Integrations",
                                    "Team Collaboration",
                                ],
                                cta: "Start Free Trial",
                                popular: true,
                            },
                            {
                                name: "Enterprise",
                                price: "Custom",
                                period: "",
                                description: "For large organizations",
                                features: [
                                    "Everything in Pro",
                                    "Unlimited Storage",
                                    "Dedicated Support",
                                    "SLA Guarantee",
                                    "Custom Contracts",
                                    "On-premise Option",
                                ],
                                cta: "Contact Sales",
                                popular: false,
                            },
                        ].map((plan, index) => (
                            <motion.div
                                key={index}
                                data-pricing-card
                                whileHover={{ y: -8 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Card
                                    className={`h-full relative ${
                                        plan.popular
                                            ? "bg-gradient-to-b from-violet-600/20 to-cyan-600/20 border-violet-500/50"
                                            : "bg-slate-800/50 border-slate-700/50"
                                    }`}
                                >
                                    {plan.popular && (
                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                            <span className="px-4 py-1 rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 text-sm font-semibold">
                                                Most Popular
                                            </span>
                                        </div>
                                    )}
                                    <CardHeader className="text-center pt-8">
                                        <CardTitle className="text-2xl text-white">{plan.name}</CardTitle>
                                        <div className="mt-4">
                                            <span className="text-5xl font-bold text-white">{plan.price}</span>
                                            <span className="text-slate-400">{plan.period}</span>
                                        </div>
                                        <CardDescription className="text-slate-400 mt-2">
                                            {plan.description}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <ul className="space-y-3">
                                            {plan.features.map((feature, i) => (
                                                <li key={i} className="flex items-center gap-3 text-slate-300">
                                                    <Check className="w-5 h-5 text-violet-400 flex-shrink-0" />
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>
                                        <Button
                                            className={`w-full mt-6 ${
                                                plan.popular
                                                    ? "bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white border-0"
                                                    : "bg-slate-700 hover:bg-slate-600 text-white"
                                            }`}
                                            size="lg"
                                        >
                                            {plan.cta}
                                        </Button>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Testimonials Carousel */}
            <section className="py-24 px-4">
                <div className="container mx-auto max-w-6xl">
                    <ScrollReveal>
                        <div className="text-center mb-16">
                            <h2 className="text-4xl md:text-5xl font-bold mb-4">
                                {(testimonialsDict.title as string) || "Loved by Teams Worldwide"}
                            </h2>
                        </div>
                    </ScrollReveal>

                    <motion.div
                        className="grid grid-cols-1 md:grid-cols-3 gap-6"
                        variants={containerVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-100px" }}
                    >
                        {[
                            {
                                quote:
                                    "This platform transformed how our team works. We've cut our development time in half.",
                                author: "Sarah Chen",
                                role: "CTO, TechStart",
                                avatar: "SC",
                            },
                            {
                                quote:
                                    "The AI features are incredible. It's like having an extra team member who never sleeps.",
                                author: "Marcus Johnson",
                                role: "Product Lead, InnovateCo",
                                avatar: "MJ",
                            },
                            {
                                quote:
                                    "Best investment we've made. The ROI was visible within the first month of use.",
                                author: "Emily Rodriguez",
                                role: "CEO, GrowthLabs",
                                avatar: "ER",
                            },
                        ].map((testimonial, index) => (
                            <motion.div key={index} variants={itemVariants}>
                                <Card className="h-full bg-slate-800/50 border-slate-700/50">
                                    <CardContent className="pt-6">
                                        <div className="flex gap-1 mb-4">
                                            {[...Array(5)].map((_, i) => (
                                                <Star
                                                    key={i}
                                                    className="w-5 h-5 fill-yellow-500 text-yellow-500"
                                                />
                                            ))}
                                        </div>
                                        <Quote className="w-8 h-8 text-violet-400/50 mb-4" />
                                        <p className="text-slate-300 mb-6 text-lg leading-relaxed">
                                            {testimonial.quote}
                                        </p>
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
                                                {testimonial.avatar}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-white">
                                                    {testimonial.author}
                                                </div>
                                                <div className="text-sm text-slate-400">{testimonial.role}</div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 px-4">
                <div className="container mx-auto max-w-4xl">
                    <motion.div
                        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 to-cyan-600 p-12 text-center"
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:32px_32px]" />
                        <div className="relative z-10">
                            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                                Ready to Get Started?
                            </h2>
                            <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
                                Join thousands of teams already using our platform to build amazing products.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Button
                                    size="lg"
                                    className="bg-white text-violet-600 hover:bg-white/90 px-8 py-6 text-lg font-semibold"
                                >
                                    Start Free Trial
                                    <ArrowRight className="ms-2 w-5 h-5" />
                                </Button>
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="border-white/30 bg-white/10 hover:bg-white/20 text-white px-8 py-6 text-lg"
                                >
                                    Talk to Sales
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Footer spacing */}
            <div className="h-20" />
        </div>
    );
}
