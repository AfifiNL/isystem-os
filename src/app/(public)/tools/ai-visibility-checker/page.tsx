import type { Metadata } from "next";
import { AiVisibilityClient } from "@/features/tools/ai-visibility/AiVisibilityClient";
import { ToolShell } from "@/features/tools/shared/ui/ToolShell";
import { buildToolPageMetadata, getToolPageContext } from "@/features/tools/shared/page-metadata";
import { getToolCopy } from "@/features/tools/shared/tool-copy";
import { renderProse } from "@/features/tools/shared/prose";

export const generateMetadata = (): Promise<Metadata> => buildToolPageMetadata("ai-visibility-checker");

export default async function AiVisibilityPage() {
    const ctx = await getToolPageContext("ai-visibility-checker");
    const copy = getToolCopy("ai-visibility-checker", ctx.locale);
    return (
        <ToolShell
            meta={ctx.meta}
            locale={ctx.locale}
            siteName={ctx.siteName}
            siteUrl={ctx.siteUrl}
            pageUrl={ctx.pageUrl}
            tool={<AiVisibilityClient locale={ctx.locale} />}
            faq={copy.faq}
            howToSteps={copy.howToSteps}
            featureList={copy.featureList}
            serviceCta={{ ...copy.serviceCta, href: "/booking" }}
            content={renderProse(copy.content, "ai-vis")}
        />
    );
}
