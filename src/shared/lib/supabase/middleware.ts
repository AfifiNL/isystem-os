import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getLocaleFromPathname, localizeHref, stripLocaleFromPathname } from '@/shared/lib/i18n/routing'

const SUPABASE_COOKIE_NAME = 'sb-auth-token'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookieOptions: {
                name: SUPABASE_COOKIE_NAME,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            },
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname
    const localePrefix = getLocaleFromPathname(pathname)
    const strippedPath = stripLocaleFromPathname(pathname)
    const isLoginPath = strippedPath === '/login'

    if (user && isLoginPath) {
        return supabaseResponse
    }

    if (!user && isLoginPath) {
        return supabaseResponse
    }

    if (!user) {
        if (strippedPath.startsWith('/dashboard')) {
            const url = request.nextUrl.clone()
            // /dashboard is admin-only and stays unlocalized.
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }

        if (strippedPath.startsWith('/portal/dashboard')) {
            const url = request.nextUrl.clone()
            url.pathname = localePrefix ? localizeHref(localePrefix, '/portal/login') : '/portal/login'
            return NextResponse.redirect(url)
        }
    }

    // Direct /portal to the guarded dashboard, preserving any locale prefix.
    if (strippedPath === '/portal') {
        const url = request.nextUrl.clone()
        url.pathname = localePrefix ? localizeHref(localePrefix, '/portal/dashboard') : '/portal/dashboard'
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}
