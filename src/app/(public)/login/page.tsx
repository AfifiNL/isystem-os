import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/ui/login-form";
import { getActiveTemplate } from "@/features/templates/actions";
import { buildSecondaryPageMetadata } from "@/features/templates/metadata";

const LOGIN_COPY: Record<"en" | "nl" | "ar", { title: string; description: string }> = {
    en: { title: "Sign in", description: "Sign in to your workspace." },
    nl: { title: "Inloggen", description: "Log in op je werkruimte." },
    ar: { title: "تسجيل الدخول", description: "سجّل الدخول إلى مساحة العمل." },
};

export async function generateMetadata(): Promise<Metadata> {
    const { config, locale, settings } = await getActiveTemplate();
    const supported = locale === "nl" || locale === "ar" ? locale : "en";
    const copy = LOGIN_COPY[supported];
    return buildSecondaryPageMetadata({
        path: "/login",
        title: copy.title,
        description: copy.description,
        locale,
        siteName: settings.siteName,
        siteDomain: settings.siteDomain,
        config,
        noIndex: true,
    });
}

export default function LoginPage() {
    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))] bg-muted/40 px-4">
            <div className="w-full max-w-sm">
                <LoginForm />
            </div>
        </div>
    );
}
