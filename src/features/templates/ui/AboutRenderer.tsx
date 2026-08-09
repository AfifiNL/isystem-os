import dynamic from "next/dynamic";
import { getActiveTemplate } from "@/features/templates/actions";
import { getDictionary } from "@/shared/lib/i18n/get-dictionary";
import type { Locale, TemplateConfig, TemplateId } from "@/features/templates/types";
import type { Json } from "@/shared/lib/supabase/database.types";
import type { ComponentType } from "react";
import { pickLocaleText } from "@/shared/lib/i18n/resolve";

// Dynamic imports: only the active theme's About renderer ships in the page
// bundle. Cuts /about First Load JS substantially on themes that don't need
// the heavy renderers (which pulled in framer-motion / GSAP eagerly).
const FacilityServicesAbout = dynamic(() => import("@/features/templates/ui/theme-renderers/facility-services-about"), { ssr: true });
const SaasProductAbout = dynamic(() => import("@/features/templates/ui/theme-renderers/saas-product-about"), { ssr: true });
const RestaurantAbout = dynamic(() => import("@/features/templates/ui/theme-renderers/restaurant-about"), { ssr: true });
const EcommerceAbout = dynamic(() => import("@/features/templates/ui/theme-renderers/ecommerce-about"), { ssr: true });
const NonprofitAbout = dynamic(() => import("@/features/templates/ui/theme-renderers/nonprofit-about"), { ssr: true });
const CreativeAgencyAbout = dynamic(() => import("@/features/templates/ui/theme-renderers/creative-agency-about"), { ssr: true });
const IsystemAgencyAbout = dynamic(() => import("@/features/templates/ui/theme-renderers/isystem-agency-about"), { ssr: true });
const PersonalBrandAbout = dynamic(() => import("@/features/templates/ui/theme-renderers/personal-brand-about"), { ssr: true });

interface AboutThemeProps {
    config: TemplateConfig;
    dictionary: Record<string, string>;
    locale: Locale;
}

interface AboutRendererProps {
    themeId?: TemplateId;
    config?: TemplateConfig;
    dictionary?: Record<string, string>;
    locale?: Locale;
    visualLayout?: Json | null;
}

function DefaultAbout({ config, locale }: AboutThemeProps) {
    const about = config.pages.about;

    return (
        <section className="py-12 md:py-20">
            <div className="container mx-auto max-w-4xl px-4 md:px-6">
                <div className="mb-12">
                    <p className="text-sm font-semibold uppercase tracking-wider text-[var(--template-primary)] mb-3">
                        {pickLocaleText(about.title, locale)}
                    </p>
                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
                        <span
                            className="text-transparent bg-clip-text"
                            style={{ backgroundImage: "linear-gradient(to right, var(--template-gradient-from), var(--template-gradient-to))" }}
                        >
                            {pickLocaleText(about.headline, locale)}
                        </span>
                    </h1>
                    <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
                        {pickLocaleText(about.description, locale)}
                    </p>
                </div>
            </div>
        </section>
    );
}

export async function AboutRenderer({ themeId, config, dictionary, locale, visualLayout }: AboutRendererProps = {}) {
    const activeTemplate = config ? { config, locale: locale ?? "en" } : await getActiveTemplate();
    const resolvedConfig = activeTemplate.config;
    const resolvedLocale = (locale ?? activeTemplate.locale) as Locale;
    const resolvedThemeId = themeId ?? resolvedConfig.id;
    const resolvedDictionary = dictionary ?? await getDictionary(resolvedLocale);
    const { renderers: configRenderers, ...serializableConfig } = resolvedConfig;

    if (process.env.NODE_ENV !== "production") {
        console.log("[AboutRenderer] Config serialization", {
            theme_id: resolvedThemeId,
            had_renderers: Boolean(configRenderers),
            renderer_keys: configRenderers ? Object.keys(configRenderers) : [],
            sanitized_for_client: true,
        });
    }

    const themeProps: AboutThemeProps = {
        config: serializableConfig as TemplateConfig,
        dictionary: resolvedDictionary,
        locale: resolvedLocale,
    };

    const aboutThemeRenderers: Record<Exclude<TemplateId, "facility-services" | "isystem-agency">, ComponentType<AboutThemeProps>> = {
        "saas-product": SaasProductAbout,
        "restaurant": RestaurantAbout,
        ecommerce: EcommerceAbout,
        nonprofit: NonprofitAbout,
        "creative-agency": CreativeAgencyAbout,
        "personal-brand": PersonalBrandAbout,
    };

    if (resolvedThemeId === "facility-services") {
        return <FacilityServicesAbout {...themeProps} visualLayout={visualLayout ?? null} />;
    }

    if (resolvedThemeId === "isystem-agency") {
        return <IsystemAgencyAbout {...themeProps} visualLayout={visualLayout ?? null} />;
    }

    const ThemeComponent = aboutThemeRenderers[resolvedThemeId];
    return ThemeComponent ? <ThemeComponent {...themeProps} /> : <DefaultAbout {...themeProps} />;
}
