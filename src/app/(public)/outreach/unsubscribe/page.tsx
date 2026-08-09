import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Outreach preferences",
    description: "Manage direct outreach preferences.",
    robots: {
        index: false,
        follow: false,
    },
};

type PageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function single(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

export default async function OutreachUnsubscribePage({ searchParams }: PageProps) {
    const params = await searchParams;
    const message = single(params.message) ?? "";
    const token = single(params.token) ?? "";

    return (
        <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-100">
            <section className="mx-auto max-w-xl rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-2xl">
                <h1 className="text-2xl font-semibold tracking-tight">Outreach preferences</h1>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                    Confirm that you no longer want to receive direct outreach from this workspace.
                </p>
                <form action="/api/outreach/unsubscribe" method="post" className="mt-6 space-y-4">
                    <input type="hidden" name="message" value={message} />
                    <input type="hidden" name="token" value={token} />
                    <button className="inline-flex h-10 items-center justify-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-200">
                        Unsubscribe
                    </button>
                </form>
            </section>
        </main>
    );
}
