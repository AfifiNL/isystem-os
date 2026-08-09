import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isystemAgencyConfig } from "./configs/isystem-agency";
import { buildPublicMetadata, buildSecondaryPageMetadata } from "./metadata";

describe("public metadata", () => {
    it("keeps the iSystem home positioning localized and lets the root layout add the site name once", () => {
        const expected = {
            en: "Digital Systems Implementation for Dutch Service SMEs",
            nl: "Implementatie van digitale systemen voor Nederlandse dienstverleners",
            ar: "تنفيذ الأنظمة الرقمية لشركات الخدمات الهولندية",
        } as const;

        for (const locale of ["en", "nl", "ar"] as const) {
            const metadata = buildPublicMetadata({
                page: "home",
                locale,
                siteName: "iSystem.ai",
                siteDescription: "workspace fallback",
                siteDomain: "isystem.ai",
                config: isystemAgencyConfig,
            });

            assert.equal(metadata.title, expected[locale]);
            assert.equal(metadata.openGraph?.title, `${expected[locale]} | iSystem.ai`);
        }
    });

    it("does not add a second site-name suffix to secondary-page document titles", () => {
        const metadata = buildSecondaryPageMetadata({
            path: "/booking",
            title: "Systems Fit Call & Blueprint",
            description: "Book the free Fit Call or the paid Blueprint.",
            locale: "en",
            siteName: "iSystem.ai",
            siteDomain: "isystem.ai",
            config: isystemAgencyConfig,
            localized: true,
        });

        assert.equal(metadata.title, "Systems Fit Call & Blueprint");
        assert.equal(metadata.openGraph?.title, "Systems Fit Call & Blueprint | iSystem.ai");
    });
});
