import dynamic from "next/dynamic";
import { getActiveTemplate } from "@/features/templates/actions";
import { getDictionary } from "@/shared/lib/i18n/get-dictionary";
import type { Json } from "@/shared/lib/supabase/database.types";
import type { Locale, TemplateConfig, TemplateId } from "@/features/templates/types";
import type { ComponentType } from "react";
import { pickLocaleText } from "@/shared/lib/i18n/resolve";

// Dynamic imports: only the active theme's Contact renderer ships in the
// page bundle. /contact previously shipped all 8 (892 KB First Load JS).
const FacilityServicesContact = dynamic(() => import("@/features/templates/ui/theme-renderers/facility-services-contact"), { ssr: true });
const SaasProductContact = dynamic(() => import("@/features/templates/ui/theme-renderers/saas-product-contact"), { ssr: true });
const RestaurantContact = dynamic(() => import("@/features/templates/ui/theme-renderers/restaurant-contact"), { ssr: true });
const EcommerceContact = dynamic(() => import("@/features/templates/ui/theme-renderers/ecommerce-contact"), { ssr: true });
const NonprofitContact = dynamic(() => import("@/features/templates/ui/theme-renderers/nonprofit-contact"), { ssr: true });
const CreativeAgencyContact = dynamic(() => import("@/features/templates/ui/theme-renderers/creative-agency-contact"), { ssr: true });
const IsystemAgencyContact = dynamic(() => import("@/features/templates/ui/theme-renderers/isystem-agency-contact"), { ssr: true });
const PersonalBrandContact = dynamic(() => import("@/features/templates/ui/theme-renderers/personal-brand-contact"), { ssr: true });

interface ContactThemeProps {
    config: TemplateConfig;
    dictionary: Record<string, string>;
    locale: Locale;
    visualLayout?: Json | null;
}

interface ContactRendererProps {
    themeId?: TemplateId;
    config?: TemplateConfig;
    dictionary?: Record<string, string>;
    locale?: Locale;
}

function DefaultContact({ config, locale }: ContactThemeProps) {
    const contact = config.pages.contact;

    return (
        <section className="py-12 md:py-20">
            <div className="container mx-auto max-w-4xl px-4 md:px-6">
                <div className="mb-12">
                    <p className="text-sm font-semibold uppercase tracking-wider text-[var(--template-primary)] mb-3">
                        {pickLocaleText(contact.subtitle, locale)}
                    </p>
                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
                        {pickLocaleText(contact.title, locale)}
                    </h1>
                </div>

                <div className="rounded-2xl border border-border/50 bg-card p-8 md:p-10">
                    <p className="text-muted-foreground">
                        {locale === "nl"
                            ? "Themaspecifieke contact-renderers worden in een volgende fase toegevoegd."
                            : "Theme-specific contact renderers will be added in a subsequent phase."
                        }
                    </p>
                </div>
            </div>
        </section>
    );
}

export async function ContactRenderer({ themeId, config, dictionary, locale, visualLayout }: ContactRendererProps & { visualLayout?: Json | null } = {}) {
    const activeTemplate = config ? { config, locale: locale ?? "en" } : await getActiveTemplate();
    const resolvedConfig = activeTemplate.config;
    const resolvedLocale = (locale ?? activeTemplate.locale) as Locale;
    const resolvedThemeId = themeId ?? resolvedConfig.id;
    const resolvedDictionary = dictionary ?? await getDictionary(resolvedLocale);
    const { renderers: configRenderers, ...serializableConfig } = resolvedConfig;

    if (process.env.NODE_ENV !== "production") {
        console.log("[ContactRenderer] Config serialization", {
            theme_id: resolvedThemeId,
            had_renderers: Boolean(configRenderers),
            renderer_keys: configRenderers ? Object.keys(configRenderers) : [],
            sanitized_for_client: true,
        });
    }

    const themeProps: ContactThemeProps = {
        config: serializableConfig as TemplateConfig,
        dictionary: resolvedDictionary,
        locale: resolvedLocale,
        visualLayout,
    };

    const contactThemeRenderers: Record<TemplateId, ComponentType<ContactThemeProps>> = {
        "facility-services": FacilityServicesContact as ComponentType<ContactThemeProps>,
        "saas-product": SaasProductContact as ComponentType<ContactThemeProps>,
        restaurant: RestaurantContact as ComponentType<ContactThemeProps>,
        ecommerce: EcommerceContact as ComponentType<ContactThemeProps>,
        nonprofit: NonprofitContact as ComponentType<ContactThemeProps>,
        "creative-agency": CreativeAgencyContact as ComponentType<ContactThemeProps>,
        "isystem-agency": IsystemAgencyContact as ComponentType<ContactThemeProps>,
        "personal-brand": PersonalBrandContact as ComponentType<ContactThemeProps>,
    };

    const ThemeComponent = contactThemeRenderers[resolvedThemeId];
    return ThemeComponent ? <ThemeComponent {...themeProps} /> : <DefaultContact {...themeProps} />;
}
