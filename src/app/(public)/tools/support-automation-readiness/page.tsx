import type { Metadata } from "next";
import { SupportReadinessClient } from "@/features/tools/support-readiness/SupportReadinessClient";
import { ToolShell } from "@/features/tools/shared/ui/ToolShell";
import { buildToolPageMetadata, getToolPageContext } from "@/features/tools/shared/page-metadata";
import { getToolCopy } from "@/features/tools/shared/tool-copy";
import { renderProse } from "@/features/tools/shared/prose";

export const generateMetadata = (): Promise<Metadata> => buildToolPageMetadata("support-automation-readiness");

export default async function SupportPage() {
    const ctx = await getToolPageContext("support-automation-readiness");
    const copy = getToolCopy("support-automation-readiness", ctx.locale);
    return (
        <ToolShell
            meta={ctx.meta}
            locale={ctx.locale}
            siteName={ctx.siteName}
            siteUrl={ctx.siteUrl}
            pageUrl={ctx.pageUrl}
            tool={<SupportReadinessClient locale={ctx.locale} />}
            faq={copy.faq}
            serviceCta={{ ...copy.serviceCta, href: "/booking" }}
            content={renderProse(copy.content, "support")}
        />
    );
}
