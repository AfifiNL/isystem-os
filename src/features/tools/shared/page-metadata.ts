import type { Metadata } from "next";
import { getActiveTemplate } from "@/features/templates/actions";
import { buildSecondaryPageMetadata } from "@/features/templates/metadata";
import type { ToolLocale, ToolMeta, ToolSlug } from "./types";
import { getToolMeta } from "./registry";
import { requirePublicToolsBrandReady } from "./availability";

function resolveLocale(locale: string): ToolLocale {
    if (locale === "nl" || locale === "ar") return locale;
    return "en";
}

export async function buildToolPageMetadata(slug: ToolSlug): Promise<Metadata> {
    const { config, locale, settings } = await getActiveTemplate();
    requirePublicToolsBrandReady(config.id);
    const supportedLocale = resolveLocale(locale);
    const meta = getToolMeta(slug);

    return buildSecondaryPageMetadata({
        path: `/tools/${slug}`,
        title: meta.title[supportedLocale],
        description: meta.description[supportedLocale],
        locale,
        siteName: settings.siteName,
        siteDomain: settings.siteDomain,
        config,
        localized: true,
    });
}

export async function buildToolsHubMetadata(): Promise<Metadata> {
    const { config, locale, settings } = await getActiveTemplate();
    requirePublicToolsBrandReady(config.id);
    const supportedLocale = resolveLocale(locale);
    const title: Record<ToolLocale, string> = {
        en: "Free AI, SEO & Automation Tools for SMEs",
        nl: "Vrijblijvende Diagnose-tools voor MKB-ondernemers",
        ar: "أدوات تشخيص مجانية لمشغّلي الشركات الصغيرة والمتوسطة",
    };
    const description: Record<ToolLocale, string> = {
        en: "Run iSystem's free SME diagnostics for automation ROI, AI search visibility, conversion, GDPR risk, support readiness, reviews, and Dutch ZZP agreements.",
        nl: "Negen gratis tools van iSystem — automatiserings-roadmap, ROI-calculator, AI-zichtbaarheid, GDPR-scan, conversie-audit en ZZP-overeenkomst generator.",
        ar: "تسع أدوات مجانية من iSystem — خارطة أتمتة، حاسبة عائد، فحص ظهور الذكاء الاصطناعي، GDPR، تحويلات، ومولّد عقد ZZP هولندي.",
    };

    return buildSecondaryPageMetadata({
        path: "/tools",
        title: title[supportedLocale],
        description: description[supportedLocale],
        locale,
        siteName: settings.siteName,
        siteDomain: settings.siteDomain,
        config,
        localized: true,
    });
}

export interface ToolPageContext {
    locale: ToolLocale;
    siteName: string;
    siteUrl: string;
    pageUrl: string;
    meta: ToolMeta;
}

export async function getToolPageContext(slug: ToolSlug): Promise<ToolPageContext> {
    const { config, locale, settings } = await getActiveTemplate();
    requirePublicToolsBrandReady(config.id);
    const supportedLocale = resolveLocale(locale);
    const siteDomain = settings.siteDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    const siteUrl = siteDomain ? `https://${siteDomain}` : "http://localhost:3000";
    return {
        locale: supportedLocale,
        siteName: settings.siteName,
        siteUrl,
        pageUrl: `${siteUrl}/tools/${slug}`,
        meta: getToolMeta(slug),
    };
}
