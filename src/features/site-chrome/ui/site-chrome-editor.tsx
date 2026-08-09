"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Locale } from "@/features/templates/types";
import {
    getLocalizedSiteChromeText,
    SITE_CHROME_SOCIAL_ICONS,
    type LocalizedText,
    type SiteChromeConfig,
    type SiteChromeFooterGroup,
    type SiteChromeLink,
    type SiteChromeSocialLink,
} from "@/features/site-chrome/schema";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";

interface SiteChromeEditorProps {
    value: SiteChromeConfig;
    onChange: (value: SiteChromeConfig) => void;
    locale: Locale;
}

function updateLocalizedText(value: LocalizedText, locale: Locale, next: string): LocalizedText {
    return {
        ...value,
        [locale]: next,
    };
}

function createLink(): SiteChromeLink {
    return {
        href: "/",
        label: { en: "New link", nl: "Nieuwe link" },
    };
}

function createGroup(): SiteChromeFooterGroup {
    return {
        title: { en: "New group", nl: "Nieuwe groep" },
        links: [createLink()],
    };
}

function createSocialLink(): SiteChromeSocialLink {
    return {
        label: "GitHub",
        href: "https://github.com",
        icon: "github",
    };
}

// All three locales are rendered side-by-side so the operator can edit
// EN/NL/AR copy in one pass. The previous design only showed inputs for the
// admin's currently selected display locale, which left NL and AR fields
// permanently empty unless someone toggled the editor locale and re-saved.
const EDITABLE_LOCALES: readonly Locale[] = ["en", "nl", "ar"];
const LOCALE_LABELS: Record<Locale, string> = { en: "English", nl: "Dutch", ar: "Arabic" };

function LocalizedField({
    label,
    value,
    onChange,
    multiline = false,
}: {
    label: string;
    value: LocalizedText;
    onChange: (value: LocalizedText) => void;
    multiline?: boolean;
}) {
    return (
        <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {label}
            </label>
            <div className="space-y-2">
                {EDITABLE_LOCALES.map((entryLocale) => {
                    const current = entryLocale === "en" ? value.en : (value[entryLocale] ?? "");
                    const isRtl = entryLocale === "ar";
                    const handle = (next: string) => onChange(updateLocalizedText(value, entryLocale, next));
                    return (
                        <div key={entryLocale} className="grid gap-1.5 md:grid-cols-[80px_1fr] md:items-start">
                            <span className="pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                {entryLocale.toUpperCase()}
                                <span className="ml-1 hidden text-muted-foreground/70 md:inline">{LOCALE_LABELS[entryLocale]}</span>
                            </span>
                            {multiline ? (
                                <Textarea
                                    value={current}
                                    dir={isRtl ? "rtl" : "ltr"}
                                    onChange={(event) => handle(event.target.value)}
                                    className="min-h-20"
                                    placeholder={entryLocale === "en" ? undefined : `Optional — falls back to English if empty`}
                                />
                            ) : (
                                <Input
                                    value={current}
                                    dir={isRtl ? "rtl" : "ltr"}
                                    onChange={(event) => handle(event.target.value)}
                                    placeholder={entryLocale === "en" ? undefined : `Optional — falls back to English if empty`}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function SiteChromePreview({ value, locale }: { value: SiteChromeConfig; locale: Locale }) {
    return (
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-background shadow-sm">
            <div className="border-b border-border/60 bg-muted/30 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Live chrome preview
            </div>
            <div className="border-b border-border/60 px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        {value.brand.navbarLogoUrl ? (
                            <img src={value.brand.navbarLogoUrl} alt="Header logo" className="h-10 w-auto rounded-md border border-border/60 bg-white p-1" />
                        ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-bold text-white">
                                {getLocalizedSiteChromeText(locale, value.brand.name).charAt(0)}
                            </div>
                        )}
                        <div className="text-base font-semibold text-foreground">
                            {getLocalizedSiteChromeText(locale, value.brand.name)}
                            {getLocalizedSiteChromeText(locale, value.brand.accentText)
                                ? <span className="ml-1 text-violet-600">{getLocalizedSiteChromeText(locale, value.brand.accentText)}</span>
                                : null}
                        </div>
                    </div>
                    <div className="hidden gap-2 md:flex">
                        {value.navbar.links.map((link) => (
                            <span key={`${link.href}-${link.label.en}`} className="rounded-lg px-3 py-2 text-sm text-muted-foreground">
                                {getLocalizedSiteChromeText(locale, link.label)}
                            </span>
                        ))}
                    </div>
                    {value.navbar.cta.enabled ? (
                        <span className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white">
                            {getLocalizedSiteChromeText(locale, value.navbar.cta.label)}
                        </span>
                    ) : null}
                </div>
            </div>
            <div className="grid gap-8 px-5 py-6 md:grid-cols-[1.2fr_1fr_1fr]">
                <div className="space-y-4">
                    {value.brand.footerLogoUrl ? (
                        <img src={value.brand.footerLogoUrl} alt="Footer logo" className="h-10 w-auto rounded-md border border-border/60 bg-white p-1" />
                    ) : null}
                    <p className="text-sm leading-7 text-muted-foreground">{getLocalizedSiteChromeText(locale, value.footer.description)}</p>
                    <div className="flex flex-wrap gap-2">
                        {value.footer.socialLinks.map((social) => (
                            <span key={`${social.href}-${social.label}`} className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">
                                {social.label}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="space-y-5">
                    {value.footer.groups.map((group) => (
                        <div key={`${group.title.en}-${group.links.length}`} className="space-y-2">
                            <p className="text-sm font-semibold text-foreground">{getLocalizedSiteChromeText(locale, group.title)}</p>
                            <div className="space-y-1 text-sm text-muted-foreground">
                                {group.links.map((link) => (
                                    <div key={`${link.href}-${link.label.en}`}>{getLocalizedSiteChromeText(locale, link.label)}</div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="space-y-3">
                    <p className="text-sm font-semibold text-foreground">{getLocalizedSiteChromeText(locale, value.footer.cta.title)}</p>
                    <p className="text-sm text-muted-foreground">{getLocalizedSiteChromeText(locale, value.footer.cta.description)}</p>
                    <span className="inline-flex rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white">
                        {getLocalizedSiteChromeText(locale, value.footer.cta.label)}
                    </span>
                </div>
            </div>
            <div className="flex flex-col gap-3 border-t border-border/60 px-5 py-4 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
                <span>{getLocalizedSiteChromeText(locale, value.footer.copyright).replace("{year}", new Date().getFullYear().toString())}</span>
                <div className="flex gap-4">
                    {value.footer.legalLinks.map((link) => (
                        <span key={`${link.href}-${link.label.en}`}>{getLocalizedSiteChromeText(locale, link.label)}</span>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function SiteChromeEditor({ value, onChange }: SiteChromeEditorProps) {
    // The `locale` prop on SiteChromeEditorProps is retained for the
    // SiteChromePreview component which still renders one locale at a time.
    // The editor itself shows EN/NL/AR inputs side-by-side, so no active
    // locale needs to be threaded through.
    const [uploadingTarget, setUploadingTarget] = useState<"navbarLogo" | "footerLogo" | "favicon" | null>(null);

    const uploadAsset = async (file: File, target: "navbarLogo" | "footerLogo" | "favicon") => {
        setUploadingTarget(target);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("target", target);

            const response = await fetch("/api/site-chrome/assets/upload", {
                method: "POST",
                body: formData,
            });

            const payload = await response.json();

            if (!response.ok || !payload.asset?.url) {
                throw new Error(payload.error || "Failed to upload site chrome asset.");
            }

            onChange({
                ...value,
                brand: {
                    ...value.brand,
                    ...(target === "navbarLogo" ? { navbarLogoUrl: payload.asset.url } : {}),
                    ...(target === "footerLogo" ? { footerLogoUrl: payload.asset.url } : {}),
                    ...(target === "favicon" ? { faviconUrl: payload.asset.url } : {}),
                },
            });
        } finally {
            setUploadingTarget(null);
        }
    };

    return (
        <div className="space-y-6">
            <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">Brand</h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <LocalizedField label="Brand name" value={value.brand.name} onChange={(next) => onChange({ ...value, brand: { ...value.brand, name: next } })} />
                    <LocalizedField label="Accent text" value={value.brand.accentText} onChange={(next) => onChange({ ...value, brand: { ...value.brand, accentText: next } })} />
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Home href</label>
                        <Input value={value.brand.homeHref} onChange={(event) => onChange({ ...value, brand: { ...value.brand, homeHref: event.target.value } })} />
                    </div>
                    {([
                        ["navbarLogoUrl", "Header logo", "navbarLogo"],
                        ["footerLogoUrl", "Footer logo", "footerLogo"],
                        ["faviconUrl", "Favicon", "favicon"],
                    ] as const).map(([field, label, target]) => (
                        <div key={field} className="space-y-2 md:col-span-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</label>
                            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                                <Input
                                    value={value.brand[field] ?? ""}
                                    onChange={(event) => onChange({ ...value, brand: { ...value.brand, [field]: event.target.value } })}
                                    placeholder={`Upload or paste ${label.toLowerCase()} URL`}
                                />
                                <Input
                                    type="file"
                                    accept={target === "favicon" ? "image/*,.ico" : "image/*"}
                                    disabled={uploadingTarget === target}
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) {
                                            void uploadAsset(file, target);
                                        }
                                    }}
                                />
                            </div>
                            {value.brand[field] ? <img src={value.brand[field]} alt={label} className="h-12 w-auto rounded-md border border-border/60 bg-background p-2" /> : null}
                        </div>
                    ))}
                </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">Navbar links</h3>
                    <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, navbar: { ...value.navbar, links: [...value.navbar.links, createLink()] } })}>
                        <Plus className="mr-2 h-4 w-4" /> Add link
                    </Button>
                </div>
                <div className="space-y-4">
                    {value.navbar.links.map((link, index) => (
                        <div key={`${link.href}-${index}`} className="grid gap-4 rounded-xl border border-border/60 p-4 md:grid-cols-[1fr_1fr_auto]">
                            <LocalizedField label="Label" value={link.label} onChange={(next) => onChange({ ...value, navbar: { ...value.navbar, links: value.navbar.links.map((entry, entryIndex) => entryIndex === index ? { ...entry, label: next } : entry) } })} />
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Href</label>
                                <Input value={link.href} onChange={(event) => onChange({ ...value, navbar: { ...value.navbar, links: value.navbar.links.map((entry, entryIndex) => entryIndex === index ? { ...entry, href: event.target.value } : entry) } })} />
                            </div>
                            <div className="flex items-end">
                                <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, navbar: { ...value.navbar, links: value.navbar.links.filter((_, entryIndex) => entryIndex !== index) } })}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">Navbar CTAs</h3>
                {(["cta", "mobileCta"] as const).map((key) => (
                    <div key={key} className="grid gap-4 rounded-xl border border-border/60 p-4 md:grid-cols-2">
                        <div className="md:col-span-2 flex items-center gap-3">
                            <input
                                id={key}
                                type="checkbox"
                                checked={value.navbar[key].enabled}
                                onChange={(event) => onChange({ ...value, navbar: { ...value.navbar, [key]: { ...value.navbar[key], enabled: event.target.checked } } })}
                            />
                            <label htmlFor={key} className="text-sm font-medium text-foreground">{key === "cta" ? "Desktop CTA" : "Mobile CTA"} enabled</label>
                        </div>
                        <LocalizedField label="Label" value={value.navbar[key].label} onChange={(next) => onChange({ ...value, navbar: { ...value.navbar, [key]: { ...value.navbar[key], label: next } } })} />
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Href</label>
                            <Input value={value.navbar[key].href} onChange={(event) => onChange({ ...value, navbar: { ...value.navbar, [key]: { ...value.navbar[key], href: event.target.value } } })} />
                        </div>
                    </div>
                ))}
            </section>

            <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">Footer groups</h3>
                    <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, footer: { ...value.footer, groups: [...value.footer.groups, createGroup()] } })}>
                        <Plus className="mr-2 h-4 w-4" /> Add group
                    </Button>
                </div>
                <LocalizedField label="Footer description" value={value.footer.description} onChange={(next) => onChange({ ...value, footer: { ...value.footer, description: next } })} multiline />
                {value.footer.groups.map((group, groupIndex) => (
                    <div key={`${group.title.en}-${groupIndex}`} className="space-y-4 rounded-xl border border-border/60 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <LocalizedField label="Group title" value={group.title} onChange={(next) => onChange({ ...value, footer: { ...value.footer, groups: value.footer.groups.map((entry, entryIndex) => entryIndex === groupIndex ? { ...entry, title: next } : entry) } })} />
                            <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, footer: { ...value.footer, groups: value.footer.groups.filter((_, entryIndex) => entryIndex !== groupIndex) } })}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="space-y-3">
                            {group.links.map((link, linkIndex) => (
                                <div key={`${link.href}-${linkIndex}`} className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                                    <LocalizedField label="Link label" value={link.label} onChange={(next) => onChange({ ...value, footer: { ...value.footer, groups: value.footer.groups.map((entry, entryIndex) => entryIndex === groupIndex ? { ...entry, links: entry.links.map((candidate, candidateIndex) => candidateIndex === linkIndex ? { ...candidate, label: next } : candidate) } : entry) } })} />
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Href</label>
                                        <Input value={link.href} onChange={(event) => onChange({ ...value, footer: { ...value.footer, groups: value.footer.groups.map((entry, entryIndex) => entryIndex === groupIndex ? { ...entry, links: entry.links.map((candidate, candidateIndex) => candidateIndex === linkIndex ? { ...candidate, href: event.target.value } : candidate) } : entry) } })} />
                                    </div>
                                    <div className="flex items-end">
                                        <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, footer: { ...value.footer, groups: value.footer.groups.map((entry, entryIndex) => entryIndex === groupIndex ? { ...entry, links: entry.links.filter((_, candidateIndex) => candidateIndex !== linkIndex) } : entry) } })}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, footer: { ...value.footer, groups: value.footer.groups.map((entry, entryIndex) => entryIndex === groupIndex ? { ...entry, links: [...entry.links, createLink()] } : entry) } })}>
                                <Plus className="mr-2 h-4 w-4" /> Add footer link
                            </Button>
                        </div>
                    </div>
                ))}
            </section>

            <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">Social and legal</h3>
                    <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, footer: { ...value.footer, socialLinks: [...value.footer.socialLinks, createSocialLink()] } })}>
                        <Plus className="mr-2 h-4 w-4" /> Add social link
                    </Button>
                </div>
                <div className="space-y-3">
                    {value.footer.socialLinks.map((social, index) => (
                        <div key={`${social.href}-${index}`} className="grid gap-4 rounded-xl border border-border/60 p-4 md:grid-cols-[1fr_1fr_180px_auto]">
                            <Input value={social.label} onChange={(event) => onChange({ ...value, footer: { ...value.footer, socialLinks: value.footer.socialLinks.map((entry, entryIndex) => entryIndex === index ? { ...entry, label: event.target.value } : entry) } })} />
                            <Input value={social.href} onChange={(event) => onChange({ ...value, footer: { ...value.footer, socialLinks: value.footer.socialLinks.map((entry, entryIndex) => entryIndex === index ? { ...entry, href: event.target.value } : entry) } })} />
                            <select className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={social.icon} onChange={(event) => onChange({ ...value, footer: { ...value.footer, socialLinks: value.footer.socialLinks.map((entry, entryIndex) => entryIndex === index ? { ...entry, icon: event.target.value as SiteChromeSocialLink["icon"] } : entry) } })}>
                                {SITE_CHROME_SOCIAL_ICONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
                            </select>
                            <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, footer: { ...value.footer, socialLinks: value.footer.socialLinks.filter((_, entryIndex) => entryIndex !== index) } })}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
                <LocalizedField label="Footer CTA title" value={value.footer.cta.title} onChange={(next) => onChange({ ...value, footer: { ...value.footer, cta: { ...value.footer.cta, title: next } } })} />
                <LocalizedField label="Footer CTA description" value={value.footer.cta.description} onChange={(next) => onChange({ ...value, footer: { ...value.footer, cta: { ...value.footer.cta, description: next } } })} multiline />
                <LocalizedField label="Footer CTA label" value={value.footer.cta.label} onChange={(next) => onChange({ ...value, footer: { ...value.footer, cta: { ...value.footer.cta, label: next } } })} />
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Footer CTA href</label>
                    <Input value={value.footer.cta.href} onChange={(event) => onChange({ ...value, footer: { ...value.footer, cta: { ...value.footer.cta, href: event.target.value } } })} />
                </div>
                <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Legal links</p>
                    {value.footer.legalLinks.map((link, index) => (
                        <div key={`${link.href}-${index}`} className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                            <LocalizedField label="Label" value={link.label} onChange={(next) => onChange({ ...value, footer: { ...value.footer, legalLinks: value.footer.legalLinks.map((entry, entryIndex) => entryIndex === index ? { ...entry, label: next } : entry) } })} />
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Href</label>
                                <Input value={link.href} onChange={(event) => onChange({ ...value, footer: { ...value.footer, legalLinks: value.footer.legalLinks.map((entry, entryIndex) => entryIndex === index ? { ...entry, href: event.target.value } : entry) } })} />
                            </div>
                            <div className="flex items-end">
                                <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, footer: { ...value.footer, legalLinks: value.footer.legalLinks.filter((_, entryIndex) => entryIndex !== index) } })}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
                <LocalizedField label="Copyright" value={value.footer.copyright} onChange={(next) => onChange({ ...value, footer: { ...value.footer, copyright: next } })} />
            </section>
        </div>
    );
}
