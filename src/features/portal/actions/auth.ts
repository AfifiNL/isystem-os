"use server";

import { createClient } from "@/shared/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSupportedLocale, localizeHref, DEFAULT_LOCALE } from "@/shared/lib/i18n/routing";

const PORTAL_ACCESS_ERROR = "This account does not have active Partner Portal access. Contact your workspace administrator or delivery lead to provision access.";

export async function portalLogin(formData: FormData) {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const localeRaw = formData.get("locale");
    const locale = isSupportedLocale(typeof localeRaw === "string" ? localeRaw : null)
        ? (localeRaw as string)
        : DEFAULT_LOCALE;
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error || !data.user) {
        return { error: error?.message ?? "Invalid credentials." };
    }

    const { data: portalMembership } = await supabase
        .from("client_portal_users")
        .select("id")
        .eq("profile_id", data.user.id)
        .limit(1)
        .maybeSingle();

    if (!portalMembership) {
        await supabase.auth.signOut();
        return { error: PORTAL_ACCESS_ERROR };
    }

    revalidatePath("/", "layout");
    redirect(localizeHref(locale as "en" | "nl" | "ar", "/portal/dashboard"));
}
