"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@/shared/ui/button";
import {
    ArrowRight,
    ArrowUpRight,
    Menu,
    X,
    Quote,
    Instagram,
    Twitter,
    Linkedin,
    Dribbble,
    ChevronDown,
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

export function CreativeAgencyHome({ dictionary }: ThemeHomeProps) {
    useTemplate();
    const containerRef = useRef<HTMLDivElement>(null);
    const heroRef = useRef<HTMLElement>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeProject, setActiveProject] = useState<number | null>(null);
    const [formState, setFormState] = useState({ name: "", email: "", message: "" });

    // GSAP scroll animations
    useGSAP(
        () => {
            if (!containerRef.current) return;

            // Hero text animation
            gsap.fromTo(
                "[data-hero-line]",
                { y: 100, opacity: 0 },
                { y: 0, opacity: 1, duration: 1.2, stagger: 0.15, ease: "power4.out" }
            );

            // Marquee animation
            gsap.to("[data-marquee]", {
                xPercent: -50,
                ease: "none",
                duration: 20,
                repeat: -1,
            });

            // Scroll-triggered reveals
            const sections = containerRef.current.querySelectorAll("[data-section]");
            sections.forEach((section) => {
                gsap.fromTo(
                    section,
                    { y: 100, opacity: 0 },
                    {
                        y: 0,
                        opacity: 1,
                        duration: 1,
                        ease: "power3.out",
                        scrollTrigger: {
                            trigger: section,
                            start: "top 80%",
                        },
                    }
                );
            });

            // Project cards stagger
            gsap.fromTo(
                "[data-project-card]",
                { y: 150, opacity: 0, rotateY: 10 },
                {
                    y: 0,
                    opacity: 1,
                    rotateY: 0,
                    duration: 1,
                    stagger: 0.2,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: "[data-projects-grid]",
                        start: "top 70%",
                    },
                }
            );
        },
        { scope: containerRef }
    );

    const dict = dictionary as Record<string, Record<string, string | string[] | Record<string, string>>>;
    const homeDict = (dict.home as Record<string, string | string[]>) || {};

    const projects = [
        {
            id: 1,
            title: "Nebula Digital",
            category: "Brand Identity",
            image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80",
            color: "#FF6B6B",
        },
        {
            id: 2,
            title: "Horizon Labs",
            category: "Web Design",
            image: "https://images.unsplash.com/photo-1634017839464-5c339bbe3c35?w=800&q=80",
            color: "#4ECDC4",
        },
        {
            id: 3,
            title: "Pulse Audio",
            category: "Product Design",
            image: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=800&q=80",
            color: "#FFE66D",
        },
        {
            id: 4,
            title: "Vertex Studio",
            category: "3D Experience",
            image: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&q=80",
            color: "#95E1D3",
        },
        {
            id: 5,
            title: "Echo Systems",
            category: "Motion Design",
            image: "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&q=80",
            color: "#DDA0DD",
        },
        {
            id: 6,
            title: "Nova Finance",
            category: "App Design",
            image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
            color: "#87CEEB",
        },
    ];

    const services = [
        { number: "01", title: "Brand Strategy", description: "Crafting distinctive identities that resonate" },
        { number: "02", title: "Digital Design", description: "Pixel-perfect interfaces that convert" },
        { number: "03", title: "Development", description: "Cutting-edge tech, seamless experiences" },
        { number: "04", title: "Motion & 3D", description: "Bringing ideas to life through movement" },
    ];

    const clients = [
        "GOOGLE", "NIKE", "APPLE", "SPOTIFY", "NETFLIX", "AMAZON", "META", "STRIPE"
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Handle form submission
        console.log("Form submitted:", formState);
    };

    return (
        <div ref={containerRef} className="min-h-screen bg-black text-white">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-6 mix-blend-difference">
                <Link href="/" className="text-xl font-bold tracking-tighter">
                    STUDIO<span className="text-red-500">.</span>
                </Link>
                <div className="hidden md:flex items-center gap-12">
                    {["Work", "Services", "About", "Contact"].map((item) => (
                        <Link
                            key={item}
                            href={`#${item.toLowerCase()}`}
                            className="text-sm font-medium hover:text-red-500 transition-colors"
                        >
                            {item}
                        </Link>
                    ))}
                </div>
                <button
                    onClick={() => setMenuOpen(true)}
                    className="md:hidden p-2"
                >
                    <Menu className="w-6 h-6" />
                </button>
            </nav>

            {/* Mobile Menu */}
            <AnimatePresence>
                {menuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center"
                    >
                        <button
                            onClick={() => setMenuOpen(false)}
                            className="absolute top-6 right-6 p-2"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <div className="space-y-8 text-center">
                            {["Work", "Services", "About", "Contact"].map((item, index) => (
                                <motion.div
                                    key={item}
                                    initial={{ y: 50, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: index * 0.1 }}
                                >
                                    <Link
                                        href={`#${item.toLowerCase()}`}
                                        onClick={() => setMenuOpen(false)}
                                        className="text-5xl font-bold hover:text-red-500 transition-colors"
                                    >
                                        {item}
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hero Section */}
            <section ref={heroRef} className="min-h-screen flex flex-col justify-center px-6 md:px-12 pt-24">
                <div className="max-w-7xl mx-auto w-full">
                    <div className="overflow-hidden">
                        <h1 data-hero-line className="text-6xl md:text-8xl lg:text-[12rem] font-bold leading-[0.9] tracking-tighter">
                            WE CREATE
                        </h1>
                    </div>
                    <div className="overflow-hidden">
                        <h1 data-hero-line className="text-6xl md:text-8xl lg:text-[12rem] font-bold leading-[0.9] tracking-tighter">
                            DIGITAL
                            <span className="text-red-500">.</span>
                        </h1>
                    </div>
                    <div className="overflow-hidden">
                        <h1 data-hero-line className="text-6xl md:text-8xl lg:text-[12rem] font-bold leading-[0.9] tracking-tighter">
                            EXPERIENCES
                        </h1>
                    </div>
                    
                    <div className="mt-16 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
                        <p className="text-xl text-gray-400 max-w-md">
                            {(homeDict.subtitle as string) ||
                                "Award-winning design studio crafting bold digital experiences for forward-thinking brands."}
                        </p>
                        <Button
                            size="lg"
                            className="bg-white text-black hover:bg-gray-200 rounded-none px-8 py-6 text-lg font-medium group"
                        >
                            Start a Project
                            <ArrowUpRight className="ms-2 w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </Button>
                    </div>
                </div>

                {/* Scroll indicator */}
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-500">
                    <span className="text-xs tracking-widest uppercase">Scroll</span>
                    <ChevronDown className="w-4 h-4 animate-bounce" />
                </div>
            </section>

            {/* Marquee */}
            <div className="py-8 border-y border-gray-800 overflow-hidden">
                <div data-marquee className="flex whitespace-nowrap">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="flex items-center gap-8 px-8">
                            {clients.map((client, index) => (
                                <span key={index} className="text-2xl md:text-4xl font-bold text-gray-700">
                                    {client}
                                </span>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* Work/Portfolio Section */}
            <section id="work" className="py-32 px-6 md:px-12">
                <div className="max-w-7xl mx-auto">
                    <div data-section className="flex justify-between items-end mb-16">
                        <div>
                            <span className="text-red-500 text-sm tracking-widest uppercase font-medium">Selected Work</span>
                            <h2 className="text-5xl md:text-7xl font-bold mt-4 tracking-tight">
                                Featured<br />Projects
                            </h2>
                        </div>
                        <Link
                            href="#"
                            className="hidden md:flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                        >
                            View All
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    <div data-projects-grid className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {projects.map((project) => (
                            <motion.div
                                key={project.id}
                                data-project-card
                                className="group cursor-pointer"
                                onMouseEnter={() => setActiveProject(project.id)}
                                onMouseLeave={() => setActiveProject(null)}
                            >
                                <div className="relative aspect-[4/3] overflow-hidden bg-gray-900">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={project.image}
                                        alt={project.title}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                    <div
                                        className={`absolute inset-0 transition-opacity duration-500 ${
                                            activeProject === project.id ? "opacity-100" : "opacity-0"
                                        }`}
                                        style={{ backgroundColor: `${project.color}20` }}
                                    />
                                    <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                                        <div>
                                            <div className="text-sm text-gray-400 mb-1">{project.category}</div>
                                            <div className="text-2xl font-bold">{project.title}</div>
                                        </div>
                                        <div className="w-12 h-12 rounded-full border border-white/30 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all">
                                            <ArrowUpRight className="w-5 h-5" />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Services Section */}
            <section id="services" className="py-32 px-6 md:px-12 bg-gray-950">
                <div className="max-w-7xl mx-auto">
                    <div data-section className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                        <div>
                            <span className="text-red-500 text-sm tracking-widest uppercase font-medium">What We Do</span>
                            <h2 className="text-5xl md:text-7xl font-bold mt-4 mb-8 tracking-tight">
                                Services
                            </h2>
                            <p className="text-xl text-gray-400 max-w-md">
                                We blend creativity with technology to deliver exceptional digital experiences that drive results.
                            </p>
                        </div>
                        <div className="space-y-0">
                            {services.map((service, index) => (
                                <div
                                    key={index}
                                    className="group py-8 border-t border-gray-800 hover:border-red-500 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="text-red-500 font-mono">{service.number}</span>
                                            <h3 className="text-3xl font-bold mt-2 group-hover:text-red-500 transition-colors">
                                                {service.title}
                                            </h3>
                                            <p className="text-gray-400 mt-2">{service.description}</p>
                                        </div>
                                        <ArrowUpRight className="w-6 h-6 text-gray-600 group-hover:text-red-500 transition-colors" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* About Section */}
            <section id="about" className="py-32 px-6 md:px-12">
                <div className="max-w-7xl mx-auto">
                    <div data-section className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div className="relative">
                            <div className="aspect-square bg-gray-900 rounded-sm overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&q=80"
                                    alt="Our team"
                                    className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                                />
                            </div>
                            <div className="absolute -bottom-8 -right-8 bg-red-500 text-white p-8">
                                <div className="text-5xl font-bold">15+</div>
                                <div className="text-sm">Years of Excellence</div>
                            </div>
                        </div>
                        <div className="space-y-8">
                            <span className="text-red-500 text-sm tracking-widest uppercase font-medium">About Us</span>
                            <h2 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
                                We&apos;re a collective of designers, developers & dreamers
                            </h2>
                            <p className="text-xl text-gray-400 leading-relaxed">
                                Founded in 2009, we&apos;ve grown from a small design studio to an award-winning creative agency.
                                Our team of 50+ talented individuals brings diverse perspectives and expertise to every project.
                            </p>
                            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-gray-800">
                                <div>
                                    <div className="text-4xl font-bold">200+</div>
                                    <div className="text-gray-500 text-sm">Projects Delivered</div>
                                </div>
                                <div>
                                    <div className="text-4xl font-bold">50+</div>
                                    <div className="text-gray-500 text-sm">Team Members</div>
                                </div>
                                <div>
                                    <div className="text-4xl font-bold">35</div>
                                    <div className="text-gray-500 text-sm">Awards Won</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Testimonial */}
            <section className="py-32 px-6 md:px-12 bg-gray-950">
                <div className="max-w-5xl mx-auto text-center">
                    <Quote className="w-16 h-16 text-red-500 mx-auto mb-8" />
                    <blockquote className="text-3xl md:text-5xl font-bold leading-tight mb-12">
                        &ldquo;Working with Studio was transformative. They didn&apos;t just redesign our brand—they
                        reimagined our entire digital presence. The results exceeded all expectations.&rdquo;
                    </blockquote>
                    <div className="flex items-center justify-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gray-800 overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&q=80"
                                alt="Client"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="text-start">
                            <div className="font-semibold">David Chen</div>
                            <div className="text-gray-500 text-sm">CEO, Nebula Digital</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact Section */}
            <section id="contact" className="py-32 px-6 md:px-12">
                <div className="max-w-7xl mx-auto">
                    <div data-section className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                        <div>
                            <span className="text-red-500 text-sm tracking-widest uppercase font-medium">Get in Touch</span>
                            <h2 className="text-5xl md:text-7xl font-bold mt-4 mb-8 tracking-tight">
                                Let&apos;s Create<br />Together
                            </h2>
                            <p className="text-xl text-gray-400 mb-12">
                                Have a project in mind? We&apos;d love to hear about it. Drop us a line and let&apos;s start the conversation.
                            </p>
                            <div className="space-y-6">
                                <div>
                                    <div className="text-sm text-gray-500 mb-1">Email</div>
                                    <a href="mailto:hello@studio.com" className="text-2xl font-semibold hover:text-red-500 transition-colors">
                                        hello@studio.com
                                    </a>
                                </div>
                                <div>
                                    <div className="text-sm text-gray-500 mb-1">Phone</div>
                                    <a href="tel:+1234567890" className="text-2xl font-semibold hover:text-red-500 transition-colors">
                                        +1 (234) 567-890
                                    </a>
                                </div>
                                <div>
                                    <div className="text-sm text-gray-500 mb-1">Location</div>
                                    <div className="text-2xl font-semibold">New York, NY</div>
                                </div>
                            </div>
                            <div className="flex gap-6 mt-12">
                                {[Instagram, Twitter, Linkedin, Dribbble].map((Icon, index) => (
                                    <a
                                        key={index}
                                        href="#"
                                        className="w-12 h-12 rounded-full border border-gray-800 flex items-center justify-center hover:border-red-500 hover:text-red-500 transition-colors"
                                    >
                                        <Icon className="w-5 h-5" />
                                    </a>
                                ))}
                            </div>
                        </div>
                        <div>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="text-sm text-gray-500 mb-2 block">Name</label>
                                    <input
                                        type="text"
                                        value={formState.name}
                                        onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                                        className="w-full bg-transparent border-b border-gray-800 py-4 text-xl focus:border-red-500 focus:outline-none transition-colors"
                                        placeholder="Your name"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500 mb-2 block">Email</label>
                                    <input
                                        type="email"
                                        value={formState.email}
                                        onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                                        className="w-full bg-transparent border-b border-gray-800 py-4 text-xl focus:border-red-500 focus:outline-none transition-colors"
                                        placeholder="your@email.com"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500 mb-2 block">Message</label>
                                    <textarea
                                        value={formState.message}
                                        onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                                        rows={4}
                                        className="w-full bg-transparent border-b border-gray-800 py-4 text-xl focus:border-red-500 focus:outline-none transition-colors resize-none"
                                        placeholder="Tell us about your project"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    size="lg"
                                    className="w-full bg-red-500 hover:bg-red-600 text-white rounded-none py-6 text-lg font-medium mt-8"
                                >
                                    Send Message
                                    <ArrowRight className="ms-2 w-5 h-5" />
                                </Button>
                            </form>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 md:px-12 border-t border-gray-800">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-2xl font-bold tracking-tighter">
                        STUDIO<span className="text-red-500">.</span>
                    </div>
                    <div className="text-gray-500 text-sm">
                        © 2024 Studio. All rights reserved.
                    </div>
                    <div className="flex gap-8">
                        {["Privacy", "Terms", "Cookies"].map((item) => (
                            <Link key={item} href="#" className="text-sm text-gray-500 hover:text-white transition-colors">
                                {item}
                            </Link>
                        ))}
                    </div>
                </div>
            </footer>
        </div>
    );
}
