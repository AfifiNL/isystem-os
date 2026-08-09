"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cpu, Menu, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const NAV_LINKS = [
    { href: "/", label: "Home" },
    { href: "/blog", label: "Blog" },
    { href: "/about", label: "About" },
    { href: "/videos", label: "Videos" },
    { href: "/contact", label: "Contact" },
];

export function PublicNavbar() {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const navRef = useRef<HTMLElement>(null);
    const mobileMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Animate navbar in on mount
    useGSAP(
        () => {
            if (!navRef.current) return;
            gsap.fromTo(
                navRef.current,
                { y: -100, autoAlpha: 0 },
                { y: 0, autoAlpha: 1, duration: 0.8, ease: "power3.out", delay: 0.2 }
            );
        },
        { scope: navRef }
    );

    // Animate mobile menu
    useGSAP(
        () => {
            if (!mobileMenuRef.current) return;
            if (mobileOpen) {
                gsap.fromTo(
                    mobileMenuRef.current,
                    { autoAlpha: 0, y: -20 },
                    { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out" }
                );
                gsap.from(mobileMenuRef.current.querySelectorAll("a"), {
                    x: -30,
                    autoAlpha: 0,
                    stagger: 0.05,
                    duration: 0.3,
                    ease: "power2.out",
                    delay: 0.1,
                });
            }
        },
        { scope: mobileMenuRef, dependencies: [mobileOpen] }
    );

    return (
        <>
            <header
                ref={navRef}
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
                    ? "bg-background/90 backdrop-blur-xl border-b border-border/40 shadow-sm"
                    : "bg-transparent border-b border-transparent"
                    }`}
                style={{ visibility: "hidden" }}
            >
                <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
                    {/* Brand */}
                    <Link href="/" className="flex items-center gap-2.5 group">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-shadow">
                            <Cpu className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-bold text-lg tracking-tight text-foreground">
                            hossam<span className="text-violet-600">afifi</span>
                        </span>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-1">
                        {NAV_LINKS.map((link) => {
                            const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isActive
                                        ? "text-foreground bg-muted"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                        }`}
                                >
                                    {link.label}
                                    {isActive && (
                                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-violet-600 rounded-full" />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* CTA + Mobile Toggle */}
                    <div className="flex items-center gap-3">
                        <Button
                            asChild
                            size="sm"
                            className="hidden sm:inline-flex bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/20 border-0"
                        >
                            <Link href="/newsletter">Subscribe</Link>
                        </Button>

                        <button
                            onClick={() => setMobileOpen(!mobileOpen)}
                            className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
                            aria-label="Toggle menu"
                        >
                            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Menu */}
            {mobileOpen && (
                <div
                    ref={mobileMenuRef}
                    className="fixed inset-0 top-16 z-40 bg-background/98 backdrop-blur-2xl md:hidden"
                    style={{ visibility: "hidden" }}
                >
                    <nav className="flex flex-col p-6 space-y-1">
                        {NAV_LINKS.map((link) => {
                            const isActive = pathname === link.href;
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setMobileOpen(false)}
                                    className={`px-4 py-3 rounded-xl text-lg font-medium transition-colors ${isActive
                                        ? "bg-violet-600/10 text-violet-600"
                                        : "text-foreground hover:bg-muted"
                                        }`}
                                >
                                    {link.label}
                                </Link>
                            );
                        })}
                        <div className="pt-4">
                            <Button
                                asChild
                                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
                            >
                                <Link href="/newsletter" onClick={() => setMobileOpen(false)}>
                                    Subscribe to Newsletter
                                </Link>
                            </Button>
                        </div>
                    </nav>
                </div>
            )}
        </>
    );
}
