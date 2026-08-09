import dynamic from "next/dynamic";
import type { HomeSectionDescriptor, TemplateId } from "@/features/templates/types";
import type { Json } from "@/shared/lib/supabase/database.types";

const DefaultThemeHome = dynamic(
    () => import("@/features/templates/ui/theme-renderers/default-theme-home").then((m) => m.DefaultThemeHome),
    { ssr: true },
);

const FacilityServicesHome = dynamic(
    () => import("@/features/templates/ui/theme-renderers/facility-services-home").then((m) => m.default),
    { ssr: true },
);

const SaasProductHome = dynamic(
    () => import("@/features/templates/ui/theme-renderers/saas-product-home").then((m) => m.SaasProductHome),
    { ssr: true },
);

const RestaurantHome = dynamic(
    () => import("@/features/templates/ui/theme-renderers/restaurant-home").then((m) => m.RestaurantHome),
    { ssr: true },
);

const EcommerceHome = dynamic(
    () => import("@/features/templates/ui/theme-renderers/ecommerce-home").then((m) => m.EcommerceHome),
    { ssr: true },
);

const NonprofitHome = dynamic(
    () => import("@/features/templates/ui/theme-renderers/nonprofit-home").then((m) => m.NonprofitHome),
    { ssr: true },
);

const CreativeAgencyHome = dynamic(
    () => import("@/features/templates/ui/theme-renderers/creative-agency-home").then((m) => m.CreativeAgencyHome),
    { ssr: true },
);

const IsystemAgencyHome = dynamic(
    () => import("@/features/templates/ui/theme-renderers/isystem-agency-home").then((m) => m.IsystemAgencyHome),
    { ssr: true },
);

const PersonalBrandHome = dynamic(
    () => import("@/features/templates/ui/theme-renderers/personal-brand-home").then((m) => m.PersonalBrandHome),
    { ssr: true },
);

interface ThemeHomeProps {
    workspace: {
        id: string;
        name: string;
        slug: string;
        theme_id: string | null;
    };
    dictionary: Record<string, unknown>;
    locale: string;
    visualLayout?: Json | null;
}

interface ThemeRendererProps {
    themeId: TemplateId;
    sections: HomeSectionDescriptor[];
    workspace?: ThemeHomeProps["workspace"];
    dictionary?: ThemeHomeProps["dictionary"];
    locale?: ThemeHomeProps["locale"];
}

export function ThemeRenderer({ themeId, sections, workspace, dictionary, locale, visualLayout }: ThemeRendererProps & { visualLayout?: Json | null }) {
    const themeProps: ThemeHomeProps = {
        workspace: workspace ?? { id: "", name: "", slug: "", theme_id: null },
        dictionary: dictionary ?? {},
        locale: locale ?? "en",
        visualLayout,
    };

    if (themeId === "facility-services") {
        return <FacilityServicesHome {...themeProps} />;
    }

    if (themeId === "saas-product") {
        return <SaasProductHome {...themeProps} />;
    }

    if (themeId === "restaurant") {
        return <RestaurantHome {...themeProps} />;
    }

    if (themeId === "ecommerce") {
        return <EcommerceHome {...themeProps} />;
    }

    if (themeId === "nonprofit") {
        return <NonprofitHome {...themeProps} />;
    }

    if (themeId === "creative-agency") {
        return <CreativeAgencyHome {...themeProps} />;
    }

    if (themeId === "isystem-agency") {
        return <IsystemAgencyHome {...themeProps} />;
    }

    if (themeId === "personal-brand") {
        return <PersonalBrandHome {...themeProps} />;
    }

    return <DefaultThemeHome sections={sections} />;
}
