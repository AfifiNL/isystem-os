import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PortalRenderer } from "@/features/templates/ui/PortalRenderer";
import { getPartnerPortalAccess } from "@/features/portal/actions/portal-access";
import { DEFAULT_LOCALE, LOCALE_HEADER_KEY, isSupportedLocale, localizeHref } from "@/shared/lib/i18n/routing";

export const metadata = {
    title: "Partner Dashboard | Workspace",
};

export default async function PortalDashboardPage() {
    const access = await getPartnerPortalAccess();

    if (!access) {
        const headerStore = await headers();
        const headerLocale = headerStore.get(LOCALE_HEADER_KEY);
        const locale = isSupportedLocale(headerLocale) ? headerLocale : DEFAULT_LOCALE;
        redirect(localizeHref(locale, "/portal/not-authorized"));
    }

    return <PortalRenderer access={access} />;
}
