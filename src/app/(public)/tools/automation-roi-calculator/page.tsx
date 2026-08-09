import type { Metadata } from "next";
import { RoiCalculatorClient } from "@/features/tools/roi-calculator/RoiCalculatorClient";
import { ToolShell } from "@/features/tools/shared/ui/ToolShell";
import { buildToolPageMetadata, getToolPageContext } from "@/features/tools/shared/page-metadata";
import { getToolCopy } from "@/features/tools/shared/tool-copy";
import { renderProse } from "@/features/tools/shared/prose";

export const generateMetadata = (): Promise<Metadata> => buildToolPageMetadata("automation-roi-calculator");

export default async function RoiCalculatorPage() {
    const ctx = await getToolPageContext("automation-roi-calculator");
    const copy = getToolCopy("automation-roi-calculator", ctx.locale);
    return (
        <ToolShell
            meta={ctx.meta}
            locale={ctx.locale}
            siteName={ctx.siteName}
            siteUrl={ctx.siteUrl}
            pageUrl={ctx.pageUrl}
            tool={<RoiCalculatorClient locale={ctx.locale} />}
            faq={copy.faq}
            serviceCta={{ ...copy.serviceCta, href: "/booking" }}
            content={renderProse(copy.content, "roi")}
        />
    );
}
