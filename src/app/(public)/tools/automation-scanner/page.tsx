import type { Metadata } from "next";
import { AutomationScannerClient } from "@/features/tools/automation-scanner/AutomationScannerClient";
import { ToolShell } from "@/features/tools/shared/ui/ToolShell";
import { buildToolPageMetadata, getToolPageContext } from "@/features/tools/shared/page-metadata";
import { getToolCopy } from "@/features/tools/shared/tool-copy";
import { renderProse } from "@/features/tools/shared/prose";

export const generateMetadata = (): Promise<Metadata> => buildToolPageMetadata("automation-scanner");

export default async function AutomationScannerPage() {
    const ctx = await getToolPageContext("automation-scanner");
    const copy = getToolCopy("automation-scanner", ctx.locale);
    return (
        <ToolShell
            meta={ctx.meta}
            locale={ctx.locale}
            siteName={ctx.siteName}
            siteUrl={ctx.siteUrl}
            pageUrl={ctx.pageUrl}
            tool={<AutomationScannerClient locale={ctx.locale} />}
            faq={copy.faq}
            howToSteps={copy.howToSteps}
            featureList={copy.featureList}
            serviceCta={{ ...copy.serviceCta, href: "/booking" }}
            content={renderProse(copy.content, "scanner")}
        />
    );
}
