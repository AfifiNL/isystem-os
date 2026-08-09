import type { Metadata } from "next";
import { NlZzpAgreementGenerator } from "@/features/legal-vault/ui/public-nl-zzp-generator";
import { buildToolPageMetadata, getToolPageContext } from "@/features/tools/shared/page-metadata";
import { getToolCopy } from "@/features/tools/shared/tool-copy";
import { renderProse } from "@/features/tools/shared/prose";
import { ToolShell } from "@/features/tools/shared/ui/ToolShell";

export const generateMetadata = (): Promise<Metadata> => buildToolPageMetadata("nl-zzp-agreement-generator");

export default async function Page() {
    const ctx = await getToolPageContext("nl-zzp-agreement-generator");
    const copy = getToolCopy("nl-zzp-agreement-generator", ctx.locale);

    return (
        <ToolShell
            meta={ctx.meta}
            locale={ctx.locale}
            siteName={ctx.siteName}
            siteUrl={ctx.siteUrl}
            pageUrl={ctx.pageUrl}
            tool={<NlZzpAgreementGenerator locale={ctx.locale} />}
            faq={copy.faq}
            serviceCta={{ ...copy.serviceCta, href: "/booking" }}
            content={renderProse(copy.content, "nl-zzp")}
            howToSteps={copy.howToSteps}
            featureList={copy.featureList}
            containerClassName="mx-auto max-w-7xl px-4 sm:px-6 print:max-w-none print:px-0"
        />
    );
}
