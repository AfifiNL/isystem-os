'use server'

import { createClient } from '@/shared/lib/supabase/server'
import { buildSiteUrl } from '@/shared/lib/auth/redirect-url'
import { ACTIVE_WORKSPACE_COOKIE } from '@/shared/lib/workspace/context'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function getPasswordRecoveryRedirectTo() {
    return buildSiteUrl('/reset-password')
}

export async function login(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
}

export async function loginWithState(
    _prevState: { error: string | null; success: boolean },
    formData: FormData,
) {
    const result = await login(formData)
    return {
        error: result?.error ?? null,
        success: Boolean(result && 'success' in result && result.success),
    }
}

export async function signup(formData: FormData) {
    void formData
    return { error: 'Account creation is disabled. Ask an administrator to invite you from the dashboard.' }
}

export async function requestPasswordRecovery(formData: FormData) {
    const email = String(formData.get('email') ?? '').trim().toLowerCase()

    if (!email) {
        return { error: 'Email is required.' }
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getPasswordRecoveryRedirectTo(),
    })

    if (error) {
        return { error: error.message }
    }

    return {
        success: 'If an account exists for that email, a password reset link has been sent.',
    }
}

export async function updatePassword(formData: FormData) {
    const password = String(formData.get('password') ?? '')
    const confirmPassword = String(formData.get('confirmPassword') ?? '')

    if (password.length < 12) {
        return { error: 'Password must be at least 12 characters long.' }
    }

    if (password !== confirmPassword) {
        return { error: 'Passwords do not match.' }
    }

    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'You must be signed in to change your password.' }
    }

    const { error } = await supabase.auth.updateUser({
        password,
    })

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/', 'layout')

    return { success: 'Password updated successfully.' }
}

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    const cookieStore = await cookies()
    cookieStore.delete(ACTIVE_WORKSPACE_COOKIE)
    revalidatePath('/', 'layout')
    redirect('/')
}
