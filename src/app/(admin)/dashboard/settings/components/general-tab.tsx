import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Shield, Palette, Globe, Type, FileText, Check, Loader2 } from "lucide-react";
import { TEMPLATE_LIST } from "@/features/templates/registry";
import type { SiteChromeConfig } from "@/features/site-chrome/schema";
import { SiteChromeEditor } from "@/features/site-chrome/ui/site-chrome-editor";

interface GeneralTabProps {
    workspace: { id: string; name: string; slug: string };
    role: string;
    accessibleWorkspaces: Array<{ id: string; name: string }>;
    nextWorkspaceId: string;
    setNextWorkspaceId: (id: string) => void;
    handleWorkspaceSwitch: () => void;
    canManageManagers: boolean;
    isPending: boolean;
    activeTemplate: string;
    setActiveTemplate: (id: string) => void;
    workspaceDefaultLocale: string;
    setWorkspaceDefaultLocale: (val: string) => void;
    locale: string;
    setLocale: (val: string) => void;
    siteName: string;
    setSiteName: (val: string) => void;
    siteDescription: string;
    setSiteDescription: (val: string) => void;
    siteDescriptionNl: string;
    setSiteDescriptionNl: (val: string) => void;
    siteDescriptionAr: string;
    setSiteDescriptionAr: (val: string) => void;
    legalPrivacyEn: string;
    setLegalPrivacyEn: (val: string) => void;
    legalPrivacyNl: string;
    setLegalPrivacyNl: (val: string) => void;
    legalPrivacyAr: string;
    setLegalPrivacyAr: (val: string) => void;
    legalTermsEn: string;
    setLegalTermsEn: (val: string) => void;
    legalTermsNl: string;
    setLegalTermsNl: (val: string) => void;
    legalTermsAr: string;
    setLegalTermsAr: (val: string) => void;
    siteChrome: SiteChromeConfig;
    setSiteChrome: (val: SiteChromeConfig) => void;
    siteChromePreview: React.ReactNode;
}

export function GeneralTab({
    workspace,
    role,
    accessibleWorkspaces,
    nextWorkspaceId,
    setNextWorkspaceId,
    handleWorkspaceSwitch,
    canManageManagers,
    isPending,
    activeTemplate,
    setActiveTemplate,
    workspaceDefaultLocale,
    setWorkspaceDefaultLocale,
    locale,
    setLocale,
    siteName,
    setSiteName,
    siteDescription,
    setSiteDescription,
    siteDescriptionNl,
    setSiteDescriptionNl,
    siteDescriptionAr,
    setSiteDescriptionAr,
    legalPrivacyEn,
    setLegalPrivacyEn,
    legalPrivacyNl,
    setLegalPrivacyNl,
    legalPrivacyAr,
    setLegalPrivacyAr,
    legalTermsEn,
    setLegalTermsEn,
    legalTermsNl,
    setLegalTermsNl,
    legalTermsAr,
    setLegalTermsAr,
    siteChrome,
    setSiteChrome,
    siteChromePreview,
}: GeneralTabProps) {
    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div className="space-y-3 bg-card p-5 rounded-md border shadow-sm">
                <label className="text-[17px] font-semibold uppercase tracking-wider flex items-center gap-2 text-foreground">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    Active Workspace
                </label>
                <p className="text-[17px] text-foreground font-medium">{workspace.name}</p>
                <p className="text-[15px] text-muted-foreground">Slug: {workspace.slug}</p>
                <p className="text-[15px] text-muted-foreground uppercase tracking-wide">Role: {role}</p>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] pt-1">
                    <select
                        value={nextWorkspaceId}
                        onChange={(e) => setNextWorkspaceId(e.target.value)}
                        disabled={!canManageManagers || isPending || accessibleWorkspaces.length === 0}
                        className="w-full flex h-9 items-center rounded-md border border-input bg-background px-3 py-2 text-[17px] focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                    >
                        {accessibleWorkspaces.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                                {entry.name}
                            </option>
                        ))}
                    </select>
                    <Button
                        variant="outline"
                        onClick={handleWorkspaceSwitch}
                        disabled={!canManageManagers || isPending || nextWorkspaceId === workspace.id}
                        aria-busy={isPending || undefined}
                    >
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isPending ? "Switching…" : "Switch"}
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                <label className="text-[17px] font-semibold uppercase tracking-wider flex items-center gap-2 text-foreground">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    Frontend Template
                </label>
                <p className="text-[15px] text-muted-foreground">
                    Select a template to define the design, layout, and style of your public website.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {TEMPLATE_LIST.map((tmpl) => (
                        <button
                            key={tmpl.id}
                            onClick={() => setActiveTemplate(tmpl.id)}
                            className={`p-4 rounded-md border-2 text-left transition-all duration-200 ${
                                activeTemplate === tmpl.id
                                    ? "border-primary bg-primary/5 shadow-md"
                                    : "border-border/50 hover:border-border bg-card hover:shadow-sm"
                            }`}
                        >
                            <div
                                className="h-2 rounded-full mb-3 w-full"
                                style={{
                                    background: `linear-gradient(to right, ${tmpl.colors.gradientFrom}, ${tmpl.colors.gradientTo})`,
                                }}
                            />
                            <h3 className="font-semibold text-[17px]">{tmpl.name}</h3>
                            <p className="text-[15px] text-muted-foreground mt-1 line-clamp-2">
                                {tmpl.description}
                            </p>
                            {activeTemplate === tmpl.id && (
                                <div className="mt-2 inline-flex items-center gap-1 text-[15px] font-medium text-primary">
                                    <Check className="h-3 w-3" /> Active
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3 bg-card p-5 rounded-md border shadow-sm md:col-span-2">
                    <label className="text-[17px] font-semibold uppercase tracking-wider flex items-center gap-2 text-foreground">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        Account Security
                    </label>
                    <p className="text-[15px] text-muted-foreground">
                        Change your password after onboarding, invite acceptance, or whenever you need to rotate credentials.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Button asChild variant="outline">
                            <Link href="/reset-password?mode=change">Change password</Link>
                        </Button>
                        <Button asChild variant="ghost">
                            <Link href="/reset-password">Send reset link</Link>
                        </Button>
                    </div>
                </div>

                <div className="space-y-3 bg-card p-5 rounded-md border shadow-sm">
                    <label className="text-[17px] font-semibold uppercase tracking-wider flex items-center gap-2 text-foreground">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        Workspace Default Language
                    </label>
                    <p className="text-[15px] text-muted-foreground">
                        Controls AI-generated content language.
                    </p>
                    <select
                        value={workspaceDefaultLocale}
                        onChange={(e) => setWorkspaceDefaultLocale(e.target.value)}
                        className="w-full flex h-10 items-center rounded-md border border-input bg-background px-3 py-2 text-[17px] focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <option value="en">🇬🇧 English</option>
                        <option value="nl">🇳🇱 Nederlands</option>
                        <option value="ar">🇸🇦 العربية (Arabic)</option>
                    </select>
                </div>

                <div className="space-y-3 bg-card p-5 rounded-md border shadow-sm">
                    <label className="text-[17px] font-semibold uppercase tracking-wider flex items-center gap-2 text-foreground">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        Language / Locale
                    </label>
                    <p className="text-[15px] text-muted-foreground">
                        Set the default display language for the site.
                    </p>
                    <select
                        value={locale}
                        onChange={(e) => setLocale(e.target.value)}
                        className="w-full flex h-10 items-center rounded-md border border-input bg-background px-3 py-2 text-[17px] focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <option value="en">🇬🇧 English</option>
                        <option value="nl">🇳🇱 Nederlands</option>
                        <option value="ar">🇸🇦 العربية (Arabic)</option>
                    </select>
                </div>

                <div className="space-y-3 bg-card p-5 rounded-md border shadow-sm">
                    <label className="text-[17px] font-semibold uppercase tracking-wider flex items-center gap-2 text-foreground">
                        <Type className="h-4 w-4 text-muted-foreground" />
                        Site Name
                    </label>
                    <p className="text-[15px] text-muted-foreground">
                        The brand name displayed in the navbar.
                    </p>
                    <Input
                        value={siteName}
                        onChange={(e) => setSiteName(e.target.value)}
                        placeholder="My Brand"
                    />
                </div>

                <div className="space-y-3 bg-card p-5 rounded-md border shadow-sm md:col-span-2">
                    <label className="text-[17px] font-semibold uppercase tracking-wider flex items-center gap-2 text-foreground">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        Site Description (English — canonical)
                    </label>
                    <p className="text-[15px] text-muted-foreground">
                        Used as fallback for SEO meta description, og:description, and twitter:description on every locale that lacks a translation.
                    </p>
                    <Input
                        value={siteDescription}
                        onChange={(e) => setSiteDescription(e.target.value)}
                        placeholder="Your site tagline or description"
                    />
                    <div className="grid gap-3 md:grid-cols-2 pt-2">
                        <div className="space-y-1">
                            <label className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">Site Description (Dutch)</label>
                            <Input dir="auto" value={siteDescriptionNl} onChange={(e) => setSiteDescriptionNl(e.target.value)} placeholder="Site beschrijving" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">Site Description (Arabic)</label>
                            <Input dir="rtl" value={siteDescriptionAr} onChange={(e) => setSiteDescriptionAr(e.target.value)} placeholder="وصف الموقع" />
                        </div>
                    </div>
                </div>

                <div className="space-y-3 bg-card p-5 rounded-md border shadow-sm md:col-span-2">
                    <label className="text-[17px] font-semibold uppercase tracking-wider flex items-center gap-2 text-foreground">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        Privacy Policy
                    </label>
                    <p className="text-[15px] text-muted-foreground">
                        Optional Markdown override per locale. When empty, the bundled hand-written privacy policy is rendered for that locale instead.
                    </p>
                    <div className="grid gap-3">
                        <div className="space-y-1">
                            <label className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">Privacy (English)</label>
                            <textarea rows={6} className="w-full rounded-md border border-input bg-background px-3 py-2 text-[17px] font-mono" value={legalPrivacyEn} onChange={(e) => setLegalPrivacyEn(e.target.value)} placeholder="# Privacy Policy&#10;&#10;Markdown body..." />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">Privacy (Dutch)</label>
                            <textarea rows={6} dir="auto" className="w-full rounded-md border border-input bg-background px-3 py-2 text-[17px] font-mono" value={legalPrivacyNl} onChange={(e) => setLegalPrivacyNl(e.target.value)} placeholder="# Privacybeleid" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">Privacy (Arabic)</label>
                            <textarea rows={6} dir="rtl" className="w-full rounded-md border border-input bg-background px-3 py-2 text-[17px] font-mono" value={legalPrivacyAr} onChange={(e) => setLegalPrivacyAr(e.target.value)} placeholder="# سياسة الخصوصية" />
                        </div>
                    </div>
                </div>

                <div className="space-y-3 bg-card p-5 rounded-md border shadow-sm md:col-span-2">
                    <label className="text-[17px] font-semibold uppercase tracking-wider flex items-center gap-2 text-foreground">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        Terms of Use
                    </label>
                    <p className="text-[15px] text-muted-foreground">
                        Optional Markdown override per locale. When empty, the bundled hand-written terms of use is rendered for that locale instead.
                    </p>
                    <div className="grid gap-3">
                        <div className="space-y-1">
                            <label className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">Terms (English)</label>
                            <textarea rows={6} className="w-full rounded-md border border-input bg-background px-3 py-2 text-[17px] font-mono" value={legalTermsEn} onChange={(e) => setLegalTermsEn(e.target.value)} placeholder="# Terms of Use" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">Terms (Dutch)</label>
                            <textarea rows={6} dir="auto" className="w-full rounded-md border border-input bg-background px-3 py-2 text-[17px] font-mono" value={legalTermsNl} onChange={(e) => setLegalTermsNl(e.target.value)} placeholder="# Gebruiksvoorwaarden" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">Terms (Arabic)</label>
                            <textarea rows={6} dir="rtl" className="w-full rounded-md border border-input bg-background px-3 py-2 text-[17px] font-mono" value={legalTermsAr} onChange={(e) => setLegalTermsAr(e.target.value)} placeholder="# شروط الاستخدام" />
                        </div>
                    </div>
                </div>

                <div className="space-y-3 bg-card p-5 rounded-md border shadow-sm md:col-span-2">
                    <label className="text-[17px] font-semibold uppercase tracking-wider flex items-center gap-2 text-foreground">
                        <Palette className="h-4 w-4 text-muted-foreground" />
                        Site Chrome
                    </label>
                    <p className="text-[15px] text-muted-foreground">
                        Edit global navbar and footer structure through dedicated sections instead of raw JSON.
                    </p>
                    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                        <SiteChromeEditor value={siteChrome} onChange={setSiteChrome} locale={locale === "nl" ? "nl" : locale === "ar" ? "ar" : "en"} />
                        <div className="space-y-4">
                            {siteChromePreview}
                            <div className="rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-3 text-[15px] text-muted-foreground">
                                This structured editor powers the public chrome rendered by [`TemplateNavbar`](src/features/templates/ui/template-navbar.tsx:17) and [`TemplateFooter`](src/features/templates/ui/template-footer.tsx:8).
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
