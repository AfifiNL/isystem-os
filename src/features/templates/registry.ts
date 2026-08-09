import type { TemplateConfig, TemplateId } from "./types";

import { personalBrandConfig } from "./configs/personal-brand";
import { facilityServicesConfig } from "./configs/facility-services";
import { creativeAgencyConfig } from "./configs/creative-agency";
import { isystemAgencyConfig } from "./configs/isystem-agency";
import { saasProductConfig } from "./configs/saas-product";
import { restaurantConfig } from "./configs/restaurant";
import { ecommerceConfig } from "./configs/ecommerce";
import { nonprofitConfig } from "./configs/nonprofit";

/** All available templates indexed by their ID. */
export const TEMPLATE_REGISTRY: Record<TemplateId, TemplateConfig> = {
    "personal-brand": personalBrandConfig,
    "facility-services": facilityServicesConfig,
    "creative-agency": creativeAgencyConfig,
    "isystem-agency": isystemAgencyConfig,
    "saas-product": saasProductConfig,
    "restaurant": restaurantConfig,
    "ecommerce": ecommerceConfig,
    "nonprofit": nonprofitConfig,
};

/** Ordered list for the admin selector UI. */
export const TEMPLATE_LIST: TemplateConfig[] = Object.values(TEMPLATE_REGISTRY);

/** Safely resolve a template by ID, falling back to personal-brand. */
export function getTemplateById(id: string): TemplateConfig {
    return TEMPLATE_REGISTRY[id as TemplateId] ?? TEMPLATE_REGISTRY["personal-brand"];
}
