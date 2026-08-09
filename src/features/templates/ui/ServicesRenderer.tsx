import dynamic from "next/dynamic";
import { getActiveTemplate } from "@/features/templates/actions";
import { getDictionary } from "@/shared/lib/i18n/get-dictionary";
import type { Json } from "@/shared/lib/supabase/database.types";
import type { Locale, TemplateConfig, TemplateId } from "@/features/templates/types";
import type { ComponentType } from "react";
import { pickLocaleText } from "@/shared/lib/i18n/resolve";

// Dynamic imports so only the active theme's services renderer ships in the
// page bundle. Without this every public /services request shipped all 8
// renderers (GSAP / framer-motion / theme assets) regardless of which one
// actually renders. Same pattern as ThemeRenderer for the home page.
const FacilityServicesServices = dynamic(() => import("@/features/templates/ui/theme-renderers/facility-services-services"), { ssr: true });
const SaasProductServices = dynamic(() => import("@/features/templates/ui/theme-renderers/saas-product-services"), { ssr: true });
const RestaurantServices = dynamic(() => import("@/features/templates/ui/theme-renderers/restaurant-services"), { ssr: true });
const EcommerceServices = dynamic(() => import("@/features/templates/ui/theme-renderers/ecommerce-services"), { ssr: true });
const NonprofitServices = dynamic(() => import("@/features/templates/ui/theme-renderers/nonprofit-services"), { ssr: true });
const CreativeAgencyServices = dynamic(() => import("@/features/templates/ui/theme-renderers/creative-agency-services"), { ssr: true });
const IsystemAgencyServices = dynamic(() => import("@/features/templates/ui/theme-renderers/isystem-agency-services"), { ssr: true });
const PersonalBrandServices = dynamic(() => import("@/features/templates/ui/theme-renderers/personal-brand-services"), { ssr: true });

interface ServicesThemeProps {
    config: TemplateConfig;
    dictionary: Record<string, string>;
    locale: Locale;
    visualLayout?: Json | null;
}

interface ServicesRendererProps {
    themeId?: TemplateId;
    config?: TemplateConfig;
    dictionary?: Record<string, string>;
    locale?: Locale;
}

function DefaultServices({ config, locale }: ServicesThemeProps) {
    const services = config.pages.services;

    return (
        <section className="py-12 md:py-20">
            <div className="container mx-auto max-w-5xl px-4 md:px-6">
                <div className="mb-14">
                    <p className="text-sm font-semibold uppercase tracking-wider text-[var(--template-primary)] mb-3">
                        {pickLocaleText(services?.subtitle, locale, "Services")}
                    </p>
                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
                        <span
                            className="text-transparent bg-clip-text"
                            style={{ backgroundImage: "linear-gradient(to right, var(--template-gradient-from), var(--template-gradient-to))" }}
                        >
                            {pickLocaleText(services?.title, locale, "Our Services")}
                        </span>
                    </h1>
                    <p className="text-lg text-muted-foreground leading-relaxed max-w-3xl">
                        {pickLocaleText(services?.description, locale, "Explore our current service offering.")}
                    </p>
                </div>

                <div className="rounded-2xl border border-border/50 bg-card p-8 md:p-10">
                    <p className="text-muted-foreground">
                        {locale === "nl"
                            ? "Thematische service-renderers worden in een volgende fase toegevoegd."
                            : "Theme-specific service renderers will be added in a subsequent phase."
                        }
                    </p>
                </div>
            </div>
        </section>
    );
}

export async function ServicesRenderer({ themeId, config, dictionary, locale, visualLayout }: ServicesRendererProps & { visualLayout?: Json | null } = {}) {
    const activeTemplate = config ? { config, locale: locale ?? "en" } : await getActiveTemplate();
    const resolvedConfig = activeTemplate.config;
    const resolvedLocale = (locale ?? activeTemplate.locale) as Locale;
    const resolvedThemeId = themeId ?? resolvedConfig.id;
    const resolvedDictionary = dictionary ?? await getDictionary(resolvedLocale);
    const { renderers: configRenderers, ...serializableConfig } = resolvedConfig;

    if (process.env.NODE_ENV !== "production") {
        console.log("[ServicesRenderer] Config serialization", {
            theme_id: resolvedThemeId,
            had_renderers: Boolean(configRenderers),
            renderer_keys: configRenderers ? Object.keys(configRenderers) : [],
            sanitized_for_client: true,
        });
    }

    const themeProps: ServicesThemeProps = {
        config: serializableConfig as TemplateConfig,
        dictionary: resolvedDictionary,
        locale: resolvedLocale,
        visualLayout,
    };

    // The map type uses `unknown` for props because next/dynamic widens the
    // inferred prop types of the lazily-loaded components. We narrow back to
    // ServicesThemeProps at the render site since every dynamic import points
    // at a renderer that accepts a structurally-compatible props shape.
    const servicesThemeRenderers: Record<TemplateId, ComponentType<ServicesThemeProps>> = {
        "facility-services": FacilityServicesServices as ComponentType<ServicesThemeProps>,
        "saas-product": SaasProductServices as ComponentType<ServicesThemeProps>,
        restaurant: RestaurantServices as ComponentType<ServicesThemeProps>,
        ecommerce: EcommerceServices as ComponentType<ServicesThemeProps>,
        nonprofit: NonprofitServices as ComponentType<ServicesThemeProps>,
        "creative-agency": CreativeAgencyServices as ComponentType<ServicesThemeProps>,
        "isystem-agency": IsystemAgencyServices as ComponentType<ServicesThemeProps>,
        "personal-brand": PersonalBrandServices as ComponentType<ServicesThemeProps>,
    };

    const ThemeComponent = servicesThemeRenderers[resolvedThemeId];
    return ThemeComponent ? <ThemeComponent {...themeProps} /> : <DefaultServices {...themeProps} />;
}
