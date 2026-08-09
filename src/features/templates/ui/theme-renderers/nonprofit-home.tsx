"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { ScrollReveal } from "@/shared/ui/animations/scroll-reveal";
import { StaggerGrid } from "@/shared/ui/animations/stagger-grid";
import { Counter } from "@/shared/ui/animations/counter";
import {
    ArrowRight,
    Heart,
    Users,
    Globe,
    Shield,
    Calendar,
    MapPin,
    Phone,
    Mail,
    Quote,
    Check,
    TrendingUp,
    Award,
    ChevronRight,
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

export function NonprofitHome({ dictionary }: ThemeHomeProps) {
    useTemplate();
    const heroRef = useRef<HTMLElement>(null);
    const impactRef = useRef<HTMLElement>(null);
    const [selectedAmount, setSelectedAmount] = useState<number | null>(50);
    const [customAmount, setCustomAmount] = useState<string>("");

    // Hero animation
    useGSAP(
        () => {
            if (!heroRef.current) return;
            const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

            tl.fromTo("[data-np-badge]", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 })
                .fromTo("[data-np-title]", { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, "-=0.3")
                .fromTo("[data-np-subtitle]", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, "-=0.4")
                .fromTo("[data-np-cta]", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, "-=0.3")
                .fromTo("[data-np-stats]", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, "-=0.2");
        },
        { scope: heroRef }
    );

    // Impact section animation
    useGSAP(
        () => {
            if (!impactRef.current) return;
            gsap.fromTo(
                impactRef.current.querySelectorAll("[data-impact-card]"),
                { y: 60, opacity: 0, scale: 0.95 },
                {
                    y: 0,
                    opacity: 1,
                    scale: 1,
                    duration: 0.8,
                    stagger: 0.15,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: impactRef.current,
                        start: "top 75%",
                    },
                }
            );
        },
        { scope: impactRef }
    );

    const dict = dictionary as Record<string, Record<string, string | string[] | Record<string, string>>>;
    const homeDict = (dict.home as Record<string, string | string[]>) || {};
    const aboutDict = (dict.about as Record<string, string>) || {};

    const donationTiers = [
        { amount: 25, impact: "Provides meals for 5 children" },
        { amount: 50, impact: "Funds a week of education" },
        { amount: 100, impact: "Supplies clean water for a family" },
        { amount: 250, impact: "Supports medical care for 10 people" },
    ];

    const impactStats = [
        { value: 50000, suffix: "+", label: "Lives Impacted", icon: Heart },
        { value: 120, suffix: "", label: "Communities Served", icon: Globe },
        { value: 95, suffix: "%", label: "Funds to Programs", icon: TrendingUp },
        { value: 15, suffix: "", label: "Years of Service", icon: Award },
    ];

    const stories = [
        {
            name: "Maria's Story",
            location: "Guatemala",
            quote:
                "Thanks to this organization, my children now have access to clean water and education. Our whole community has been transformed.",
            image: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=400&q=80",
        },
        {
            name: "James's Journey",
            location: "Kenya",
            quote:
                "The support I received helped me start my own business. Now I can provide for my family and give back to my community.",
            image: "https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=400&q=80",
        },
        {
            name: "Aisha's Hope",
            location: "Bangladesh",
            quote:
                "Education changed everything for me. I'm now the first in my village to attend university, and I want to help others do the same.",
            image: "https://images.unsplash.com/photo-1504159506876-f8338247a14a?w=400&q=80",
        },
    ];

    const programs = [
        {
            title: "Clean Water Initiative",
            description: "Providing sustainable water solutions to communities in need.",
            image: "https://images.unsplash.com/photo-1541544537156-7627a7a4aa1c?w=500&q=80",
            raised: 750000,
            goal: 1000000,
        },
        {
            title: "Education for All",
            description: "Building schools and providing scholarships for underprivileged children.",
            image: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=500&q=80",
            raised: 420000,
            goal: 600000,
        },
        {
            title: "Healthcare Access",
            description: "Mobile clinics and medical supplies for remote communities.",
            image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=500&q=80",
            raised: 890000,
            goal: 1200000,
        },
    ];

    return (
        <div className="min-h-screen bg-white text-gray-900">
            {/* Hero Section */}
            <section ref={heroRef} className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-100 rounded-full blur-3xl opacity-50" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-100 rounded-full blur-3xl opacity-50" />

                <div className="container mx-auto max-w-7xl px-4 py-20 md:py-32 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <div data-np-badge className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium mb-6">
                                <Shield className="w-4 h-4" />
                                Trusted Nonprofit Since 2009
                            </div>
                            <h1 data-np-title className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                                {(homeDict.title as string) || "Together, We Can"}
                                <span className="block text-emerald-600 mt-2">
                                    {(homeDict.titleHighlight as string) || "Change Lives"}
                                </span>
                            </h1>
                            <p data-np-subtitle className="text-xl text-gray-600 mb-8 leading-relaxed">
                                {(homeDict.subtitle as string) ||
                                    "Join our mission to create lasting change in communities around the world. Every contribution makes a difference."}
                            </p>
                            <div data-np-cta className="flex flex-col sm:flex-row gap-4">
                                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white px-8">
                                    <Heart className="me-2 w-5 h-5" />
                                    Donate Now
                                </Button>
                                <Button size="lg" variant="outline" className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 px-8">
                                    <Users className="me-2 w-5 h-5" />
                                    Become a Volunteer
                                </Button>
                            </div>
                        </div>
                        <div className="relative">
                            <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src="https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=800&q=80"
                                    alt="Children smiling in a classroom"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            {/* Floating stat card */}
                            <motion.div
                                className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-6"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.8 }}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                                        <Heart className="w-7 h-7 text-emerald-600" />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-gray-900">50,000+</div>
                                        <div className="text-sm text-gray-500">Lives Changed</div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Impact Stats */}
            <section data-np-stats className="py-16 bg-gray-900 text-white">
                <div className="container mx-auto max-w-7xl px-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {impactStats.map((stat, index) => (
                            <div key={index} className="text-center">
                                <stat.icon className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                                <div className="text-4xl md:text-5xl font-bold mb-2">
                                    <Counter end={stat.value} suffix={stat.suffix} duration={2.5} />
                                </div>
                                <div className="text-gray-400">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Mission Section */}
            <section className="py-24 px-4">
                <div className="container mx-auto max-w-6xl">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <ScrollReveal>
                            <div className="relative">
                                <div className="aspect-square rounded-3xl overflow-hidden">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src="https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&q=80"
                                        alt="Volunteers helping community"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="absolute -bottom-6 -right-6 bg-emerald-600 text-white p-6 rounded-2xl shadow-xl">
                                    <div className="text-3xl font-bold">95%</div>
                                    <div className="text-emerald-100 text-sm">of funds go directly to programs</div>
                                </div>
                            </div>
                        </ScrollReveal>
                        <ScrollReveal delay={0.2}>
                            <div className="space-y-6">
                                <span className="text-emerald-600 text-sm tracking-widest uppercase font-semibold">
                                    Our Mission
                                </span>
                                <h2 className="text-4xl md:text-5xl font-bold leading-tight">
                                    {(aboutDict.headline as string) ||
                                        "Creating Sustainable Change, One Community at a Time"}
                                </h2>
                                <p className="text-lg text-gray-600 leading-relaxed">
                                    {(aboutDict.description as string) ||
                                        "We believe that everyone deserves access to clean water, quality education, and basic healthcare. Our programs are designed to create lasting, sustainable change that empowers communities to thrive."}
                                </p>
                                <ul className="space-y-4">
                                    {[
                                        "Transparent financial reporting",
                                        "Community-led initiatives",
                                        "Long-term sustainable solutions",
                                        "Volunteer-driven impact",
                                    ].map((item, index) => (
                                        <li key={index} className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                                <Check className="w-4 h-4 text-emerald-600" />
                                            </div>
                                            <span className="text-gray-700">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Button size="lg" variant="outline" className="border-emerald-600 text-emerald-700">
                                    Learn More About Us
                                    <ArrowRight className="ms-2 w-4 h-4" />
                                </Button>
                            </div>
                        </ScrollReveal>
                    </div>
                </div>
            </section>

            {/* Donation Section */}
            <section className="py-24 px-4 bg-gradient-to-br from-emerald-600 to-teal-600 text-white">
                <div className="container mx-auto max-w-4xl">
                    <ScrollReveal>
                        <div className="text-center mb-12">
                            <h2 className="text-4xl md:text-5xl font-bold mb-4">Make a Difference Today</h2>
                            <p className="text-xl text-emerald-100 max-w-2xl mx-auto">
                                Your donation directly supports our programs and helps us reach more communities in need.
                            </p>
                        </div>
                    </ScrollReveal>

                    <div className="bg-white rounded-3xl p-8 md:p-12 text-gray-900">
                        <div className="mb-8">
                            <h3 className="text-xl font-semibold mb-4">Select Donation Amount</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {donationTiers.map((tier) => (
                                    <button
                                        key={tier.amount}
                                        onClick={() => {
                                            setSelectedAmount(tier.amount);
                                            setCustomAmount("");
                                        }}
                                        className={`p-4 rounded-xl border-2 transition-all text-start ${
                                            selectedAmount === tier.amount
                                                ? "border-emerald-500 bg-emerald-50"
                                                : "border-gray-200 hover:border-emerald-300"
                                        }`}
                                    >
                                        <div className="text-2xl font-bold text-gray-900">${tier.amount}</div>
                                        <div className="text-xs text-gray-500 mt-1">{tier.impact}</div>
                                    </button>
                                ))}
                            </div>
                            <div className="mt-4">
                                <label className="text-sm text-gray-600 mb-2 block">Or enter custom amount</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                    <input
                                        type="number"
                                        value={customAmount}
                                        onChange={(e) => {
                                            setCustomAmount(e.target.value);
                                            setSelectedAmount(null);
                                        }}
                                        placeholder="Enter amount"
                                        className="w-full ps-8 pe-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button size="lg" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white">
                                <Heart className="me-2 w-5 h-5" />
                                Donate ${customAmount || selectedAmount || 0}
                            </Button>
                            <Button size="lg" variant="outline" className="border-gray-300">
                                Monthly Giving
                            </Button>
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-100 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
                            <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-emerald-600" />
                                Secure Donation
                            </div>
                            <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-emerald-600" />
                                Tax Deductible
                            </div>
                            <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-emerald-600" />
                                100% to Programs
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Programs Section */}
            <section ref={impactRef} className="py-24 px-4">
                <div className="container mx-auto max-w-7xl">
                    <ScrollReveal>
                        <div className="text-center mb-16">
                            <span className="text-emerald-600 text-sm tracking-widest uppercase font-semibold">
                                Our Programs
                            </span>
                            <h2 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
                                Where Your Donation Goes
                            </h2>
                            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                                We focus on sustainable programs that create lasting impact in communities worldwide.
                            </p>
                        </div>
                    </ScrollReveal>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {programs.map((program, index) => (
                            <motion.div
                                key={index}
                                data-impact-card
                                whileHover={{ y: -8 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Card className="h-full overflow-hidden border-0 shadow-lg">
                                    <div className="aspect-[4/3] overflow-hidden">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={program.image}
                                            alt={program.title}
                                            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                                        />
                                    </div>
                                    <CardContent className="p-6">
                                        <h3 className="text-xl font-bold mb-2">{program.title}</h3>
                                        <p className="text-gray-600 mb-4">{program.description}</p>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">Progress</span>
                                                <span className="font-semibold">
                                                    ${(program.raised / 1000).toFixed(0)}K / ${(program.goal / 1000).toFixed(0)}K
                                                </span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-emerald-500 rounded-full"
                                                    style={{ width: `${(program.raised / program.goal) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Stories Section */}
            <section className="py-24 px-4 bg-gray-50">
                <div className="container mx-auto max-w-7xl">
                    <ScrollReveal>
                        <div className="text-center mb-16">
                            <span className="text-emerald-600 text-sm tracking-widest uppercase font-semibold">
                                Impact Stories
                            </span>
                            <h2 className="text-4xl md:text-5xl font-bold mt-4">
                                Real Stories, Real Change
                            </h2>
                        </div>
                    </ScrollReveal>

                    <StaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {stories.map((story, index) => (
                            <Card key={index} className="bg-white border-0 shadow-sm overflow-hidden">
                                <div className="aspect-[4/3] overflow-hidden">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={story.image}
                                        alt={story.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <CardContent className="p-6">
                                    <Quote className="w-8 h-8 text-emerald-200 mb-4" />
                                    <p className="text-gray-600 mb-6 leading-relaxed">&ldquo;{story.quote}&rdquo;</p>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-semibold text-gray-900">{story.name}</div>
                                            <div className="text-sm text-gray-500">{story.location}</div>
                                        </div>
                                        <button className="text-emerald-600 hover:text-emerald-700 font-medium text-sm flex items-center gap-1">
                                            Read More
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </StaggerGrid>
                </div>
            </section>

            {/* Volunteer CTA */}
            <section className="py-24 px-4">
                <div className="container mx-auto max-w-6xl">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <ScrollReveal>
                            <div className="space-y-6">
                                <span className="text-emerald-600 text-sm tracking-widest uppercase font-semibold">
                                    Join Our Team
                                </span>
                                <h2 className="text-4xl md:text-5xl font-bold leading-tight">
                                    Become a Volunteer
                                </h2>
                                <p className="text-lg text-gray-600 leading-relaxed">
                                    Your time and skills can make a tremendous impact. Join our global network of volunteers
                                    and help us bring change to communities in need.
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { icon: Globe, label: "Global Opportunities" },
                                        { icon: Calendar, label: "Flexible Schedule" },
                                        { icon: Users, label: "Team Environment" },
                                        { icon: Award, label: "Make an Impact" },
                                    ].map((item, index) => (
                                        <div key={index} className="flex items-center gap-3">
                                            <item.icon className="w-5 h-5 text-emerald-600" />
                                            <span className="text-gray-700">{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white px-8">
                                    Apply to Volunteer
                                    <ArrowRight className="ms-2 w-5 h-5" />
                                </Button>
                            </div>
                        </ScrollReveal>
                        <ScrollReveal delay={0.2}>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=400&q=80",
                                    "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=400&q=80",
                                    "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=400&q=80",
                                    "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=400&q=80",
                                ].map((src, index) => (
                                    <div
                                        key={index}
                                        className={`rounded-2xl overflow-hidden ${index % 2 === 1 ? "mt-8" : ""}`}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={src}
                                            alt={`Volunteer ${index + 1}`}
                                            className="w-full h-48 object-cover"
                                        />
                                    </div>
                                ))}
                            </div>
                        </ScrollReveal>
                    </div>
                </div>
            </section>

            {/* Partners/Trust Section */}
            <section className="py-16 px-4 bg-gray-50">
                <div className="container mx-auto max-w-6xl">
                    <ScrollReveal>
                        <div className="text-center mb-12">
                            <h3 className="text-lg text-gray-500 mb-8">Trusted by Leading Organizations</h3>
                            <div className="flex flex-wrap items-center justify-center gap-12 opacity-50">
                                {["UNICEF", "WHO", "Red Cross", "UNDP", "World Bank"].map((partner) => (
                                    <div key={partner} className="text-2xl font-bold text-gray-400">
                                        {partner}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </ScrollReveal>
                </div>
            </section>

            {/* Contact Section */}
            <section className="py-24 px-4">
                <div className="container mx-auto max-w-4xl">
                    <ScrollReveal>
                        <div className="text-center mb-12">
                            <h2 className="text-4xl font-bold mb-4">Get in Touch</h2>
                            <p className="text-gray-600">
                                Have questions? We&apos;d love to hear from you.
                            </p>
                        </div>
                    </ScrollReveal>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { icon: Mail, label: "Email", value: "hello@nonprofit.org" },
                            { icon: Phone, label: "Phone", value: "+1 (555) 123-4567" },
                            { icon: MapPin, label: "Address", value: "123 Hope Street, NY 10001" },
                        ].map((contact, index) => (
                            <div key={index} className="text-center">
                                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                                    <contact.icon className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div className="font-semibold text-gray-900">{contact.label}</div>
                                <div className="text-gray-600">{contact.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer spacing */}
            <div className="h-20 bg-gray-50" />
        </div>
    );
}
