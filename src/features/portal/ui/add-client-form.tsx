"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
    createPortalClient,
    type ProfileOption,
} from "@/features/portal/actions/facility-operations-actions";

interface AddClientFormProps {
    profiles: ProfileOption[];
    onDone: () => void;
}

export function AddClientForm({ profiles, onDone }: AddClientFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [companyName, setCompanyName] = useState("");
    const [profileId, setProfileId] = useState<string>("");
    const [error, setError] = useState<string | null>(null);

    function submit() {
        if (!companyName.trim()) return;
        setError(null);
        startTransition(async () => {
            const { error: err } = await createPortalClient(
                companyName,
                profileId || null
            );
            if (err) {
                setError(err);
                return;
            }
            router.refresh();
            onDone();
        });
    }

    return (
        <div className="rounded-xl border bg-card shadow-sm p-6 space-y-5">
            <div>
                <h2 className="font-semibold text-base">New Client Account</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Create a client workspace account, choose the right engagement owner,
                    and prepare the account for SLA templates, delivery tracking, and portal access.
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                {/* Company name */}
                <div>
                    <label
                        htmlFor="company-name"
                        className="block text-xs font-medium text-muted-foreground mb-1"
                    >
                        Client or organization name *
                    </label>
                    <input
                        id="company-name"
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g. Van Dijk Legal, Horizon Education, Northline Realty"
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                </div>

                {/* Profile link */}
                <div>
                    <label
                        htmlFor="profile-select"
                        className="block text-xs font-medium text-muted-foreground mb-1"
                    >
                        Link client owner account{" "}
                        <span className="font-normal">(optional)</span>
                    </label>
                    <select
                        id="profile-select"
                        value={profileId}
                        onChange={(e) => setProfileId(e.target.value)}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <option value="">— No account linked yet —</option>
                        {profiles.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.email}{" "}
                                {p.role !== "user" ? `(${p.role})` : ""}
                            </option>
                        ))}
                    </select>
                    <p className="mt-1 text-xs text-muted-foreground">
                        You can link or reassign the account later from the client console or SLA workspace.
                    </p>
                </div>
            </div>

            {error && (
                <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-2">
                <button
                    onClick={submit}
                    disabled={isPending || !companyName.trim()}
                    aria-busy={isPending || undefined}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isPending ? "Creating…" : "Create Account"}
                </button>
                <button
                    onClick={onDone}
                    disabled={isPending}
                    className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
