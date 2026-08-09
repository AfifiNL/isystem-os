import type { Metadata } from "next";
import { CheckCircle2, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
    title: "Unsubscribed",
    robots: { index: false, follow: false },
};

interface UnsubscribePageProps {
    searchParams: Promise<{ status?: string; message?: string }>;
}

export default async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
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
                                You&apos;re unsubscribed.
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                You will no longer receive newsletter emails. Changed your mind? Use the
                                subscribe form to opt back in any time.
                            </p>
                        </>
                    ) : (
                        <>
                            <AlertCircle className="mx-auto mb-4 h-10 w-10 text-amber-500" />
                            <h1 className="mb-3 text-2xl font-semibold tracking-tight text-foreground">
                                Could not unsubscribe.
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {params.message
                                    ? params.message
                                    : "The unsubscribe link is invalid or expired. Please contact us if you continue to receive emails."}
                            </p>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}
