import { redirect } from "next/navigation";
import { PlusCircle, Wand2 } from "lucide-react";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import {
    createBuilderPage,
    listBuilderPages,
    revalidateCorePagePaths,
    seedCorePageContentItems,
} from "@/features/content-engine/actions";
import { Input } from "@/shared/ui/input";
import { PendingFormButton } from "@/shared/ui/pending-form-button";
import { BuilderPagesList } from "@/features/builder/ui/builder-pages-list";
import {
    DashboardAppWorkbench,
    AppCommandBar,
} from "@/features/admin/ui/app-workbench";

const ALLOWED_STATUSES = new Set(["draft", "ready", "published"]);

function parseList(v: string | string[] | undefined): string[] {
    if (!v) return [];
    const raw = Array.isArray(v) ? v.join(",") : v;
    return raw.split(",").map((x) => x.trim()).filter(Boolean);
}
function parseInt10(v: string | string[] | undefined, fallback: number): number {
    const raw = Array.isArray(v) ? v[0] : v;
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

interface BuilderPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BuilderIndexPage({ searchParams }: BuilderPageProps) {
    await requireDashboardModuleAccess("builder");

    const params = await searchParams;
    const statuses = parseList(params.status).filter((s) => ALLOWED_STATUSES.has(s));
    const search = Array.isArray(params.q) ? params.q[0] : params.q;
    const page = Math.max(1, parseInt10(params.page, 1));
    const pageSize = Math.min(100, Math.max(5, parseInt10(params.pageSize, 25)));

    let listResult = await listBuilderPages({ statuses, search, page, pageSize });

    // Seed default pages on first load (empty list + no filters)
    if (
        !listResult.error &&
        listResult.total === 0 &&
        statuses.length === 0 &&
        !search
    ) {
        const seedResult = await seedCorePageContentItems();
        if (!seedResult.error) {
            listResult = await listBuilderPages({ statuses, search, page, pageSize });
        }
    }

    if (listResult.error) {
        throw new Error(listResult.error);
    }

    async function seedPagesAction() {
        "use server";

        await seedCorePageContentItems();
        await revalidateCorePagePaths();
        redirect("/dashboard/builder");
    }

    async function createPageAction(formData: FormData) {
        "use server";

        const title = String(formData.get("title") ?? "");
        const slug = String(formData.get("slug") ?? "");
        const pageIntent = String(formData.get("pageIntent") ?? "");
        const starterPreset = String(formData.get("starterPreset") ?? "");
        const result = await createBuilderPage({ title, slug, pageIntent, starterPreset });

        if (result.data?.id) {
            redirect(`/dashboard/builder/${result.data.id}`);
        }

        redirect("/dashboard/builder");
    }

    return (
        <DashboardAppWorkbench>
            <AppCommandBar>
                <div className="flex flex-1 flex-wrap items-center justify-between gap-4">
                    <div className="text-[17px] font-semibold text-foreground shrink-0">Page Builder</div>
                    <form action={createPageAction} className="flex flex-1 flex-wrap items-center gap-2 justify-end">
                        <Input name="title" placeholder="Page title" required className="h-8 min-w-0 max-w-[150px] text-[15px]" />
                        <Input name="slug" placeholder="page-slug" required className="h-8 min-w-0 max-w-[130px] text-[15px]" />
                        <select name="pageIntent" className="h-8 min-w-0 rounded-md border border-input bg-background px-2 text-[15px] text-foreground max-w-[140px] focus:outline-none">
                            <option value="service-page">Service page</option>
                            <option value="campaign-landing">Campaign landing</option>
                            <option value="sector-page">Sector page</option>
                            <option value="trust-proof">Trust / proof</option>
                            <option value="case-study">Case study</option>
                            <option value="quote-capture">Quote capture</option>
                            <option value="recruitment">Recruitment</option>
                            <option value="location-page">Location page</option>
                        </select>
                        <select name="starterPreset" className="h-8 min-w-0 rounded-md border border-input bg-background px-2 text-[15px] text-foreground max-w-[140px] focus:outline-none">
                            <option value="">Empty canvas</option>
                            <option value="trust-strip">Trust strip</option>
                            <option value="service-comparison">Service comparison</option>
                            <option value="why-choose-us">Why choose us</option>
                            <option value="operational-standards">Delivery model</option>
                            <option value="call-booking-cta">Booking CTA</option>
                            <option value="client-transparency">Client transparency</option>
                            <option value="facility-sector-showcase">Sector showcase</option>
                        </select>
                        <PendingFormButton
                            size="sm"
                            className="shrink-0 bg-[#002f58] text-white hover:bg-[#0a3d69] h-8 text-[15px]"
                            idleIcon={<Wand2 className="h-3.5 w-3.5" />}
                            pendingLabel="Creating…"
                        >
                            Create page
                        </PendingFormButton>
                    </form>
                </div>
            </AppCommandBar>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <BuilderPagesList
                    pages={listResult.data}
                    total={listResult.total}
                    page={listResult.page}
                    pageSize={listResult.pageSize}
                    statuses={statuses}
                    search={search ?? ""}
                    statusCounts={listResult.statusCounts}
                />

                {listResult.total === 0 && statuses.length === 0 && !search ? (
                    <div className="rounded-md border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
                        <p className="text-[17px] font-medium text-foreground">No pages yet</p>
                        <p className="mt-1 text-[15px] text-muted-foreground">Seed core pages to get started with the visual builder.</p>
                        <form action={seedPagesAction} className="mt-4">
                            <PendingFormButton
                                size="sm"
                                className="bg-[#002f58] text-white hover:bg-[#0a3d69]"
                                idleIcon={<PlusCircle className="h-4 w-4" />}
                                pendingLabel="Seeding…"
                            >
                                Seed core pages
                            </PendingFormButton>
                        </form>
                    </div>
                ) : null}
            </div>
        </DashboardAppWorkbench>
    );
}
