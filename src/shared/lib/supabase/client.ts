import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_COOKIE_NAME = 'sb-auth-token'

function getRequiredEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
    const value = process.env[name]?.trim();

    if (!value) {
        if (typeof window !== 'undefined') {
            console.warn(`Missing required Supabase environment variable: ${name}`)
            return ''
        }

        throw new Error(`Missing required Supabase environment variable: ${name}`);
    }

    return value;
}

export function createClient() {
    const url = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL')
    const key = getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

    if (!url || !key) {
        return createBrowserClient('https://placeholder.supabase.co', 'placeholder-key')
    }

    return createBrowserClient(
        url,
        key,
        {
            cookieOptions: {
                name: SUPABASE_COOKIE_NAME,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            },
        }
    )
}
