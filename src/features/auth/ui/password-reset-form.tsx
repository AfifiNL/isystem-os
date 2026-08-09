'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { requestPasswordRecovery, updatePassword } from '@/features/auth/actions'
import { createClient } from '@/shared/lib/supabase/client'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'

type PasswordResetMode = 'request' | 'recovery' | 'change'

function getBaseMode(mode: string | null): PasswordResetMode {
    if (mode === 'recovery' || mode === 'change') {
        return mode
    }

    return 'request'
}

export function PasswordResetForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const requestedMode = getBaseMode(searchParams.get('mode'))
    const [mode, setMode] = useState<PasswordResetMode>(requestedMode)
    const [email, setEmail] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        const supabase = createClient()

        supabase.auth.getSession().then(({ data: { session } }) => {
            const hash = window.location.hash
            const hasRecoveryFlow = hash.includes('type=invite') || hash.includes('type=recovery')

            if (hasRecoveryFlow) {
                setMode('recovery')
                return
            }

            if (requestedMode === 'change' && session?.user) {
                setMode('change')
                return
            }

            if (requestedMode === 'recovery' && session?.user) {
                setMode('recovery')
                return
            }

            setMode('request')
        })
    }, [requestedMode])

    const pageCopy = useMemo(() => {
        if (mode === 'change') {
            return {
                title: 'Change password',
                description: 'Update your account password and use a strong password you do not reuse elsewhere.',
                button: 'Update password',
            }
        }

        if (mode === 'recovery') {
            return {
                title: 'Set your password',
                description: 'Choose a secure password to finish your invite or password recovery flow.',
                button: 'Save new password',
            }
        }

        return {
            title: 'Reset your password',
            description: 'Enter your email address and we will send you a secure password reset link.',
            button: 'Send reset link',
        }
    }, [mode])

    const handleRequestReset = async (formData: FormData) => {
        setError(null)
        setSuccess(null)

        startTransition(async () => {
            const result = await requestPasswordRecovery(formData)

            if (result?.error) {
                setError(result.error)
                return
            }

            setSuccess(result?.success ?? 'Password reset email sent.')
        })
    }

    const handlePasswordUpdate = async (formData: FormData) => {
        setError(null)
        setSuccess(null)

        startTransition(async () => {
            const result = await updatePassword(formData)

            if (result?.error) {
                setError(result.error)
                return
            }

            setSuccess(result?.success ?? 'Password updated successfully.')
            window.location.hash = ''

            setTimeout(() => {
                router.push('/dashboard/settings')
                router.refresh()
            }, 800)
        })
    }

    return (
        <Card className="mx-auto w-full max-w-md">
            <CardHeader>
                <CardTitle className="text-2xl">{pageCopy.title}</CardTitle>
                <CardDescription>{pageCopy.description}</CardDescription>
            </CardHeader>
            <CardContent>
                {error && <div className="mb-4 text-sm font-medium text-red-500">{error}</div>}
                {success && <div className="mb-4 text-sm font-medium text-emerald-600">{success}</div>}

                {mode === 'request' ? (
                    <form id="password-reset-request-form" className="grid gap-4" action={handleRequestReset}>
                        <div className="grid gap-2">
                            <label htmlFor="recovery-email">Email</label>
                            <Input
                                id="recovery-email"
                                name="email"
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="name@company.com"
                                required
                            />
                        </div>
                    </form>
                ) : (
                    <form id="password-update-form" className="grid gap-4" action={handlePasswordUpdate}>
                        <div className="grid gap-2">
                            <label htmlFor="password">New password</label>
                            <Input id="password" name="password" type="password" minLength={12} required />
                            <p className="text-xs text-muted-foreground">Use at least 12 characters with a mix of words, numbers, and symbols.</p>
                        </div>
                        <div className="grid gap-2">
                            <label htmlFor="confirmPassword">Confirm new password</label>
                            <Input id="confirmPassword" name="confirmPassword" type="password" minLength={12} required />
                        </div>
                    </form>
                )}
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-3">
                <Button
                    type="submit"
                    form={mode === 'request' ? 'password-reset-request-form' : 'password-update-form'}
                    disabled={isPending}
                    className="w-full"
                >
                    {isPending ? 'Processing...' : pageCopy.button}
                </Button>

                <Link href="/login" className="text-center text-sm font-medium text-primary hover:underline">
                    Back to login
                </Link>
            </CardFooter>
        </Card>
    )
}
