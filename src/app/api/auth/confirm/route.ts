import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { stripLocaleFromPathname } from '@/shared/lib/i18n/routing'

// Allowlisted base paths (after stripping any locale prefix). Localized
// equivalents like /ar/portal also pass since we strip the locale before
// checking.
const SAFE_AUTH_REDIRECT_PATHS = new Set(['/dashboard', '/login', '/portal'])

function getSafeRedirectPath(next: string | null) {
    const candidate = next?.trim() || '/dashboard'

    if (!candidate.startsWith('/')) {
        return '/dashboard'
    }

    if (candidate.startsWith('//') || candidate.includes('\\')) {
        return '/dashboard'
    }

    try {
        const parsed = new URL(candidate, 'http://localhost')
        const normalized = parsed.pathname
        const stripped = stripLocaleFromPathname(normalized)

        if (!SAFE_AUTH_REDIRECT_PATHS.has(stripped)) {
            return '/dashboard'
        }

        return `${normalized}${parsed.search}${parsed.hash}`
    } catch {
        return '/dashboard'
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type') as EmailOtpType | null
    const next = getSafeRedirectPath(searchParams.get('next'))

    const redirectTo = request.nextUrl.clone()
    redirectTo.pathname = next
    redirectTo.searchParams.delete('token_hash')
    redirectTo.searchParams.delete('type')

    if (token_hash && type) {
        const supabase = await createClient()

        const { error } = await supabase.auth.verifyOtp({
            type,
            token_hash,
        })
        if (!error) {
            redirectTo.searchParams.delete('next')
            return NextResponse.redirect(redirectTo)
        }
    }

    // Return the user to an error page with some instructions
    redirectTo.pathname = '/login'
    redirectTo.searchParams.set('error', 'Auth token invalid or expired')
    return NextResponse.redirect(redirectTo)
}
