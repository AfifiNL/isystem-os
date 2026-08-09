"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/client";

export function AuthListener() {
    const router = useRouter();

    useEffect(() => {
        if (typeof window !== "undefined") {
            const currentPath = window.location.pathname;
            const hasRecoveryHash = window.location.hash.includes("type=invite") || window.location.hash.includes("type=recovery");

            if (!hasRecoveryHash && !currentPath.startsWith("/reset-password")) {
                return;
            }
        }

        const supabase = createClient();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event) => {
            if (event === "SIGNED_IN") {
                // If we land via an implicit flow hash fragment for an invite or recovery
                if (window.location.hash.includes("type=invite") || window.location.hash.includes("type=recovery")) {
                    // Give cookies a moment to persist
                    setTimeout(() => {
                        router.push("/reset-password?mode=recovery");
                    }, 500);
                }
            }
        });

        // Some browsers may process the hash before the listener attaches, so check immediately
        const hash = window.location.hash;
        if (hash && (hash.includes("type=invite") || hash.includes("type=recovery"))) {
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (session) {
                    router.push("/reset-password?mode=recovery");
                }
            });
        }

        return () => {
            subscription.unsubscribe();
        };
    }, [router]);

    return null;
}
