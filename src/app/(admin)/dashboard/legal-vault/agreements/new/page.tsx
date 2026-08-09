import { requireAdminDashboardState } from "@/features/admin/lib/route-guard";
import { listLegalTemplates } from "@/features/legal-vault/actions/templates";
import { NewAgreementForm } from "@/features/legal-vault/ui/new-agreement-form";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "New agreement | Legal Vault",
};

export default async function NewAgreementPage({ searchParams }: { searchParams?: Promise<{ template?: string }> }) {
    await requireAdminDashboardState();
    const [result, resolvedSearchParams] = await Promise.all([
        listLegalTemplates(),
        searchParams ?? Promise.resolve({} as { template?: string }),
    ]);

    return (
        <div className="flex h-full flex-col overflow-y-auto bg-background">
            <header className="border-b border-border/60 bg-card/50 px-8 py-6">
                <p className="text-sm text-muted-foreground">Legal Vault · Agreements</p>
                <h1 className="text-2xl font-semibold tracking-tight">New agreement</h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    Pick a template, describe the engagement, and let Gemini fill in defensible values
                    under Wet DBA constraints. Operator-supplied known facts always override AI guesses.
                </p>
            </header>
            <NewAgreementForm
                templates={result.success ? result.data : []}
                templatesError={result.success ? null : result.error}
                initialTemplateSlug={resolvedSearchParams.template ?? null}
            />
        </div>
    );
}
