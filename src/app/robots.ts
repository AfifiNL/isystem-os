import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/features/templates/actions";
import { resolveMetadataBase } from "@/features/templates/metadata";

export default async function robots(): Promise<MetadataRoute.Robots> {
    const settings = await getSiteSettings();
    const metadataBase = resolveMetadataBase(settings.siteDomain);
    const siteUrl = metadataBase?.toString().replace(/\/$/, "");

    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: [
                    "/dashboard",
                    "/dashboard/",
                    "/portal",
                    "/portal/",
                    "/en/portal",
                    "/en/portal/",
                    "/nl/portal",
                    "/nl/portal/",
                    "/ar/portal",
                    "/ar/portal/",
                    "/api",
                    "/api/",
                    "/login",
                    "/login/",
                    "/setup",
                    "/setup/",
                    "/test",
                    "/test/",
                    "/batch_queues",
                    "/batch_queues/",
                ],
            },
        ],
        sitemap: siteUrl ? `${siteUrl}/sitemap.xml` : undefined,
        host: siteUrl,
    };
}
