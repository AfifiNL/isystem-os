import type { Metadata } from "next";
import { CheckCircle2, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
    title: "Subscription confirmed",
    robots: { index: false, follow: false },
};

interface ConfirmPageProps {
    searchParams: Promise<{ status?: string; message?: string }>;
}

export default async function ConfirmPage({ searchParams }: ConfirmPageProps) {
    const params = await searchParams;
    const ok = params.status !== "error";

    return (
        <section className="py-20 md:py-28">
            <div className="container mx-auto max-w-xl px-4 md:px-6">
                <div className="rounded-2xl border border-border/60 bg-card p-10 text-center shadow-sm">
                    {ok ? (
                        <>
                            <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-emerald-500" />
                            <h1 className="mb-3 text-2xl font-semibold tracking-tight text-foreground">
                                You&apos;re confirmed.
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Thanks — you&apos;ll start receiving the newsletter shortly. You can unsubscribe
                                from the footer of any email.
                            </p>
                        </>
                    ) : (
                        <>
                            <AlertCircle className="mx-auto mb-4 h-10 w-10 text-amber-500" />
                            <h1 className="mb-3 text-2xl font-semibold tracking-tight text-foreground">
                                Could not confirm.
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {params.message ?? "The confirmation link is invalid or expired. Try subscribing again."}
                            </p>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}
