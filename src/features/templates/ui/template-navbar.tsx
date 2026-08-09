"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Globe } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useTemplate } from "@/features/templates/template-provider";
import { LanguageSwitcher } from "./language-switcher";
import { getLocalizedSiteChromeText } from "@/features/site-chrome/schema";
import { localizeHref, stripLocaleFromPathname } from "@/shared/lib/i18n/routing";
import { pickLocaleText } from "@/shared/lib/i18n/resolve";
import { resolveNavbarLogoUrl } from "./template-footer-visuals";

export function TemplateNavbar() {
    const { config, locale, siteName, siteChrome, chromeOverrides } = useTemplate();
    const pathname = usePathname();
    const publicPathname = stripLocaleFromPathname(pathname || "/");
    const isFacilityServices = config.id === "facility-services";
    const isIsystemAgency = config.id === "isystem-agency";
    const isLightPublicTheme = config.appearance?.defaultMode === "light";
    const navTextClass = isLightPublicTheme ? "text-[var(--template-text-primary)]" : "text-[var(--template-text-inverse)]";
    const navMutedClass = isLightPublicTheme ? "text-[var(--template-text-secondary)]" : "text-[var(--template-text-inverse-muted)]";
    const navHoverClass = isLightPublicTheme ? "hover:bg-white/70 hover:text-[var(--template-text-primary)]" : "hover:bg-white/5 hover:text-[var(--template-text-inverse)]";
    const navBorderClass = isLightPublicTheme ? "border-[var(--template-border-soft)]" : "border-[var(--template-border-inverse)]";
    const navSurfaceClass = isIsystemAgency
        ? "[background:var(--public-paper)] shadow-none backdrop-blur-0"
        : "[background:var(--template-surface-glass)] shadow-[var(--template-depth-md)] backdrop-blur-[22px]";
    const menuSurfaceClass = isIsystemAgency
        ? "[background:var(--public-paper)] shadow-[var(--public-shadow-evidence)] backdrop-blur-0"
        : "[background:var(--template-surface-glass)] shadow-[var(--template-depth-lg)] backdrop-blur-[26px]";
    const navRadiusClass = isIsystemAgency ? "rounded-[var(--public-radius-md)]" : "rounded-[var(--template-radius-pill)]";
    const brandLogoUrl = resolveNavbarLogoUrl({
        templateId: config.id,
        navbarLogoUrl: siteChrome.brand.navbarLogoUrl,
        isLightSurface: isLightPublicTheme,
    });
    const [mobileOpen, setMobileOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const mobileMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!mobileOpen) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setMobileOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [mobileOpen]);

    useGSAP(
        () => {
            if (!mobileMenuRef.current) return;
            if (mobileOpen) {
                gsap.fromTo(mobileMenuRef.current, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.24, ease: "power2.out" });
                gsap.from(mobileMenuRef.current.querySelectorAll("a, button"), {
                    x: -18, opacity: 0, stagger: 0.035, duration: 0.22, ease: "power2.out", delay: 0.05,
                });
            }
        },
        { scope: mobileMenuRef, dependencies: [mobileOpen] }
    );

    const desktopCta = chromeOverrides?.ctaVariant === "mobile" ? siteChrome.navbar.mobileCta : siteChrome.navbar.cta;
    const bookingCtaFallback = {
        enabled: true,
        href: "/booking",
        label: {
            en: "Book the free Systems Fit Call",
            nl: "Plan de gratis Systems Fit Call",
            ar: "احجز مكالمة ملاءمة الأنظمة المجانية",
        },
    };
    const mobileMenuCtas = [bookingCtaFallback, siteChrome.navbar.cta, siteChrome.navbar.mobileCta].filter((cta, index, ctas) => {
        if (!cta.enabled) return false;
        const href = cta.href.trim();
        const label = getLocalizedSiteChromeText(locale, cta.label).trim();
        return href.length > 0 && label.length > 0 && ctas.findIndex((candidate) => candidate.enabled && candidate.href.trim() === href) === index;
    });
    const brandName = getLocalizedSiteChromeText(locale, siteChrome.brand.name) || siteName;
    const brandAccentText = getLocalizedSiteChromeText(locale, siteChrome.brand.accentText);
    const toLocalizedHref = (href: string) => localizeHref(locale, href);

    const menuByHref = new Map(
        (siteChrome.navbar.menus ?? []).map((menu) => [menu.href ?? "", menu]),
    );

    if (chromeOverrides?.hideNavbar) {
        return null;
    }

    return (
        <>
            <header
                className={`fixed top-0 left-0 right-0 z-[70] transition-all duration-300 ${scrolled || mobileOpen
                    ? `border-b ${navBorderClass} ${navSurfaceClass}`
                    : "bg-transparent border-b border-transparent"
                    }`}
            >
                <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6 [font-family:var(--font-inter)]">
                    {/* Brand */}
                    <Link href={toLocalizedHref(siteChrome.brand.homeHref)} className="flex items-center gap-2.5 group min-w-0">
                        {brandLogoUrl ? (
                            <>
                                <img
                                    src={brandLogoUrl}
                                    alt={siteName}
                                    className="h-10 md:h-12 w-auto max-w-[220px] md:max-w-[280px] object-contain object-left shrink-0"
                                />
                                <span className="sr-only">{brandName}</span>
                            </>
                            ) : isFacilityServices ? (
                                <>
                                    <img
                                        src="/themes/facility-services/logo.svg"
                                        alt={siteName}
                                        className="h-10 md:h-12 w-auto max-w-[220px] md:max-w-[280px] object-contain object-left shrink-0"
                                    />
                                    <span className="sr-only">{brandName}</span>
                                </>
                            ) : (
                                <>
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg transition-shadow"
                                    style={{
                                        background: `linear-gradient(135deg, var(--template-gradient-from), var(--template-gradient-to))`,
                                    }}
                                    >
                                        <Globe className="h-4 w-4 text-white" />
                                    </div>
                                    <span className={`font-bold text-lg tracking-tight ${navTextClass}`}>
                                        {brandName}
                                        {brandAccentText ? <span style={{ color: "var(--template-text-accent-strong)" }}>{brandAccentText}</span> : null}
                                    </span>
                                </>
                            )}
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-1">
                        {siteChrome.navbar.links.map((link) => {
                            const isActive = publicPathname === link.href || (link.href !== "/" && publicPathname.startsWith(link.href));
                            const submenu = menuByHref.get(link.href);
                            const localizedHref = toLocalizedHref(link.href);
                            return (
                                <div key={link.href} className="relative group">
                                    <Link
                                        href={localizedHref}
                                        className={`relative inline-flex ${navRadiusClass} px-4 py-2 text-sm font-medium transition-colors ${isActive
                                             ? `bg-[color-mix(in_oklch,var(--template-accent)_10%,transparent)] ${navTextClass}`
                                             : `${navMutedClass} ${navHoverClass}`
                                            }`}
                                    >
                                        {pickLocaleText(link.label, locale)}
                                        <span className={`absolute bottom-1 left-1/2 h-px w-6 -translate-x-1/2 origin-center rounded-full bg-[var(--template-text-accent-strong)] transition-transform duration-300 ${isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`} />
                                    </Link>
                                    {submenu ? (
                                        <div className="pointer-events-none absolute left-0 top-full z-50 pt-4 opacity-0 translate-y-2 transition-all duration-300 group-hover:pointer-events-auto group-hover:opacity-100 group-hover:translate-y-0">
                                            <div className={`w-[360px] ${isIsystemAgency ? "rounded-[var(--public-radius-lg)]" : "rounded-[var(--template-radius-xl)]"} border ${navBorderClass} ${menuSurfaceClass} p-4`}>
                                                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--template-text-accent-strong)]">{pickLocaleText(submenu.label, locale)}</p>
                                                <div className="space-y-1">
                                                    {submenu.items.map((item) => (
                                                        <Link key={item.href} href={toLocalizedHref(item.href)} className="group/item relative block rounded-[var(--template-radius-lg)] px-4 py-3 transition-colors hover:bg-white/70">
                                                            <span className="absolute inset-y-3 left-0 w-0.5 bg-[var(--template-text-accent-strong)] opacity-0 transition-opacity group-hover/item:opacity-100" />
                                                            <p className={`text-sm font-semibold ${navTextClass}`}>{pickLocaleText(item.label, locale)}</p>
                                                            {item.blurb ? <p className={`mt-1 text-xs leading-5 ${isLightPublicTheme ? "text-[var(--template-text-subtle)]" : "text-[var(--template-text-inverse-subtle)]"}`}>{pickLocaleText(item.blurb, locale)}</p> : null}
                                                        </Link>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </nav>

                    {/* Language + CTA + Mobile Toggle */}
                    <div className="flex items-center gap-3">
                        <LanguageSwitcher />
                        {desktopCta.enabled ? (
                            <Button
                                asChild
                                size="sm"
                                className={`hidden sm:inline-flex border ${isIsystemAgency ? "border-[var(--public-action)] shadow-none" : "border-[var(--template-border-accent-soft)] text-white shadow-[var(--template-depth-glow)]"}`}
                                style={{
                                    background: isIsystemAgency ? "var(--public-action)" : "linear-gradient(to right, var(--template-gradient-from), var(--template-gradient-to))",
                                }}
                            >
                                <Link href={toLocalizedHref(desktopCta.href)} data-analytics-cta="true" data-analytics-name="navbar-primary-cta" data-analytics-placement="navbar">
                                    {getLocalizedSiteChromeText(locale, desktopCta.label)}
                                </Link>
                            </Button>
                        ) : null}

                        <button
                            onClick={() => setMobileOpen(!mobileOpen)}
                            className={`md:hidden rounded-lg p-2 ${navTextClass} transition-colors ${isLightPublicTheme ? "hover:bg-black/5" : "hover:bg-white/10"}`}
                            aria-label={mobileOpen ? "Close menu" : "Open menu"}
                            aria-expanded={mobileOpen}
                            aria-controls="mobile-nav-menu"
                            type="button"
                        >
                            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Menu */}
            {mobileOpen && (
                <div
                    id="mobile-nav-menu"
                    ref={mobileMenuRef}
                    className={`fixed inset-x-0 bottom-0 top-16 z-[60] overflow-y-auto overscroll-contain border-t ${navBorderClass} ${isIsystemAgency ? "[background:var(--public-paper)] text-[var(--public-ink)] shadow-[var(--public-shadow-evidence)] backdrop-blur-0" : isLightPublicTheme ? "[background:var(--template-surface-light)] text-[var(--template-text-primary)] shadow-[var(--template-depth-lg)] backdrop-blur-[24px]" : "[background:var(--template-surface-dark-strong)] text-[var(--template-text-inverse)] shadow-[var(--template-depth-lg)] backdrop-blur-[24px]"} md:hidden`}
                    style={{ WebkitOverflowScrolling: "touch" }}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Mobile navigation"
                >
                    <nav className="flex min-h-full flex-col p-6 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
                        <div className="space-y-1">
                            {mobileMenuCtas.map((cta, ctaIndex) => (
                                <Link
                                    key={cta.href}
                                    href={toLocalizedHref(cta.href)}
                                    onClick={() => setMobileOpen(false)}
                                    data-analytics-cta="true"
                                    data-analytics-name={ctaIndex === 0 ? "navbar-mobile-booking-cta" : "navbar-mobile-cta"}
                                    data-analytics-placement="mobile-menu"
                                    className={`mb-2 block ${isIsystemAgency ? "rounded-[var(--public-radius-md)]" : "rounded-2xl"} px-4 py-4 text-lg font-semibold transition-colors ${ctaIndex === 0
                                        ? isIsystemAgency ? "bg-[var(--public-action)] text-white shadow-none" : "bg-[linear-gradient(to_right,var(--template-gradient-from),var(--template-gradient-to))] text-white shadow-[var(--template-depth-glow)]"
                                        : isLightPublicTheme
                                            ? "border border-[var(--template-border-soft)] bg-white/60 text-[var(--template-text-primary)] hover:bg-white"
                                            : "border border-white/15 bg-white/5 text-[var(--template-text-inverse)] hover:bg-white/10"
                                        }`}
                                >
                                    {getLocalizedSiteChromeText(locale, cta.label)}
                                </Link>
                            ))}
                            {siteChrome.navbar.links.map((link) => {
                                const isActive = publicPathname === link.href || (link.href !== "/" && publicPathname.startsWith(link.href));
                                const submenu = menuByHref.get(link.href);
                                const localizedHref = toLocalizedHref(link.href);
                                return (
                                    <div key={link.href} className="rounded-2xl">
                                        <Link
                                            href={localizedHref}
                                            onClick={() => setMobileOpen(false)}
                                            className={`block rounded-xl px-4 py-3 text-lg font-medium transition-colors ${isActive
                                                 ? "bg-[color-mix(in_oklch,var(--template-accent)_10%,transparent)] text-[var(--template-text-accent-strong)]"
                                                 : `${navTextClass} ${isLightPublicTheme ? "hover:bg-black/5" : "hover:bg-white/10"}`
                                                }`}
                                        >
                                            {pickLocaleText(link.label, locale)}
                                        </Link>
                                        {submenu ? (
                                            <div className={`ms-4 mt-1 space-y-1 border-s ${navBorderClass} ps-4`}>
                                                {submenu.items.map((item) => (
                                                    <Link key={item.href} href={toLocalizedHref(item.href)} onClick={() => setMobileOpen(false)} className={`block rounded-xl px-3 py-2 transition-colors ${isLightPublicTheme ? "hover:bg-black/5" : "hover:bg-white/10"}`}>
                                                        <p className={`text-sm font-medium ${navTextClass}`}>{pickLocaleText(item.label, locale)}</p>
                                                        {item.blurb ? <p className={`mt-0.5 text-xs leading-5 ${isLightPublicTheme ? "text-[var(--template-text-subtle)]" : "text-[var(--template-text-inverse-subtle)]"}`}>{pickLocaleText(item.blurb, locale)}</p> : null}
                                                    </Link>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </nav>
                </div>
            )}
        </>
    );
}
