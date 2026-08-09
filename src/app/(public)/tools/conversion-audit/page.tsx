import type { Metadata } from "next";
import { ConversionAuditClient } from "@/features/tools/conversion-audit/ConversionAuditClient";
import { ToolShell } from "@/features/tools/shared/ui/ToolShell";
import { buildToolPageMetadata, getToolPageContext } from "@/features/tools/shared/page-metadata";
import { getToolCopy } from "@/features/tools/shared/tool-copy";
import { renderProse } from "@/features/tools/shared/prose";

export const generateMetadata = (): Promise<Metadata> => buildToolPageMetadata("conversion-audit");

export default async function ConversionPage() {
    const ctx = await getToolPageContext("conversion-audit");
    const copy = getToolCopy("conversion-audit", ctx.locale);
    return (
        <ToolShell
            meta={ctx.meta}
            locale={ctx.locale}
            siteName={ctx.siteName}
            siteUrl={ctx.siteUrl}
            pageUrl={ctx.pageUrl}
            tool={<ConversionAuditClient locale={ctx.locale} />}
            faq={copy.faq}
            howToSteps={copy.howToSteps}
            featureList={copy.featureList}
            serviceCta={{ ...copy.serviceCta, href: "/booking" }}
            content={renderProse(copy.content, "conv")}
        />
    );
}
