import { headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_HEADER_KEY, getLocaleDirection, isSupportedLocale } from "@/shared/lib/i18n/routing";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
    const headerStore = await headers();
    const headerLocale = headerStore.get(LOCALE_HEADER_KEY);
    const locale = isSupportedLocale(headerLocale) ? headerLocale : DEFAULT_LOCALE;
    const dir = getLocaleDirection(locale);

    return (
        <main
            dir={dir}
            lang={locale}
            className="min-h-screen bg-slate-50 font-sans selection:bg-[#4A90E2] selection:text-white"
        >
            {children}
        </main>
    );
}
