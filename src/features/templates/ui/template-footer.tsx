"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { Globe, ArrowRight, Instagram, Linkedin, Twitter, Facebook, Youtube, Github } from "lucide-react";
import { useTemplate } from "@/features/templates/template-provider";
import { getLocalizedSiteChromeText } from "@/features/site-chrome/schema";
import { localizeHref } from "@/shared/lib/i18n/routing";
import { resolveFooterLogoUrl } from "./template-footer-visuals";

export function TemplateFooter() {
    const { config, locale, siteName, siteChrome, chromeOverrides } = useTemplate();
    const isFacilityServices = config.id === "facility-services";
    const isIsystemAgency = config.id === "isystem-agency";
    const footerLogoUrl = resolveFooterLogoUrl({
        templateId: config.id,
        footerLogoUrl: siteChrome.brand.footerLogoUrl,
        navbarLogoUrl: siteChrome.brand.navbarLogoUrl,
    });
    const copyrightText = getLocalizedSiteChromeText(locale, siteChrome.footer.copyright).replace("{year}", new Date().getFullYear().toString());
    const toLocalizedHref = (href: string) => localizeHref(locale, href);

    if (chromeOverrides?.hideFooter) {
        return null;
    }

    const renderSocialIcon = (icon: string) => {
        switch (icon) {
            case "instagram": return <Instagram className="h-4 w-4" />;
            case "linkedin": return <Linkedin className="h-4 w-4" />;
            case "twitter": return <Twitter className="h-4 w-4" />;
            case "facebook": return <Facebook className="h-4 w-4" />;
            case "youtube": return <Youtube className="h-4 w-4" />;
            case "github": return <Github className="h-4 w-4" />;
            default: return <Globe className="h-4 w-4" />;
        }
    };

    return (
        <footer className={`relative overflow-hidden border-t border-[var(--template-border-inverse)] [background:var(--template-surface-dark)] text-[var(--template-text-inverse)] [font-family:var(--font-inter)] ${isIsystemAgency ? "isystem-public-footer" : ""}`}>
            {/* Top accent line */}
            <div
                className="absolute top-0 left-0 h-px w-full opacity-70"
                style={{ background: isIsystemAgency ? "var(--public-brass)" : "linear-gradient(90deg, transparent, color-mix(in oklch, var(--template-primary) 24%, transparent) 12%, color-mix(in oklch, var(--template-accent) 48%, transparent) 52%, transparent 88%)" }}
            />

            <div className="container mx-auto max-w-7xl px-4 md:px-8">
                {/* Main Footer */}
                <div className={`grid grid-cols-1 gap-12 py-20 ${isIsystemAgency ? "lg:grid-cols-12 lg:gap-x-14 lg:py-24" : "md:grid-cols-12"}`}>
                    {/* Brand Column */}
                    <div className={`${isIsystemAgency ? "space-y-7 lg:col-span-4" : "space-y-6 md:col-span-4"}`}>
                        <Link href={toLocalizedHref(siteChrome.brand.homeHref)} className="flex items-center gap-3 group w-fit min-w-0">
                            {footerLogoUrl ? (
                                <>
                                    <img
                                        src={footerLogoUrl}
                                        alt={siteName}
                                        className="h-12 md:h-14 w-auto max-w-[240px] md:max-w-[320px] object-contain object-left shrink-0"
                                    />
                                    <span className="sr-only">{siteName}</span>
                                </>
                            ) : isFacilityServices ? (
                                <>
                                    <img
                                        src="/themes/facility-services/logo.svg"
                                        alt={siteName}
                                        className="h-12 md:h-14 w-auto max-w-[240px] md:max-w-[320px] object-contain object-left shrink-0"
                                    />
                                    <span className="sr-only">{siteName}</span>
                                </>
                            ) : isIsystemAgency ? (
                                <>
                                    <img
                                        src="/isystem-assets/isystem-logo-dark.png"
                                        alt={siteName}
                                        className="h-12 md:h-14 w-auto max-w-[240px] md:max-w-[320px] object-contain object-left shrink-0"
                                    />
                                    <span className="sr-only">{siteName}</span>
                                </>
                            ) : (
                                <>
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-300"
                                        style={{
                                            background: `linear-gradient(135deg, var(--template-gradient-from), var(--template-gradient-to))`,
                                        }}
                                    >
                                        <Globe className="h-5 w-5 text-white" />
                                    </div>
                                    <span className="font-bold text-xl tracking-tight text-foreground group-hover:opacity-80 transition-opacity">
                                        {siteName}
                                    </span>
                                </>
                            )}
                        </Link>
                        <p className={`max-w-sm text-[var(--template-text-inverse-muted)] ${isIsystemAgency ? "text-[15px] leading-7" : "text-sm leading-relaxed"}`}>
                            {getLocalizedSiteChromeText(locale, siteChrome.footer.description)}
                        </p>
                        <div className="flex items-center gap-3 pt-4">
                            {siteChrome.footer.socialLinks.map((social) => (
                                <a
                                    key={social.label}
                                    href={social.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center justify-center rounded-full border bg-transparent text-[var(--template-text-inverse-muted)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--template-border-accent)] hover:text-[var(--template-text-inverse)] ${isIsystemAgency ? "h-11 w-11 border-[var(--public-inverse-line)]" : "h-10 w-10 border-[var(--template-border-accent-soft)] hover:shadow-[var(--template-depth-glow)]"}`}
                                    aria-label={social.label}
                                >
                                    {renderSocialIcon(social.icon)}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Link Columns */}
                    <div className={`grid grid-cols-2 ${isIsystemAgency ? "gap-x-8 gap-y-12 lg:col-span-5" : "gap-8 md:col-span-5"}`}>
                        {siteChrome.footer.groups.map((group, index) => (
                            <div key={`${group.title.en}-${index}`} className={isIsystemAgency ? "space-y-5" : "space-y-6"}>
                                <h4 className={`relative inline-flex font-semibold uppercase text-[var(--template-text-inverse)] after:absolute after:bottom-0 after:left-0 after:h-px after:bg-[var(--template-border-accent)] after:content-[''] ${isIsystemAgency ? "pb-3 text-xs tracking-[0.18em] after:w-6" : "pb-2 text-[11px] tracking-[0.24em] after:w-full"}`}>
                                    {getLocalizedSiteChromeText(locale, group.title)}
                                </h4>
                                <ul className={isIsystemAgency ? "space-y-3.5" : "space-y-3"}>
                                    {group.links.map((link, linkIndex) => (
                                        <li key={`${group.title.en}-${link.href}-${linkIndex}`}>
                                            <Link
                                                href={toLocalizedHref(link.href)}
                                                className="group inline-flex items-center gap-1.5 text-sm leading-6 text-[var(--template-text-inverse-muted)] transition-colors hover:text-[var(--template-text-inverse)]"
                                            >
                                                <span className="relative overflow-hidden">
                                                    <span className="block transition-transform duration-300 group-hover:translate-x-0.5">
                                                        {getLocalizedSiteChromeText(locale, link.label)}
                                                    </span>
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {/* Newsletter / CTA Micro-CTA */}
                    <div className={`relative space-y-6 overflow-hidden border border-[var(--template-border-inverse)] [background:var(--template-surface-inverse-raised)] ${isIsystemAgency ? "rounded-[var(--public-radius-lg)] p-7 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[var(--public-brass)] lg:col-span-3" : "rounded-[var(--template-radius-lg)] p-6 shadow-[var(--template-depth-md)] md:col-span-3"}`}>
                        <h4 className={isIsystemAgency ? "text-lg font-semibold leading-6 tracking-[-0.02em] text-[var(--template-text-inverse)]" : "text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--template-text-inverse)]"}>
                            {getLocalizedSiteChromeText(locale, siteChrome.footer.cta.title)}
                        </h4>
                        <p className="text-sm leading-relaxed text-[var(--template-text-inverse-muted)]">
                            {getLocalizedSiteChromeText(locale, siteChrome.footer.cta.description)}
                        </p>
                        <Link
                            href={toLocalizedHref(siteChrome.footer.cta.href)}
                            data-analytics-cta="true"
                            data-analytics-name="footer-cta"
                            data-analytics-placement="footer"
                            className={`group inline-flex items-center gap-2 ${isIsystemAgency ? "justify-center rounded-[var(--public-radius-md)] border-[var(--public-action)] shadow-none" : "rounded-[var(--template-radius-pill)] border-[var(--template-border-accent-soft)] hover:shadow-[var(--template-depth-glow)]"} px-6 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5`}
                            style={{
                                background: isIsystemAgency ? "var(--public-action)" : "linear-gradient(135deg, var(--template-primary), var(--template-gradient-to, var(--template-primary)))",
                                color: "#fff",
                            }}
                        >
                            {getLocalizedSiteChromeText(locale, siteChrome.footer.cta.label)}
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className={`flex flex-col items-center justify-between gap-4 border-t border-[var(--template-border-inverse)] md:flex-row ${isIsystemAgency ? "py-7" : "py-8"}`}>
                    <p className={`${isIsystemAgency ? "text-[13px]" : "text-sm"} text-[var(--template-text-inverse-subtle)]`}>
                        {copyrightText}
                    </p>
                    <div className={`flex items-center gap-6 font-medium text-[var(--template-text-inverse-subtle)] ${isIsystemAgency ? "text-[13px]" : "text-sm"}`}>
                        {siteChrome.footer.legalLinks.map((link, linkIndex) => (
                            <Link key={`${link.href}-${linkIndex}`} href={toLocalizedHref(link.href)} className="transition-colors hover:text-[var(--template-text-inverse)]">
                                {getLocalizedSiteChromeText(locale, link.label)}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    );
}
