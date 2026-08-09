import type { Metadata } from "next";

import { getCustomerBookingManagementView } from "@/features/booking/actions/customer-management";
import { CustomerBookingManager } from "@/features/booking/ui/customer-booking-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Manage booking",
    robots: {
        index: false,
        follow: false,
        noarchive: true,
    },
    referrer: "no-referrer",
};

function first(value: string | string[] | undefined): string {
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function CustomerBookingManagementPage({
    searchParams,
}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = (await searchParams) ?? {};
    const token = first(params.token);
    const view = token ? await getCustomerBookingManagementView(token) : null;

    if (!view) {
        return (
            <main className="min-h-screen bg-slate-950 px-5 py-20 text-slate-100">
                <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Secure booking management</p>
                    <h1 className="mt-3 text-2xl font-semibold">This link is invalid or expired.</h1>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                        Reply to your latest booking email so the team can help without exposing reservation details.
                    </p>
                </div>
            </main>
        );
    }

    return <CustomerBookingManager token={token} view={view} />;
}
