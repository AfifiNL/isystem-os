import type { Metadata } from "next";
import { ReviewResponseClient } from "@/features/tools/review-response/ReviewResponseClient";
import { ToolShell } from "@/features/tools/shared/ui/ToolShell";
import { buildToolPageMetadata, getToolPageContext } from "@/features/tools/shared/page-metadata";
import { getToolCopy } from "@/features/tools/shared/tool-copy";
import { renderProse } from "@/features/tools/shared/prose";

export const generateMetadata = (): Promise<Metadata> => buildToolPageMetadata("review-response-generator");

export default async function ReviewResponsePage() {
    const ctx = await getToolPageContext("review-response-generator");
    const copy = getToolCopy("review-response-generator", ctx.locale);
    return (
        <ToolShell
            meta={ctx.meta}
            locale={ctx.locale}
            siteName={ctx.siteName}
            siteUrl={ctx.siteUrl}
            pageUrl={ctx.pageUrl}
            tool={<ReviewResponseClient locale={ctx.locale} />}
            faq={copy.faq}
            serviceCta={{ ...copy.serviceCta, href: "/booking" }}
            content={renderProse(copy.content, "review")}
        />
    );
}
