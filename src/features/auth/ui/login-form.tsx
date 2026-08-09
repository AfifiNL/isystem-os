'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { loginWithState } from '@/features/auth/actions'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'

export function LoginForm() {
    const [state, formAction, isPending] = useActionState(loginWithState, { error: null as string | null, success: false })

    return (
        <Card className="mx-auto max-w-sm">
            <CardHeader>
                <CardTitle className="text-2xl">Login</CardTitle>
                <CardDescription>
                    Enter your email below to login to your account
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form
                    id="auth-form"
                    className="grid gap-4"
                    action={formAction}
                >
                    {state?.error && <div className="text-sm text-red-500 font-medium">{state.error}</div>}
                    <div className="grid gap-2">
                        <label htmlFor="email">Email</label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="m@example.com"
                            required
                        />
                    </div>
                    <div className="grid gap-2">
                        <div className="flex items-center">
                            <label htmlFor="password">Password</label>
                        </div>
                        <Input id="password" name="password" type="password" required />
                        <Link href="/reset-password" className="text-xs font-medium text-primary hover:underline">
                            Forgot password?
                        </Link>
                    </div>
                </form>
            </CardContent>
            <CardFooter className="flex-col gap-2">
                <Button
                    type="submit"
                    form="auth-form"
                    className="w-full"
                    disabled={isPending}
                >
                    {isPending ? 'Logging in...' : 'Sign in'}
                </Button>
            </CardFooter>
        </Card>
    )
}
