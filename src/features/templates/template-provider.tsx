"use client";

import { createContext, useContext } from "react";
import type { TemplateConfig, Locale } from "./types";
import type { Dictionary } from "@/shared/lib/i18n/get-dictionary";
import type { SiteChromeConfig } from "@/features/site-chrome/schema";
import type { BuilderPageMetadata } from "@/features/builder/facility-services-page-data";
import { buildTemplateCssVariables } from "./design-tokens";

interface TemplateContextValue {
    config: TemplateConfig;
    locale: Locale;
    dict: Dictionary;
    siteName: string;
    siteDescription: string;
    siteChrome: SiteChromeConfig;
    supportedLocales: Locale[];
    chromeOverrides?: BuilderPageMetadata | null;
}

const TemplateContext = createContext<TemplateContextValue | null>(null);

export function useTemplate() {
    const ctx = useContext(TemplateContext);
    if (!ctx) throw new Error("useTemplate must be used within a TemplateProvider");
    return ctx;
}

export function useLocale() {
    const { locale } = useTemplate();
    return locale;
}

export function useDict() {
    const { dict } = useTemplate();
    return dict;
}

interface TemplateProviderProps {
    config: TemplateConfig;
    locale: Locale;
    dict?: Dictionary;
    siteName: string;
    siteDescription: string;
    siteChrome: SiteChromeConfig;
    supportedLocales?: Locale[];
    chromeOverrides?: BuilderPageMetadata | null;
    children: React.ReactNode;
}

export function TemplateProvider({ config, locale, dict = {}, siteName, siteDescription, siteChrome, supportedLocales = ["en", "nl", "ar"], chromeOverrides, children }: TemplateProviderProps) {
    const cssVars = buildTemplateCssVariables(config);

    const templateFontClass = "[font-family:var(--template-font-body)] [&_h1]:[font-family:var(--template-font-heading)] [&_h2]:[font-family:var(--template-font-heading)] [&_h3]:[font-family:var(--template-font-heading)] [&_h4]:[font-family:var(--template-font-heading)] [&_h5]:[font-family:var(--template-font-heading)] [&_h6]:[font-family:var(--template-font-heading)]";

    return (
        <TemplateContext.Provider value={{ config, locale, dict, siteName, siteDescription, siteChrome, supportedLocales, chromeOverrides }}>
            <div className={templateFontClass} data-template-id={config.id} style={cssVars as React.CSSProperties}>
                {children}
            </div>
        </TemplateContext.Provider>
    );
}
