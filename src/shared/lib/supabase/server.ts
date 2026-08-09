import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_COOKIE_NAME = 'sb-auth-token'

function getRequiredEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(`Missing required Supabase environment variable: ${name}`);
    }

    return value;
}

export async function createClient() {
    const cookieStore = await cookies()

    return createServerClient(
        getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
        getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
        {
            cookieOptions: {
                name: SUPABASE_COOKIE_NAME,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            },
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                async setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options)
                    })
                },
            },
        }
    )
}
