"use client";

import { useState } from "react";
import { AddClientForm } from "@/features/portal/ui/add-client-form";
import type { ProfileOption } from "@/features/portal/actions/facility-operations-actions";

interface AddClientButtonProps {
    profiles: ProfileOption[];
    variant?: "default" | "panel";
}

export function AddClientButton({ profiles, variant = "default" }: AddClientButtonProps) {
    const [open, setOpen] = useState(false);

    if (open) {
        return <AddClientForm profiles={profiles} onDone={() => setOpen(false)} />;
    }

    return (
        <button
            onClick={() => setOpen(true)}
            className={
                variant === "panel"
                    ? "inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                    : "inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors shadow-sm hover:bg-primary/90"
            }
        >
            <span className="text-base leading-none">+</span> Add Account
        </button>
    );
}
