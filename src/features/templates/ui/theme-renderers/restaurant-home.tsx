"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { ParallaxImage } from "@/shared/ui/animations/parallax-image";
import { ScrollReveal } from "@/shared/ui/animations/scroll-reveal";
import { StaggerGrid } from "@/shared/ui/animations/stagger-grid";
import {
    ArrowRight,
    Calendar,
    Clock,
    MapPin,
    Phone,
    Star,
    Utensils,
    ChefHat,
    Award,
    Quote,
    Instagram,
    ExternalLink,
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

export function RestaurantHome({ dictionary }: ThemeHomeProps) {
    useTemplate();
    const heroRef = useRef<HTMLElement>(null);
    const menuRef = useRef<HTMLElement>(null);
    const galleryRef = useRef<HTMLDivElement>(null);
    const [activeCategory, setActiveCategory] = useState("starters");

    // Hero parallax and text animation
    useGSAP(
        () => {
            if (!heroRef.current) return;
            const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

            tl.fromTo(
                "[data-hero-overlay]",
                { opacity: 0 },
                { opacity: 1, duration: 1 }
            )
                .fromTo(
                    "[data-hero-badge]",
                    { y: 30, opacity: 0 },
                    { y: 0, opacity: 1, duration: 0.8 },
                    "-=0.5"
                )
                .fromTo(
                    "[data-hero-title]",
                    { y: 60, opacity: 0 },
                    { y: 0, opacity: 1, duration: 1 },
                    "-=0.5"
                )
                .fromTo(
                    "[data-hero-subtitle]",
                    { y: 40, opacity: 0 },
                    { y: 0, opacity: 1, duration: 0.8 },
                    "-=0.6"
                )
                .fromTo(
                    "[data-hero-cta]",
                    { y: 20, opacity: 0 },
                    { y: 0, opacity: 1, duration: 0.6 },
                    "-=0.4"
                );
        },
        { scope: heroRef }
    );

    // Menu section scroll animation
    useGSAP(
        () => {
            if (!menuRef.current) return;
            gsap.fromTo(
                menuRef.current.querySelectorAll("[data-menu-item]"),
                { y: 60, opacity: 0, scale: 0.95 },
                {
                    y: 0,
                    opacity: 1,
                    scale: 1,
                    duration: 0.8,
                    stagger: 0.15,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: menuRef.current,
                        start: "top 75%",
                    },
                }
            );
        },
        { scope: menuRef }
    );

    // Gallery horizontal scroll effect
    useGSAP(
        () => {
            if (!galleryRef.current) return;
            const gallery = galleryRef.current;
            const track = gallery.querySelector("[data-gallery-track]");
            if (!track) return;

            gsap.to(track, {
                x: () => -(track.scrollWidth - gallery.offsetWidth),
                ease: "none",
                scrollTrigger: {
                    trigger: gallery,
                    start: "top bottom",
                    end: () => `+=${track.scrollWidth - gallery.offsetWidth}`,
                    scrub: 1,
                    pin: false,
                },
            });
        },
        { scope: galleryRef }
    );

    const dict = dictionary as Record<string, Record<string, string | string[] | Record<string, string>>>;
    const homeDict = (dict.home as Record<string, string | string[]>) || {};
    const menuDict = (dict.menu as Record<string, string | Record<string, string>>) || {};
    const aboutDict = (dict.about as Record<string, string>) || {};

    const menuCategories = [
        { id: "starters", label: "Starters" },
        { id: "mains", label: "Main Courses" },
        { id: "desserts", label: "Desserts" },
        { id: "wines", label: "Wines" },
    ];

    const menuItems: Record<string, Array<{ name: string; description: string; price: string }>> = {
        starters: [
            {
                name: "Tuna Tartare",
                description: "Fresh yellowfin tuna, avocado mousse, citrus ponzu",
                price: "24",
            },
            {
                name: "Burrata",
                description: "Creamy burrata, heirloom tomatoes, aged balsamic",
                price: "19",
            },
            {
                name: "Foie Gras",
                description: "Pan-seared foie gras, caramelized apple, brioche",
                price: "32",
            },
        ],
        mains: [
            {
                name: "Wagyu Ribeye",
                description: "A5 Japanese wagyu, truffle butter, roasted vegetables",
                price: "95",
            },
            {
                name: "Dover Sole",
                description: "Whole Dover sole, brown butter, capers, lemon",
                price: "68",
            },
            {
                name: "Duck Breast",
                description: "Moulard duck, cherry gastrique, parsnip purée",
                price: "48",
            },
        ],
        desserts: [
            {
                name: "Chocolate Soufflé",
                description: "Valrhona chocolate, crème anglaise",
                price: "18",
            },
            {
                name: "Crème Brûlée",
                description: "Madagascar vanilla, caramelized sugar",
                price: "14",
            },
            {
                name: "Cheese Selection",
                description: "Artisanal cheeses, honeycomb, fig compote",
                price: "22",
            },
        ],
        wines: [
            {
                name: "Château Margaux 2015",
                description: "Bordeaux, France - Full-bodied, elegant",
                price: "450",
            },
            {
                name: "Opus One 2018",
                description: "Napa Valley, USA - Rich, complex",
                price: "380",
            },
            {
                name: "Dom Pérignon 2012",
                description: "Champagne, France - Crisp, refined",
                price: "290",
            },
        ],
    };

    return (
        <div className="min-h-screen bg-stone-50 text-stone-900">
            {/* Hero Section with Parallax */}
            <section ref={heroRef} className="relative h-screen overflow-hidden">
                {/* Background Image with Parallax */}
                <div className="absolute inset-0">
                    <ParallaxImage
                        src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1920&q=80"
                        alt="Fine dining restaurant ambiance"
                        className="h-full w-full"
                        speed={0.5}
                    />
                </div>

                {/* Overlay */}
                <div
                    data-hero-overlay
                    className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70"
                />

                {/* Content */}
                <div className="relative z-10 h-full flex flex-col items-center justify-center text-center text-white px-4">
                    {/* Badge */}
                    <div
                        data-hero-badge
                        className="mb-6 opacity-0"
                        style={{ visibility: "hidden" }}
                    >
                        <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-white/30 bg-white/10 backdrop-blur-sm text-sm tracking-widest uppercase">
                            <Award className="w-4 h-4" />
                            Michelin Star Restaurant
                        </span>
                    </div>

                    {/* Title with Serif Font */}
                    <h1
                        data-hero-title
                        className="text-5xl md:text-7xl lg:text-8xl font-serif font-light tracking-wide mb-6 opacity-0"
                        style={{ visibility: "hidden" }}
                    >
                        {(homeDict.title as string) || "Maison"}
                        <span className="block italic text-amber-300 mt-2">
                            {(homeDict.titleHighlight as string) || "Élégance"}
                        </span>
                    </h1>

                    {/* Subtitle */}
                    <p
                        data-hero-subtitle
                        className="text-xl md:text-2xl text-white/80 max-w-2xl mb-10 font-light leading-relaxed opacity-0"
                        style={{ visibility: "hidden" }}
                    >
                        {(homeDict.subtitle as string) ||
                            "An unforgettable culinary journey through contemporary French cuisine"}
                    </p>

                    {/* CTA Buttons */}
                    <div
                        data-hero-cta
                        className="flex flex-col sm:flex-row gap-4 opacity-0"
                        style={{ visibility: "hidden" }}
                    >
                        <Button
                            size="lg"
                            className="bg-amber-600 hover:bg-amber-500 text-white px-8 py-6 text-lg tracking-wide"
                        >
                            <Calendar className="me-2 w-5 h-5" />
                            Reserve a Table
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="border-white/40 bg-transparent hover:bg-white/10 text-white px-8 py-6 text-lg tracking-wide"
                        >
                            <Utensils className="me-2 w-5 h-5" />
                            View Menu
                        </Button>
                    </div>
                </div>

                {/* Scroll Indicator */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
                    <div className="w-6 h-10 rounded-full border-2 border-white/40 flex items-start justify-center p-2">
                        <div className="w-1 h-2 bg-white/60 rounded-full" />
                    </div>
                </div>
            </section>

            {/* About Section */}
            <section className="py-24 px-4">
                <div className="container mx-auto max-w-6xl">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <ScrollReveal>
                            <div className="space-y-6">
                                <span className="text-amber-700 text-sm tracking-widest uppercase font-medium">
                                    Our Story
                                </span>
                                <h2 className="text-4xl md:text-5xl font-serif font-light text-stone-900 leading-tight">
                                    {(aboutDict.headline as string) ||
                                        "A Passion for Culinary Excellence"}
                                </h2>
                                <p className="text-lg text-stone-600 leading-relaxed">
                                    {(aboutDict.description as string) ||
                                        "Founded in 2010, our restaurant has been dedicated to creating memorable dining experiences. Our chef combines traditional French techniques with modern innovation, using only the finest seasonal ingredients sourced from local farms and trusted suppliers."}
                                </p>
                                <div className="flex gap-8 pt-4">
                                    <div className="text-center">
                                        <div className="text-4xl font-serif text-amber-700">15</div>
                                        <div className="text-sm text-stone-500 uppercase tracking-wide">
                                            Years
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-4xl font-serif text-amber-700">3</div>
                                        <div className="text-sm text-stone-500 uppercase tracking-wide">
                                            Michelin Stars
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-4xl font-serif text-amber-700">50k+</div>
                                        <div className="text-sm text-stone-500 uppercase tracking-wide">
                                            Guests
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ScrollReveal>
                        <ScrollReveal delay={0.2}>
                            <div className="relative">
                                <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src="https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?w=800&q=80"
                                        alt="Chef preparing dish"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="absolute -bottom-6 -left-6 bg-amber-600 text-white p-6 rounded-xl shadow-xl">
                                    <ChefHat className="w-8 h-8 mb-2" />
                                    <div className="font-serif text-lg">Chef Marcus</div>
                                    <div className="text-amber-200 text-sm">Executive Chef</div>
                                </div>
                            </div>
                        </ScrollReveal>
                    </div>
                </div>
            </section>

            {/* Menu Highlights Section */}
            <section ref={menuRef} className="py-24 px-4 bg-stone-100">
                <div className="container mx-auto max-w-6xl">
                    <ScrollReveal>
                        <div className="text-center mb-16">
                            <span className="text-amber-700 text-sm tracking-widest uppercase font-medium">
                                Culinary Art
                            </span>
                            <h2 className="text-4xl md:text-5xl font-serif font-light text-stone-900 mt-4 mb-6">
                                {(menuDict.title as string) || "Our Menu"}
                            </h2>
                            <p className="text-lg text-stone-600 max-w-2xl mx-auto">
                                Each dish is a celebration of flavors, textures, and artistry
                            </p>
                        </div>
                    </ScrollReveal>

                    {/* Category Tabs */}
                    <div className="flex justify-center gap-4 mb-12 flex-wrap">
                        {menuCategories.map((category) => (
                            <button
                                key={category.id}
                                onClick={() => setActiveCategory(category.id)}
                                className={`px-6 py-3 rounded-full text-sm tracking-wide transition-all ${
                                    activeCategory === category.id
                                        ? "bg-amber-600 text-white"
                                        : "bg-white text-stone-600 hover:bg-amber-50"
                                }`}
                            >
                                {category.label}
                            </button>
                        ))}
                    </div>

                    {/* Menu Items */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {menuItems[activeCategory]?.map((item, index) => (
                            <div
                                key={index}
                                data-menu-item
                                className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-shadow duration-300"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-serif text-xl text-stone-900">{item.name}</h3>
                                    <span className="text-amber-700 font-semibold">${item.price}</span>
                                </div>
                                <p className="text-stone-500 text-sm leading-relaxed">
                                    {item.description}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="text-center mt-12">
                        <Button
                            size="lg"
                            variant="outline"
                            className="border-amber-600 text-amber-700 hover:bg-amber-50 px-8"
                        >
                            View Full Menu
                            <ArrowRight className="ms-2 w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </section>

            {/* Chef Spotlight */}
            <section className="py-24 px-4 bg-stone-900 text-white">
                <div className="container mx-auto max-w-6xl">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div className="relative order-2 lg:order-1">
                            <div className="aspect-square rounded-2xl overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src="https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=800&q=80"
                                    alt="Chef Marcus in kitchen"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="absolute -top-4 -right-4 w-32 h-32 border-2 border-amber-500 rounded-2xl" />
                        </div>
                        <div className="order-1 lg:order-2">
                            <ScrollReveal>
                                <span className="text-amber-400 text-sm tracking-widest uppercase font-medium">
                                    Meet Our Chef
                                </span>
                                <h2 className="text-4xl md:text-5xl font-serif font-light mt-4 mb-6">
                                    Chef Marcus Laurent
                                </h2>
                                <Quote className="w-12 h-12 text-amber-500/30 mb-6" />
                                <blockquote className="text-xl text-stone-300 leading-relaxed mb-8 italic">
                                    &ldquo;Cooking is an art, and like any art, it requires patience, passion,
                                    and a deep respect for the ingredients. Every dish we create tells a
                                    story of tradition, innovation, and love.&rdquo;
                                </blockquote>
                                <div className="flex items-center gap-4">
                                    <div className="flex gap-1">
                                        {[...Array(3)].map((_, i) => (
                                            <Star
                                                key={i}
                                                className="w-5 h-5 fill-amber-500 text-amber-500"
                                            />
                                        ))}
                                    </div>
                                    <span className="text-stone-400">Michelin Starred Chef</span>
                                </div>
                            </ScrollReveal>
                        </div>
                    </div>
                </div>
            </section>

            {/* Gallery Section with Horizontal Scroll */}
            <section className="py-24 px-4 overflow-hidden">
                <div className="container mx-auto max-w-6xl mb-12">
                    <ScrollReveal>
                        <div className="text-center">
                            <span className="text-amber-700 text-sm tracking-widest uppercase font-medium">
                                Visual Journey
                            </span>
                            <h2 className="text-4xl md:text-5xl font-serif font-light text-stone-900 mt-4">
                                Our Gallery
                            </h2>
                        </div>
                    </ScrollReveal>
                </div>
                <div ref={galleryRef} className="overflow-hidden">
                    <div data-gallery-track className="flex gap-6 px-4" style={{ width: "max-content" }}>
                        {[
                            "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80",
                            "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600&q=80",
                            "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
                            "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=600&q=80",
                            "https://images.unsplash.com/photo-1515669097368-22e68427d265?w=600&q=80",
                            "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
                        ].map((src, index) => (
                            <div
                                key={index}
                                className="w-80 h-96 flex-shrink-0 rounded-2xl overflow-hidden group"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={src}
                                    alt={`Gallery image ${index + 1}`}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Reservation CTA */}
            <section className="py-24 px-4 bg-gradient-to-br from-amber-700 to-amber-900 text-white">
                <div className="container mx-auto max-w-4xl text-center">
                    <ScrollReveal>
                        <h2 className="text-4xl md:text-5xl font-serif font-light mb-6">
                            Reserve Your Table
                        </h2>
                        <p className="text-xl text-amber-100/80 mb-10 max-w-2xl mx-auto">
                            Join us for an unforgettable dining experience. We recommend booking at
                            least 2 weeks in advance for weekend reservations.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                            <Button
                                size="lg"
                                className="bg-white text-amber-900 hover:bg-amber-50 px-8 py-6 text-lg"
                            >
                                <Calendar className="me-2 w-5 h-5" />
                                Book Online
                            </Button>
                            <Button
                                size="lg"
                                variant="outline"
                                className="border-white/40 bg-transparent hover:bg-white/10 text-white px-8 py-6 text-lg"
                            >
                                <Phone className="me-2 w-5 h-5" />
                                +1 (555) 123-4567
                            </Button>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-amber-100/80">
                            <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5" />
                                <span>Tue-Sun: 6PM - 11PM</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin className="w-5 h-5" />
                                <span>123 Gourmet Avenue, New York</span>
                            </div>
                        </div>
                    </ScrollReveal>
                </div>
            </section>

            {/* Testimonials */}
            <section className="py-24 px-4 bg-stone-100">
                <div className="container mx-auto max-w-6xl">
                    <ScrollReveal>
                        <div className="text-center mb-16">
                            <span className="text-amber-700 text-sm tracking-widest uppercase font-medium">
                                Guest Experiences
                            </span>
                            <h2 className="text-4xl md:text-5xl font-serif font-light text-stone-900 mt-4">
                                What Our Guests Say
                            </h2>
                        </div>
                    </ScrollReveal>

                    <StaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                quote:
                                    "An extraordinary culinary journey. Every course was a masterpiece of flavor and presentation.",
                                author: "James M.",
                                rating: 5,
                            },
                            {
                                quote:
                                    "The best dining experience we've ever had. The chef's tasting menu was absolutely phenomenal.",
                                author: "Sarah L.",
                                rating: 5,
                            },
                            {
                                quote:
                                    "Impeccable service, stunning atmosphere, and food that transcends expectations. A must-visit.",
                                author: "Michael R.",
                                rating: 5,
                            },
                        ].map((testimonial, index) => (
                            <Card key={index} className="bg-white border-0 shadow-sm">
                                <CardContent className="pt-8">
                                    <div className="flex gap-1 mb-4">
                                        {[...Array(testimonial.rating)].map((_, i) => (
                                            <Star
                                                key={i}
                                                className="w-5 h-5 fill-amber-500 text-amber-500"
                                            />
                                        ))}
                                    </div>
                                    <Quote className="w-8 h-8 text-amber-200 mb-4" />
                                    <p className="text-stone-600 leading-relaxed mb-6">
                                        &ldquo;{testimonial.quote}&rdquo;
                                    </p>
                                    <div className="font-medium text-stone-900">
                                        {testimonial.author}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </StaggerGrid>
                </div>
            </section>

            {/* Instagram Section */}
            <section className="py-24 px-4">
                <div className="container mx-auto max-w-6xl">
                    <ScrollReveal>
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-serif font-light text-stone-900 mb-4">
                                Follow Our Journey
                            </h2>
                            <a
                                href="#"
                                className="inline-flex items-center gap-2 text-amber-700 hover:text-amber-600"
                            >
                                <Instagram className="w-5 h-5" />
                                @maisonrestaurant
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    </ScrollReveal>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {[
                            "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&q=80",
                            "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&q=80",
                            "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80",
                            "https://images.unsplash.com/photo-1482049016gy-2d1ec7ab7445?w=400&q=80",
                            "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80",
                            "https://images.unsplash.com/photo-1560717789-0ac7c58ac90a?w=400&q=80",
                        ].map((src, index) => (
                            <div
                                key={index}
                                className="aspect-square rounded-lg overflow-hidden group cursor-pointer"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={src}
                                    alt={`Instagram post ${index + 1}`}
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer spacing */}
            <div className="h-20 bg-stone-100" />
        </div>
    );
}
