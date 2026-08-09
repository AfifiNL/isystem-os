import type { Metadata } from "next";
import { StackRecommenderClient } from "@/features/tools/stack-recommender/StackRecommenderClient";
import { ToolShell } from "@/features/tools/shared/ui/ToolShell";
import { buildToolPageMetadata, getToolPageContext } from "@/features/tools/shared/page-metadata";
import { getToolCopy } from "@/features/tools/shared/tool-copy";
import { renderProse } from "@/features/tools/shared/prose";

export const generateMetadata = (): Promise<Metadata> => buildToolPageMetadata("ai-stack-recommender");

export default async function StackRecommenderPage() {
    const ctx = await getToolPageContext("ai-stack-recommender");
    const copy = getToolCopy("ai-stack-recommender", ctx.locale);
    return (
        <ToolShell
            meta={ctx.meta}
            locale={ctx.locale}
            siteName={ctx.siteName}
            siteUrl={ctx.siteUrl}
            pageUrl={ctx.pageUrl}
            tool={<StackRecommenderClient locale={ctx.locale} />}
            faq={copy.faq}
            serviceCta={{ ...copy.serviceCta, href: "/booking" }}
            content={renderProse(copy.content, "stack")}
        />
    );
}
