import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/shared/lib/supabase/middleware'
import { LOCALE_COOKIE_KEY, LOCALE_PREF_COOKIE_KEY } from '@/shared/lib/i18n/cookies'
import {
    DEFAULT_LOCALE,
    LOCALE_HEADER_KEY,
    PATHNAME_HEADER_KEY,
    getLocaleFromPathname,
    isNonLocalizedPath,
    isSupportedLocale,
    resolveLocaleFromRequest,
    shouldLocalizePath,
    stripLocaleFromPathname,
} from '@/shared/lib/i18n/routing'
import { isBlogPath } from '@/features/blog/urls'
import { resolveLegacyIndexingRedirect } from '@/features/seo/indexing/legacy-redirects'

const PATHNAME_COOKIE_KEY = 'site-pathname'
const COOKIE_SECURE = process.env.NODE_ENV === 'production'
const LOCALE_COOKIE_OPTIONS = {
    path: '/',
    sameSite: 'lax' as const,
    secure: COOKIE_SECURE,
}
const PERSISTENT_LOCALE_COOKIE_OPTIONS = {
    ...LOCALE_COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 365,
}

function copyCookies(source: NextResponse, target: NextResponse) {
    source.cookies.getAll().forEach((cookie) => {
        target.cookies.set(cookie)
    })
}

function withLocaleState(
    source: NextResponse,
    target: NextResponse,
    locale: string,
    pathname: string,
    options?: { syncPref?: boolean },
) {
    copyCookies(source, target)

    target.cookies.set(PATHNAME_COOKIE_KEY, pathname, {
        ...LOCALE_COOKIE_OPTIONS,
    })

    target.cookies.set(LOCALE_COOKIE_KEY, locale, {
        ...PERSISTENT_LOCALE_COOKIE_OPTIONS,
    })

    // When the visitor lands on an explicit /{locale}/... URL whose locale
    // differs from their stale sticky preference, update the pref so the
    // next locale-less visit doesn't bounce them back.
    if (options?.syncPref) {
        target.cookies.set(LOCALE_PREF_COOKIE_KEY, locale, {
            ...PERSISTENT_LOCALE_COOKIE_OPTIONS,
        })
    }

    return target
}

function buildRequestHeaders(request: NextRequest, locale: string, pathname: string) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set(LOCALE_HEADER_KEY, locale)
    requestHeaders.set(PATHNAME_HEADER_KEY, pathname)
    return requestHeaders
}

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname
    const legacyRedirectPath = resolveLegacyIndexingRedirect({
        pathname,
        search: request.nextUrl.search,
        hash: request.nextUrl.hash,
    })
    if (legacyRedirectPath) {
        const redirectUrl = request.nextUrl.clone()
        const [pathAndSearch, hash = ""] = legacyRedirectPath.split("#")
        const [path, search = ""] = pathAndSearch.split("?")
        redirectUrl.pathname = path
        redirectUrl.search = search ? `?${search}` : ""
        redirectUrl.hash = hash ? `#${hash}` : ""
        return NextResponse.redirect(redirectUrl, 308)
    }

    const localeFromPath = getLocaleFromPathname(pathname)
    const strippedPath = stripLocaleFromPathname(pathname)

    if (localeFromPath && isNonLocalizedPath(strippedPath)) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = strippedPath
        const redirectResponse = NextResponse.redirect(redirectUrl)

        redirectResponse.cookies.set(LOCALE_COOKIE_KEY, localeFromPath, {
            ...PERSISTENT_LOCALE_COOKIE_OPTIONS,
        })

        return redirectResponse
    }

    // Path-locale is the source of truth. When the visitor explicitly requests
    // /{locale}/..., we honor it AND update the sticky preference cookie so
    // future locale-less visits land on the same locale. The previous design
    // forced sticky pref to override path locale, which broke for any user
    // whose pref cookie was set before a new locale (e.g. ar) was introduced —
    // they'd be redirected away from /ar back to their stale en pref. Now the
    // user is always free to "switch by URL" and the pref follows.
    const prefLocale = request.cookies.get(LOCALE_PREF_COOKIE_KEY)?.value
    const prefMismatch = Boolean(
        localeFromPath
        && isSupportedLocale(prefLocale)
        && prefLocale !== localeFromPath
        && shouldLocalizePath(pathname)
    )

    const sessionResponse = await updateSession(request)

    if (sessionResponse.headers.has('location')) {
        if (localeFromPath) {
            sessionResponse.cookies.set(LOCALE_COOKIE_KEY, localeFromPath, {
                ...PERSISTENT_LOCALE_COOKIE_OPTIONS,
            })
        }

        return sessionResponse
    }

    if (localeFromPath === DEFAULT_LOCALE && isBlogPath(strippedPath)) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = strippedPath

        return withLocaleState(
            sessionResponse,
            NextResponse.redirect(redirectUrl, 308),
            DEFAULT_LOCALE,
            strippedPath,
            { syncPref: prefMismatch },
        )
    }

    const locale = !localeFromPath && isBlogPath(pathname)
        ? DEFAULT_LOCALE
        : resolveLocaleFromRequest({
            pathname,
            cookieLocale: request.cookies.get(LOCALE_COOKIE_KEY)?.value,
            acceptLanguage: request.headers.get('accept-language'),
            defaultLocale: DEFAULT_LOCALE,
        })

    if (!localeFromPath && shouldLocalizePath(pathname) && !isBlogPath(pathname)) {
        const redirectUrl = request.nextUrl.clone()
        const redirectLocale = locale
        redirectUrl.pathname = pathname === '/' ? `/${redirectLocale}` : `/${redirectLocale}${pathname}`

        return withLocaleState(
            sessionResponse,
            NextResponse.redirect(redirectUrl, 307),
            redirectLocale,
            redirectUrl.pathname,
        )
    }

    const requestHeaders = buildRequestHeaders(request, locale, pathname)

    if (localeFromPath && shouldLocalizePath(pathname)) {
        const rewriteUrl = request.nextUrl.clone()
        rewriteUrl.pathname = strippedPath

        return withLocaleState(
            sessionResponse,
            NextResponse.rewrite(rewriteUrl, {
                request: {
                    headers: requestHeaders,
                },
            }),
            locale,
            pathname,
            { syncPref: prefMismatch },
        )
    }

    return withLocaleState(
        sessionResponse,
        NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        }),
        locale,
        pathname,
    )
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|llms.txt|llms-full.txt|robots.txt|sitemap.xml|.*\\.(?:avif|css|csv|gif|ico|jpe?g|js|json|map|mp3|mp4|pdf|png|svg|txt|webm|webp|xml|zip)$).*)',
    ],
}
