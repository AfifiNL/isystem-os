import { ReactNode, Suspense } from "react";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { getActiveTemplate } from "@/features/templates/actions";
import { getPageContentItemBySlug } from "@/features/content-engine/actions";
import { isPublicBuilderData, normalizePublicBuilderData } from "@/features/builder/puck.config";
import { TemplateProvider } from "@/features/templates/template-provider";
import { buildPublicTemplateConfig } from "@/features/templates/public-template-payload";
import { TemplateNavbar } from "@/features/templates/ui/template-navbar";
import { TemplateFooter } from "@/features/templates/ui/template-footer";
import { PublicAnalyticsTracker } from "@/features/analytics/ui/public-analytics-tracker";
import { PopupHost } from "@/features/popups/ui/popup-host";
import { resolveActivePopupForRequest } from "@/features/popups/actions";
import { ArabesqueBackground } from "@/features/templates/ui/arabesque-background";
import { BfcacheGuard } from "@/features/templates/ui/bfcache-guard";
import { PATHNAME_HEADER_KEY, stripLocaleFromPathname } from "@/shared/lib/i18n/routing";
import { localizeHref } from "@/shared/lib/i18n/routing";
import { resolvePublicPageDefinition } from "@/features/public-site/public-page-contract";
import { CookieConsentBanner } from "@/features/gdpr/ui/cookie-consent-banner";
import { getPublicGdprFlags } from "@/features/gdpr/public";

export default async function PublicLayout({ children }: { children: ReactNode }) {
    const { config, locale, settings } = await getActiveTemplate();
    const headerStore = await headers();
    const cookieStore = await cookies();
    const pathname = headerStore.get(PATHNAME_HEADER_KEY) ?? cookieStore.get("site-pathname")?.value ?? "/";
    const publicPathname = stripLocaleFromPathname(pathname);
    const routeDefinition = resolvePublicPageDefinition(publicPathname);
    const chromeMode = config.id === "isystem-agency" ? routeDefinition?.chromeMode ?? "default" : "default";
    const showFullChrome = chromeMode === "default";
    const showMinimalChrome = chromeMode === "minimal";

    const normalizedPath = publicPathname === "/" ? "home" : publicPathname.replace(/^\//, "").split("/")[0] ?? "";
    const shouldResolveChromeOverrides = normalizedPath === "home" || normalizedPath === "about" || normalizedPath === "services" || normalizedPath === "contact" || Boolean(normalizedPath);
    const pageEntry = shouldResolveChromeOverrides ? (await getPageContentItemBySlug(normalizedPath)).data : null;
    const normalizedVisualLayout = pageEntry && isPublicBuilderData(pageEntry.visual_layout)
        ? normalizePublicBuilderData(
            pageEntry.visual_layout,
            typeof pageEntry.metadata?.page_kind === "string" ? pageEntry.metadata.page_kind : undefined,
        )
        : null;
    const chromeOverrides = normalizedVisualLayout
        ? ((normalizedVisualLayout.root?.props?.metadata ?? null) as typeof settings.siteChrome extends never ? never : Record<string, unknown> | null)
        : null;

    // Resolve at most one popup for this request. Cached at 60s per
    // (workspace, locale, path); admin edits invalidate via revalidateTag.
    const popupForRequest = pageEntry?.workspace_id
        ? await resolveActivePopupForRequest({
            workspaceId: pageEntry.workspace_id,
            locale,
            localeStrippedPath: publicPathname,
        })
        : null;

    const gdprFlags = await getPublicGdprFlags(pageEntry?.workspace_id ?? null);
    const shouldShowConsentBanner = gdprFlags.consentRequired && gdprFlags.consentMode === "banner";

    const clientConfig = buildPublicTemplateConfig(config);

    return (
        <TemplateProvider
            config={clientConfig}
            locale={locale}
            siteName={settings.siteName}
            siteDescription={settings.siteDescription}
            siteChrome={settings.siteChrome!}
            supportedLocales={settings.supportedLocales}
            chromeOverrides={chromeOverrides as never}
        >
            <div className="relative flex min-h-screen flex-col [background:var(--template-surface-canvas)]">
                <BfcacheGuard />
                {config.id !== "isystem-agency" ? (
                    <Suspense fallback={null}>
                        <ArabesqueBackground />
                    </Suspense>
                ) : null}
                <PublicAnalyticsTracker
                    workspaceId={pageEntry?.workspace_id ?? null}
                    consentRequired={gdprFlags.consentRequired}
                />
                {showFullChrome ? (
                    <PopupHost
                        popup={popupForRequest}
                        workspaceId={pageEntry?.workspace_id ?? null}
                        locale={locale}
                        path={publicPathname}
                        consentRequired={gdprFlags.consentRequired}
                    />
                ) : null}
                {showFullChrome ? <TemplateNavbar /> : showMinimalChrome ? (
                    <header className="relative z-20 flex h-16 items-center border-b border-[var(--public-line)] bg-[var(--public-paper)]">
                        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 md:px-8">
                            <Link href={localizeHref(locale, "/")} className="text-sm font-semibold tracking-tight text-[var(--public-ink)]">
                                {settings.siteName}
                            </Link>
                            <Link href={localizeHref(locale, "/booking")} className="text-sm font-semibold text-[var(--public-action-strong)] underline">
                                {locale === "nl" ? "Terug naar boeken" : locale === "ar" ? "العودة إلى الحجز" : "Back to booking"}
                            </Link>
                        </div>
                    </header>
                ) : null}
                <main className={`relative z-10 flex-1 ${showFullChrome || showMinimalChrome ? "pt-16" : "pt-0"}`}>{children}</main>
                {showFullChrome ? <div className="relative z-10"><TemplateFooter /></div> : null}
                {shouldShowConsentBanner && showFullChrome && (
                    <CookieConsentBanner
                        locale={locale}
                        privacyHref={gdprFlags.privacyUrl ?? "/privacy"}
                        termsHref={gdprFlags.termsUrl ?? "/terms"}
                    />
                )}
            </div>
        </TemplateProvider>
    );
}
