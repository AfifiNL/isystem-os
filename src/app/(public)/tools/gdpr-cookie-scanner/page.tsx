import type { Metadata } from "next";
import { GdprScannerClient } from "@/features/tools/gdpr-scanner/GdprScannerClient";
import { ToolShell } from "@/features/tools/shared/ui/ToolShell";
import { buildToolPageMetadata, getToolPageContext } from "@/features/tools/shared/page-metadata";
import { getToolCopy } from "@/features/tools/shared/tool-copy";
import { renderProse } from "@/features/tools/shared/prose";

export const generateMetadata = (): Promise<Metadata> => buildToolPageMetadata("gdpr-cookie-scanner");

export default async function GdprPage() {
    const ctx = await getToolPageContext("gdpr-cookie-scanner");
    const copy = getToolCopy("gdpr-cookie-scanner", ctx.locale);
    return (
        <ToolShell
            meta={ctx.meta}
            locale={ctx.locale}
            siteName={ctx.siteName}
            siteUrl={ctx.siteUrl}
            pageUrl={ctx.pageUrl}
            tool={<GdprScannerClient locale={ctx.locale} />}
            faq={copy.faq}
            howToSteps={copy.howToSteps}
            featureList={copy.featureList}
            serviceCta={{ ...copy.serviceCta, href: "/booking" }}
            content={renderProse(copy.content, "gdpr")}
        />
    );
}
